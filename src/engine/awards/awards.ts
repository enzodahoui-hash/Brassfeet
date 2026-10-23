import type { Achievement, AwardCandidate, AwardResult, AwardWindow, Career, CompInstance, Player, Pos } from '../types';
import { compStat } from '../players/stats';
import { Rng, clamp, hashString, seedFrom } from '../core/rng';
import { mmdd, fmtDay } from '../core/date';
import { POS_LINE, ovrToLevel } from '../players/attributes';
import { emptyWindow } from '../players/generate';
import { addNews } from '../news/news';
import { compFixtures, leagueTable } from '../competitions/manager';
import { expectedRank } from '../board/board';
import { roundMoney } from '../players/value';
import { nationName } from '../data/nations';
import { traitEffects } from '../players/traits';

const POS_GOAL: Record<Pos, number> = { GK: 0, CB: 2.2, RB: 2, LB: 2, DM: 2, CM: 1.6, AM: 1.3, RM: 1.3, LM: 1.3, RW: 1.15, LW: 1.15, ST: 1 };

export function awardName(c: Career, id: string): string {
  if (id === 'ballon') return c.config.awards.ballonName;
  return c.config.awards.names[id] ?? id;
}

/** Pontuação explicável de um candidato a partir das estatísticas reais acumuladas. */
export function candidateScore(c: Career, p: Player, w: AwardWindow): { score: number; breakdown: Record<string, number> } {
  const cfg = c.config.awards.weights;
  const apps = Math.max(1, w.apps);
  const avg = w.ratingSum / apps;
  const line = POS_LINE[p.pos];
  const perf = clamp((avg - 6.4) * 40 + w.motm * 1.2, 0, 100);
  const goals = line === 'G' || line === 'D' ? clamp(w.cleanSheets * 3.2 + w.goals * 6, 0, 100) : clamp(w.goals * POS_GOAL[p.pos] * 2.3, 0, 100);
  const assists = clamp(w.assists * 4 * (line === 'D' ? 1.4 : 1), 0, 100);
  const titles = clamp(w.titles * 11, 0, 100);
  const regularity = clamp((w.apps / 48) * 100 * Math.min(1, w.minutes / (w.apps * 75)), 0, 100);
  const big = w.bigGames ? clamp((w.bigGameRatingSum / w.bigGames - 6.3) * 45 + Math.min(20, w.bigGames * 1.5), 0, 100) : 0;
  const level = clamp((w.levelSum / apps) * 42, 0, 100);
  const importance = clamp((w.teamGoalsShare / apps) * 110, 0, 100);
  const cont = clamp(w.contGoals * 6 + w.contApps * 2.2, 0, 100);
  const breakdown = { performance: perf, goals, assists, titles, regularity, bigGames: big, competitionLevel: level, teamImportance: importance, continental: cont };
  let total = 0;
  let wsum = 0;
  for (const k of Object.keys(breakdown) as (keyof typeof breakdown)[]) {
    total += breakdown[k] * cfg[k];
    wsum += cfg[k];
  }
  const rounded: Record<string, number> = {};
  for (const [k, v] of Object.entries(breakdown)) rounded[k] = Math.round(v * 10) / 10;
  return { score: Math.round((total / Math.max(1, wsum)) * 100) / 100, breakdown: rounded };
}

function makeCandidate(c: Career, p: Player, w: AwardWindow): AwardCandidate {
  const { score, breakdown } = candidateScore(c, p, w);
  const club = p.clubId ? c.clubs[p.clubId] : null;
  return {
    playerId: p.id, name: p.name, clubId: club?.id ?? '', clubName: club?.name ?? 'Sem clube', nat: p.nat, pos: p.pos, level: Math.round(ovrToLevel(p.ovr)), score, breakdown,
    stats: { apps: w.apps, goals: w.goals, assists: w.assists, avg: w.apps ? Math.round((w.ratingSum / w.apps) * 100) / 100 : 0, titles: w.titleNames.slice(), contGoals: w.contGoals, motm: w.motm },
  };
}

