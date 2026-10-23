import type { Career, Player, RetiredPlayer, StaffRole } from '../types';
import { Rng, clamp, seedFrom } from '../core/rng';
import { A, ovrToLevel } from './attributes';
import { traitEffects } from './traits';
import { addDecision, addNews } from '../news/news';
import { removeFromClub } from '../market/roster';
import { ROLE_NAME } from '../infra/infra';

/** Probabilidade de encerrar a carreira ao fim da temporada (não há idade fixa). */
export function retirementChance(c: Career, p: Player): number {
  const age = c.season - p.birthYear;
  const shift = c.config.progression.retirementAgeShift + (p.pos === 'GK' ? 2 : 0);
  if (p.farewell) return 1;
  if (age < 31 + shift) return 0;
  const lvl = ovrToLevel(p.ovr);
  let x = (age - (35.5 + shift)) * 0.9;
  x -= (lvl - 10) * 0.08; // jogadores de alto nível duram mais
  if (!p.clubId) x += 1.2; // sem clube
  if (p.contract && p.contract.endYear > c.season) x -= 1.3; // contrato em vigor
  const bigInjuries = p.injuries.filter((i) => i.days > 60).length;
  x += bigInjuries * 0.35;
  if (p.condition < 50) x += 0.3;
  const te = traitEffects(p.traits);
  if (p.traits.includes('profissional')) x -= 0.4;
  x -= te.loyalty * 0.2;
  return clamp(1 / (1 + Math.exp(-x)), 0, 0.98);
}

export function careerTotals(p: Player): { apps: number; goals: number; assists: number } {
  let apps = 0, goals = 0, assists = 0;
  for (const h of p.history) {
    apps += h.apps;
    goals += h.goals;
    assists += h.assists;
  }
  return { apps, goals, assists };
}

const TRANSITION: StaffRole[] = ['coach', 'youthCoach', 'fitness', 'scout', 'gkCoach'];

/** Executa a aposentadoria preservando o histórico completo no banco do universo. */
export function retirePlayer(c: Career, p: Player, rng: Rng): RetiredPlayer {
  const club = p.clubId ? c.clubs[p.clubId] : null;
  const totals = careerTotals(p);
  const peak = Math.max(ovrToLevel(p.ovr), ...p.history.map((h) => h.level));
  const r: RetiredPlayer = {
    id: p.id, name: p.name, nat: p.nat, pos: p.pos, birthYear: p.birthYear, retiredSeason: c.season, lastClub: club?.name ?? 'Sem clube',
    peakLevel: Math.round(peak), history: p.history, achievements: p.achievements, apps: totals.apps, goals: totals.goals, appearance: p.appearance, origin: p.origin,
  };
  // transição para a comissão técnica (opcional, não garantida)
  const lead = p.attrs[A.lea] / 100;
  const exp = p.experience / 100;
  const chance = clamp(0.08 + lead * 0.35 + exp * 0.2 + (p.futureRole ? 0.4 : 0), 0, 0.9);
  if (rng.chance(chance)) {
    const role = p.futureRole ?? (p.pos === 'GK' ? 'gkCoach' : rng.pick(TRANSITION));
    const id = `s${c.nextId++}`;
    const ability = clamp(Math.round(4 + lead * 8 + exp * 5 + rng.range(-2, 2)), 1, 18);
    c.staff[id] = { id, name: p.name, nat: p.nat, age: c.season - p.birthYear, role, ability, specialty: 'ex-jogador', wage: Math.round((12_000 + Math.pow(ability, 2.3) * 850) / 1000) * 1000, clubId: null, exPlayerId: p.id, reputation: clamp(Math.round(peak * 3), 1, 100) };
    r.newRole = ROLE_NAME[role];
    if (club && club.id === c.userClubId) {
      addDecision(c, {
        kind: 'staffOffer', title: `${p.name} aceita trabalhar na comissão técnica`, playerId: p.id, clubId: club.id,
        text: `Recém-aposentado, ${p.name} topa iniciar uma nova trajetória como ${ROLE_NAME[role].toLowerCase()} (nível ${ability}/20). Deseja contratá-lo?`,
        data: { staffId: id }, options: [{ id: 'hire', label: 'Contratar' }, { id: 'decline', label: 'Agradecer e recusar' }],
      });
    }
  }
  if (club) removeFromClub(c, p);
  delete c.players[p.id];
  c.retired[p.id] = r;
  c.shortlist = c.shortlist.filter((x) => x !== p.id);
  const titles = p.achievements.filter((a) => a.kind === 'title').length;
  const notable = peak >= 17 || titles >= 3 || (club && club.id === c.userClubId) || p.origin === 'creator';
  if (notable) {
    addNews(c, {
      kind: 'retire', icon: 'retire', title: `${p.name} anuncia aposentadoria`,
      body: `Aos ${c.season - p.birthYear} anos, ${p.name} encerra a carreira${club ? ` no ${club.name}` : ''}. Números: ${totals.apps} jogos, ${totals.goals} gols, ${totals.assists} assistências e ${titles} título(s).${r.newRole ? ` Seguirá no futebol como ${r.newRole.toLowerCase()}.` : ''}`,
      clubIds: club ? [club.id] : [], playerIds: [p.id], important: peak >= 20 || p.origin === 'creator', link: { screen: 'player', id: p.id },
    });
  }
  return r;
}

export function processRetirements(c: Career): RetiredPlayer[] {
  const rng = new Rng(seedFrom(c.id, 'retire', c.season));
  const out: RetiredPlayer[] = [];
  for (const p of Object.values(c.players)) {
    if (p.squad === 'youth') continue;
    if (rng.chance(retirementChance(c, p))) out.push(retirePlayer(c, p, rng));
  }
  return out;
}
