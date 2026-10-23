import type { Appearance, AwardWindow, Foot, Player, PlayerOrigin, Pos, SquadType } from '../types';
import { Rng, clamp } from '../core/rng';
import { A, ATTRS, ATTR_COUNT, POS_WEIGHTS, STYLE_WEIGHTS, type AttrKey, computeOvr, levelToOvr, scaleToOvr } from './attributes';
import { NAME_POOLS } from '../data/nations';
import { stylesFor } from './styles';
import { TRAITS } from './traits';

export { emptyStats } from './stats';
export function winOf(p: { win?: AwardWindow }): AwardWindow {
  return (p.win ??= emptyWindow());
}
export function emptyWindow(): AwardWindow {
  return { apps: 0, minutes: 0, goals: 0, assists: 0, ratingSum: 0, motm: 0, bigGames: 0, bigGameRatingSum: 0, contApps: 0, contGoals: 0, cleanSheets: 0, titles: 0, titleNames: [], levelSum: 0, teamGoalsShare: 0 };
}

export function randomAppearance(rng: Rng, nat: string): Appearance {
  const darker = ['NGA', 'SEN', 'CIV', 'CMR', 'GHA', 'GUI', 'MLI'].includes(nat);
  const mixed = ['BRA', 'COL', 'ECU', 'VEN', 'FRA', 'ENG', 'NED', 'BEL', 'POR', 'USA', 'CAN', 'MAR', 'ALG', 'EGY'].includes(nat);
  const skin = darker ? rng.int(3, 5) : mixed ? rng.int(0, 5) : rng.int(0, 2);
  return { skin, hair: rng.int(0, 7), hairColor: skin >= 3 ? rng.pick([0, 0, 1, 5]) : rng.int(0, 5), beard: rng.int(0, 4), face: rng.int(0, 3) };
}

export function randomName(rng: Rng, nat: string): { first: string; last: string; display: string } {
  const pool = NAME_POOLS[nat] ?? NAME_POOLS.BRA;
  const first = rng.pick(pool.first);
  let last = rng.pick(pool.last);
  if (rng.chance(0.15)) {
    const extra = rng.pick(pool.last);
    if (extra !== last) last = nat === 'BRA' || nat === 'POR' ? `${extra} ${last}` : last;
  }
  const display = pool.nick && rng.chance(pool.nick) ? first : `${first} ${last.split(' ').slice(-1)[0]}`;
  return { first, last, display };
}

const RELATED_ALT: Record<Pos, Pos[]> = {
  GK: [], RB: ['RM', 'CB', 'LB'], LB: ['LM', 'CB', 'RB'], CB: ['DM', 'RB', 'LB'], DM: ['CM', 'CB'], CM: ['DM', 'AM', 'RM', 'LM'],
  AM: ['CM', 'RW', 'LW', 'ST'], RM: ['RW', 'RB', 'CM'], LM: ['LW', 'LB', 'CM'], RW: ['RM', 'LW', 'AM', 'ST'], LW: ['LM', 'RW', 'AM', 'ST'], ST: ['AM', 'RW', 'LW'],
};

export function randomAlt(rng: Rng, pos: Pos): Pos[] {
  const pool = RELATED_ALT[pos].slice();
  const n = pos === 'GK' ? 0 : rng.weighted([0, 1, 2], (k) => [0.35, 0.45, 0.2][k]);
  rng.shuffle(pool);
  return pool.slice(0, n);
}

function bodyFor(rng: Rng, pos: Pos): { height: number; weight: number } {
  const ranges: Record<string, [number, number]> = { GK: [184, 199], CB: [179, 196], ST: [172, 195], DM: [172, 190], RW: [163, 184], LW: [163, 184], RB: [168, 186], LB: [168, 186], CM: [168, 188], AM: [165, 186], RM: [166, 185], LM: [166, 185] };
  const [lo, hi] = ranges[pos];
  const height = Math.round(rng.range(lo, hi));
  const weight = Math.round(height - 103 + rng.normal(0, 4));
  return { height, weight: clamp(weight, 55, 100) };
}

function randomFoot(rng: Rng, pos: Pos): Foot {
  if (rng.chance(0.06)) return 'A';
  if (['LB', 'LM', 'LW'].includes(pos)) return rng.chance(0.68) ? 'E' : 'D';
  return rng.chance(0.78) ? 'D' : 'E';
}

