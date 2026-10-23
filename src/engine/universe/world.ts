import type { Club, CrestDesign, FacilityId, Player, Pos, Sector, Stadium, Staff, StaffRole, Tactics, World } from '../types';
import { Rng, clamp } from '../core/rng';
import { DIVISIONS, NAME_PATTERNS, PALETTE, STADIUM_PATTERNS, type ClubSeed, type DivisionSeed } from '../data/clubs';
import { REAL_COACHES, REAL_PHOTOS, REAL_SQUADS, COMMONS_THUMB, type RealPlayerRow } from '../data/real';
import { FOREIGN_MIX, NAME_POOLS } from '../data/nations';
import { defaultConfig } from '../data/competitions';
import { makePlayer, randomName, rollPotential } from '../players/generate';
import { computeOvr, levelToOvr, ovrToLevel } from '../players/attributes';
import { expectedWage, marketValue, playerReputation } from '../players/value';
import { defaultKitCollection } from '../kits/kits';
import { referenceTicket } from '../stadium/stadium';

export const SCHEMA_VERSION = 5;

export const FACILITY_IDS: FacilityId[] = ['tc_pitches', 'tc_equipment', 'tc_gym', 'tc_technical', 'tc_recovery', 'tc_medical', 'tc_analysis', 'y_dorms', 'y_nutrition', 'y_study', 'y_living', 'y_recovery', 'y_monitoring'];

export const SQUAD_TEMPLATE: [Pos, number, number][] = [
  // posição, quantidade, titulares
  ['GK', 3, 1], ['CB', 4, 2], ['RB', 2, 1], ['LB', 2, 1], ['DM', 2, 1], ['CM', 3, 2], ['AM', 2, 1], ['RW', 2, 1], ['LW', 2, 1], ['ST', 2, 1],
];

export function defaultTactics(): Tactics {
  return {
    formation: '4-3-3', mentality: 0, pressing: 1, line: 1, tempo: 1, passing: 'mixed', counter: false, marking: 'zonal', width: 1,
    setPieces: 'mixed', captain: null, penaltyTaker: null, freeKickTaker: null,
  };
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function makeCrest(rng: Rng, colors: [string, string, string], name: string): CrestDesign {
  const words = strip(name).replace(/[^A-Za-z ]/g, '').split(' ').filter((w) => w.length > 2 && !['del', 'das', 'dos', 'the', 'von'].includes(w.toLowerCase()));
  const initials = (words.length >= 2 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? 'FC').slice(0, 2)).toUpperCase();
  return {
    shape: rng.pick(['shield', 'round', 'diamond', 'classic', 'square'] as const),
    pattern: rng.pick(['plain', 'stripes', 'halves', 'sash', 'chevron', 'quarters', 'band'] as const),
    c1: colors[0], c2: colors[1], c3: colors[2],
    symbol: rng.pick(['none', 'star', 'ball', 'crown', 'bird', 'lion', 'tower', 'wave', 'bolt', 'cross'] as const),
    initials, stars: 0,
  };
}

export function makeStadium(rng: Rng, name: string, capacity: number, level: number): Stadium {
  const split = [0.2, 0.2, 0.3, 0.3];
  const names = ['Norte', 'Sul', 'Leste', 'Oeste'];
  const sectors: Sector[] = names.map((n, i) => ({
    id: `s${i}`, name: n, capacity: Math.round((capacity * split[i]) / 10) * 10,
    tiers: clamp(Math.ceil((capacity * split[i]) / 9000), 1, 3), covered: level >= 15 ? i >= 2 || level >= 20 : rng.chance(0.15),
    seatLevel: clamp(Math.round(level / 2.6) + rng.int(-1, 1), 1, 10), closed: 0,
  }));
  const lv = (b = 0) => clamp(Math.round(level / 2.7) + b + rng.int(-1, 1), 1, 10);
  return {
    name, sectors, boxes: Math.round(clamp(level - 6, 0, 20) * 4), vip: lv(-1), shops: lv(), restaurants: lv(-1), parking: lv(-1), screens: lv(),
    accessibility: lv(), security: lv(), press: lv(),
    pitch: { quality: lv(), drainage: lv(), irrigation: lv(), lighting: lv(), maintenance: lv(), trainingPitch: lv(), condition: 85 },
    ticketPrice: 10, history: [], attendances: [],
  };
}

