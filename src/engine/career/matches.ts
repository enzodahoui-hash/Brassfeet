import type { Career, Club, Fixture, FixtureResult, Player, Pos, Tactics } from '../types';
import { Rng, clamp, seedFrom } from '../core/rng';
import { autoLineup, repairLineup, slotsOf } from '../clubs/lineup';
import { MatchSim, type MatchInput, type MatchOutcome, type SideInput } from '../match/engine';
import { knockoutContext } from '../competitions/manager';
import { winOf } from '../players/generate';
import { emptyStats, normalizeLine, statKey } from '../players/stats';
import { DEFAULT_REG, defaultSubPlan } from '../match/subs';
import { A, ovrToLevel } from '../players/attributes';
import { traitEffects } from '../players/traits';
import { clubEffects } from '../infra/infra';
import { computeAttendance, pitchFactor, postMatchdayRevenue } from '../stadium/stadium';
import { post } from '../finance/ledger';
import { rollInjury } from '../players/progression';
import { addNews } from '../news/news';
import { markRecovering } from './index';

function aiTactics(c: Career, club: Club, starters: Player[]): Tactics {
  const t = { ...club.tactics };
  const byLead = starters.slice().sort((a, b) => b.attrs[A.lea] - a.attrs[A.lea]);
  const byFin = starters.filter((p) => p.pos !== 'GK').sort((a, b) => b.attrs[A.fin] + b.attrs[A.com] - (a.attrs[A.fin] + a.attrs[A.com]));
  const byFk = starters.filter((p) => p.pos !== 'GK').sort((a, b) => b.attrs[A.fin] + b.attrs[A.cro] - (a.attrs[A.fin] + a.attrs[A.cro]));
  if (!t.captain || !starters.some((p) => p.id === t.captain)) t.captain = byLead[0]?.id ?? null;
  if (!t.penaltyTaker || !starters.some((p) => p.id === t.penaltyTaker)) t.penaltyTaker = byFin[0]?.id ?? null;
  if (!t.freeKickTaker || !starters.some((p) => p.id === t.freeKickTaker)) t.freeKickTaker = byFk[0]?.id ?? null;
  return t;
}

export function buildSide(c: Career, f: Fixture, clubId: string, userControlled: boolean, autoSubs: boolean, live = false): { side: SideInput; changes: string[] } {
  const club = c.clubs[clubId];
  const formation = club.tactics.formation;
  let lineup;
  let changes: string[] = [];
  if (userControlled) {
    const r = repairLineup(c, club, club.lineup, formation, f.compId);
    lineup = r.lineup;
    changes = r.changed;
    club.lineup = lineup;
  } else {
    lineup = autoLineup(c, club, formation, f.compId, true);
  }
  const slots = slotsOf(formation);
  const starters: Player[] = [];
  const slotPos: Pos[] = [];
  for (let i = 0; i < slots.length; i++) {
    const id = lineup.starters[i];
    if (id && c.players[id]) {
      starters.push(c.players[id]);
      slotPos.push(slots[i].pos);
    }
  }
  // emergência: completa com jovens da base se faltar gente
  if (starters.length < 11) {
    for (const id of club.youthIds) {
      if (starters.length >= 11) break;
      const p = c.players[id];
      if (p && !p.injury && !starters.includes(p)) {
        starters.push(p);
        slotPos.push(slots[starters.length - 1]?.pos ?? p.pos);
      }
    }
  }
  const bench = lineup.bench.map((id) => c.players[id]).filter((p) => p && !starters.includes(p));
  const fx = clubEffects(c, club);
  const user = club.id === c.userClubId;
  const prep = user && club.training.focus === 'matchPrep' ? 4 : 0;
  const tactics = userControlled ? { ...club.tactics } : aiTactics(c, club, starters);
  if (userControlled) {
    const t = aiTactics(c, club, starters);
    tactics.captain = tactics.captain && starters.some((p) => p.id === tactics.captain) ? tactics.captain : t.captain;
    tactics.penaltyTaker = tactics.penaltyTaker && starters.some((p) => p.id === tactics.penaltyTaker) ? tactics.penaltyTaker : t.penaltyTaker;
    tactics.freeKickTaker = tactics.freeKickTaker && starters.some((p) => p.id === tactics.freeKickTaker) ? tactics.freeKickTaker : t.freeKickTaker;
  }
  return {
    side: {
      clubId, name: club.name, short: club.short, starters, slots: slotPos, bench, tactics,
      cohesion: clamp(club.cohesion * (0.9 + fx.cohesion * 0.1) + prep, 0, 100),
      homeFactor: f.neutral ? 1 : f.home === clubId ? c.config.homeAdvantage : 1, autoSubs, analysis: fx.analysis,
      plan: userControlled ? (club.subPlan ?? defaultSubPlan()) : undefined,
      reg: c.config.competitions[c.competitions[f.compId]?.templateId]?.subs ?? DEFAULT_REG,
      confirm: userControlled && live ? !!(club.subPlan ?? defaultSubPlan()).confirm : false,
    },
    changes,
  };
}