/** Votação simulada (100 jornalistas fictícios, 6-4-3-2-1 pontos). Reprodutível pela semente da edição. */
export function simulateVotes(cands: AwardCandidate[], voters: number, seed: number): AwardCandidate[] {
  const rng = new Rng(seed);
  const pts = [6, 4, 3, 2, 1];
  for (const cd of cands) {
    cd.votes = 0;
    cd.firstPlaces = 0;
  }
  const pool = cands.slice(0, 15);
  for (let v = 0; v < voters; v++) {
    const ranked = pool.map((cd) => ({ cd, s: cd.score + rng.normal(0, 3.2) })).sort((a, b) => b.s - a.s);
    ranked.slice(0, 5).forEach((r, i) => {
      r.cd.votes! += pts[i];
      if (i === 0) r.cd.firstPlaces!++;
    });
  }
  const sorted = cands.slice().sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0) || (b.firstPlaces ?? 0) - (a.firstPlaces ?? 0) || b.score - a.score || hashString(a.playerId) - hashString(b.playerId));
  sorted.forEach((cd, i) => (cd.rank = i + 1));
  return sorted;
}

function addAchievement(p: Player, a: Achievement): boolean {
  if (p.achievements.some((x) => x.key === a.key)) return false;
  p.achievements.push(a);
  return true;
}

function bump(c: Career, pid: string, kind: 'nominated' | 'finalist' | 'won'): void {
  const p = c.players[pid];
  if (!p) return;
  p.nominations ??= { nominated: 0, finalist: 0, won: 0 };
  p.nominations[kind]++;
}

/** Repercussão: reputação, valor de mercado quando justificado, torcida e notícias. Atributos NÃO mudam. */
function repercussion(c: Career, res: AwardResult, major: boolean): void {
  const p = res.winnerId ? c.players[res.winnerId] : null;
  if (!p) return;
  const te = traitEffects(p.traits);
  p.reputation = clamp(p.reputation + (major ? 8 : 3) * (1 + te.repGrowth), 0, 100);
  if (major) p.value = roundMoney(p.value * 1.12);
  p.morale = clamp(p.morale + 10, 0, 100);
  const club = p.clubId ? c.clubs[p.clubId] : null;
  if (club) {
    club.fanMood = clamp(club.fanMood + (major ? 6 : 2), 0, 100);
    club.reputation = clamp(club.reputation + (major ? 1 : 0.3), 0, 100);
  }
  p.awardsCount ??= {};
  p.awardsCount[res.awardId] = (p.awardsCount[res.awardId] ?? 0) + 1;
  addAchievement(p, { key: `award|${res.key}`, kind: 'award', season: res.season, label: `${res.name} ${res.edition}`, awardId: res.awardId, clubId: club?.id, clubName: club?.name, day: res.day });
}

function prevWinners(c: Career, awardId: string): AwardResult[] {
  return Object.values(c.awards).filter((a) => a.awardId === awardId).sort((a, b) => b.edition - a.edition);
}

// ───────────────────────── Bola de Ouro ─────────────────────────

export function ballonDay(c: Career, year: number): number {
  const d = clamp(Math.round(c.config.awards.ballonDay), 25, 31);
  return mmdd(year, `10-${String(d).padStart(2, '0')}`);
}

