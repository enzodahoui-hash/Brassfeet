import type { Career, Club, CompInstance, CompTemplate, Fixture, Stage, StandingRow, Tie } from '../types';
import { Rng, hashString, seedFrom } from '../core/rng';
import { type Day, mmdd, onOrAfter } from '../core/date';
import { roundRobin, standings } from './table';
import { continentalDates, cupDates, daysOfWeek, leagueDates, spread } from '../calendar/plan';
import { placeFixture } from '../calendar/resolve';
import { post } from '../finance/ledger';

export const compKey = (tplId: string, season: number) => `${tplId}-${season}`;

export function roundLabel(n: number): { name: string; key: string } {
  if (n <= 2) return { name: 'Final', key: 'F' };
  if (n <= 4) return { name: 'Semifinal', key: 'SF' };
  if (n <= 8) return { name: 'Quartas de final', key: 'QF' };
  if (n <= 16) return { name: 'Oitavas de final', key: 'R16' };
  if (n <= 32) return { name: '16-avos de final', key: 'R32' };
  if (n <= 64) return { name: 'Primeira fase', key: 'R64' };
  return { name: `Fase de ${n}`, key: `R${n}` };
}

export interface CompEvent {
  type: 'drawn' | 'eliminated' | 'advanced' | 'finished' | 'stage';
  compId: string;
  clubIds: string[];
  text: string;
  round?: string;
}

// ───────────────────────── helpers ─────────────────────────

function nextFixtureId(c: Career): string {
  return `f${c.nextId++}`;
}

function levelOf(c: Career, id: string): number {
  return c.clubs[id]?.level ?? 0;
}

function bySeed(c: Career, ids: string[]): string[] {
  return ids.slice().sort((a, b) => levelOf(c, b) - levelOf(c, a) || a.localeCompare(b));
}

function isDerby(c: Career, h: string, a: string): boolean {
  return c.clubs[h]?.rivals.includes(a) ?? false;
}

function makeFixture(c: Career, comp: CompInstance, stageIdx: number, round: number, home: string, away: string, day: Day, extra: Partial<Fixture> = {}): Fixture {
  const id = nextFixtureId(c);
  const tpl = c.config.competitions[comp.templateId];
  const derby = isDerby(c, home, away);
  const f: Fixture = {
    id, compId: comp.id, stageIdx, round, day, origDay: day, home, away, neutral: false, status: 'scheduled',
    seed: seedFrom(c.id, id, comp.id), derby,
    bigGame: derby || (tpl?.importance ?? 1) >= 4 || (levelOf(c, home) >= 18 && levelOf(c, away) >= 18),
    ...extra,
  };
  return f;
}

function addFixture(c: Career, comp: CompInstance, stage: Stage, f: Fixture, window: [Day, Day]): void {
  placeFixture(c, f, window[0], window[1]);
  stage.fixtureIds.push(f.id);
}

// ───────────────────────── participantes ─────────────────────────