export function matchInput(c: Career, f: Fixture, detail: boolean, userAuto = true, live = false): { input: MatchInput; changes: string[] } {
  const comp = c.competitions[f.compId];
  const t = c.config.competitions[comp.templateId];
  const userHome = f.home === c.userClubId;
  const userAway = f.away === c.userClubId;
  const h = buildSide(c, f, f.home, userHome, userHome ? userAuto : true, live);
  const a = buildSide(c, f, f.away, userAway, userAway ? userAuto : true, live);
  const ko = knockoutContext(c, f);
  return {
    input: {
      seed: f.seed, home: h.side, away: a.side, neutral: f.neutral, importance: t?.importance ?? 2, bigGame: f.bigGame, derby: f.derby,
      needWinner: ko?.needWinner ?? false, aggregate: ko?.aggregate, awayPrev: ko?.awayPrev, awayGoals: ko?.awayGoals, extraTime: ko?.extraTime ?? false,
      penalties: true, pitch: pitchFactor(c.clubs[f.home]), detail,
    },
    changes: [...h.changes, ...a.changes],
  };
}

export function createLiveMatch(c: Career, f: Fixture, userAutoSubs = true): { sim: MatchSim; changes: string[] } {
  const { input, changes } = matchInput(c, f, true, userAutoSubs, true);
  return { sim: new MatchSim(input), changes };
}

/** Simula e aplica um jogo (usado para jogos da IA e para o modo "resultado rápido"). */
export function playFixture(c: Career, f: Fixture, detail = false): MatchOutcome {
  const { input } = matchInput(c, f, detail, true);
  const sim = new MatchSim(input);
  sim.runToEnd();
  const out = sim.outcome();
  applyOutcome(c, f, out, detail);
  return out;
}

