import { archivePlayer, archiveSeason } from '../players/stats';
import type { Career, CompTemplate, SeasonSummary } from '../types';
import { Rng, clamp, seedFrom } from '../core/rng';
import { type Day, mmdd } from '../core/date';
import { compKey, createCompetition, koRounds, leagueTable, resolveParticipants } from '../competitions/manager';
import { cupDates } from '../calendar/plan';
import { applyPromotionRelegation } from '../competitions/promotion';
import { computeQualification } from '../competitions/qualification';
import { seasonBoardReview, setObjectives } from '../board/board';
import { addNews } from '../news/news';
import { processRetirements } from '../players/retirement';
import { aiSquadMaintenance, expireContracts, returnFromLoan } from '../market/transfers';
import { closeSpell } from '../market/roster';
import { ovrToLevel } from '../players/attributes';
import { updateRecords } from '../awards/awards';
import { currentCollection } from '../kits/commerce';
import { defaultKitCollection } from '../kits/kits';
import { assignRoles } from '../universe/world';
import { resetIndex } from './index';
import { findClashes } from '../calendar/resolve';
import { seedUserStaff } from './staffSeed';

const ORDER: Record<string, number> = { league: 0, cup: 1, state: 2, super: 3, continental: 4 };

/** Monta todas as competições da temporada (ligas primeiro; copas e continentais depois, com remarcação). */
export function buildSeason(c: Career, year: number): string[] {
  const warnings: string[] = [];
  const reserved = new Set<Day>();
  const enabledCountries = new Set(c.config.countries.filter((x) => x.enabled).map((x) => x.code));
  const tpls = Object.values(c.config.competitions).filter((t) => t.enabled && (t.region === 'SA' || t.region === 'EU' || enabledCountries.has(t.country ?? t.region)));
  // reserva as quartas-feiras das copas antes de distribuir as rodadas das ligas
  for (const t of tpls.filter((x) => x.kind === 'cup')) {
    const { ids } = resolveParticipants(c, t, year);
    if (ids.length < 2) continue;
    const slots = koRounds(ids.length, t).rounds.reduce((s, r) => s + r.legs, 0);
    for (const d of cupDates(c.config, t, year, slots)) reserved.add(d);
  }
  const sorted = tpls.slice().sort((a: CompTemplate, b: CompTemplate) => ORDER[a.kind] - ORDER[b.kind] || (a.tier ?? 0) - (b.tier ?? 0) || a.id.localeCompare(b.id));
  for (const t of sorted) {
    if (c.competitions[compKey(t.id, year)]) continue;
    const { warnings: w } = createCompetition(c, t, year, reserved);
    warnings.push(...w);
  }
  const clashes = findClashes(c);
  if (clashes.length) warnings.push(`Conflitos de calendário detectados: ${clashes.length}.`);
  return warnings;
}

function allFinished(c: Career, season: number): boolean {
  return Object.values(c.competitions).every((x) => x.season !== season || x.status === 'finished');
}

export function seasonReadyToEnd(c: Career): boolean {
  return !c.seasonEnded && c.day >= mmdd(c.season, '12-27') && allFinished(c, c.season);
}