/** Cerimônia anual. Idempotente: a mesma edição nunca é gerada duas vezes. */
export function runBallon(c: Career, year: number): AwardResult | null {
  const key = `ballon|${year}`;
  if (c.awards[key] || !c.config.awards.enabled) return null;
  const cfg = c.config.awards;
  const prev = prevWinners(c, 'ballon')[0];
  const cands: AwardCandidate[] = [];
  for (const p of Object.values(c.players)) {
    if (p.squad !== 'senior' || !p.win || p.win.apps < cfg.minApps) continue;
    cands.push(makeCandidate(c, p, p.win));
  }
  cands.sort((a, b) => b.score - a.score || hashString(a.playerId) - hashString(b.playerId));
  const nominees = cands.slice(0, cfg.nominees);
  const voted = simulateVotes(nominees, cfg.voters, seedFrom(c.id, key));
  const finalists = voted.slice(0, cfg.finalists).map((x) => x.playerId);
  const winner = voted[0];
  const res: AwardResult = {
    key, awardId: 'ballon', name: cfg.ballonName, edition: year, season: c.season, day: c.day, winnerId: winner?.playerId ?? null, winnerName: winner?.name ?? '—',
    winnerClubId: winner?.clubId, winnerClubName: winner?.clubName, winnerNat: winner?.nat, candidates: voted, finalists, simulated: true, headlines: [],
    windowLabel: `Desempenho de ${prev ? fmtDay(prev.day + 1) : `01/01/${year}`} a ${fmtDay(c.day)}`,
  };
  if (winner) {
    const p = c.players[winner.playerId];
    const times = (p?.awardsCount?.ballon ?? 0) + 1;
    res.headlines.push(`${winner.name} vence a ${cfg.ballonName} ${year}${times > 1 ? ` pela ${times}ª vez` : ''}!`);
    res.headlines.push(`${winner.votes} pontos na votação simulada; ${voted[1]?.name ?? ''} foi o segundo.`);
    if (prev && prev.winnerId === winner.playerId) res.headlines.push('Bicampeonato consecutivo!');
    for (const cd of nominees) bump(c, cd.playerId, 'nominated');
    for (const f of finalists) bump(c, f, 'finalist');
    bump(c, winner.playerId, 'won');
    repercussion(c, res, true);
    const club = winner.clubId ? c.clubs[winner.clubId] : null;
    addNews(c, {
      kind: 'award', icon: 'award', title: res.headlines[0], body: `${winner.name} (${winner.clubName}, ${nationName(winner.nat)}) superou ${voted.slice(1, 3).map((x) => x.name).join(' e ')}. ${winner.stats.goals} gols, ${winner.stats.assists} assistências e nota média ${winner.stats.avg} no período. Votação simulada do universo do jogo.`,
      clubIds: club ? [club.id] : [], playerIds: finalists, important: true, link: { screen: 'awards', id: key },
    });
  }
  c.awards[key] = res;
  // a janela de avaliação recomeça após a cerimônia
  for (const p of Object.values(c.players)) delete p.win;
  updateRecords(c);
  return res;
}

// ───────────────────────── gala de fim de ano ─────────────────────────

/** Agrega estatísticas da temporada (todas as competições) em formato de janela. */
export function seasonWindow(c: Career, p: Player, season: number): AwardWindow {
  const w = emptyWindow();
  for (const [k, s] of Object.entries(p.stats)) {
    const [yr, compId] = k.split('|');
    if (Number(yr) !== season) continue;
    const comp = c.competitions[compId];
    const coef = comp ? c.config.competitions[comp.templateId]?.coefficient ?? 1 : 1;
    w.apps += s.apps;
    w.minutes += s.minutes;
    w.goals += s.goals;
    w.assists += s.assists;
    w.ratingSum += s.ratingSum;
    w.motm += s.motm;
    w.cleanSheets += s.cleanSheets;
    w.levelSum += coef * s.apps;
    if (comp?.kind === 'continental') {
      w.contApps += s.apps;
      w.contGoals += s.goals;
    }
  }
  for (const a of p.achievements) if (a.kind === 'title' && a.season === season) {
    w.titles += 1.5;
    w.titleNames.push(a.compName ?? a.label);
  }
  w.teamGoalsShare = w.apps ? Math.min(1, (w.goals + w.assists * 0.6) / Math.max(10, w.apps * 1.6)) * w.apps : 0;
  w.bigGames = Math.round(w.contApps * 0.6);
  w.bigGameRatingSum = w.bigGames * (w.apps ? w.ratingSum / w.apps : 6.5);
  return w;
}