/** Monta atributos coerentes com posição, idade e estilo e depois ajusta à nota-alvo. */
export function buildAttrs(rng: Rng, pos: Pos, age: number, targetOvr: number, style: string | null, height: number): number[] {
  const w = POS_WEIGHTS[pos];
  const sw = (style && STYLE_WEIGHTS[style]) || {};
  const attrs: number[] = new Array(ATTR_COUNT).fill(0);
  for (let i = 0; i < ATTR_COUNT; i++) {
    const key = ATTRS[i].key as AttrKey;
    const group = ATTRS[i].group;
    let base: number;
    if (pos === 'GK') base = group === 'gol' ? targetOvr : group === 'men' ? targetOvr - 8 : targetOvr - 32;
    else if (group === 'gol') base = rng.range(5, 18);
    else base = (w[key] ?? 0) > 0 ? targetOvr : targetOvr - 14;
    if (sw[key]) base += 6;
    if (group !== 'gol' || pos === 'GK') base += rng.normal(0, 6.5);
    attrs[i] = base;
  }
  // idade: físico atinge o pico cedo, mental amadurece mais tarde
  const physicalAge = age < 20 ? -(20 - age) * 1.6 : age > 30 ? -(age - 30) * 2.2 : 0;
  const mentalAge = age < 23 ? -(23 - age) * 1.4 : age > 29 ? Math.min(6, (age - 29) * 1.2) : 0;
  for (const k of ['pac', 'acc', 'sta', 'agi'] as AttrKey[]) attrs[A[k]] += physicalAge;
  attrs[A.str] += age < 21 ? -(21 - age) * 2 : 0;
  for (const k of ['dec', 'com', 'con', 'lea', 'cns', 'psn'] as AttrKey[]) attrs[A[k]] += mentalAge;
  // altura influencia cabeceio, impulsão e agilidade
  const h = (height - 180) / 10;
  attrs[A.hea] += h * 4;
  attrs[A.jum] += h * 3;
  attrs[A.aer] += pos === 'GK' ? h * 3 : 0;
  attrs[A.agi] -= h * 2.5;
  const clamped = attrs.map((v) => clamp(v, 1, 99));
  return scaleToOvr(clamped, pos, style, targetOvr);
}

export interface MakePlayerOpts {
  nat: string;
  pos: Pos;
  age: number;
  level: number;
  potLevel: number;
  season: number;
  clubId: string | null;
  squad?: SquadType;
  origin?: PlayerOrigin;
  style?: string | null;
  traits?: string[];
  alt?: Pos[];
  foot?: Foot;
  firstName?: string;
  lastName?: string;
  name?: string;
  height?: number;
}

export function nextId(world: { nextId: number }, prefix = 'p'): { id: string; num: number } {
  const num = world.nextId++;
  return { id: `${prefix}${num}`, num };
}

export function makePlayer(world: { nextId: number }, rng: Rng, o: MakePlayerOpts): Player {
  const body = bodyFor(rng, o.pos);
  const height = o.height ?? body.height;
  const style = o.style === undefined ? (rng.chance(0.45) ? rng.pick(stylesFor(o.pos)).id : null) : o.style;
  const targetOvr = levelToOvr(clamp(o.level, 0, 25));
  const attrs = buildAttrs(rng, o.pos, o.age, targetOvr, style, height).map((v) => Math.round(clamp(v, 1, 100)));
  const nm = o.name ? { first: o.firstName ?? o.name.split(' ')[0], last: o.lastName ?? o.name.split(' ').slice(1).join(' '), display: o.name } : randomName(rng, o.nat);
  const { id, num } = nextId(world);
  const traits = o.traits ?? randomTraits(rng);
  const p: Player = {
    id, num,
    firstName: o.firstName ?? nm.first,
    lastName: o.lastName ?? nm.last,
    name: nm.display,
    nat: o.nat,
    birthYear: o.season - o.age,
    pos: o.pos,
    alt: o.alt ?? randomAlt(rng, o.pos),
    foot: o.foot ?? randomFoot(rng, o.pos),
    height,
    weight: body.weight + Math.round((height - body.height) * 0.8),
    attrs,
    ovr: 0,
    pot: 0,
    style,
    traits,
    clubId: o.clubId,
    squad: o.squad ?? 'senior',
    shirt: 0,
    contract: null,
    value: 0,
    reputation: 0,
    morale: 70 + rng.int(-8, 8),
    condition: 100,
    sharpness: 75,
    form: [],
    injury: null,
    injuries: [],
    susp: {},
    yellows: {},
    stats: {},
    history: [],
    achievements: [],
    origin: o.origin ?? 'generated',
    appearance: randomAppearance(rng, o.nat),
    experience: clamp((o.age - 17) * 6 + o.level, 0, 100),
    joined: 0,
    recentMinutes: [],
  };
  p.ovr = computeOvr(p);
  p.pot = Math.max(p.ovr, levelToOvr(clamp(o.potLevel, 0, 25)));
  return p;
}

export function randomTraits(rng: Rng): string[] {
  const n = rng.weighted([0, 1, 2], (k) => [0.45, 0.4, 0.15][k]);
  const out: string[] = [];
  while (out.length < n) {
    const t = rng.pick(TRAITS).id;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** Potencial para jovens: cauda longa — maioria modesta, raros excepcionais. */
export function rollPotential(rng: Rng, level: number, age: number, quality: number): number {
  if (age >= 29) return level;
  const room = age <= 18 ? 9 : age <= 21 ? 6.5 : age <= 24 ? 3.5 : 1.2;
  const extra = Math.abs(rng.normal(0, room * 0.55)) + rng.range(0, room * 0.35) + quality;
  return clamp(level + extra, level, 25);
}
