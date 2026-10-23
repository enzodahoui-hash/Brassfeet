import type { Career, Fixture } from '../types';
import { Rng, seedFrom } from '../core/rng';
import { isFirstOfMonth, mmdd, weekday, ymd, fmtDay } from '../core/date';
import { fixturesOn, nextClubFixture } from './index';
import { playFixture } from './matches';
import { progressCompetition, type CompEvent } from '../competitions/manager';
import { finalizeCompetition } from '../competitions/finalize';
import { dailyRecovery, progressPlayer, refreshValues, trainingInjuries, weeklyMorale, type WeekContext } from '../players/progression';
import { clubEffects, progressProjects } from '../infra/infra';
import { dailyPitch } from '../stadium/stadium';
import { financialHealth, monthlyFinance, weeklyWages } from '../finance/economy';
import { aiMarketWeek, returnFromLoan, windowOpen } from '../market/transfers';
import { expireCandidates, weeklyYouthEvents, youthIntakeEvent } from '../youth/academy';
import { weeklyKitSales } from '../kits/commerce';
import { weeklyBoard } from '../board/board';
import { ballonDay, galaDay, runBallon, runGala } from '../awards/awards';
import { beginSeason, endSeason, seasonReadyToEnd } from './season';
import { expireDecisions } from './decisions';
import { addDecision, addNews } from '../news/news';
import { expectedWage } from '../players/value';
import { ovrToLevel } from '../players/attributes';

export type AdvanceStatus = 'ok' | 'user_match' | 'season_end' | 'fired' | 'new_season';

export interface AdvanceResult {
  status: AdvanceStatus;
  fixtureId?: string;
  events: string[];
}

export function userFixtureToday(c: Career): Fixture | null {
  for (const f of fixturesOn(c, c.day)) if (f.status === 'scheduled' && (f.home === c.userClubId || f.away === c.userClubId)) return f;
  return null;
}

/** Joga todas as partidas do dia que não envolvem o clube do usuário. */
export function playAIFixtures(c: Career, day: number): number {
  let n = 0;
  const list = fixturesOn(c, day).filter((f) => f.status === 'scheduled' && f.home !== c.userClubId && f.away !== c.userClubId).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  for (const f of list) {
    playFixture(c, f, false);
    n++;
  }
  return n;
}

function compEventsNews(c: Career, evs: CompEvent[]): void {
  for (const e of evs) {
    const userIn = e.clubIds.includes(c.userClubId);
    if (e.type === 'drawn' && userIn) addNews(c, { kind: 'calendar', icon: 'calendar', title: e.text, body: 'Confira os confrontos na página da competição.', clubIds: [c.userClubId], playerIds: [], link: { screen: 'comp', id: e.compId } });
    if (e.type === 'eliminated' && e.clubIds[0] === c.userClubId) addNews(c, { kind: 'match', icon: 'match', title: `${c.clubs[c.userClubId].name} é eliminado`, body: e.text, clubIds: [c.userClubId], playerIds: [], important: true, link: { screen: 'comp', id: e.compId } });
    if (e.type === 'stage' && userIn) {
      const comp = c.competitions[e.compId];
      addNews(c, { kind: comp.kind === 'continental' ? 'continental' : 'trophy', icon: comp.kind === 'continental' ? 'continental' : 'trophy', title: comp.kind === 'continental' ? `Campanha histórica: ${c.clubs[c.userClubId].name} avança no mata-mata da ${comp.name}` : `${c.clubs[c.userClubId].name} avança na ${comp.name}`, body: e.text, clubIds: [c.userClubId], playerIds: [], link: { screen: 'comp', id: e.compId } });
    }
  }
}