function bestBy(c: Career, season: number, filter: (p: Player) => boolean, minApps: number): AwardCandidate[] {
  const out: AwardCandidate[] = [];
  for (const p of Object.values(c.players)) {
    if (p.squad !== 'senior' || !filter(p)) continue;
    const w = seasonWindow(c, p, season);
    if (w.apps < minApps) continue;
    out.push(makeCandidate(c, p, w));
  }
  return out.sort((a, b) => b.score - a.score || hashString(a.playerId) - hashString(b.playerId));
}

function record(c: Career, res: AwardResult, major = false, newsBody?: string): void {
  if (c.awards[res.key]) return;
  c.awards[res.key] = res;
  if (res.winnerId) {
    for (const cd of res.candidates.slice(0, 10)) bump(c, cd.playerId, 'nominated');
    bump(c, res.winnerId, 'won');
    repercussion(c, res, major);
    const club = res.winnerClubId ? c.clubs[res.winnerClubId] : null;
    if (major || club?.id === c.userClubId) {
      addNews(c, { kind: 'award', icon: 'award', title: res.headlines[0] ?? `${res.winnerName} recebe ${res.name}`, body: newsBody ?? `${res.winnerName} (${res.winnerClubName}) foi eleito ${res.name.toLowerCase()} de ${res.edition}.`, clubIds: club ? [club.id] : [], playerIds: [res.winnerId], important: major, link: { screen: 'awards', id: res.key } });
    }
  }
}

export function galaDay(c: Career, year: number): number {
  return mmdd(year, c.config.awards.galaDate);
}