export function resolveParticipants(c: Career, t: CompTemplate, season: number): { ids: string[]; notes: { clubId: string; reason: string }[]; warnings: string[] } {
  const warnings: string[] = [];
  const notes: { clubId: string; reason: string }[] = [];
  const clubs = Object.values(c.clubs);
  const tierOf = (cl: Club) => c.config.competitions[cl.divisionId]?.tier ?? 9;
  if (t.kind === 'league') {
    const ids = clubs.filter((cl) => cl.divisionId === t.id).map((cl) => cl.id);
    if (ids.length !== t.numClubs) warnings.push(`${t.name}: ${ids.length} clubes inscritos (configurado: ${t.numClubs}).`);
    return { ids: bySeed(c, ids), notes, warnings };
  }
  const rule = t.participantsRule;
  if (rule?.type === 'divisions') {
    const pool = clubs.filter((cl) => rule.ids.includes(cl.divisionId)).sort((a, b) => tierOf(a) - tierOf(b) || b.level - a.level);
    const ids = pool.slice(0, rule.max ?? pool.length).map((cl) => cl.id);
    return { ids, notes, warnings };
  }
  if (rule?.type === 'state') {
    const states = rule.state.split(',');
    const pool = clubs.filter((cl) => cl.country === 'BRA' && cl.state && states.includes(cl.state)).sort((a, b) => tierOf(a) - tierOf(b) || b.level - a.level);
    return { ids: pool.slice(0, rule.max).map((cl) => cl.id), notes, warnings };
  }
  if (rule?.type === 'super') {
    const lg = c.champions[rule.leagueId]?.find((x) => x.season === season - 1);
    const cup = c.champions[rule.cupId]?.find((x) => x.season === season - 1);
    let a = lg?.clubId;
    let b = cup?.clubId;
    if (a && b && a === b) {
      const prev = c.competitions[compKey(rule.leagueId, season - 1)];
      b = prev ? leagueTable(c, prev)[1]?.clubId : undefined;
    }
    if (!a || !b) {
      // primeira temporada: dois clubes de maior nível da liga (critério inicial do universo)
      const top = bySeed(c, clubs.filter((cl) => cl.divisionId === rule.leagueId).map((cl) => cl.id));
      a = a ?? top.find((x) => x !== b);
      b = b ?? top.find((x) => x !== a);
      notes.push({ clubId: a!, reason: lg ? 'Campeão nacional' : 'Ranking inicial do universo' }, { clubId: b!, reason: cup ? 'Campeão da copa' : 'Ranking inicial do universo' });
    } else notes.push({ clubId: a, reason: 'Campeão nacional' }, { clubId: b, reason: cup?.clubId === b ? 'Campeão da copa' : 'Vice-campeão nacional' });
    return { ids: [a!, b!].filter(Boolean), notes, warnings };
  }
  if (t.kind === 'continental') {
    const list = c.qualification[t.id] ?? [];
    for (const q of list) notes.push({ clubId: q.clubId, reason: q.reason });
    const ids = list.map((q) => q.clubId).filter((id) => c.clubs[id]);
    return { ids, notes, warnings };
  }
  return { ids: [], notes, warnings };
}

// ───────────────────────── construção ─────────────────────────

interface KoRound {
  name: string;
  key: string;
  legs: 1 | 2;
}

export function koRounds(n: number, t: CompTemplate): { rounds: KoRound[]; prelim: number } {
  let B = 1;
  while (B * 2 <= n) B *= 2;
  const rounds: KoRound[] = [];
  const legsFor = (r: number): 1 | 2 => {
    if (r <= 2) return t.ko.finalLegs;
    if (t.ko.twoLegsFrom) return r <= t.ko.twoLegsFrom ? 2 : 1;
    return t.ko.legs;
  };
  const prelim = n > B ? n - B : 0; // número de confrontos preliminares
  if (prelim) rounds.push({ name: 'Fase preliminar', key: 'PRE', legs: legsFor(B * 2) });
  for (let r = B; r >= 2; r /= 2) rounds.push({ ...roundLabel(r), legs: legsFor(r) });
  return { rounds, prelim };
}

function koStage(name: string, teams: string[], rounds: KoRound[], days: Day[][]): Stage {
  return {
    id: name, type: 'knockout', name, groups: [teams], turns: 1, roundNames: rounds.map((r) => r.name), roundKeys: rounds.map((r) => r.key),
    roundLegs: rounds.map((r) => r.legs), roundDays: days, ties: [], fixtureIds: [], done: false,
  };
}

function leagueStage(name: string, groups: string[][], turns: 1 | 2, days: Day[], advance?: number): Stage {
  const nRounds = days.length;
  return {
    id: name, type: 'league', name, groups, turns, roundNames: Array.from({ length: nRounds }, (_, i) => `Rodada ${i + 1}`), roundDays: days.map((d) => [d]),
    ties: [], fixtureIds: [], done: false, advance,
  };
}

