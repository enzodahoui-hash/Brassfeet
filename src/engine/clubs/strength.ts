import type { Career, Club, World } from '../types';
import { autoLineup, slotRating, slotsOf } from './lineup';
import { ovrToLevel } from '../players/attributes';
import { clamp } from '../core/rng';

/**
 * Três conceitos separados:
 * 1) nível do clube (reputação/força estrutural, editável);
 * 2) qualidade do elenco (melhor onze possível, sem considerar forma);
 * 3) força atual (escalação real × condição, moral, entrosamento, ritmo e tática).
 */
export function squadQuality(w: World | Career, club: Club): number {
  const lu = autoLineup(w, club, club.tactics.formation);
  const slots = slotsOf(club.tactics.formation);
  let s = 0, n = 0;
  lu.starters.forEach((id, i) => {
    if (!id) return;
    s += ovrToLevel(slotRating(w.players[id], slots[i].pos));
    n++;
  });
  return n ? s / 11 : 0;
}

export function currentStrength(w: World | Career, club: Club): number {
  const lineup = club.lineup ?? autoLineup(w, club, club.tactics.formation);
  const slots = slotsOf(club.tactics.formation);
  let s = 0;
  lineup.starters.forEach((id, i) => {
    const p = id ? w.players[id] : null;
    if (!p || !slots[i]) return;
    const avail = p.injury ? 0.3 : 1;
    const f = (0.72 + 0.28 * (p.condition / 100)) * (0.94 + 0.12 * (p.morale / 100)) * (0.96 + 0.04 * (p.sharpness / 100)) * avail;
    s += ovrToLevel(slotRating(p, slots[i].pos) * f);
  });
  const cohesion = 0.96 + 0.08 * (club.cohesion / 100);
  return clamp((s / 11) * cohesion, 0, 25);
}

export function strengthSummary(w: World | Career, club: Club) {
  return { clubLevel: club.level, squad: squadQuality(w, club), current: currentStrength(w, club) };
}
