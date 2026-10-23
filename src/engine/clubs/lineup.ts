import type { Club, Lineup, Player, Pos, World } from '../types';
import { positionFit, ratingAt } from '../players/attributes';

export interface Slot {
  pos: Pos;
  x: number; // 0..100 (esquerda → direita)
  y: number; // 0..100 (próprio gol → ataque)
}

export const FORMATIONS: Record<string, Slot[]> = {
  '4-3-3': [
    { pos: 'GK', x: 50, y: 5 }, { pos: 'RB', x: 85, y: 26 }, { pos: 'CB', x: 62, y: 20 }, { pos: 'CB', x: 38, y: 20 }, { pos: 'LB', x: 15, y: 26 },
    { pos: 'DM', x: 50, y: 40 }, { pos: 'CM', x: 70, y: 52 }, { pos: 'CM', x: 30, y: 52 }, { pos: 'RW', x: 82, y: 76 }, { pos: 'ST', x: 50, y: 84 }, { pos: 'LW', x: 18, y: 76 },
  ],
  '4-4-2': [
    { pos: 'GK', x: 50, y: 5 }, { pos: 'RB', x: 85, y: 26 }, { pos: 'CB', x: 62, y: 20 }, { pos: 'CB', x: 38, y: 20 }, { pos: 'LB', x: 15, y: 26 },
    { pos: 'RM', x: 84, y: 54 }, { pos: 'CM', x: 61, y: 48 }, { pos: 'CM', x: 39, y: 48 }, { pos: 'LM', x: 16, y: 54 }, { pos: 'ST', x: 60, y: 82 }, { pos: 'ST', x: 40, y: 82 },
  ],
  '4-2-3-1': [
    { pos: 'GK', x: 50, y: 5 }, { pos: 'RB', x: 85, y: 26 }, { pos: 'CB', x: 62, y: 20 }, { pos: 'CB', x: 38, y: 20 }, { pos: 'LB', x: 15, y: 26 },
    { pos: 'DM', x: 62, y: 40 }, { pos: 'DM', x: 38, y: 40 }, { pos: 'RW', x: 80, y: 66 }, { pos: 'AM', x: 50, y: 64 }, { pos: 'LW', x: 20, y: 66 }, { pos: 'ST', x: 50, y: 85 },
  ],
  '3-5-2': [
    { pos: 'GK', x: 50, y: 5 }, { pos: 'CB', x: 72, y: 20 }, { pos: 'CB', x: 50, y: 17 }, { pos: 'CB', x: 28, y: 20 },
    { pos: 'RM', x: 88, y: 50 }, { pos: 'DM', x: 50, y: 38 }, { pos: 'CM', x: 67, y: 55 }, { pos: 'CM', x: 33, y: 55 }, { pos: 'LM', x: 12, y: 50 }, { pos: 'ST', x: 60, y: 82 }, { pos: 'ST', x: 40, y: 82 },
  ],
  '3-4-3': [
    { pos: 'GK', x: 50, y: 5 }, { pos: 'CB', x: 72, y: 20 }, { pos: 'CB', x: 50, y: 17 }, { pos: 'CB', x: 28, y: 20 },
    { pos: 'RM', x: 86, y: 50 }, { pos: 'CM', x: 60, y: 46 }, { pos: 'CM', x: 40, y: 46 }, { pos: 'LM', x: 14, y: 50 }, { pos: 'RW', x: 78, y: 78 }, { pos: 'ST', x: 50, y: 85 }, { pos: 'LW', x: 22, y: 78 },
  ],
  '5-3-2': [
    { pos: 'GK', x: 50, y: 5 }, { pos: 'RB', x: 88, y: 30 }, { pos: 'CB', x: 70, y: 19 }, { pos: 'CB', x: 50, y: 16 }, { pos: 'CB', x: 30, y: 19 }, { pos: 'LB', x: 12, y: 30 },
    { pos: 'CM', x: 70, y: 50 }, { pos: 'DM', x: 50, y: 42 }, { pos: 'CM', x: 30, y: 50 }, { pos: 'ST', x: 60, y: 80 }, { pos: 'ST', x: 40, y: 80 },
  ],
  '4-1-4-1': [
    { pos: 'GK', x: 50, y: 5 }, { pos: 'RB', x: 85, y: 26 }, { pos: 'CB', x: 62, y: 20 }, { pos: 'CB', x: 38, y: 20 }, { pos: 'LB', x: 15, y: 26 },
    { pos: 'DM', x: 50, y: 37 }, { pos: 'RM', x: 84, y: 58 }, { pos: 'CM', x: 62, y: 54 }, { pos: 'CM', x: 38, y: 54 }, { pos: 'LM', x: 16, y: 58 }, { pos: 'ST', x: 50, y: 84 },
  ],
};
export const FORMATION_NAMES = Object.keys(FORMATIONS);