/** Fim do dia: fases das competições, encerramentos e rotinas diárias. */
function endOfDay(c: Career): void {
  for (const comp of Object.values(c.competitions)) {
    if (comp.status === 'running') compEventsNews(c, progressCompetition(c, comp));
    if (comp.status === 'finished' && !comp.finalized) finalizeCompetition(c, comp);
  }
  const effects = new Map();
  dailyRecovery(c, new Rng(seedFrom(c.id, 'rec', c.day)), effects);
  progressProjects(c);
  for (const club of Object.values(c.clubs)) if (club.id === c.userClubId || weekday(c.day) === 1) dailyPitch(club);
  if (weekday(c.day) === 0) for (const p of Object.values(c.players)) if (p.loan && p.loan.until <= c.day) returnFromLoan(c, p);
  expireDecisions(c);
  expireCandidates(c);
}

function weekly(c: Career): void {
  const rng = new Rng(seedFrom(c.id, 'week', c.day));
  weeklyWages(c);
  const ctx: WeekContext = { rng, effects: new Map() };
  for (const p of Object.values(c.players)) {
    progressPlayer(c, p, ctx);
    weeklyMorale(c, p, rng);
  }
  const injured = trainingInjuries(c, rng, ctx.effects);
  for (const p of injured) {
    if (p.clubId === c.userClubId) addNews(c, { kind: 'injury', icon: 'injury', title: `${p.name} se machuca no treino`, body: `${p.injury!.name}: cerca de ${Math.round(p.injury!.daysLeft)} dias de recuperação.`, clubIds: [c.userClubId], playerIds: [p.id], link: { screen: 'player', id: p.id } });
  }
  if (windowOpen(c)) aiMarketWeek(c);
  weeklyYouthEvents(c);
  weeklyKitSales(c);
  weeklyBoard(c);
  financialHealth(c);
  seniorRequests(c, rng);
  if (ymd(c.day).d <= 7) {
    refreshValues(c);
    const { m } = ymd(c.day);
    if (m >= 9) {
      const club = c.clubs[c.userClubId];
      const ending = club.playerIds.map((id) => c.players[id]).filter((p) => p?.contract && p.contract.endYear <= c.season && !p.loan);
      if (ending.length) addNews(c, { kind: 'transfer', icon: 'warning', title: `${ending.length} contrato(s) terminam em 31/12`, body: `${ending.slice(0, 6).map((p) => p.name).join(', ')}${ending.length > 6 ? '…' : ''}. Renove na ficha do jogador ou eles sairão de graça.`, clubIds: [club.id], playerIds: ending.map((p) => p.id), important: true, link: { screen: 'squad' } });
    }
  }
  void clubEffects;
}

/** Pedidos de jogadores do elenco (aumento, transferência) gerados pelo estado real deles. */
function seniorRequests(c: Career, rng: Rng): void {
  const club = c.clubs[c.userClubId];
  const open = new Set(c.inbox.filter((d) => !d.resolved).map((d) => `${d.kind}|${d.playerId}`));
  for (const id of club.playerIds) {
    const p = c.players[id];
    if (!p?.contract || p.loan) continue;
    if (p.happiness === 'Quer jogar em um clube maior' && p.morale < 40 && !open.has(`transferRequest|${p.id}`) && rng.chance(0.15)) {
      addDecision(c, { kind: 'transferRequest', title: `${p.name} pede para ser negociado`, text: 'O jogador acredita que precisa de um clube maior para a carreira.', playerId: p.id, options: [{ id: 'list', label: 'Colocar à venda' }, { id: 'persuade', label: 'Convencê-lo a ficar' }, { id: 'refuse', label: 'Negar' }], expires: c.day + 14 });
    } else if (p.contract.wage < expectedWage(p, club.level, c.season) * 0.65 && ovrToLevel(p.ovr) >= 8 && !open.has(`wageRequest|${p.id}`) && rng.chance(0.04)) {
      addDecision(c, { kind: 'wageRequest', title: `${p.name} solicita aumento`, text: `Ganha ${p.contract.wage.toLocaleString('pt-BR')} por ano e considera estar abaixo do mercado.`, playerId: p.id, options: [{ id: 'accept', label: 'Conceder 15%' }, { id: 'refuse', label: 'Recusar' }], expires: c.day + 14 });
    }
  }
}

