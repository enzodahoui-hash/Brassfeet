import type { Fixture, StandingRow, Tiebreak } from '../types';
import { Rng, hashString } from '../core/rng';

/** Gera rodadas pelo método do círculo, alternando mando de campo; 2 turnos espelham o primeiro. */
export function roundRobin(teams: string[], turns: 1 | 2, seed = 1): [string, string][][] {
  const rng = new Rng(seed);
  const list = rng.shuffle(teams.slice());
  if (list.length % 2) list.push('__BYE__');
  const n = list.length;
  const rounds: [string, string][][] = [];
  const arr = list.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === '__BYE__' || b === '__BYE__') continue;
      // alterna o mando para equilibrar jogos em casa
      const homeFirst = i === 0 ? r % 2 === 0 : (i + r) % 2 === 0;
      pairs.push(homeFirst ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  if (turns === 2) {
    const second = rounds.map((r) => r.map(([h, a]) => [a, h] as [string, string]));
    return rounds.concat(second);
  }
  return rounds;
}

export function emptyRow(clubId: string): StandingRow {
  return { clubId, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, red: 0, form: [] };
}

export interface Points {
  win: number;
  draw: number;
  loss: number;
}

/** Soma resultados de partidas válidas (jogadas e não anuladas). */
export function accumulate(fixtures: Fixture[], clubIds: string[], pts: Points): Map<string, StandingRow> {
  const rows = new Map(clubIds.map((id) => [id, emptyRow(id)]));
  const sorted = fixtures.filter((f) => f.status === 'played' && f.result).sort((a, b) => a.day - b.day);
  for (const f of sorted) {
    const r = f.result!;
    const h = rows.get(f.home);
    const a = rows.get(f.away);
    if (!h || !a) continue;
    h.p++; a.p++;
    h.gf += r.hg; h.ga += r.ag; a.gf += r.ag; a.ga += r.hg;
    for (const c of r.cards) if (c.red) (c.club === f.home ? h : a).red++;
    if (r.hg > r.ag) { h.w++; a.l++; h.pts += pts.win; a.pts += pts.loss; h.form.push('V'); a.form.push('D'); }
    else if (r.hg < r.ag) { a.w++; h.l++; a.pts += pts.win; h.pts += pts.loss; h.form.push('D'); a.form.push('V'); }
    else { h.d++; a.d++; h.pts += pts.draw; a.pts += pts.draw; h.form.push('E'); a.form.push('E'); }
  }
  for (const r of rows.values()) r.form = r.form.slice(-5);
  return rows;
}

function critValue(crit: Tiebreak, row: StandingRow, group: StandingRow[], fixtures: Fixture[], pts: Points, salt: string): number {
  switch (crit) {
    case 'points': return row.pts;
    case 'wins': return row.w;
    case 'gd': return row.gf - row.ga;
    case 'gf': return row.gf;
    case 'fewestRed': return -row.red;
    case 'awayGoals': {
      let g = 0;
      for (const f of fixtures) if (f.status === 'played' && f.result && f.away === row.clubId) g += f.result.ag;
      return g;
    }
    case 'h2h': {
      const ids = new Set(group.map((g) => g.clubId));
      const mini = fixtures.filter((f) => ids.has(f.home) && ids.has(f.away));
      const m = accumulate(mini, [...ids], pts).get(row.clubId)!;
      return m.pts * 10000 + (m.gf - m.ga) * 100 + m.gf;
    }
    case 'lots': return hashString(`${salt}|${row.clubId}`) % 100000;
  }
}

function sortGroup(rows: StandingRow[], crits: Tiebreak[], idx: number, fixtures: Fixture[], pts: Points, salt: string): StandingRow[] {
  if (rows.length <= 1 || idx >= crits.length) return rows;
  const crit = crits[idx];
  const vals = new Map(rows.map((r) => [r.clubId, critValue(crit, r, rows, fixtures, pts, salt)]));
  const sorted = rows.slice().sort((a, b) => vals.get(b.clubId)! - vals.get(a.clubId)!);
  const out: StandingRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && vals.get(sorted[j + 1].clubId) === vals.get(sorted[i].clubId)) j++;
    out.push(...sortGroup(sorted.slice(i, j + 1), crits, idx + 1, fixtures, pts, salt));
    i = j + 1;
  }
  return out;
}

/** Classificação com critérios de desempate configuráveis (aplicados em ordem). */
export function standings(fixtures: Fixture[], clubIds: string[], pts: Points, tiebreakers: Tiebreak[], salt: string): StandingRow[] {
  const rows = [...accumulate(fixtures, clubIds, pts).values()];
  const crits = tiebreakers.length ? (tiebreakers[0] === 'points' ? tiebreakers : (['points', ...tiebreakers] as Tiebreak[])) : (['points', 'gd', 'gf', 'lots'] as Tiebreak[]);
  if (!crits.includes('lots')) crits.push('lots');
  return sortGroup(rows, crits, 0, fixtures, pts, salt);
}

export const TIEBREAK_NAMES: Record<Tiebreak, string> = {
  points: 'Pontos', wins: 'Vitórias', gd: 'Saldo de gols', gf: 'Gols marcados', h2h: 'Confronto direto', awayGoals: 'Gols fora de casa', fewestRed: 'Menos cartões vermelhos', lots: 'Sorteio',
};