function addStats(c: Career, f: Fixture, out: MatchOutcome): void {
  const comp = c.competitions[f.compId];
  const t = c.config.competitions[comp.templateId];
  const cont = comp.kind === 'continental';
  const big = f.bigGame || !!f.tieId;
  const teamGoals = [out.hg, out.ag];
  for (const l of out.lines) {
    const p = c.players[l.pid];
    if (!p) continue;
    const clubId = l.side === 0 ? f.home : f.away;
    const key = statKey(comp.season, comp.id, clubId);
    const s = (p.stats[key] = p.stats[key] ? normalizeLine(p.stats[key]) : emptyStats());
    s.apps++;
    if (l.started) s.starts++;
    s.minutes += l.minutes;
    s.goals += l.goals;
    s.assists += l.assists;
    s.yellow += l.yellow;
    s.red += l.red ? 1 : 0;
    s.ratingSum += l.rating;
    s.shots += l.shots;
    s.saves += l.saves;
    if (l.pid === out.motm) s.motm++;
    if (l.cleanSheet) s.cleanSheets++;
    if (l.slot === 'GK') s.conceded += l.conceded;
    s.sot += l.sot;
    s.xg = Math.round((s.xg + l.xg) * 100) / 100;
    s.keyPasses += l.keyPasses;
    s.passes += l.passes;
    s.passesOk += l.passesOk;
    s.tackles += l.tackles;
    s.interceptions += l.interceptions;
    s.clearances += l.clearances;
    s.blocks += l.blocks;
    s.fouls += l.fouls;
    s.fouled += l.fouled;
    s.offsides += l.offsides;
    s.errGoal += l.errGoal;
    s.penScored += l.penScored;
    s.penMissed += l.penMissed;
    s.penSaved += l.penSaved;
    s.concededOn += l.concededOn;
    const w = winOf(p);
    w.apps++;
    w.minutes += l.minutes;
    w.goals += l.goals;
    w.assists += l.assists;
    w.ratingSum += l.rating;
    if (l.pid === out.motm) w.motm++;
    w.levelSum += t?.coefficient ?? 1;
    if (big) {
      w.bigGames++;
      w.bigGameRatingSum += l.rating;
    }
    if (cont) {
      w.contApps++;
      w.contGoals += l.goals;
    }
    if (l.cleanSheet) w.cleanSheets++;
    const tg = teamGoals[l.side];
    w.teamGoalsShare += tg > 0 ? Math.min(1, (l.goals + l.assists * 0.6) / tg) : 0;
    p.form.push(l.rating);
    if (p.form.length > 5) p.form.shift();
    p.condition = l.condAfter;
    markRecovering(c, p.id);
    p.sharpness = clamp(p.sharpness + (l.minutes / 90) * 7, 0, 100);
    if (!p.recentMinutes.length) p.recentMinutes.push(0);
    p.recentMinutes[p.recentMinutes.length - 1] += l.minutes;
    if (p.loan && p.clubId === p.loan.toClubId) {
      p.loan.apps++;
      p.loan.goals += l.goals;
      p.loan.minutes += l.minutes;
      p.loan.ratingSum += l.rating;
    }
    // moral pelo resultado
    const diff = l.side === 0 ? out.hg - out.ag : out.ag - out.hg;
    const te = traitEffects(p.traits);
    let dm = diff > 0 ? 3 : diff < 0 ? -3 * (1 - te.pressure) : 0.5;
    if (l.pid === out.motm) dm += 4;
    if (l.rating < 5.5) dm -= 2;
    p.morale = clamp(p.morale + dm, 0, 100);
  }
}

/** Jogos perdidos por lesão: contados uma vez por partida oficial do clube. */
function addMissed(c: Career, f: Fixture, out: MatchOutcome): void {
  const comp = c.competitions[f.compId];
  const played = new Set(out.lines.map((l) => l.pid));
  for (const clubId of [f.home, f.away]) {
    for (const id of c.clubs[clubId].playerIds) {
      const p = c.players[id];
      if (!p?.injury || played.has(id)) continue;
      const key = statKey(comp.season, comp.id, clubId);
      const s = (p.stats[key] = p.stats[key] ? normalizeLine(p.stats[key]) : emptyStats());
      s.missed++;
    }
  }
}

function applyDiscipline(c: Career, f: Fixture, out: MatchOutcome): void {
  const comp = c.competitions[f.compId];
  // cumprem suspensão os suspensos dos dois clubes que não entraram em campo
  const played = new Set(out.lines.map((l) => l.pid));
  for (const clubId of [f.home, f.away]) {
    const club = c.clubs[clubId];
    for (const id of club.playerIds) {
      const p = c.players[id];
      if (p && (p.susp[comp.id] ?? 0) > 0 && !played.has(id)) {
        p.susp[comp.id]--;
        if (p.susp[comp.id] <= 0) delete p.susp[comp.id];
      }
    }
  }
  const rng = new Rng(seedFrom(f.seed, 'disc'));
  for (const card of out.cards) {
    const p = c.players[card.pid];
    if (!p) continue;
    if (card.red) {
      const games = card.second ? 1 : rng.chance(0.25) ? 3 : 2;
      p.susp[comp.id] = (p.susp[comp.id] ?? 0) + games;
      if (card.second) p.yellows[comp.id] = Math.max(0, (p.yellows[comp.id] ?? 0) - 1);
    } else {
      p.yellows[comp.id] = (p.yellows[comp.id] ?? 0) + 1;
      if (p.yellows[comp.id] >= 3) {
        p.yellows[comp.id] = 0;
        p.susp[comp.id] = (p.susp[comp.id] ?? 0) + 1;
      }
    }
  }
}

