import type { Career, CompKind, Player, StatLine, StatRecord, World } from '../types';
import { STAT_FIELDS } from '../types';

// Estatísticas individuais. A temporada em andamento fica em p.stats (chave `${temporada}|${competição}|${clube}`);
// ao encerrar a temporada, cada linha vira um StatRecord permanente em p.statArchive. Toda consulta junta as
// duas fontes sem repetir a mesma (temporada, competição, clube), então nada é contado duas vezes.

export function emptyStats(): StatLine {
  const s = {} as StatLine;
  for (const f of STAT_FIELDS) s[f] = 0;
  return s;
}

/** Completa linhas antigas (salvamentos anteriores) com os campos novos zerados. */
export function normalizeLine(s: Partial<StatLine>): StatLine {
  const out = emptyStats();
  for (const f of STAT_FIELDS) out[f] = Number(s[f] ?? 0) || 0;
  return out;
}

export const statKey = (season: number, compId: string, clubId: string | null) => `${season}|${compId}|${clubId ?? 'livre'}`;

export function parseKey(k: string): { season: number; compId: string; clubId: string } {
  const [s, compId, clubId] = k.split('|');
  return { season: Number(s), compId, clubId: clubId ?? '' };
}

export function addInto(a: StatLine, b: StatLine): StatLine {
  for (const f of STAT_FIELDS) a[f] += b[f] ?? 0;
  return a;
}

export function pack(s: StatLine): number[] {
  return STAT_FIELDS.map((f) => (f === 'ratingSum' || f === 'xg' ? Math.round(s[f] * 100) / 100 : s[f]));
}

export function unpack(v: number[]): StatLine {
  const s = emptyStats();
  STAT_FIELDS.forEach((f, i) => (s[f] = v[i] ?? 0));
  return s;
}

/** Linha de estatística resolvida (temporada em andamento ou arquivada). */
export interface StatRow {
  season: number;
  compId: string;
  tpl: string;
  comp: string;
  kind: CompKind | '';
  clubId: string;
  club: string;
  live: boolean;
  s: StatLine;
}

function compInfo(w: World | Career, compId: string): { tpl: string; comp: string; kind: CompKind | '' } {
  const inst = 'competitions' in w ? (w as Career).competitions[compId] : undefined;
  if (inst) return { tpl: inst.templateId, comp: (w.config.competitions[inst.templateId]?.name ?? inst.name), kind: inst.kind };
  const tpl = compId.replace(/-\d{4}$/, '');
  const t = w.config.competitions[tpl];
  return { tpl, comp: t?.name ?? compId, kind: t?.kind ?? '' };
}

/** Todas as linhas do jogador: arquivo permanente + temporada em andamento, sem duplicar. */
export function statRows(w: World | Career, p: Player): StatRow[] {
  const out: StatRow[] = [];
  const seen = new Set<string>();
  for (const r of p.statArchive ?? []) {
    const k = statKey(r.season, r.compId, r.clubId);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ season: r.season, compId: r.compId, tpl: r.tpl, comp: r.comp, kind: r.kind, clubId: r.clubId, club: r.club, live: false, s: unpack(r.v) });
  }
  for (const [k, s] of Object.entries(p.stats)) {
    const { season, compId, clubId } = parseKey(k);
    const key = statKey(season, compId, clubId);
    if (seen.has(key)) continue;
    seen.add(key);
    const ci = compInfo(w, compId);
    out.push({ season, compId, ...ci, clubId, club: w.clubs[clubId]?.name ?? (clubId === 'livre' ? 'Sem clube' : clubId), live: true, s: normalizeLine(s) });
  }
  return out.sort((a, b) => b.season - a.season || a.comp.localeCompare(b.comp));
}

/** Soma das linhas que passam no filtro. */
export function sumRows(rows: StatRow[], f: (r: StatRow) => boolean = () => true): StatLine {
  const t = emptyStats();
  for (const r of rows) if (f(r)) addInto(t, r.s);
  return t;
}

/** Estatística de uma competição numa temporada (somando eventuais clubes diferentes na mesma competição). */
export function compStat(p: Player, season: number, compId: string): StatLine | undefined {
  let found: StatLine | undefined;
  const prefix = `${season}|${compId}|`;
  for (const [k, s] of Object.entries(p.stats)) {
    if (!k.startsWith(prefix)) continue;
    found = addInto(found ?? emptyStats(), normalizeLine(s));
  }
  if (found) return found;
  for (const r of p.statArchive ?? []) if (r.season === season && r.compId === compId) found = addInto(found ?? emptyStats(), unpack(r.v));
  return found;
}

/** Arquiva as linhas de uma temporada encerrada. Idempotente: nunca grava duas vezes a mesma linha. */
export function archiveSeason(c: Career, season: number): number {
  let n = 0;
  for (const p of Object.values(c.players)) n += archivePlayer(c, p, season);
  return n;
}

export function archivePlayer(c: Career, p: Player, season: number): number {
  let n = 0;
  for (const [k, s] of Object.entries(p.stats)) {
    const { season: y, compId, clubId } = parseKey(k);
    if (y !== season) continue;
    const line = normalizeLine(s);
    if (line.apps === 0 && line.missed === 0) continue;
    p.statArchive ??= [];
    if (p.statArchive.some((r) => r.season === y && r.compId === compId && r.clubId === clubId)) continue;
    const ci = compInfo(c, compId);
    const rec: StatRecord = { season: y, compId, tpl: ci.tpl, comp: ci.comp, kind: (ci.kind || 'league') as CompKind, clubId, club: c.clubs[clubId]?.name ?? clubId, v: pack(line) };
    p.statArchive.push(rec);
    n++;
  }
  return n;
}

// ───────────────────────── derivados (exibição) ─────────────────────────

export const per90 = (v: number, minutes: number) => (minutes > 0 ? (v * 90) / minutes : 0);
export const avgRating = (s: StatLine) => (s.apps > 0 ? s.ratingSum / s.apps : 0);
export const passPct = (s: StatLine) => (s.passes > 0 ? (s.passesOk / s.passes) * 100 : 0);
export const savePct = (s: StatLine) => (s.saves + s.conceded > 0 ? (s.saves / (s.saves + s.conceded)) * 100 : 0);
export const conversion = (s: StatLine) => (s.shots >= 5 ? (s.goals / s.shots) * 100 : null);
