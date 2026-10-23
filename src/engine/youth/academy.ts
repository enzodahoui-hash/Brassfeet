import type { Career, Club, Player, Pos, SquadRole, YouthPlan } from '../types';
import { Rng, clamp, seedFrom } from '../core/rng';
import { ovrToLevel } from '../players/attributes';
import { makePlayer, rollPotential } from '../players/generate';
import { finalizePlayer, assignRoles } from '../universe/world';
import { clubEffects } from '../infra/infra';
import { expectedWage, roundMoney } from '../players/value';
import { addDecision, addNews } from '../news/news';
import { FOREIGN_MIX } from '../data/nations';
import { moveToClub } from '../market/roster';

export const YOUTH_PLANS: Record<YouthPlan, { name: string; desc: string; fatigue: number }> = {
  balanced: { name: 'Equilibrado', desc: 'Desenvolve todos os aspectos de forma uniforme.', fatigue: 1 },
  technical: { name: 'Técnico', desc: 'Prioriza passe, finalização, drible e controle.', fatigue: 1 },
  physical: { name: 'Físico', desc: 'Prioriza velocidade, força e resistência (mais desgaste).', fatigue: 1.25 },
  tactical: { name: 'Tático', desc: 'Prioriza posicionamento, decisões e trabalho em equipe.', fatigue: 0.95 },
  position: { name: 'Especialização por posição', desc: 'Foca nos atributos da posição de desenvolvimento.', fatigue: 1 },
  proPrep: { name: 'Preparação para o profissional', desc: 'Foco mental e de ritmo para a transição.', fatigue: 1.05 },
};

export type RecruitRegion = 'local' | 'nacional' | 'continental';

/** Faixa de potencial estimada pela comissão: a incerteza depende da qualidade da equipe da base. */
export function potentialEstimate(c: Career, p: Player): { low: number; high: number; mid: number; accuracy: number } {
  const club = p.clubId ? c.clubs[p.clubId] : c.clubs[c.userClubId];
  const acc = club ? clubEffects(c, club).youthAccuracy : 0.3;
  const err = clamp(6 - acc * 5, 1, 6);
  const truth = ovrToLevel(p.pot);
  const noise = (p.youth?.scoutNoise ?? 0) * err * 0.6;
  const mid = clamp(truth + noise, ovrToLevel(p.ovr), 25);
  return { low: Math.max(Math.floor(ovrToLevel(p.ovr)), Math.round(mid - err / 2)), high: Math.min(25, Math.round(mid + err / 2)), mid: Math.round(mid), accuracy: acc };
}

export function talentTier(estMid: number): { label: string; tone: 'common' | 'good' | 'great' | 'star' } {
  if (estMid >= 21) return { label: 'Possível futuro craque', tone: 'star' };
  if (estMid >= 17) return { label: 'Grande promessa', tone: 'great' };
  if (estMid >= 12) return { label: 'Bom talento', tone: 'good' };
  return { label: 'Promessa comum', tone: 'common' };
}

export function developmentStatus(c: Career, p: Player): string {
  const g = p.youth?.recentGain ?? 0;
  if (p.injury) return 'Lesionado';
  if (g > 0.6) return 'Evolução acelerada';
  if (g > 0.2) return 'Evoluindo bem';
  if (g > 0.05) return 'Evolução lenta';
  return c.season - p.birthYear >= 19 ? 'Estagnado' : 'Em adaptação';
}