function roundsNeeded(size: number, turns: 1 | 2): number {
  const n = size % 2 ? size + 1 : size;
  return (n - 1) * turns;
}

/** Datas sequenciais para as pernas de cada rodada eliminatória. */
function assignKoDays(rounds: KoRound[], slots: Day[]): Day[][] {
  const out: Day[][] = [];
  let i = 0;
  for (const r of rounds) {
    const d: Day[] = [];
    for (let l = 0; l < r.legs; l++) d.push(slots[Math.min(i++, slots.length - 1)]);
    out.push(d);
  }
  return out;
}

/** Cria a instância da competição na temporada, com fases e datas. */
export function createCompetition(c: Career, t: CompTemplate, season: number, reservedMid: Set<Day>): { comp: CompInstance | null; warnings: string[] } {
  const { ids, notes, warnings } = resolveParticipants(c, t, season);
  if (ids.length < 2) {
    warnings.push(`${t.name}: participantes insuficientes (${ids.length}). Verifique a configuração no editor.`);
    return { comp: null, warnings };
  }
  const comp: CompInstance = {
    id: compKey(t.id, season), templateId: t.id, season, name: `${t.name} ${season}`, kind: t.kind, region: t.region, participants: ids, qualNotes: notes,
    stages: [], current: 0, status: 'scheduled', finalized: false, eliminated: {}, startDay: 0, endDay: 0,
  };
  const start = mmdd(season, t.dates.start);
  if (t.format === 'league') {
    const days = leagueDates(c.config, t, season, roundsNeeded(ids.length, t.turns), reservedMid);
    comp.stages.push(leagueStage('Pontos corridos', [ids], t.turns, days));
  } else if (t.format === 'knockout') {
    const { rounds } = koRounds(ids.length, t);
    const slots = t.kind === 'super' ? [onOrAfter(start, t.dates.weekday)] : cupDates(c.config, t, season, rounds.reduce((s, r) => s + r.legs, 0));
    for (const d of slots) reservedMid.add(d);
    comp.stages.push(koStage('Mata-mata', ids, rounds, assignKoDays(rounds, slots)));
  } else if (t.format === 'leaguePlayoff') {
    const rr = roundsNeeded(ids.length, t.turns);
    const po = Math.min(t.playoffTeams ?? 4, ids.length);
    const { rounds } = koRounds(po, { ...t, ko: { ...t.ko, legs: 1, finalLegs: 1 } });
    const end = mmdd(season, t.dates.end);
    const sundays = daysOfWeek(start, end, 0);
    let days: Day[];
    if (sundays.length >= rr + rounds.length) days = sundays.slice(0, rr + rounds.length);
    else {
      const weds = daysOfWeek(start + 3, end, 3).filter((d) => !reservedMid.has(d));
      days = [...sundays, ...spread(weds, rr + rounds.length - sundays.length)].sort((a, b) => a - b);
    }
    comp.stages.push(leagueStage('Fase de classificação', [ids], t.turns, days.slice(0, rr), po));
    comp.stages.push(koStage('Mata-mata', [], rounds, rounds.map((_, i) => [days[rr + i] ?? days[days.length - 1] + 7 * (i + 1)])));
  } else if (t.format === 'groupsKO') {
    const cd = continentalDates(t, season);
    const size = t.groups?.size ?? 4;
    let g = 1;
    while (g * 2 * size <= ids.length && g * 2 <= (t.groups?.count ?? 8)) g *= 2;
    if (ids.length < size * 2) {
      const { rounds } = koRounds(ids.length, t);
      comp.stages.push(koStage('Mata-mata', ids, rounds, rounds.map((r) => (r.key === 'F' ? cd.ko.F : r.key === 'PRE' ? cd.pre : cd.ko[r.key] ?? cd.ko.QF))));
    } else {
      const capacity = g * size;
      if (ids.length > capacity) {
        const pre = ids.length - capacity; // confrontos preliminares
        const r: KoRound = { name: 'Fase preliminar', key: 'PRE', legs: 2 };
        const st = koStage('Fase preliminar', ids, [r], [cd.pre]);
        st.byes = ids.slice(0, ids.length - pre * 2);
        comp.stages.push(st);
      }
      const groupStage = leagueStage('Fase de grupos', [], t.groups?.turns ?? 2, cd.groups.slice(0, roundsNeeded(size, t.groups?.turns ?? 2)), t.groups?.advance ?? 2);
      comp.stages.push(groupStage);
      const koTeams = g * (t.groups?.advance ?? 2);
      const { rounds } = koRounds(koTeams, { ...t, ko: { ...t.ko, legs: 2 } });
      comp.stages.push(koStage('Mata-mata', [], rounds, rounds.map((r) => (r.key === 'F' ? cd.ko.F : cd.ko[r.key] ?? cd.ko.R16))));
    }
  }
  c.competitions[comp.id] = comp;
  startStage(c, comp, 0, ids);
  const allDays = comp.stages.flatMap((s) => s.roundDays.flat());
  comp.startDay = Math.min(...allDays);
  comp.endDay = Math.max(...allDays);
  comp.status = 'running';
  // cota de participação
  for (const id of ids) {
    const club = c.clubs[id];
    if (club && t.prize.participation) post(c, club, { key: `part|${comp.id}|${id}`, day: c.day, amount: t.prize.participation, cat: 'premiações', desc: `Cota de participação — ${comp.name}` });
  }
  return { comp, warnings };
}