export function slotsOf(formation: string): Slot[] {
  return FORMATIONS[formation] ?? FORMATIONS['4-3-3'];
}

/** Penalidade suavizada de familiaridade (os atributos já respondem pela posição). */
export function familiarity(p: Pick<Player, 'pos' | 'alt'>, slot: Pos): number {
  return 0.5 + 0.5 * positionFit(p, slot);
}

const POS_IDX: Record<Pos, number> = { GK: 0, RB: 1, CB: 2, LB: 3, DM: 4, CM: 5, AM: 6, RM: 7, LM: 8, RW: 9, LW: 10, ST: 11 };
let cacheGen = 0;
const ratingCache = new WeakMap<Player, { ovr: number; pos: Pos; gen: number; vals: Float64Array }>();

/** Invalida o cache de notas (usado pelo editor ao mudar posições/estilo). */
export function invalidateRatings(): void {
  cacheGen++;
}

/** Nota do jogador numa posição (com penalidade de familiaridade), com cache invalidado quando ele muda. */
export function slotRating(p: Player, slot: Pos): number {
  let e = ratingCache.get(p);
  if (!e || e.ovr !== p.ovr || e.pos !== p.pos || e.gen !== cacheGen) ratingCache.set(p, (e = { ovr: p.ovr, pos: p.pos, gen: cacheGen, vals: new Float64Array(12).fill(-1) }));
  const i = POS_IDX[slot];
  let v = e.vals[i];
  if (v < 0) v = e.vals[i] = ratingAt(p.attrs, slot, p.style) * familiarity(p, slot);
  return v;
}

export function isAvailable(p: Player, compId?: string): boolean {
  if (p.injury) return false;
  if (compId && (p.susp[compId] ?? 0) > 0) return false;
  return true;
}

export function availabilityNote(p: Player, compId?: string): string | null {
  if (p.injury) return `Lesionado (${p.injury.name}, ${p.injury.daysLeft} dias)`;
  if (compId && (p.susp[compId] ?? 0) > 0) return `Suspenso (${p.susp[compId]} jogo${p.susp[compId] > 1 ? 's' : ''})`;
  return null;
}

const ORDER: Pos[] = ['GK', 'CB', 'RB', 'LB', 'DM', 'ST', 'CM', 'AM', 'RW', 'LW', 'RM', 'LM'];

/** Escolhe o melhor onze disponível para a formação, considerando condição física. */
export function autoLineup(world: World, club: Club, formation: string, compId?: string, rotate = false): Lineup {
  const slots = slotsOf(formation);
  const pool = club.playerIds.map((id) => world.players[id]).filter((p) => p && isAvailable(p, compId));
  const used = new Set<string>();
  const starters: (string | null)[] = new Array(slots.length).fill(null);
  const idx = slots.map((s, i) => i).sort((a, b) => ORDER.indexOf(slots[a].pos) - ORDER.indexOf(slots[b].pos));
  for (const i of idx) {
    const slot = slots[i].pos;
    let best: Player | null = null;
    let bestScore = -1;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const condF = p.condition < 70 ? (rotate ? 0.7 : 0.85) : p.condition < 82 && rotate ? 0.94 : 1;
      const s = slotRating(p, slot) * condF;
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    if (best) {
      starters[i] = best.id;
      used.add(best.id);
    }
  }
  const rest = pool.filter((p) => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr);
  const bench: string[] = [];
  const gk = rest.find((p) => p.pos === 'GK');
  if (gk) bench.push(gk.id);
  for (const p of rest) {
    if (bench.length >= 9) break;
    if (!bench.includes(p.id)) bench.push(p.id);
  }
  return { starters, bench };
}