/** Encerramento da temporada: acesso/rebaixamento, vagas continentais, diretoria, aposentadorias e contratos. */
export function endSeason(c: Career): SeasonSummary {
  const Y = c.season;
  const user = c.clubs[c.userClubId];
  const moves = applyPromotionRelegation(c, Y);
  for (const e of moves.errors) addNews(c, { kind: 'warning', icon: 'warning', title: 'Aviso de regulamento', body: e, clubIds: [], playerIds: [], important: true, link: { screen: 'editor' } });
  const qual = computeQualification(c, Y);
  c.qualification = qual.lists;
  c.qualificationWarnings = qual.warnings;
  for (const w of qual.warnings) addNews(c, { kind: 'warning', icon: 'warning', title: 'Vagas continentais incompletas', body: `${w}`, clubIds: [], playerIds: [], important: true, link: { screen: 'editor' } });
  // registros dos clubes
  for (const comp of Object.values(c.competitions)) {
    if (comp.season !== Y || comp.kind !== 'league') continue;
    const table = comp.finalTable ?? leagueTable(c, comp);
    table.forEach((r, i) => {
      const club = c.clubs[r.clubId];
      if (!club || club.seasons.some((s) => s.season === Y && s.compId === comp.id)) return;
      club.seasons.push({ season: Y, compId: comp.id, compName: c.config.competitions[comp.templateId]?.name ?? comp.name, position: i + 1, points: r.pts, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga });
      // força estrutural evolui devagar com o desempenho e com a qualidade do elenco
      const squad = club.playerIds.map((id) => c.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr).slice(0, 14);
      const squadLvl = squad.length ? squad.reduce((s, p) => s + ovrToLevel(p.ovr), 0) / squad.length : club.level;
      const tier = c.config.competitions[comp.templateId]?.tier ?? 1;
      const perf = (table.length / 2 - i) / table.length; // -0.5..0.5
      club.level = clamp(club.level + clamp((squadLvl - club.level) * 0.15 + perf * 0.5 * (tier === 1 ? 1 : 0.6), -0.7, 0.7), 0, 25);
      club.reputation = clamp(club.reputation + perf * 2, 1, 100);
    });
  }
  // histórico individual (temporada encerrada): estatísticas finais ficam registradas antes da próxima temporada
  archiveSeason(c, Y);
  for (const p of Object.values(c.players)) {
    if (!p.clubId || p.squad !== 'senior') continue;
    const had = Object.keys(p.stats).some((k) => k.startsWith(`${Y}|`));
    if (had || p.origin === 'creator' || p.clubId === c.userClubId) closeSpell(c, p, !!p.loan);
    if (!had && (p.origin === 'creator' || p.clubId === c.userClubId) && !p.history.some((h) => h.season === Y)) {
      p.history.push({ season: Y, clubId: p.clubId, clubName: c.clubs[p.clubId].name, apps: 0, goals: 0, assists: 0, avgRating: 0, level: Math.round(ovrToLevel(p.ovr) * 10) / 10, value: p.value });
    }
  }
  const review = seasonBoardReview(c);
  const league = c.competitions[compKey(user.divisionId, Y)];
  const pos = league ? (league.finalTable ?? leagueTable(c, league)).findIndex((r) => r.clubId === user.id) + 1 : undefined;
  c.manager.history.push({ season: Y, clubId: user.id, clubName: user.name, finish: pos ? `${pos}º na ${c.config.competitions[user.divisionId]?.name}` : undefined });
  const summary: SeasonSummary = {
    season: Y, userClubId: user.id, userClubName: user.name, userPosition: pos, userDivision: c.config.competitions[user.divisionId]?.name,
    champions: Object.values(c.competitions).filter((x) => x.season === Y && x.champion).map((x) => ({ compTemplateId: x.templateId, compName: c.config.competitions[x.templateId]?.name ?? x.name, clubId: x.champion!, clubName: c.clubs[x.champion!]?.name ?? '' })),
    promoted: moves.promoted.map((m) => ({ clubId: m.clubId, to: m.to })), relegated: moves.relegated.map((m) => ({ clubId: m.clubId, to: m.to })),
    topScorers: Object.values(c.competitions).filter((x) => x.season === Y && x.topScorers?.length && (x.kind === 'league' || x.kind === 'continental')).map((x) => ({ compName: x.name, name: x.topScorers![0].name, goals: x.topScorers![0].goals })),
    boardVerdict: review.verdict,
  };
  c.seasonHistory.push(summary);
  if (review.fired) {
    c.firedPending = true;
    c.manager.fired++;
    addNews(c, { kind: 'board', icon: 'board', title: `${c.manager.name} é demitido do ${user.name}`, body: review.verdict.split('\n')[0], clubIds: [user.id], playerIds: [], important: true });
  }
  // empréstimos voltam, contratos vencem, veteranos se aposentam
  for (const p of Object.values(c.players)) if (p.loan) returnFromLoan(c, p);
  processRetirements(c);
  expireContracts(c);
  updateRecords(c);
  c.seasonEnded = true;
  addNews(c, { kind: 'calendar', icon: 'calendar', title: `Temporada ${Y} encerrada`, body: `${user.name}: ${pos ? `${pos}º lugar` : 'campanha encerrada'}. ${summary.promoted.length} acessos e ${summary.relegated.length} rebaixamentos no universo.`, clubIds: [user.id], playerIds: [], important: true, link: { screen: 'history' } });
  return summary;
}