/** Sorteio de grupos com potes por nível, evitando clubes do mesmo país no mesmo grupo. */
export function drawGroups(c: Career, teams: string[], groups: number, seed: number): string[][] {
  const rng = new Rng(seed);
  const seeded = bySeed(c, teams);
  const size = Math.ceil(seeded.length / groups);
  let best: string[][] = [];
  let bestConf = Infinity;
  for (let attempt = 0; attempt < 60; attempt++) {
    const gs: string[][] = Array.from({ length: groups }, () => []);
    let conf = 0;
    for (let pot = 0; pot < size; pot++) {
      const potTeams = rng.shuffle(seeded.slice(pot * groups, pot * groups + groups));
      const order = rng.shuffle(Array.from({ length: groups }, (_, i) => i));
      for (const team of potTeams) {
        const country = c.clubs[team]?.country;
        let gi = order.findIndex((g) => gs[g].length === pot && !gs[g].some((x) => c.clubs[x]?.country === country));
        if (gi < 0) {
          gi = order.findIndex((g) => gs[g].length === pot);
          conf++;
        }
        const g = order[gi];
        order.splice(gi, 1);
        gs[g].push(team);
      }
    }
    if (conf < bestConf) {
      best = gs;
      bestConf = conf;
    }
    if (conf === 0) break;
  }
  return best;
}