export function emptyClub(id: string, name: string, short: string, country: string, divisionId: string, level: number, colors: [string, string, string], rng: Rng): Club {
  const facilities = Object.fromEntries(FACILITY_IDS.map((f) => [f, clamp(Math.round(level / 2.6) + rng.int(-1, 1), 1, 10)])) as Record<FacilityId, number>;
  return {
    id, name, short, city: '', country, colors, crest: makeCrest(rng, colors, name), level, reputation: Math.round(clamp(level * 4, 1, 100)),
    divisionId, fans: 50_000, fanMood: 60, stadium: makeStadium(rng, `Estádio de ${name}`, 10_000, level), balance: 0, revenueBase: 0,
    transferBudget: 0, wageBudget: 0, ledger: [], installments: [], loans: [],
    coach: { name: 'Treinador', nat: country, rep: Math.round(level * 4) },
    board: { confidence: 60, objectives: [], president: '', members: [], warnings: 0 },
    playerIds: [], youthIds: [], tactics: defaultTactics(), lineup: null, facilities, projects: [], staffIds: [],
    staffLevel: clamp(Math.round(level * 0.75 + 2), 1, 20), kits: [], titles: [], seasons: [], events: [], cohesion: 55, lastStarters: [],
    overdraftDays: 0, embargo: false, rivals: [], totalInvested: {}, training: { focus: 'balanced', intensity: 1 },
  };
}

function homeNat(rng: Rng, country: string, level: number): string {
  const foreignShare = ['ENG', 'ITA', 'GER', 'FRA', 'ESP'].includes(country) ? (level >= 18 ? 0.55 : 0.35) : country === 'BRA' ? 0.12 : 0.15;
  if (rng.chance(foreignShare)) return rng.pick(FOREIGN_MIX[country] ?? ['BRA']);
  return country;
}

function parseStar(line: string) {
  const [name, nat, pos, alt, birth, lvl, pot, style, traits, foot] = line.split('|');
  return {
    name, nat, pos: pos as Pos, alt: (alt ? alt.split(',') : []) as Pos[], birth: Number(birth), level: Number(lvl), pot: Number(pot),
    style: style || null, traits: traits ? traits.split(',') : [], foot: (foot || 'D') as 'D' | 'E' | 'A',
  };
}

export function signContract(p: Player, clubLevel: number, season: number, years: number, rng?: Rng): void {
  const wage = expectedWage(p, clubLevel, season);
  p.contract = { wage, endYear: season + years - 1, signedDay: 0, role: 'rotation', releaseClause: rng && rng.chance(0.3) ? Math.round(marketValue(p, season) * rng.range(2, 4)) : undefined };
}

export function finalizePlayer(p: Player, clubLevel: number, season: number): void {
  p.ovr = computeOvr(p);
  if (p.pot < p.ovr) p.pot = p.ovr;
  p.reputation = playerReputation(ovrToLevel(p.ovr), clubLevel);
  p.value = marketValue(p, season);
}

export function addPlayerToClub(world: World, p: Player, club: Club | null, squad: 'senior' | 'youth' = 'senior'): void {
  world.players[p.id] = p;
  p.clubId = club?.id ?? null;
  p.squad = squad;
  if (!club) return;
  if (squad === 'senior') {
    if (!club.playerIds.includes(p.id)) club.playerIds.push(p.id);
  } else if (!club.youthIds.includes(p.id)) club.youthIds.push(p.id);
  assignShirt(world, club, p);
}

export function assignShirt(world: World, club: Club, p: Player): void {
  const used = new Set(club.playerIds.concat(club.youthIds).filter((id) => id !== p.id).map((id) => world.players[id]?.shirt));
  if (p.shirt && !used.has(p.shirt)) return;
  const pref: Record<Pos, number[]> = { GK: [1, 12, 23], RB: [2, 22], CB: [3, 4, 5, 15], LB: [6, 16], DM: [5, 8, 18], CM: [8, 14, 16], AM: [10, 20], RM: [7, 17], LM: [11, 21], RW: [7, 17], LW: [11, 19], ST: [9, 19, 29] };
  for (const n of pref[p.pos].concat(Array.from({ length: 98 }, (_, i) => i + 1))) {
    if (!used.has(n)) {
      p.shirt = n;
      return;
    }
  }
}