function applyInjuries(c: Career, f: Fixture, out: MatchOutcome): void {
  const rng = new Rng(seedFrom(f.seed, 'inj'));
  for (const inj of out.injuries) {
    const p = c.players[inj.pid];
    if (!p) continue;
    const club = p.clubId ? c.clubs[p.clubId] : null;
    const fx = club ? clubEffects(c, club) : null;
    const pitch = c.clubs[f.home].stadium.pitch;
    const bias = (pitch.quality < 4 ? 0.05 : 0) + traitEffects(p.traits).injury * 0.05 - (fx ? (1 - fx.injuryRisk) * 0.1 : 0);
    const r = rollInjury(rng, bias);
    p.injury = { name: r.name, daysLeft: r.days, since: c.day, severity: r.sev };
    markRecovering(c, p.id);
    if (club?.id === c.userClubId || ovrToLevel(p.ovr) >= 18) {
      addNews(c, { kind: 'injury', icon: 'injury', title: `${p.name} se lesiona`, body: `${r.name}: previsão de ${r.days} dias fora${club ? ` do ${club.name}` : ''}.`, clubIds: club ? [club.id] : [], playerIds: [p.id], link: { screen: 'player', id: p.id } });
    }
  }
}

function clubAfterMatch(c: Career, f: Fixture, out: MatchOutcome): void {
  const comp = c.competitions[f.compId];
  const t = c.config.competitions[comp.templateId];
  for (const [side, clubId] of [[0, f.home], [1, f.away]] as [0 | 1, string][]) {
    const club = c.clubs[clubId];
    const starters = out.lineups[side];
    const overlap = starters.filter((id) => club.lastStarters.includes(id)).length;
    const fx = clubEffects(c, club);
    const tactical = club.id === c.userClubId && club.training.focus === 'tactical' ? 1.3 : 1;
    club.cohesion = clamp(club.cohesion + (overlap / 11 - 0.55) * 4 * fx.cohesion * tactical, 15, 100);
    club.lastStarters = starters;
    const diff = side === 0 ? out.hg - out.ag : out.ag - out.hg;
    const imp = (t?.importance ?? 2) / 3;
    club.fanMood = clamp(club.fanMood + (diff > 0 ? 1.6 : diff < 0 ? -1.8 : -0.2) * imp * (f.derby ? 1.6 : 1), 5, 100);
    if (t && (t.prize.win || t.prize.draw) && comp.kind !== 'continental') {
      const amount = diff > 0 ? t.prize.win : diff === 0 ? t.prize.draw : 0;
      if (amount) post(c, club, { key: `mw|${f.id}|${club.id}`, day: f.day, amount, cat: 'premiações', desc: `${diff > 0 ? 'Vitória' : 'Empate'} x ${c.clubs[side === 0 ? f.away : f.home].short} — ${comp.name}` });
    } else if (t && comp.kind === 'continental') {
      const amount = diff > 0 ? t.prize.win : diff === 0 ? t.prize.draw : 0;
      if (amount) post(c, club, { key: `mw|${f.id}|${club.id}`, day: f.day, amount, cat: 'premiações', desc: `Bônus por resultado — ${comp.name}` });
    }
  }
}