function startStage(c: Career, comp: CompInstance, idx: number, teams: string[]): CompEvent[] {
  const events: CompEvent[] = [];
  const stage = comp.stages[idx];
  const t = c.config.competitions[comp.templateId];
  const seasonEnd = mmdd(comp.season, '12-20');
  if (stage.type === 'league') {
    if (!stage.groups.length || !stage.groups[0].length) {
      // grupos da fase continental (sorteio)
      const gcount = Math.max(1, Math.round(teams.length / (t.groups?.size ?? 4)));
      stage.groups = drawGroups(c, teams, gcount, seedFrom(comp.id, 'grupos'));
      stage.drawn = true;
      events.push({ type: 'drawn', compId: comp.id, clubIds: teams, text: `Sorteio dos grupos da ${comp.name} realizado.` });
    }
    stage.groups.forEach((group, gi) => {
      const rounds = roundRobin(group, stage.turns, seedFrom(comp.id, idx, gi));
      rounds.forEach((pairs, r) => {
        const day = stage.roundDays[r]?.[0] ?? stage.roundDays[stage.roundDays.length - 1][0] + 3 * (r - stage.roundDays.length + 1);
        for (const [h, a] of pairs) {
          const f = makeFixture(c, comp, idx, r, h, a, day, { group: gi });
          addFixture(c, comp, stage, f, comp.kind === 'continental' ? [day - 1, day + 3] : [day - 3, Math.max(day + 21, seasonEnd)]);
        }
      });
    });
  } else {
    const all = stage.groups[0]?.length ? stage.groups[0] : teams;
    stage.groups = [all];
    if (stage.byes) {
      const byes = new Set(stage.byes);
      const playing = bySeed(c, all.filter((x) => !byes.has(x)));
      createTies(c, comp, idx, 0, pairTopBottom(playing));
    } else if (comp.kind === 'continental' && idx > 0 && comp.stages[idx - 1].type === 'league') {
      createTies(c, comp, idx, 0, teams.length ? groupPairs(c, comp, idx - 1) : []);
    } else {
      // copas: pré-eliminatória para encaixar em potência de 2
      const { prelim } = koRounds(all.length, t);
      const seeded = bySeed(c, all);
      if (prelim) {
        const playing = seeded.slice(seeded.length - prelim * 2);
        stage.byes = seeded.slice(0, seeded.length - prelim * 2);
        createTies(c, comp, idx, 0, pairTopBottom(playing));
      } else createTies(c, comp, idx, 0, pairTopBottom(seeded));
    }
    events.push({ type: 'drawn', compId: comp.id, clubIds: all, text: `${comp.name}: definidos os confrontos da ${stage.roundNames[0].toLowerCase()}.`, round: stage.roundNames[0] });
  }
  return events;
}

/** Forte contra fraco; o mais fraco manda o primeiro jogo (ou o único, em copas). */
function pairTopBottom(seeded: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < Math.floor(seeded.length / 2); i++) out.push([seeded[seeded.length - 1 - i], seeded[i]]);
  return out;
}

function groupPairs(c: Career, comp: CompInstance, groupStageIdx: number): [string, string][] {
  const st = comp.stages[groupStageIdx];
  const tables = st.groups.map((g, gi) => groupTable(c, comp, groupStageIdx, gi));
  const W = tables.map((t) => t[0]?.clubId);
  const R = tables.map((t) => t[1]?.clubId);
  const out: [string, string][] = [];
  for (let i = 0; i + 1 < tables.length; i += 2) {
    out.push([R[i + 1], W[i]]);
    out.push([R[i], W[i + 1]]);
  }
  if (tables.length === 1) out.push([R[0], W[0]]);
  return out.filter(([a, b]) => a && b);
}

/** Cria os confrontos de uma rodada: a = mandante da ida, b = mandante da volta (ou jogo único). */
function createTies(c: Career, comp: CompInstance, stageIdx: number, round: number, pairs: [string, string][]): void {
  const stage = comp.stages[stageIdx];
  const t = c.config.competitions[comp.templateId];
  const legs = stage.roundLegs?.[round] ?? 1;
  const days = stage.roundDays[round] ?? [];
  const isFinal = stage.roundKeys?.[round] === 'F';
  pairs.forEach(([a, b], i) => {
    const tie: Tie = { id: `${comp.id}-s${stageIdx}r${round}t${i}`, round, a, b, fixtureIds: [] };
    stage.ties.push(tie);
    if (!a || !b) return;
    const d1 = days[0] ?? c.day + 3;
    if (legs === 1) {
      const neutral = isFinal && t.ko.neutralFinal;
      const [h, aw] = neutral ? (levelOf(c, a) >= levelOf(c, b) ? [a, b] : [b, a]) : [a, b];
      const f = makeFixture(c, comp, stageIdx, round, h, aw, d1, { tieId: tie.id, leg: 1, neutral, bigGame: true });
      addFixture(c, comp, stage, f, [d1 - 2, d1 + 6]);
      tie.fixtureIds.push(f.id);
    } else {
      const f1 = makeFixture(c, comp, stageIdx, round, a, b, d1, { tieId: tie.id, leg: 1 });
      addFixture(c, comp, stage, f1, [d1 - 2, d1 + 4]);
      const d2 = Math.max(days[1] ?? d1 + 7, c.fixtures[f1.id].day + 3);
      const f2 = makeFixture(c, comp, stageIdx, round, b, a, d2, { tieId: tie.id, leg: 2, bigGame: true });
      addFixture(c, comp, stage, f2, [c.fixtures[f1.id].day + 2, d2 + 6]);
      tie.fixtureIds.push(f1.id, f2.id);
    }
  });
  // premiação por fase alcançada
  const key = stage.roundKeys?.[round];
  const prize = key ? t.prize.byStage[key] : 0;
  if (prize) {
    for (const [a, b] of pairs) for (const id of [a, b]) {
      const club = c.clubs[id];
      if (club) post(c, club, { key: `stage|${comp.id}|${key}|${id}`, day: c.day, amount: prize, cat: 'premiações', desc: `${comp.name}: ${stage.roundNames[round]}` });
    }
  }
}