function proceduralClubs(rng: Rng, d: DivisionSeed, used: Set<string>): ClubSeed[] {
  const out: ClubSeed[] = [];
  const pr = d.procedural!;
  const pats = NAME_PATTERNS[pr.style];
  const stad = STADIUM_PATTERNS[pr.style];
  for (let i = 0; i < pr.count; i++) {
    const [city, state] = pr.cities[i % pr.cities.length];
    let name = '';
    for (let t = 0; t < 20; t++) {
      name = rng.pick(pats).replace('{c}', city);
      if (!used.has(name)) break;
    }
    used.add(name);
    const c1 = rng.pick(PALETTE);
    let c2 = rng.pick(PALETTE);
    while (c2 === c1) c2 = rng.pick(PALETTE);
    const level = Math.round(rng.range(pr.level[0], pr.level[1] + 0.99) * 10) / 10;
    const cap = Math.round((4 + level * 1.6 + rng.range(-2, 6)) * 10) / 10;
    const fans = Math.round(12 * Math.pow(1.45, level) * rng.range(0.6, 1.5));
    const key = `${d.id}_${strip(city).toLowerCase().replace(/[^a-z]/g, '')}${i}`;
    out.push([key, name, strip(city).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), city, `${c1},${c2},#ffffff`, level, rng.pick(stad).replace('{c}', city), cap, fans, state]);
  }
  return out;
}

function generateStaff(world: World, rng: Rng, role: StaffRole, ability: number, clubId: string | null, season: number): Staff {
  const nat = rng.pick(['BRA', 'BRA', 'ARG', 'POR', 'ESP', 'ITA', 'ENG', 'GER', 'FRA', 'URU', 'COL']);
  const nm = randomName(rng, nat);
  const id = `s${world.nextId++}`;
  const specialties: Record<StaffRole, string[]> = {
    coach: ['técnico', 'tático', 'ataque', 'defesa'], youthCoach: ['formação técnica', 'formação tática', 'desenvolvimento físico'], fitness: ['resistência', 'força', 'prevenção'],
    gkCoach: ['reflexos', 'posicionamento'], analyst: ['adversários', 'desempenho'], scout: ['América do Sul', 'Europa', 'base nacional'], medical: ['fisioterapia', 'ortopedia', 'nutrição'],
    devSpecialist: ['mentoria', 'psicologia esportiva', 'plano individual'],
  };
  const s: Staff = {
    id, name: `${nm.first} ${nm.last.split(' ').slice(-1)[0]}`, nat, age: rng.int(30, 64), role, ability: clamp(Math.round(ability), 1, 20),
    specialty: rng.pick(specialties[role]), wage: Math.round((15_000 + Math.pow(ability, 2.3) * 900) / 1000) * 1000, clubId, reputation: clamp(Math.round(ability * 5), 1, 100),
  };
  void season;
  world.staff[id] = s;
  return s;
}
export { generateStaff };

export interface BuildOptions {
  seed?: number;
  name?: string;
}

/** Gera o universo padrão de forma determinística (mesma semente → mesmo universo). */
export function buildDefaultWorld(opts: BuildOptions = {}): World {
  const rng = new Rng(opts.seed ?? 20270101);
  const config = defaultConfig();
  const season = config.startYear;
  const world: World = {
    schemaVersion: SCHEMA_VERSION,
    meta: { id: 'padrao', name: opts.name ?? 'Universo Padrão', createdAt: 0, base: 'padrao', description: 'Clubes reais de 15 países com os elencos atuais (outubro de 2026). Níveis são estimativas do jogo.', custom: false },
    config, clubs: {}, players: {}, staff: {}, retired: {}, nextId: 1,
  };
  const usedNames = new Set<string>();
  for (const d of DIVISIONS) for (const c of d.clubs) usedNames.add(c[1]);

  for (const d of DIVISIONS) {
    const seeds = d.clubs.concat(d.procedural ? proceduralClubs(rng, d, usedNames) : []);
    for (const s of seeds) {
      const [key, name, short, city, colorStr, level, stadiumName, capK, fansK, state, qid] = s;
      const colors = colorStr.split(',') as [string, string, string];
      const club = emptyClub(key, name, short, d.country, d.id, level, colors, rng);
      club.city = city;
      club.state = state;
      club.fans = Math.round(fansK * 1000);
      club.stadium = makeStadium(rng, stadiumName, Math.round(capK * 1000), level);
      void qid;
      const coach = REAL_COACHES[key];
      if (coach) club.coach = { name: coach, nat: d.country, rep: Math.round(level * 4) };
      else {
        const nm = randomName(rng, d.country);
        club.coach = { name: `${nm.first} ${nm.last.split(' ').slice(-1)[0]}`, nat: d.country, rep: Math.round(level * 3.5) };
      }
      const pres = randomName(rng, d.country);
      club.board.president = `${pres.first} ${pres.last.split(' ').slice(-1)[0]}`;
      club.board.members = [0, 1, 2].map(() => {
        const n = randomName(rng, d.country);
        return `${n.first} ${n.last.split(' ').slice(-1)[0]}`;
      });
      world.clubs[key] = club;
      populateSquad(world, rng, club, season);
    }
  }
  // rivais: clubes da mesma cidade
  const byCity: Record<string, string[]> = {};
  for (const c of Object.values(world.clubs)) (byCity[`${c.country}|${c.city}`] ??= []).push(c.id);
  for (const ids of Object.values(byCity)) for (const id of ids) world.clubs[id].rivals = ids.filter((x) => x !== id);

  // agentes livres: jogadores gerados pelo jogo (sem clube no início da carreira)
  for (let i = 0; i < 90; i++) {
    const nat = rng.pick(['BRA', 'BRA', 'ARG', 'URU', 'COL', 'ESP', 'ITA', 'FRA', 'ENG', 'GER', 'POR', 'CHI', 'PAR', 'NED']);
    const pos = rng.pick(['GK', 'CB', 'CB', 'RB', 'LB', 'DM', 'CM', 'CM', 'AM', 'RW', 'LW', 'ST', 'ST'] as Pos[]);
    const age = rng.int(19, 34);
    const level = clamp(rng.normal(9, 3.5), 2, 17);
    const p = makePlayer(world, rng, { nat, pos, age, level, potLevel: rollPotential(rng, level, age, 0), season, clubId: null });
    finalizePlayer(p, 8, season);
    addPlayerToClub(world, p, null);
  }
  // mercado de profissionais (comissão técnica)
  const roles: StaffRole[] = ['coach', 'youthCoach', 'fitness', 'gkCoach', 'analyst', 'scout', 'medical', 'devSpecialist'];
  for (const r of roles) for (let i = 0; i < 9; i++) generateStaff(world, rng, r, clamp(rng.normal(10, 4), 2, 20), null, season);

  for (const club of Object.values(world.clubs)) setupFinances(world, club, season);
  return world;
}