export function runGala(c: Career, year: number): AwardResult[] {
  if (!c.config.awards.enabled) return [];
  const out: AwardResult[] = [];
  const season = c.season;
  const mk = (id: string, cands: AwardCandidate[], major = false, extra: Partial<AwardResult> = {}) => {
    const key = `${id}|${year}`;
    if (c.awards[key]) return;
    const w = cands[0];
    const res: AwardResult = {
      key, awardId: id, name: awardName(c, id), edition: year, season, day: c.day, winnerId: w?.playerId ?? null, winnerName: w?.name ?? '—', winnerClubId: w?.clubId, winnerClubName: w?.clubName, winnerNat: w?.nat,
      candidates: cands.slice(0, 10).map((x, i) => ({ ...x, rank: i + 1 })), finalists: cands.slice(0, 3).map((x) => x.playerId), simulated: true,
      headlines: w ? [`${w.name} é eleito ${awardName(c, id)} de ${year}`] : [], ...extra,
    };
    record(c, res, major);
    out.push(res);
  };
  const line = (p: Player) => POS_LINE[p.pos];
  mk('player', bestBy(c, season, () => true, 20), true);
  mk('young', bestBy(c, season, (p) => season - p.birthYear <= c.config.awards.youngAge, 12));
  mk('gk', bestBy(c, season, (p) => line(p) === 'G', 15));
  mk('def', bestBy(c, season, (p) => line(p) === 'D', 15));
  mk('mid', bestBy(c, season, (p) => line(p) === 'M', 15));
  mk('fwd', bestBy(c, season, (p) => line(p) === 'A', 15));
  // artilheiro do ano (todas as competições oficiais)
  const scorers = Object.values(c.players)
    .map((p) => ({ p, w: seasonWindow(c, p, season) }))
    .filter((x) => x.w.goals > 0)
    .sort((a, b) => b.w.goals - a.w.goals || a.w.apps - b.w.apps || a.p.id.localeCompare(b.p.id));
  if (scorers.length) {
    const top = scorers.slice(0, 10).map((x) => makeCandidate(c, x.p, x.w));
    mk('topscorer', top, false, { headlines: [`${scorers[0].p.name} é o artilheiro do ano com ${scorers[0].w.goals} gols`] });
  }
  // revelação: maior salto de nível entre jovens com minutos
  const rev = Object.values(c.players)
    .filter((p) => p.squad === 'senior' && season - p.birthYear <= c.config.awards.revelationAge)
    .map((p) => {
      const w = seasonWindow(c, p, season);
      const prev = p.history.filter((h) => h.season === season - 1).map((h) => h.level)[0] ?? ovrToLevel(p.ovr) - 1;
      return { p, w, gain: ovrToLevel(p.ovr) - prev };
    })
    .filter((x) => x.w.apps >= 12)
    .sort((a, b) => b.gain * 10 + candidateScore(c, b.p, b.w).score - (a.gain * 10 + candidateScore(c, a.p, a.w).score));
  if (rev.length) mk('revelation', rev.slice(0, 10).map((x) => makeCandidate(c, x.p, x.w)));
  // time ideal 4-3-3
  const shape: [string, (p: Player) => boolean, number][] = [
    ['GK', (p) => p.pos === 'GK', 1], ['RB', (p) => p.pos === 'RB', 1], ['CB', (p) => p.pos === 'CB', 2], ['LB', (p) => p.pos === 'LB', 1],
    ['MC', (p) => ['DM', 'CM', 'AM'].includes(p.pos), 3], ['PD', (p) => ['RW', 'RM'].includes(p.pos), 1], ['ATA', (p) => p.pos === 'ST', 1], ['PE', (p) => ['LW', 'LM'].includes(p.pos), 1],
  ];
  const team: { pos: string; playerId: string; name: string; clubName: string }[] = [];
  const used = new Set<string>();
  for (const [pos, f, n] of shape) {
    for (const cd of bestBy(c, season, f, 15).filter((x) => !used.has(x.playerId)).slice(0, n)) {
      team.push({ pos, playerId: cd.playerId, name: cd.name, clubName: cd.clubName });
      used.add(cd.playerId);
      const p = c.players[cd.playerId];
      if (p) addAchievement(p, { key: `award|team|${year}`, kind: 'award', season, label: `${awardName(c, 'team')} ${year}`, awardId: 'team', day: c.day, clubName: cd.clubName });
    }
  }
  const teamKey = `team|${year}`;
  if (!c.awards[teamKey]) {
    c.awards[teamKey] = { key: teamKey, awardId: 'team', name: awardName(c, 'team'), edition: year, season, day: c.day, winnerId: null, winnerName: 'Seleção da temporada', candidates: [], finalists: [], simulated: true, team, headlines: ['Divulgado o time ideal da temporada'] };
    out.push(c.awards[teamKey]);
  }
  // melhor treinador: superação frente à expectativa + títulos
  const coachKey = `coach|${year}`;
  if (!c.awards[coachKey]) {
    let best: { clubId: string; score: number } | null = null;
    for (const comp of Object.values(c.competitions)) {
      if (comp.season !== season || comp.kind !== 'league' || c.config.competitions[comp.templateId]?.tier !== 1) continue;
      const table = comp.finalTable ?? leagueTable(c, comp);
      const coef = c.config.competitions[comp.templateId].coefficient;
      table.forEach((row, i) => {
        const club = c.clubs[row.clubId];
        if (!club) return;
        const exp = expectedRank(c, club).rank;
        const titles = Object.values(c.competitions).filter((x) => x.season === season && x.champion === club.id).reduce((s, x) => s + (c.config.competitions[x.templateId]?.importance ?? 1), 0);
        const score = ((exp - (i + 1)) / table.length) * 40 + titles * 6 + (i === 0 ? 8 : 0) + coef * 3;
        if (!best || score > best.score) best = { clubId: club.id, score };
      });
    }
    if (best) {
      const b = best as { clubId: string; score: number };
      const club = c.clubs[b.clubId];
      const isUser = club.id === c.userClubId;
      const name = isUser ? c.manager.name : club.coach.name;
      c.awards[coachKey] = { key: coachKey, awardId: 'coach', name: awardName(c, 'coach'), edition: year, season, day: c.day, winnerId: null, winnerName: name, winnerClubId: club.id, winnerClubName: club.name, candidates: [], finalists: [], simulated: true, coach: { name, clubId: club.id, clubName: club.name, score: Math.round(b.score * 10) / 10, isUser }, headlines: [`${name} (${club.name}) é o melhor treinador de ${year}`] };
      if (isUser) {
        c.manager.reputation = clamp(c.manager.reputation + 6, 0, 100);
        c.manager.trophies.push({ compName: awardName(c, 'coach'), season });
      }
      addNews(c, { kind: 'award', icon: 'award', title: c.awards[coachKey].headlines[0], body: `A campanha do ${club.name} superou as expectativas do início da temporada.`, clubIds: [club.id], playerIds: [], important: isUser, link: { screen: 'awards', id: coachKey } });
      out.push(c.awards[coachKey]);
    }
  }
  updateRecords(c);
  return out;
}