/** Remove partidas antigas (exceto as do clube do usuário) para manter o salvamento leve. */
export function pruneOldSeasons(c: Career, keepFrom: number): void {
  for (const comp of Object.values(c.competitions)) {
    if (comp.season >= keepFrom || comp.pruned) continue;
    for (const st of comp.stages) {
      st.fixtureIds = st.fixtureIds.filter((id) => {
        const f = c.fixtures[id];
        if (!f) return false;
        if (f.home === c.userClubId || f.away === c.userClubId || f.tieId) {
          if (f.result) {
            f.result.events = f.home === c.userClubId || f.away === c.userClubId ? f.result.events : undefined;
          }
          return true;
        }
        delete c.fixtures[id];
        return false;
      });
    }
    comp.pruned = true;
  }
  for (const p of Object.values(c.players)) {
    // as linhas antigas só saem de p.stats depois de arquivadas em p.statArchive (histórico permanente)
    const seasons = new Set(Object.keys(p.stats).map((k) => Number(k.split('|')[0])).filter((y) => y < keepFrom));
    for (const y of seasons) archivePlayer(c, p, y);
    for (const k of Object.keys(p.stats)) if (Number(k.split('|')[0]) < keepFrom) delete p.stats[k];
    if (p.injuries.length > 20) p.injuries.splice(0, p.injuries.length - 20);
  }
  resetIndex(c);
}

/** Início da nova temporada: elencos completos, orçamentos, objetivos e calendário. */
export function beginSeason(c: Career): string[] {
  const Y = c.season + 1;
  c.season = Y;
  c.seasonEnded = false;
  const rng = new Rng(seedFrom(c.id, 'season', Y));
  for (const p of Object.values(c.players)) {
    p.yellows = {};
    p.susp = {};
    p.morale = clamp(p.morale + (65 - p.morale) * 0.4, 0, 100);
    p.condition = Math.max(p.condition, 92);
  }
  aiSquadMaintenance(c);
  for (const club of Object.values(c.clubs)) {
    if (club.id !== c.userClubId) {
      club.transferBudget = Math.max(0, Math.round(club.balance * 0.45));
      if (!club.kits.some((k) => k.season === Y)) club.kits.push(defaultKitCollection(club, Y));
      if (club.kits.length > 1) club.kits.splice(0, club.kits.length - 1);
    }
    club.board.warnings = 0;
    assignRoles(c, club);
  }
  pruneOldSeasons(c, Y);
  const warnings = buildSeason(c, Y);
  setObjectives(c, c.clubs[c.userClubId]);
  currentCollection(c);
  void rng;
  addNews(c, { kind: 'calendar', icon: 'calendar', title: `Começa a temporada ${Y}`, body: `A diretoria definiu ${c.clubs[c.userClubId].board.objectives.length} objetivos. Confira o calendário e o elenco.`, clubIds: [c.userClubId], playerIds: [], important: true, link: { screen: 'club' } });
  if (warnings.length) addNews(c, { kind: 'warning', icon: 'warning', title: 'Avisos de configuração das competições', body: warnings.join(' '), clubIds: [], playerIds: [], important: true, link: { screen: 'editor' } });
  return warnings;
}

/** Após demissão: lista clubes que aceitariam o treinador. */
export function jobOffers(c: Career): string[] {
  const rep = c.manager.reputation;
  const current = c.userClubId;
  return Object.values(c.clubs)
    .filter((cl) => cl.id !== current && cl.level <= rep / 4 + 4 && cl.level >= rep / 4 - 6)
    .sort((a, b) => b.level - a.level)
    .slice(0, 6)
    .map((cl) => cl.id);
}

export function acceptJob(c: Career, clubId: string): void {
  const old = c.clubs[c.userClubId];
  const club = c.clubs[clubId];
  // a comissão do clube antigo permanece lá; o novo clube recebe profissionais conforme seu nível
  c.userClubId = clubId;
  c.firedPending = false;
  club.board.confidence = 60;
  if (club.staffIds.length === 0) seedUserStaff(c, club);
  setObjectives(c, club);
  addNews(c, { kind: 'board', icon: 'board', title: `${c.manager.name} assume o ${club.name}`, body: `Novo desafio após a saída do ${old.name}.`, clubIds: [club.id], playerIds: [], important: true, link: { screen: 'club' } });
}