// ───────────────────────── resultados de confrontos ─────────────────────────

export interface TieState {
  decided: boolean;
  winner?: string;
  loser?: string;
  aggA: number;
  aggB: number;
  note?: string;
}

export function tieState(c: Career, tie: Tie, awayGoals: boolean): TieState {
  const fs = tie.fixtureIds.map((id) => c.fixtures[id]);
  let aggA = 0, aggB = 0, awayA = 0, awayB = 0;
  for (const f of fs) {
    if (!f?.result || f.status !== 'played') return { decided: false, aggA, aggB };
    const r = f.result;
    if (f.home === tie.a) {
      aggA += r.hg; aggB += r.ag;
      awayB += r.ag;
    } else {
      aggA += r.ag; aggB += r.hg;
      awayA += r.ag;
    }
  }
  if (!tie.a || !tie.b) return { decided: true, winner: tie.a ?? tie.b ?? undefined, aggA, aggB };
  let winner: string | undefined;
  let note: string | undefined;
  if (aggA !== aggB) winner = aggA > aggB ? tie.a : tie.b;
  else if (awayGoals && fs.length === 2 && awayA !== awayB) {
    winner = awayA > awayB ? tie.a : tie.b;
    note = 'gols fora';
  } else {
    const last = fs[fs.length - 1];
    if (last?.result?.pens) {
      const [ph, pa] = last.result.pens;
      winner = ph > pa ? last.home : last.away;
      note = `pênaltis ${Math.max(ph, pa)}x${Math.min(ph, pa)}`;
    } else {
      // segurança: nunca deixa confronto sem vencedor (critério reproduzível)
      winner = hashString(tie.id) % 2 ? tie.a : tie.b;
      note = 'sorteio';
    }
  }
  return { decided: true, winner, loser: winner === tie.a ? tie.b : tie.a, aggA, aggB, note };
}

/** Informações para o motor saber se o jogo precisa de vencedor (prorrogação/pênaltis). */
export function knockoutContext(c: Career, f: Fixture): { needWinner: boolean; aggregate?: [number, number]; awayPrev?: [number, number]; awayGoals: boolean; extraTime: boolean } | null {
  if (!f.tieId) return null;
  const comp = c.competitions[f.compId];
  const t = c.config.competitions[comp.templateId];
  const stage = comp.stages[f.stageIdx];
  const tie = stage.ties.find((x) => x.id === f.tieId);
  if (!tie) return null;
  const legs = tie.fixtureIds.length;
  if (legs === 1) return { needWinner: true, awayGoals: false, extraTime: t.ko.extraTime };
  if (f.leg === 1) return { needWinner: false, awayGoals: false, extraTime: false };
  const l1 = c.fixtures[tie.fixtureIds[0]];
  const r = l1?.result;
  if (!r) return { needWinner: true, awayGoals: t.ko.awayGoals, extraTime: t.ko.extraTime };
  // perspectiva do jogo de volta: mandante = visitante da ida
  return { needWinner: true, aggregate: [r.ag, r.hg], awayPrev: [r.ag, 0], awayGoals: t.ko.awayGoals, extraTime: t.ko.extraTime };
}