/** Jogador real a partir da linha de dados (Wikipédia/Wikidata). */
function realPlayer(world: World, rng: Rng, row: RealPlayerRow, club: Club, season: number): Player {
  const [name, nat, pos, alt, birth, level, pot, style, traits, foot, num, height, key, first, last] = row;
  const p = makePlayer(world, rng, {
    nat, pos: pos as Pos, age: season - birth, level, potLevel: pot, season, clubId: club.id, style: style || undefined, traits: traits ? traits.split(',') : undefined,
    alt: alt ? (alt.split(',') as Pos[]) : undefined, foot: (foot || undefined) as Player['foot'] | undefined, name, firstName: first || undefined, lastName: last || undefined, origin: 'real', height: height || undefined,
  });
  if (num > 0 && num < 100) p.shirt = num;
  const ph = REAL_PHOTOS[key];
  if (ph) p.photo = { src: COMMONS_THUMB + ph[0], author: ph[1], license: ph[2] };
  if (/^Q\d+$/.test(key)) p.wd = key;
  return p;
}

/** Elenco do clube: jogadores reais do elenco atual; posições sem cobertura são completadas pelo gerador. */
export function populateSquad(world: World, rng: Rng, club: Club, season: number): void {
  const L = club.level;
  const rows = REAL_SQUADS[club.id] ?? [];
  const counts: Record<string, number> = {};
  // elencos muito grandes: jovens de até 20 anos de menor nível vão para a base; profissional com até 34
  const ranked = rows.map((r, i) => ({ r, i })).sort((a, b) => b.r[5] - a.r[5]);
  const toYouth = new Set<number>();
  if (rows.length > 30) for (const { r, i } of ranked.slice(26).reverse()) if (season - r[4] <= 20 && rows.length - toYouth.size > 30) toYouth.add(i);
  const keep = new Set(ranked.filter(({ i }) => !toYouth.has(i)).slice(0, 34).map(({ i }) => i));
  rows.forEach((row, i) => {
    const p = realPlayer(world, rng, row, club, season);
    finalizePlayer(p, L, season);
    if (toYouth.has(i) || !keep.has(i)) {
      if (!toYouth.has(i)) return; // excedente sem perfil de base: fica fora (raro)
      p.contract = { wage: Math.round((3_000 + L * 900) / 100) * 100, endYear: season + 2, signedDay: 0, role: 'prospect' };
      p.youth = { plan: 'balanced', joined: 0, scoutNoise: rng.range(-1, 1), mentoring: false, recentGain: 0 };
      addPlayerToClub(world, p, club, 'youth');
      return;
    }
    signContract(p, L, season, rng.int(1, 5), rng);
    addPlayerToClub(world, p, club, 'senior');
    counts[p.pos] = (counts[p.pos] ?? 0) + 1;
  });
  // completa apenas o necessário (clubes sem dados públicos suficientes)
  const real = club.playerIds.length;
  const base = rows.length ? rows.map((r) => r[5]).sort((a, b) => b - a) : [];
  const ref = base.length >= 11 ? base.slice(0, 11).reduce((a, b) => a + b, 0) / 11 : clamp(L * 0.72 + 2, 2, 20);
  for (const [pos, n, starters] of SQUAD_TEMPLATE) {
    const have = counts[pos] ?? 0;
    const target = real >= 18 ? Math.min(n, pos === 'GK' ? 2 : 1) : n;
    for (let i = have; i < target; i++) {
      const tier = real >= 18 ? 2 : i < starters ? 0 : i < starters + 1 ? 1 : 2;
      const mean = tier === 0 ? ref : tier === 1 ? ref - 1.8 : ref - 3.2;
      const level = clamp(rng.normal(mean, 1.3), 0, 22);
      const age = tier === 0 ? rng.int(22, 32) : rng.chance(0.35) ? rng.int(18, 21) : rng.int(22, 34);
      const p = makePlayer(world, rng, { nat: homeNat(rng, club.country, L), pos, age, level, potLevel: rollPotential(rng, level, age, 0), season, clubId: club.id });
      finalizePlayer(p, L, season);
      signContract(p, L, season, rng.int(1, 4), rng);
      addPlayerToClub(world, p, club, 'senior');
    }
  }
  // base
  const youthCount = rng.int(6, 9);
  for (let i = 0; i < youthCount; i++) {
    const pos = rng.pick(['GK', 'CB', 'CB', 'RB', 'LB', 'DM', 'CM', 'CM', 'AM', 'RW', 'LW', 'ST', 'ST'] as Pos[]);
    const age = rng.int(15, 18);
    const level = clamp(rng.normal(L * 0.38 + (club.facilities.y_dorms ?? 3) * 0.25, 1.6), 0, 14);
    const potLevel = rollPotential(rng, level, age, club.facilities.y_monitoring * 0.15 + L * 0.08);
    const p = makePlayer(world, rng, { nat: homeNat(rng, club.country, 5), pos, age, level, potLevel, season, clubId: club.id, squad: 'youth', origin: 'youth' });
    finalizePlayer(p, L, season);
    p.contract = { wage: Math.round((3_000 + L * 900) / 100) * 100, endYear: season + 2, signedDay: 0, role: 'prospect' };
    p.youth = { plan: 'balanced', joined: 0, scoutNoise: rng.range(-1, 1), mentoring: false, recentGain: 0 };
    addPlayerToClub(world, p, club, 'youth');
  }
  assignRoles(world, club);
}