// ───────────────────────── prêmios de competição e estrelas ─────────────────────────

export interface ScorerRow {
  playerId: string;
  goals: number;
  assists: number;
  apps: number;
  clubId: string;
}

/** Artilharia calculada a partir dos eventos das partidas válidas (gols anulados e jogos anulados não contam). */
export function computeScorers(c: Career, comp: CompInstance): ScorerRow[] {
  const map = new Map<string, ScorerRow>();
  const appsMap = new Map<string, number>();
  for (const f of compFixtures(c, comp)) {
    if (f.status !== 'played' || !f.result) continue;
    for (const g of f.result.goals) {
      if (g.disallowed || g.type === 'og') continue;
      const row = map.get(g.pid) ?? { playerId: g.pid, goals: 0, assists: 0, apps: 0, clubId: g.club };
      row.goals++;
      row.clubId = g.club;
      map.set(g.pid, row);
      if (g.aid) {
        const a = map.get(g.aid) ?? { playerId: g.aid, goals: 0, assists: 0, apps: 0, clubId: g.club };
        a.assists++;
        map.set(g.aid, a);
      }
    }
  }
  for (const [pid, row] of map) {
    const p = c.players[pid];
    row.apps = (p ? compStat(p, comp.season, comp.id)?.apps : undefined) ?? appsMap.get(pid) ?? 0;
  }
  return [...map.values()];
}

export function topScorers(c: Career, comp: CompInstance): ScorerRow[] {
  return computeScorers(c, comp).filter((r) => r.goals > 0).sort((a, b) => b.goals - a.goals || a.apps - b.apps || a.playerId.localeCompare(b.playerId));
}