// ───────────────────────── tabelas ─────────────────────────

export function stageFixtures(c: Career, comp: CompInstance, stageIdx: number, group?: number): Fixture[] {
  const st = comp.stages[stageIdx];
  return st.fixtureIds.map((id) => c.fixtures[id]).filter((f) => f && (group === undefined || f.group === group));
}

export function groupTable(c: Career, comp: CompInstance, stageIdx: number, group: number): StandingRow[] {
  // competições antigas têm as partidas resumidas: usa a tabela oficial congelada
  if (comp.pruned) {
    if (comp.groupTables?.[group]) return comp.groupTables[group];
    if (comp.finalTable && group === 0) return comp.finalTable;
  }
  const t = c.config.competitions[comp.templateId];
  const st = comp.stages[stageIdx];
  return standings(stageFixtures(c, comp, stageIdx, group), st.groups[group] ?? [], t.points, t.tiebreakers, comp.id);
}

export function leagueTable(c: Career, comp: CompInstance): StandingRow[] {
  const idx = comp.stages.findIndex((s) => s.type === 'league');
  if (idx < 0) return [];
  return groupTable(c, comp, idx, 0);
}

// ───────────────────────── progressão ─────────────────────────

function stageComplete(c: Career, stage: Stage): boolean {
  return stage.fixtureIds.every((id) => {
    const f = c.fixtures[id];
    return !f || f.status !== 'scheduled';
  });
}