/** Início do dia: rotinas semanais/mensais e eventos de calendário. */
function startOfDay(c: Career): AdvanceStatus {
  const d = c.day;
  const { y, m, d: dd } = ymd(d);
  if (weekday(d) === 1) weekly(c);
  if (isFirstOfMonth(d)) monthlyFinance(c);
  for (const w of c.config.transferWindows) {
    if (d === mmdd(y, w.start)) addNews(c, { kind: 'transfer', icon: 'transfer', title: 'Janela de transferências aberta', body: `Negociações liberadas até ${w.end.split('-').reverse().join('/')}.`, clubIds: [], playerIds: [], important: true, link: { screen: 'market' } });
    if (d === mmdd(y, w.end) + 1) addNews(c, { kind: 'transfer', icon: 'transfer', title: 'Janela de transferências fechada', body: 'Negociações com clubes ficam bloqueadas até a próxima janela. Jogadores livres ainda podem ser contratados.', clubIds: [], playerIds: [], important: true });
  }
  const prog = c.config.progression;
  if (prog.youthIntake !== 'off') {
    const dates = prog.youthIntake === 'annual' ? prog.intakeDates.slice(0, 1) : prog.intakeDates;
    if (dates.some((s) => d === mmdd(y, s))) youthIntakeEvent(c);
  }
  if (c.config.awards.enabled && d === ballonDay(c, y)) runBallon(c, y);
  if (c.config.awards.enabled && d === galaDay(c, y) && y === c.season) runGala(c, y);
  if (seasonReadyToEnd(c)) {
    endSeason(c);
    return c.firedPending ? 'fired' : 'season_end';
  }
  if (c.seasonEnded && y > c.season) {
    beginSeason(c);
    return 'new_season';
  }
  void m;
  void dd;
  return 'ok';
}

/** Avança exatamente um dia, na ordem: jogo do usuário pendente → fim do dia → novo dia → jogos da IA. */
export function advanceDay(c: Career): AdvanceResult {
  if (c.firedPending) return { status: 'fired', events: [] };
  const pending = userFixtureToday(c);
  if (pending) return { status: 'user_match', fixtureId: pending.id, events: [] };
  endOfDay(c);
  c.day += 1;
  const st = startOfDay(c);
  playAIFixtures(c, c.day);
  const uf = userFixtureToday(c);
  if (st === 'season_end' || st === 'fired' || st === 'new_season') return { status: st, events: [], fixtureId: uf?.id };
  if (uf) return { status: 'user_match', fixtureId: uf.id, events: [] };
  return { status: 'ok', events: [] };
}

/** Avança até o próximo jogo do usuário, fim de temporada, decisão importante ou limite de dias. */
export function advanceToNextEvent(c: Career, maxDays = 60, stopOnDecisions = true): AdvanceResult {
  const decisionsBefore = c.inbox.filter((x) => !x.resolved).length;
  const offersBefore = c.offers.filter((o) => o.status === 'pending').length;
  for (let i = 0; i < maxDays; i++) {
    const r = advanceDay(c);
    if (r.status !== 'ok') return r;
    if (stopOnDecisions) {
      const dn = c.inbox.filter((x) => !x.resolved).length;
      const on = c.offers.filter((o) => o.status === 'pending').length;
      if (dn > decisionsBefore || on > offersBefore || c.intakeCandidates.length > 0 && i > 0 && c.news[0]?.day === c.day && c.news[0]?.kind === 'youth') return { status: 'ok', events: ['Há novidades que exigem sua atenção.'] };
    }
  }
  return { status: 'ok', events: [] };
}

export function nextUserFixture(c: Career): Fixture | null {
  return nextClubFixture(c, c.userClubId, c.day);
}

export function dayLabel(c: Career): string {
  return fmtDay(c.day);
}