/** Previsão de promoção comparando com o 18º jogador do elenco profissional. */
export function promotionForecast(c: Career, p: Player): string {
  const club = c.clubs[p.clubId!];
  const senior = club.playerIds.map((id) => c.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  const ref = senior[Math.min(17, senior.length - 1)];
  const age = c.season - p.birthYear;
  if (!ref) return 'Pronto';
  const diff = ovrToLevel(p.ovr) - ovrToLevel(ref.ovr);
  if (diff >= 0) return 'Pronto para o profissional';
  const gain = Math.max(0.15, (p.youth?.recentGain ?? 0.2) / 4) * 52;
  const years = Math.ceil(-diff / gain);
  if (years <= 1 && age >= 17) return 'Em até 1 temporada';
  if (age >= 20) return 'Improvável';
  return `Em ${Math.min(years, 4)} temporada(s)`;
}

function intakeCount(c: Career, club: Club, rng: Rng): number {
  const e = clubEffects(c, club);
  return clamp(Math.round(2 + e.intakeQuality * 4 + club.reputation / 50 + rng.range(-1, 1.5)), 2, 9);
}

/** Revelações do período: qualidade e quantidade dependem de reputação, estrutura, olheiros e histórico. */
export function generateIntake(c: Career, club: Club, rng: Rng, region: RecruitRegion = 'nacional', maxCount = 99, history?: number): Player[] {
  const e = clubEffects(c, club);
  const n = Math.min(maxCount, intakeCount(c, club, rng));
  history ??= club.playerIds.filter((id) => c.players[id]?.origin === 'youth' && ovrToLevel(c.players[id].ovr) >= 14).length;
  const out: Player[] = [];
  for (let i = 0; i < n; i++) {
    const pos = rng.pick(['GK', 'CB', 'CB', 'RB', 'LB', 'DM', 'CM', 'CM', 'AM', 'RW', 'LW', 'ST', 'ST'] as Pos[]);
    const age = rng.int(15, 17);
    const nat = region === 'continental' && rng.chance(0.4) ? rng.pick(FOREIGN_MIX[club.country] ?? ['BRA']) : region === 'nacional' || rng.chance(0.8) ? club.country : rng.pick(FOREIGN_MIX[club.country] ?? [club.country]);
    const level = clamp(rng.normal(club.level * 0.32 + e.intakeQuality * 2.5, 1.7), 0, 13);
    const quality = e.intakeQuality * 1.6 + club.reputation / 60 + Math.min(1, history / 10) * 0.6 + (region === 'continental' ? 0.4 : region === 'local' ? -0.3 : 0);
    let pot = rollPotential(rng, level, age, quality);
    if (rng.chance(0.015 + e.scouting * 0.02)) pot = clamp(pot + rng.range(3, 7), level, 25); // raro talento excepcional
    const p = makePlayer(c, rng, { nat, pos, age, level, potLevel: pot, season: c.season, clubId: null, squad: 'youth', origin: 'youth' });
    finalizePlayer(p, club.level, c.season);
    p.youth = { plan: 'balanced', joined: c.day, scoutNoise: rng.range(-1, 1), mentoring: false, recentGain: 0 };
    p.contract = { wage: roundMoney(3_000 + club.level * 900), endYear: c.season + 2, signedDay: c.day, role: 'prospect' };
    c.players[p.id] = p;
    out.push(p);
  }
  return out;
}

export function youthIntakeEvent(c: Career): void {
  const rng = new Rng(seedFrom(c.id, 'intake', c.day));
  // clubes da IA: aceitam automaticamente os melhores
  for (const club of Object.values(c.clubs)) {
    if (club.id === c.userClubId) continue;
    const ps = generateIntake(c, club, rng, 'nacional', 3, 0);
    ps.sort((a, b) => b.pot - a.pot);
    for (const [i, p] of ps.entries()) {
      if (i < 2 && club.youthIds.length < 12) moveToClub(c, p, club, 'youth');
      else delete c.players[p.id];
    }
    // jovens que não evoluíram são liberados aos 20 anos
    for (const id of club.youthIds.slice()) {
      const p = c.players[id];
      if (p && c.season - p.birthYear >= 20) {
        if (ovrToLevel(p.ovr) >= club.level - 4 && club.playerIds.length < 30) promote(c, p, 'backup', true);
        else {
          moveToClub(c, p, null, 'senior');
          p.contract = null;
          p.youth = undefined;
        }
      }
    }
  }
  const club = c.clubs[c.userClubId];
  const region = ((c.flags.recruitContinental ? 'continental' : c.flags.recruitLocal ? 'local' : 'nacional') as RecruitRegion);
  const cands = generateIntake(c, club, rng, region);
  c.intakeCandidates.push(...cands.map((p) => p.id));
  addNews(c, { kind: 'youth', icon: 'youth', title: `${cands.length} novos talentos avaliados pela base`, body: 'A comissão da base apresentou o relatório das peneiras. Aceite, avalie ou dispense os candidatos na aba Base.', clubIds: [club.id], playerIds: cands.map((p) => p.id), important: true, link: { screen: 'youth' } });
}

export function acceptCandidate(c: Career, pid: string): string | null {
  const club = c.clubs[c.userClubId];
  const p = c.players[pid];
  if (!p || !c.intakeCandidates.includes(pid)) return 'Candidato indisponível.';
  const cap = clubEffects(c, club).youthCapacity;
  if (club.youthIds.length >= cap) return `Alojamentos lotados (${cap} vagas). Melhore os alojamentos ou libere jovens.`;
  c.intakeCandidates = c.intakeCandidates.filter((x) => x !== pid);
  moveToClub(c, p, club, 'youth');
  p.youth!.joined = c.day;
  return null;
}

export function dismissCandidate(c: Career, pid: string): void {
  c.intakeCandidates = c.intakeCandidates.filter((x) => x !== pid);
  const p = c.players[pid];
  if (p && !p.clubId) delete c.players[pid];
}

export function expireCandidates(c: Career): void {
  for (const id of c.intakeCandidates.slice()) {
    const p = c.players[id];
    if (!p || c.day - (p.youth?.joined ?? c.day) > 30) dismissCandidate(c, id);
  }
}

/** Promove um jovem ao profissional: novo contrato, folha atualizada, histórico preservado. */
export function promote(c: Career, p: Player, role: SquadRole, silent = false): string | null {
  if (!p.clubId || p.squad !== 'youth') return 'O jogador não está na base.';
  const club = c.clubs[p.clubId];
  if (club.playerIds.length >= 32) return 'Elenco profissional cheio (32).';
  club.youthIds = club.youthIds.filter((x) => x !== p.id);
  club.playerIds.push(p.id);
  p.squad = 'senior';
  const wage = roundMoney(Math.max(p.contract?.wage ?? 0, expectedWage(p, club.level, c.season) * 0.7));
  p.contract = { wage, endYear: Math.max(p.contract?.endYear ?? c.season, c.season + 2), signedDay: c.day, role };
  if (p.youth) p.youth.promotedDay = c.day;
  p.morale = clamp(p.morale + 12, 0, 100);
  club.events.push({ day: c.day, text: `${p.name} promovido da base ao profissional` });
  if (!silent) {
    addNews(c, { kind: 'youth', icon: 'youth', title: `${p.name} é promovido ao time principal`, body: `O jovem de ${c.season - p.birthYear} anos assina contrato profissional (salário de ${wage.toLocaleString('pt-BR')}/ano) e passa a ser opção para a escalação.`, clubIds: [club.id], playerIds: [p.id], link: { screen: 'player', id: p.id } });
  }
  assignRoles(c, club);
  if (p.contract) p.contract.role = role;
  return null;
}

export function setPlan(c: Career, pid: string, plan: YouthPlan, devPos?: Pos): void {
  const p = c.players[pid];
  if (!p?.youth) return;
  p.youth.plan = plan;
  p.youth.devPos = devPos;
}

export function setMentoring(c: Career, pid: string, on: boolean): string | null {
  const p = c.players[pid];
  if (!p?.youth) return 'Jogador inválido.';
  const club = c.clubs[c.userClubId];
  const used = club.youthIds.filter((id) => c.players[id]?.youth?.mentoring).length;
  const cap = 1 + Math.floor(club.facilities.y_monitoring / 2);
  if (on && used >= cap) return `Capacidade de acompanhamento individual esgotada (${cap}). Melhore o acompanhamento individual.`;
  p.youth.mentoring = on;
  return null;
}

/** Eventos semanais com decisões rápidas e consequências reais. */
export function weeklyYouthEvents(c: Career): void {
  const rng = new Rng(seedFrom(c.id, 'yev', c.day));
  const club = c.clubs[c.userClubId];
  const senior = club.playerIds.map((id) => c.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  const ref = senior[Math.min(17, senior.length - 1)];
  const open = new Set(c.inbox.filter((d) => !d.resolved).map((d) => `${d.kind}|${d.playerId}`));
  for (const id of club.youthIds) {
    const p = c.players[id];
    if (!p) continue;
    const age = c.season - p.birthYear;
    const ready = ref && p.ovr >= ref.ovr;
    const ask = (k: string) => !open.has(`${k}|${p.id}`);
    if (ready && age >= 17 && rng.chance(0.08) && ask('coachPromote')) {
      addDecision(c, { kind: 'coachPromote', title: `Treinador da base recomenda ${p.name}`, text: `${p.name} (${age} anos) já tem nível para o profissional. Promover agora?`, playerId: p.id, options: [{ id: 'promote', label: 'Promover' }, { id: 'wait', label: 'Manter na base' }], expires: c.day + 21 });
    } else if (age >= 18 && ready && rng.chance(0.05) && ask('askChance')) {
      addDecision(c, { kind: 'askChance', title: `${p.name} pede uma oportunidade`, text: 'O jovem se sente pronto e quer treinar com o grupo principal.', playerId: p.id, options: [{ id: 'promote', label: 'Promover', hint: '+moral' }, { id: 'promise', label: 'Prometer chance em breve', hint: 'moral estável' }, { id: 'no', label: 'Recusar', hint: '−moral' }], expires: c.day + 14 });
    } else if ((p.youth?.recentGain ?? 0) > 0.7 && rng.chance(0.1)) {
      addNews(c, { kind: 'youth', icon: 'youth', title: `${p.name} se destaca na base`, body: 'A comissão relata evolução acima do esperado nas últimas semanas.', clubIds: [club.id], playerIds: [p.id], link: { screen: 'player', id: p.id } });
    } else if (ovrToLevel(p.pot) >= 18 && rng.chance(0.025) && ask('poach')) {
      const big = Object.values(c.clubs).filter((x) => x.level >= club.level + 2).sort(() => rng.next() - 0.5)[0];
      if (big) addDecision(c, { kind: 'poach', title: `${big.name} assedia ${p.name}`, text: `O ${big.name} oferece ${roundMoney(p.value * 1.4).toLocaleString('pt-BR')} pelo jovem. A família está tentada.`, playerId: p.id, clubId: big.id, data: { fee: roundMoney(p.value * 1.4) }, options: [{ id: 'sell', label: 'Vender' }, { id: 'renew', label: 'Oferecer contrato melhor', hint: 'custo salarial' }, { id: 'refuse', label: 'Recusar' }], expires: c.day + 10 });
    } else if (p.contract && p.contract.endYear <= c.season && rng.chance(0.12) && ask('youthContract')) {
      addDecision(c, { kind: 'youthContract', title: `${p.name} pede melhores condições`, text: 'O vínculo de formação termina neste ano. O jogador quer aumento para renovar.', playerId: p.id, options: [{ id: 'accept', label: 'Renovar com aumento' }, { id: 'refuse', label: 'Manter as condições' }], expires: c.day + 14 });
    }
  }
  // promovidos sem minutos perdem confiança
  for (const p of senior) {
    if (!p.youth?.promotedDay || c.day - p.youth.promotedDay < 42) continue;
    const mins = p.recentMinutes.reduce((s, x) => s + x, 0);
    if (mins === 0 && rng.chance(0.08) && !open.has(`noMinutes|${p.id}`)) {
      p.morale = clamp(p.morale - 6, 0, 100);
      addDecision(c, { kind: 'noMinutes', title: `${p.name} perde confiança`, text: 'Promovido há semanas, ainda não entrou em campo. Avalie dar minutos ou emprestá-lo.', playerId: p.id, options: [{ id: 'talk', label: 'Conversar e prometer minutos' }, { id: 'loanlist', label: 'Colocar para empréstimo' }, { id: 'ignore', label: 'Ignorar' }], expires: c.day + 14 });
    }
  }
}

export function youthOfClub(c: Career, club: Club): Player[] {
  return club.youthIds.map((id) => c.players[id]).filter(Boolean);
}