export interface LineupIssue {
  level: 'error' | 'warning';
  text: string;
  slot?: number;
}

export function validateLineup(world: World, club: Club, lineup: Lineup, formation: string, compId?: string): LineupIssue[] {
  const issues: LineupIssue[] = [];
  const slots = slotsOf(formation);
  const seen = new Set<string>();
  if (lineup.starters.length !== slots.length) issues.push({ level: 'error', text: 'A escalação não corresponde à formação.' });
  lineup.starters.forEach((id, i) => {
    if (!id) {
      issues.push({ level: 'error', text: `Posição ${i + 1} (${slots[i]?.pos}) sem jogador.`, slot: i });
      return;
    }
    const p = world.players[id];
    if (!p || p.clubId !== club.id || p.squad !== 'senior') {
      issues.push({ level: 'error', text: 'Jogador não pertence ao elenco profissional.', slot: i });
      return;
    }
    if (seen.has(id)) issues.push({ level: 'error', text: `${p.name} escalado duas vezes.`, slot: i });
    seen.add(id);
    const note = availabilityNote(p, compId);
    if (note) issues.push({ level: 'error', text: `${p.name}: ${note}.`, slot: i });
    const slot = slots[i]?.pos;
    if (slot) {
      const fit = positionFit(p, slot);
      if (slot === 'GK' && p.pos !== 'GK') issues.push({ level: 'warning', text: `${p.name} improvisado no gol.`, slot: i });
      else if (fit < 0.8) issues.push({ level: 'warning', text: `${p.name} fora de posição (${slot}).`, slot: i });
      if (p.condition < 65) issues.push({ level: 'warning', text: `${p.name} está cansado (${Math.round(p.condition)}%).`, slot: i });
    }
  });
  for (const id of lineup.bench) {
    if (seen.has(id)) issues.push({ level: 'error', text: `${world.players[id]?.name ?? id} está entre titulares e reservas.` });
    const p = world.players[id];
    if (p && availabilityNote(p, compId)) issues.push({ level: 'warning', text: `${p.name} no banco: ${availabilityNote(p, compId)}.` });
  }
  if (lineup.bench.length > 9) issues.push({ level: 'error', text: 'Máximo de 9 reservas.' });
  return issues;
}

/** Corrige a escalação do usuário trocando apenas jogadores indisponíveis. */
export function repairLineup(world: World, club: Club, lineup: Lineup | null, formation: string, compId?: string): { lineup: Lineup; changed: string[] } {
  const slots = slotsOf(formation);
  if (!lineup || lineup.starters.length !== slots.length) return { lineup: autoLineup(world, club, formation, compId), changed: ['Escalação automática aplicada.'] };
  const changed: string[] = [];
  const starters = lineup.starters.slice();
  const used = new Set(starters.filter(Boolean) as string[]);
  const ok = (id: string | null) => {
    if (!id) return false;
    const p = world.players[id];
    return !!p && p.clubId === club.id && p.squad === 'senior' && isAvailable(p, compId);
  };
  for (let i = 0; i < starters.length; i++) {
    if (ok(starters[i])) continue;
    const old = starters[i] ? world.players[starters[i]!] : null;
    if (starters[i]) used.delete(starters[i]!);
    const cands = club.playerIds.map((id) => world.players[id]).filter((p) => p && !used.has(p.id) && isAvailable(p, compId));
    cands.sort((a, b) => slotRating(b, slots[i].pos) - slotRating(a, slots[i].pos));
    const rep = cands[0];
    starters[i] = rep?.id ?? null;
    if (rep) {
      used.add(rep.id);
      changed.push(`${old ? old.name : 'Vaga'} → ${rep.name} (${slots[i].pos})`);
    }
  }
  const bench = lineup.bench.filter((id) => ok(id) && !used.has(id));
  const extra = club.playerIds.map((id) => world.players[id]).filter((p) => p && !used.has(p.id) && !bench.includes(p.id) && isAvailable(p, compId)).sort((a, b) => b.ovr - a.ovr);
  for (const p of extra) {
    if (bench.length >= 7) break;
    bench.push(p.id);
  }
  return { lineup: { starters, bench: bench.slice(0, 9) }, changed };
}