/** Verifica fases encerradas, cria próximas rodadas e sinaliza competições finalizadas. */
export function progressCompetition(c: Career, comp: CompInstance): CompEvent[] {
  const events: CompEvent[] = [];
  if (comp.status !== 'running') return events;
  const t = c.config.competitions[comp.templateId];
  let guard = 0;
  while (guard++ < 20) {
    const idx = comp.current;
    const stage = comp.stages[idx];
    if (!stage) break;
    if (stage.type === 'league') {
      if (!stageComplete(c, stage)) break;
      stage.done = true;
      const next = comp.stages[idx + 1];
      if (!next) {
        comp.status = 'finished';
        const table = leagueTable(c, comp);
        comp.champion = table[0]?.clubId;
        comp.runnerUp = table[1]?.clubId;
        events.push({ type: 'finished', compId: comp.id, clubIds: [comp.champion!], text: `${comp.name} encerrado.` });
        break;
      }
      let qualified: string[];
      if (comp.kind === 'state') qualified = groupTable(c, comp, idx, 0).slice(0, stage.advance ?? 4).map((r) => r.clubId);
      else qualified = stage.groups.flatMap((_, gi) => groupTable(c, comp, idx, gi).slice(0, stage.advance ?? 2).map((r) => r.clubId));
      for (const g of stage.groups) for (const id of g) if (!qualified.includes(id)) comp.eliminated[id] = stage.name;
      comp.current = idx + 1;
      if (comp.kind === 'state') {
        // semifinal 1º x 4º e 2º x 3º, melhor campanha com mando
        const nxt = comp.stages[idx + 1];
        nxt.groups = [qualified];
        const pairs: [string, string][] = [];
        for (let i = 0; i < qualified.length / 2; i++) pairs.push([qualified[i], qualified[qualified.length - 1 - i]]);
        createTies(c, comp, idx + 1, 0, pairs.map(([a, b]) => [a, b]));
        events.push({ type: 'stage', compId: comp.id, clubIds: qualified, text: `${comp.name}: definidos os semifinalistas.` });
      } else {
        comp.stages[idx + 1].groups = [qualified];
        startStage(c, comp, idx + 1, qualified);
        events.push({ type: 'stage', compId: comp.id, clubIds: qualified, text: `${comp.name}: definidos os classificados para o mata-mata.` });
      }
      continue;
    }
    // mata-mata
    const round = Math.max(0, ...stage.ties.map((x) => x.round));
    const ties = stage.ties.filter((x) => x.round === round);
    if (!ties.length) break;
    const states = ties.map((tie) => ({ tie, st: tieState(c, tie, t.ko.awayGoals) }));
    if (states.some((s) => !s.st.decided)) break;
    for (const { tie, st } of states) {
      if (tie.winner) continue;
      tie.winner = st.winner;
      tie.loser = st.loser;
      tie.aggA = st.aggA;
      tie.aggB = st.aggB;
      tie.note = st.note;
      if (st.loser) {
        comp.eliminated[st.loser] = stage.roundNames[round];
        events.push({ type: 'eliminated', compId: comp.id, clubIds: [st.loser, st.winner!], text: `${c.clubs[st.winner!]?.name} elimina ${c.clubs[st.loser]?.name} (${stage.roundNames[round]}).`, round: stage.roundNames[round] });
      }
    }
    const winners = ties.map((x) => x.winner!).filter(Boolean);
    const lastRound = round >= stage.roundNames.length - 1;
    if (lastRound) {
      stage.done = true;
      const next = comp.stages[idx + 1];
      const advancing = winners.concat(stage.byes ?? []);
      if (next) {
        comp.current = idx + 1;
        next.groups = next.type === 'league' ? [] : [advancing];
        startStage(c, comp, idx + 1, advancing);
        continue;
      }
      const final = ties[0];
      comp.champion = final.winner;
      comp.runnerUp = final.loser;
      comp.status = 'finished';
      events.push({ type: 'finished', compId: comp.id, clubIds: [final.winner!, final.loser!].filter(Boolean), text: `${c.clubs[final.winner!]?.name} conquista ${comp.name}!` });
      break;
    }
    // próxima rodada
    let pairs: [string, string][];
    if (round === 0 && stage.byes?.length) {
      const pool = bySeed(c, stage.byes.concat(winners));
      pairs = pairTopBottom(pool);
    } else if (comp.kind === 'state') {
      // estadual: melhor campanha manda o jogo
      const order = stage.groups[0];
      const sorted = winners.slice().sort((x, y) => order.indexOf(x) - order.indexOf(y));
      pairs = [];
      for (let i = 0; i < sorted.length / 2; i++) pairs.push([sorted[i], sorted[sorted.length - 1 - i]]);
    } else {
      pairs = [];
      for (let i = 0; i + 1 < winners.length; i += 2) {
        const a = winners[i], b = winners[i + 1];
        // o de menor nível manda o primeiro jogo
        pairs.push(levelOf(c, a) <= levelOf(c, b) ? [a, b] : [b, a]);
      }
    }
    createTies(c, comp, idx, round + 1, pairs);
    events.push({ type: 'drawn', compId: comp.id, clubIds: winners, text: `${comp.name}: confrontos da ${stage.roundNames[round + 1].toLowerCase()} definidos.`, round: stage.roundNames[round + 1] });
  }
  return events;
}

export function compFixtures(c: Career, comp: CompInstance): Fixture[] {
  return comp.stages.flatMap((s) => s.fixtureIds.map((id) => c.fixtures[id]).filter(Boolean));
}

/** Rodada da fase de pontos corridos de um jogo (para exibição). */
export function roundName(c: Career, f: Fixture): string {
  const comp = c.competitions[f.compId];
  const st = comp?.stages[f.stageIdx];
  if (!st) return '';
  if (st.type === 'league') return st.groups.length > 1 ? `Grupo ${String.fromCharCode(65 + (f.group ?? 0))} · ${f.round + 1}ª rodada` : `${f.round + 1}ª rodada`;
  return `${st.roundNames[f.round] ?? ''}${f.leg && (st.roundLegs?.[f.round] ?? 1) > 1 ? ` (${f.leg === 1 ? 'ida' : 'volta'})` : ''}`;
}
