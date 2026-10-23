import type { Career, Fixture } from '../types';

// Índices em memória (não são salvos; são reconstruídos ao carregar).
interface Index {
  byDay: Map<number, Set<string>>;
  byClub: Map<string, Map<number, string[]>>;
}
const cache = new WeakMap<Career, Index>();

function build(c: Career): Index {
  const ix: Index = { byDay: new Map(), byClub: new Map() };
  for (const f of Object.values(c.fixtures)) if (f.status !== 'void') addTo(ix, f);
  return ix;
}
function addTo(ix: Index, f: Fixture) {
  let d = ix.byDay.get(f.day);
  if (!d) ix.byDay.set(f.day, (d = new Set()));
  d.add(f.id);
  for (const club of [f.home, f.away]) {
    let m = ix.byClub.get(club);
    if (!m) ix.byClub.set(club, (m = new Map()));
    const arr = m.get(f.day) ?? [];
    if (!arr.includes(f.id)) arr.push(f.id);
    m.set(f.day, arr);
  }
}
function removeFrom(ix: Index, f: Fixture) {
  ix.byDay.get(f.day)?.delete(f.id);
  for (const club of [f.home, f.away]) {
    const m = ix.byClub.get(club);
    const arr = m?.get(f.day);
    if (arr) {
      const n = arr.filter((x) => x !== f.id);
      if (n.length) m!.set(f.day, n);
      else m!.delete(f.day);
    }
  }
}

export function index(c: Career): Index {
  let ix = cache.get(c);
  if (!ix) cache.set(c, (ix = build(c)));
  return ix;
}
export function resetIndex(c: Career): void {
  cache.delete(c);
}
export function registerFixture(c: Career, f: Fixture): void {
  c.fixtures[f.id] = f;
  addTo(index(c), f);
}
export function unregisterFixture(c: Career, f: Fixture): void {
  removeFrom(index(c), f);
}
export function moveFixture(c: Career, f: Fixture, day: number): void {
  const ix = index(c);
  removeFrom(ix, f);
  f.day = day;
  addTo(ix, f);
}
export function fixturesOn(c: Career, day: number): Fixture[] {
  const ids = index(c).byDay.get(day);
  if (!ids) return [];
  return [...ids].map((id) => c.fixtures[id]).filter(Boolean);
}
export function clubFixturesOn(c: Career, clubId: string, day: number): Fixture[] {
  return (index(c).byClub.get(clubId)?.get(day) ?? []).map((id) => c.fixtures[id]).filter((f) => f && f.status !== 'void');
}
/** Clube ocupado no dia (ou em dia adjacente, para garantir descanso mínimo). */
export function clubBusy(c: Career, clubId: string, day: number, ignore?: string, gap = 1): boolean {
  const m = index(c).byClub.get(clubId);
  if (!m) return false;
  for (let d = day - gap; d <= day + gap; d++) {
    const ids = m.get(d);
    if (ids && ids.some((id) => id !== ignore && c.fixtures[id]?.status !== 'void')) return true;
  }
  return false;
}
export function clubFixtures(c: Career, clubId: string): Fixture[] {
  const m = index(c).byClub.get(clubId);
  if (!m) return [];
  const out: Fixture[] = [];
  for (const ids of m.values()) for (const id of ids) if (c.fixtures[id]) out.push(c.fixtures[id]);
  return out.sort((a, b) => a.day - b.day);
}
export function nextClubFixture(c: Career, clubId: string, fromDay: number): Fixture | null {
  let best: Fixture | null = null;
  for (const f of clubFixtures(c, clubId)) if (f.status === 'scheduled' && f.day >= fromDay && (!best || f.day < best.day)) best = f;
  return best;
}

// Jogadores em recuperação (condição < 100 ou lesionados): evita varrer todo o universo diariamente.
const recoveringCache = new WeakMap<Career, Set<string>>();
export function recovering(c: Career): Set<string> {
  let s = recoveringCache.get(c);
  if (!s) {
    s = new Set();
    for (const p of Object.values(c.players)) if (p.condition < 100 || p.injury) s.add(p.id);
    recoveringCache.set(c, s);
  }
  return s;
}
export function markRecovering(c: Career, pid: string): void {
  recovering(c).add(pid);
}