/** Define papéis esperados (titular, rotação, reserva) pelo ranking interno do elenco. */
export function assignRoles(world: World, club: Club): void {
  const ps = club.playerIds.map((id) => world.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  ps.forEach((p, i) => {
    if (!p.contract) return;
    p.contract.role = i < 3 ? 'key' : i < 12 ? 'first' : i < 18 ? 'rotation' : p.birthYear > 0 && i < 24 ? 'backup' : 'backup';
  });
}

export function wageBill(world: World, club: Club): number {
  let s = 0;
  for (const id of club.playerIds.concat(club.youthIds)) s += world.players[id]?.contract?.wage ?? 0;
  for (const id of club.staffIds) s += world.staff[id]?.wage ?? 0;
  return s;
}

/** Receita de referência calibrada para que um clube típico feche o ano perto do equilíbrio. */
export function setupFinances(world: World, club: Club, season: number): void {
  const bill = wageBill(world, club);
  const capacity = club.stadium.sectors.reduce((s, x) => s + x.capacity, 0);
  club.stadium.ticketPrice = referenceTicket(club);
  const expectedMatchday = Math.min(capacity, 8000 + Math.sqrt(club.fans) * 25) * 0.85 * club.stadium.ticketPrice * 1.25 * 26;
  club.revenueBase = Math.round(Math.max(bill * 1.05 - expectedMatchday, bill * 0.3) / 1000) * 1000;
  club.balance = Math.round((club.revenueBase * 0.22 + bill * 0.05) / 1000) * 1000;
  club.transferBudget = Math.round(club.balance * 0.5 / 1000) * 1000;
  club.wageBudget = Math.round(bill * 1.08 / 1000) * 1000;
  club.kits = [defaultKitCollection(club, season)];
}

export function playerLevelInt(p: Player): number {
  return Math.round(ovrToLevel(p.ovr));
}
export function ovrForLevel(level: number): number {
  return levelToOvr(level);
}
export { NAME_POOLS };