/** Estrelas de artilharia: só após o encerramento oficial; empatados recebem conforme a regra configurada. */
export function awardScorerStars(c: Career, comp: CompInstance): string[] {
  if (comp.status !== 'finished') return [];
  const kind = comp.kind === 'league' ? 'gold_star' : comp.kind === 'continental' ? 'red_star' : null;
  // após a limpeza das partidas antigas, vale o registro oficial congelado no encerramento
  const rows: ScorerRow[] = comp.pruned && comp.topScorers
    ? comp.topScorers.map((t) => ({ playerId: t.playerId, goals: t.goals, assists: 0, apps: (c.players[t.playerId] ? compStat(c.players[t.playerId], comp.season, comp.id)?.apps : 0) ?? 0, clubId: t.clubId }))
    : topScorers(c, comp);
  if (!comp.pruned) {
    comp.topScorers = rows.slice(0, 20).map((r) => ({ playerId: r.playerId, name: c.players[r.playerId]?.name ?? c.retired[r.playerId]?.name ?? '?', clubId: r.clubId, goals: r.goals }));
    comp.topAssists = computeScorers(c, comp).filter((r) => r.assists > 0).sort((a, b) => b.assists - a.assists || a.playerId.localeCompare(b.playerId)).slice(0, 20).map((r) => ({ playerId: r.playerId, name: c.players[r.playerId]?.name ?? '?', clubId: r.clubId, assists: r.assists }));
  }
  if (!kind || !rows.length) return [];
  const max = rows[0].goals;
  let winners = rows.filter((r) => r.goals === max);
  const rule = c.config.awards.scorerTieRule;
  if (rule === 'fewerApps' && winners.length > 1) {
    const minApps = Math.min(...winners.map((w) => w.apps));
    winners = winners.filter((w) => w.apps === minApps);
  } else if (rule === 'moreAssists' && winners.length > 1) {
    const maxA = Math.max(...winners.map((w) => w.assists));
    winners = winners.filter((w) => w.assists === maxA);
  }
  const tplName = c.config.competitions[comp.templateId]?.name ?? comp.name;
  const out: string[] = [];
  for (const w of winners) {
    const p = c.players[w.playerId];
    if (!p) continue;
    const club = c.clubs[w.clubId];
    const label = `Artilheiro ${comp.kind === 'league' ? 'da' : 'da'} ${tplName} — Temporada ${comp.season}`;
    const added = addAchievement(p, { key: `${kind}|${comp.id}`, kind, season: comp.season, label, compId: comp.id, compTemplateId: comp.templateId, compName: tplName, goals: w.goals, clubId: club?.id, clubName: club?.name, day: c.day });
    if (added) {
      out.push(p.id);
      p.reputation = clamp(p.reputation + (kind === 'red_star' ? 4 : 2), 0, 100);
      const id = kind === 'gold_star' ? 'leagueTop' : 'contTop';
      const key = `${id}|${comp.id}|${p.id}`;
      if (!c.awards[key]) {
        c.awards[key] = { key, awardId: id, name: `Artilheiro — ${tplName}`, edition: comp.season, season: comp.season, day: c.day, scope: comp.id, winnerId: p.id, winnerName: p.name, winnerClubId: club?.id, winnerClubName: club?.name, winnerNat: p.nat, candidates: [], finalists: [], simulated: true, headlines: [`${p.name} termina como artilheiro da ${tplName} com ${w.goals} gols`] };
      }
      addNews(c, {
        kind: 'award', icon: kind === 'gold_star' ? 'star' : 'continental', title: `${p.name} é o artilheiro da ${tplName}${winners.length > 1 ? ' (dividido)' : ''}`,
        body: `${w.goals} gols na ${comp.name}. ${kind === 'gold_star' ? 'Estrela dourada' : 'Estrela vermelha'} adicionada ao currículo do atleta.${comp.kind === 'continental' ? ' Artilheiro brilha no continente e dispara no mercado.' : ''}`,
        clubIds: club ? [club.id] : [], playerIds: [p.id], important: comp.kind === 'continental' || club?.id === c.userClubId, link: { screen: 'player', id: p.id },
      });
      if (comp.kind === 'continental') p.value = roundMoney(p.value * 1.06);
    }
  }
  return out;
}