/** Aplica o resultado oficial: estatísticas, tabelas, disciplina, lesões, finanças e moral. */
export function applyOutcome(c: Career, f: Fixture, out: MatchOutcome, detail: boolean): void {
  if (f.status === 'played') return; // nunca aplica duas vezes
  const comp = c.competitions[f.compId];
  const att = computeAttendance(c, f, comp);
  const res: FixtureResult = {
    hg: out.hg, ag: out.ag, et: out.et, pens: out.pens, goals: out.goals, cards: out.cards, stats: out.stats, motm: out.motm, attendance: att.attendance,
    injuries: out.injuries,
  };
  const userMatch = f.home === c.userClubId || f.away === c.userClubId;
  if (detail || userMatch) {
    res.ratings = Object.fromEntries(out.lines.map((l) => [l.pid, l.rating]));
    res.lineups = out.lineups;
    res.subs = out.subs;
    res.events = out.events;
    res.report = out.report;
    res.interventions = out.interventions;
  }
  f.result = res;
  f.status = 'played';
  addMissed(c, f, out);
  addStats(c, f, out);
  applyDiscipline(c, f, out);
  applyInjuries(c, f, out);
  clubAfterMatch(c, f, out);
  postMatchdayRevenue(c, f, comp, att);
  if (userMatch) userMatchNews(c, f);
}

function userMatchNews(c: Career, f: Fixture): void {
  const r = f.result!;
  const user = c.clubs[c.userClubId];
  const opp = c.clubs[f.home === user.id ? f.away : f.home];
  const ug = f.home === user.id ? r.hg : r.ag;
  const og = f.home === user.id ? r.ag : r.hg;
  const comp = c.competitions[f.compId];
  if (f.derby) {
    addNews(c, { kind: 'match', icon: 'match', title: `Clássico movimenta a rodada: ${c.clubs[f.home].short} ${r.hg} x ${r.ag} ${c.clubs[f.away].short}`, body: `${ug > og ? `Vitória do ${user.name} no clássico.` : ug < og ? `O ${opp.name} levou a melhor no clássico.` : 'Clássico terminou empatado.'} Público de ${r.attendance.toLocaleString('pt-BR')}.`, clubIds: [user.id, opp.id], playerIds: [], link: { screen: 'match', id: f.id } });
  } else if (Math.abs(ug - og) >= 4) {
    addNews(c, { kind: 'match', icon: 'match', title: ug > og ? `${user.name} goleia o ${opp.name}` : `${user.name} sofre goleada do ${opp.name}`, body: `${comp.name}: ${c.clubs[f.home].short} ${r.hg} x ${r.ag} ${c.clubs[f.away].short}.`, clubIds: [user.id, opp.id], playerIds: [], link: { screen: 'match', id: f.id } });
  }
  // sequência de vitórias/derrotas
  const recent = Object.values(c.fixtures).filter((x) => x.status === 'played' && (x.home === user.id || x.away === user.id)).sort((a, b) => b.day - a.day).slice(0, 5);
  const resOf = (x: Fixture) => Math.sign((x.home === user.id ? x.result!.hg - x.result!.ag : x.result!.ag - x.result!.hg));
  if (recent.length === 5 && recent.every((x) => resOf(x) > 0) && !c.flags[`streakW${c.day}`]) {
    c.flags[`streakW${c.day}`] = true;
    addNews(c, { kind: 'match', icon: 'match', title: `${user.name} emplaca cinco vitórias seguidas`, body: 'A sequência anima a torcida e aumenta a confiança da diretoria.', clubIds: [user.id], playerIds: [] });
  } else if (recent.length === 5 && recent.every((x) => resOf(x) < 0)) {
    addNews(c, { kind: 'board', icon: 'board', title: `Treinador do ${user.name} recebe críticas`, body: 'Cinco derrotas consecutivas colocam o trabalho em xeque.', clubIds: [user.id], playerIds: [], important: true });
  }
}

export function finishLiveMatch(c: Career, f: Fixture, sim: MatchSim): MatchOutcome {
  sim.runToEnd();
  const out = sim.outcome();
  applyOutcome(c, f, out, true);
  return out;
}