/** Craque da liga / melhor da competição continental / melhor em campo da final. */
export function competitionAwards(c: Career, comp: CompInstance): void {
  const t = c.config.competitions[comp.templateId];
  if (comp.kind === 'league' || comp.kind === 'continental') {
    const id = comp.kind === 'league' ? 'leagueBest' : 'contBest';
    const key = `${id}|${comp.id}`;
    if (!c.awards[key]) {
      const games = comp.kind === 'league' ? (comp.participants.length - 1) * (t.turns ?? 2) : 8;
      const cands: AwardCandidate[] = [];
      for (const p of Object.values(c.players)) {
        const s = compStat(p, comp.season, comp.id);
        if (!s || s.apps < games * 0.4) continue;
        const w = emptyWindow();
        Object.assign(w, { apps: s.apps, minutes: s.minutes, goals: s.goals, assists: s.assists, ratingSum: s.ratingSum, motm: s.motm, cleanSheets: s.cleanSheets, levelSum: s.apps * t.coefficient });
        if (comp.champion && p.clubId === comp.champion) {
          w.titles = 1.5;
          w.titleNames = [t.name];
        }
        w.teamGoalsShare = Math.min(1, (s.goals + s.assists * 0.6) / Math.max(8, s.apps * 1.6)) * s.apps;
        cands.push(makeCandidate(c, p, w));
      }
      cands.sort((a, b) => b.score - a.score || hashString(a.playerId) - hashString(b.playerId));
      const w = cands[0];
      if (w) {
        comp.bestPlayer = w.playerId;
        record(c, {
          key, awardId: id, name: `${awardName(c, id)} — ${t.name}`, edition: comp.season, season: comp.season, day: c.day, scope: comp.id, winnerId: w.playerId, winnerName: w.name, winnerClubId: w.clubId, winnerClubName: w.clubName, winnerNat: w.nat,
          candidates: cands.slice(0, 8).map((x, i) => ({ ...x, rank: i + 1 })), finalists: cands.slice(0, 3).map((x) => x.playerId), simulated: true, headlines: [`${w.name} é eleito ${awardName(c, id).toLowerCase()} da ${t.name}`],
        }, comp.kind === 'continental');
      }
    }
    // seleção da competição (continental)
    if (comp.kind === 'continental' && !comp.teamOfComp) {
      const ids = Object.values(c.players).filter((p) => (compStat(p, comp.season, comp.id)?.apps ?? 0) >= 5).sort((a, b) => {
        const sa = compStat(a, comp.season, comp.id)!, sb = compStat(b, comp.season, comp.id)!;
        return sb.ratingSum / sb.apps - sa.ratingSum / sa.apps;
      });
      const pick = (f: (p: Player) => boolean, n: number) => ids.filter(f).slice(0, n).map((p) => p.id);
      comp.teamOfComp = [...pick((p) => p.pos === 'GK', 1), ...pick((p) => POS_LINE[p.pos] === 'D', 4), ...pick((p) => POS_LINE[p.pos] === 'M', 3), ...pick((p) => POS_LINE[p.pos] === 'A', 3)];
    }
  }
  // melhor em campo da final
  const lastStage = comp.stages[comp.stages.length - 1];
  if (lastStage?.type === 'knockout') {
    const finalTie = lastStage.ties.find((x) => lastStage.roundKeys?.[x.round] === 'F');
    const lastFx = finalTie ? c.fixtures[finalTie.fixtureIds[finalTie.fixtureIds.length - 1]] : null;
    const motm = lastFx?.result?.motm;
    if (motm && c.players[motm]) {
      comp.finalMotm = motm;
      const p = c.players[motm];
      const key = `finalBest|${comp.id}`;
      record(c, { key, awardId: 'finalBest', name: `${awardName(c, 'finalBest')} — ${t.name}`, edition: comp.season, season: comp.season, day: c.day, scope: comp.id, winnerId: motm, winnerName: p.name, winnerClubId: p.clubId ?? undefined, winnerClubName: p.clubId ? c.clubs[p.clubId]?.name : undefined, winnerNat: p.nat, candidates: [], finalists: [], simulated: true, headlines: [`${p.name} é o melhor em campo da final da ${t.name}`] });
    }
  }
}

export function updateRecords(c: Career): void {
  const counts: Record<string, number> = {};
  for (const a of Object.values(c.awards)) if (a.awardId === 'ballon' && a.winnerId) counts[a.winnerId] = (counts[a.winnerId] ?? 0) + 1;
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best) {
    const name = c.players[best[0]]?.name ?? c.retired[best[0]]?.name ?? '?';
    c.records.ballonWins = { label: `Mais conquistas da ${c.config.awards.ballonName}`, value: best[1], holder: name, season: c.season };
  }
  for (const comp of Object.values(c.competitions)) {
    const top = comp.topScorers?.[0];
    if (!top) continue;
    const k = `goals|${comp.templateId}`;
    const cur = c.records[k];
    if (!cur || top.goals > cur.value) c.records[k] = { label: `Mais gols numa edição — ${c.config.competitions[comp.templateId]?.name ?? comp.name}`, value: top.goals, holder: top.name, season: comp.season };
  }
}

export function awardsOfPlayer(c: Career, pid: string): AwardResult[] {
  return Object.values(c.awards).filter((a) => a.winnerId === pid).sort((a, b) => b.edition - a.edition);
}

export function starsOf(p: Pick<Player, 'achievements'>): { gold: Achievement[]; red: Achievement[] } {
  return { gold: p.achievements.filter((a) => a.kind === 'gold_star'), red: p.achievements.filter((a) => a.kind === 'red_star') };
}
