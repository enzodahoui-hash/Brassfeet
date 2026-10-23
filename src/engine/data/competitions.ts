import { DEFAULT_REG } from '../match/subs';
import type { AwardsConfig, CompTemplate, CountryConfig, ProgressionConfig, SlotRule, UniverseConfig } from '../types';
import { DIVISIONS } from './clubs';
import { NATIONS } from './nations';

const KO_DEFAULT = { legs: 2 as const, finalLegs: 1 as const, awayGoals: false, extraTime: false, penalties: true, neutralFinal: true };

const LEAGUE_COEF: Record<string, number> = {
  eng1: 2.0, esp1: 1.9, ita1: 1.8, ger1: 1.8, fra1: 1.6, bra1: 1.4, arg1: 1.2, eng2: 1.1, esp2: 1.0, ita2: 0.95, ger2: 1.0, fra2: 0.9,
  bra2: 0.9, bra3: 0.6, bra4: 0.4, arg2: 0.7, uru1: 0.8, chi1: 0.8, chi2: 0.5, col1: 0.9, ecu1: 0.85, par1: 0.75, per1: 0.7, bol1: 0.6, ven1: 0.55,
};

const LEAGUE_COLORS: Record<string, [string, string]> = {
  BRA: ['#0b6b3a', '#f2c230'], ARG: ['#4a90c8', '#ffffff'], URU: ['#4a90c8', '#f2c230'], CHI: ['#b5242a', '#ffffff'], COL: ['#f2c230', '#1f3c88'],
  ECU: ['#f2c230', '#b5242a'], PAR: ['#b5242a', '#1f3c88'], PER: ['#b5242a', '#ffffff'], BOL: ['#2e7d32', '#f2c230'], VEN: ['#7b1f2e', '#f2c230'],
  ENG: ['#3d195b', '#ffffff'], ESP: ['#c8102e', '#f2c230'], ITA: ['#1a4b8c', '#ffffff'], GER: ['#d20515', '#111111'], FRA: ['#0b2a5b', '#d7ff3a'],
};

function leaguePrize(coef: number, n: number) {
  const champion = Math.round(1_200_000 * coef * coef);
  const byPosition = Array.from({ length: n }, (_, i) => Math.round(champion * (1 - (i / n) * 0.85)));
  return { participation: 0, win: Math.round(40_000 * coef), draw: Math.round(12_000 * coef), byPosition, byStage: {}, champion, tv: 0 };
}

function leagueTemplate(d: (typeof DIVISIONS)[number], all: typeof DIVISIONS): CompTemplate {
  const n = d.clubs.length + (d.procedural?.count ?? 0);
  const same = all.filter((x) => x.country === d.country).sort((a, b) => a.tier - b.tier);
  const upper = same.find((x) => x.tier === d.tier - 1);
  const lower = same.find((x) => x.tier === d.tier + 1);
  const coef = LEAGUE_COEF[d.id] ?? 0.7;
  const movers = d.country === 'BRA' ? 4 : n >= 18 ? 3 : 2;
  const [c1, c2] = LEAGUE_COLORS[d.country] ?? ['#1b5e20', '#ffffff'];
  return {
    id: d.id, name: d.name, short: d.short, kind: 'league', region: d.country, country: d.country, tier: d.tier, enabled: true,
    format: 'league', numClubs: n, turns: 2, points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['points', 'wins', 'gd', 'gf', 'h2h', 'fewestRed', 'lots'],
    promote: upper ? movers : 0, relegate: lower ? movers : 0, upperId: upper?.id, lowerId: lower?.id,
    ko: KO_DEFAULT,
    prize: leaguePrize(coef, n),
    dates: d.country === 'BRA' ? { start: '04-12', end: '12-06', weekday: 0 } : { start: '02-01', end: '12-06', weekday: 0 },
    importance: d.tier === 1 ? 3 : 2, coefficient: coef, color: c1, accent: c2,
  };
}

function cupTemplate(id: string, name: string, short: string, country: string, divisions: string[], max: number, coef: number): CompTemplate {
  const [c1, c2] = LEAGUE_COLORS[country] ?? ['#1b5e20', '#ffffff'];
  return {
    id, name, short, kind: 'cup', region: country, country, enabled: true, format: 'knockout', numClubs: max, turns: 1,
    points: { win: 3, draw: 1, loss: 0 }, tiebreakers: ['points'],
    ko: { legs: 1, finalLegs: country === 'BRA' ? 2 : 1, awayGoals: false, extraTime: country !== 'BRA', penalties: true, neutralFinal: country !== 'BRA', twoLegsFrom: country === 'BRA' ? 16 : undefined },
    participantsRule: { type: 'divisions', ids: divisions, max },
    prize: { participation: Math.round(60_000 * coef), win: 0, draw: 0, byPosition: [], champion: Math.round(3_000_000 * coef), tv: 0, byStage: { R2: Math.round(100_000 * coef), R16: Math.round(250_000 * coef), QF: Math.round(500_000 * coef), SF: Math.round(900_000 * coef), F: Math.round(1_500_000 * coef) } },
    dates: { start: '02-25', end: '11-04', weekday: 3 }, importance: 3, coefficient: coef, color: c2 === '#ffffff' ? c1 : c2, accent: c1,
  };
}

function stateTemplate(id: string, name: string, short: string, states: string[], color: string, accent: string): CompTemplate {
  return {
    id, name, short, kind: 'state', region: 'BRA', country: 'BRA', state: states.join(','), enabled: true, format: 'leaguePlayoff', numClubs: 12,
    turns: 1, points: { win: 3, draw: 1, loss: 0 }, tiebreakers: ['points', 'wins', 'gd', 'gf', 'lots'],
    ko: { legs: 1, finalLegs: 1, awayGoals: false, extraTime: false, penalties: true, neutralFinal: false }, playoffTeams: 4,
    participantsRule: { type: 'state', state: states.join(','), max: 12 },
    prize: { participation: 80_000, win: 20_000, draw: 6_000, byPosition: [], champion: 700_000, tv: 0, byStage: { SF: 120_000, F: 250_000 } },
    dates: { start: '01-11', end: '04-05', weekday: 0 }, importance: 2, coefficient: 0.6, color, accent,
  };
}

function continental(id: string, name: string, short: string, region: 'SA' | 'EU', slots: SlotRule[], groups: number, coef: number, weekday: number, color: string, accent: string, prizeScale: number): CompTemplate {
  return {
    id, name, short, kind: 'continental', region, enabled: true, format: 'groupsKO', numClubs: groups * 4, turns: 2,
    points: { win: 3, draw: 1, loss: 0 }, tiebreakers: ['points', 'gd', 'gf', 'h2h', 'awayGoals', 'lots'],
    ko: { legs: 2, finalLegs: 1, awayGoals: false, extraTime: false, penalties: true, neutralFinal: true },
    groups: { count: groups, size: 4, advance: 2, turns: 2 }, slots,
    prize: {
      participation: Math.round(1_500_000 * prizeScale), win: Math.round(300_000 * prizeScale), draw: Math.round(100_000 * prizeScale), byPosition: [],
      champion: Math.round(12_000_000 * prizeScale), tv: 0,
      byStage: { PRE: Math.round(300_000 * prizeScale), R16: Math.round(1_500_000 * prizeScale), QF: Math.round(2_500_000 * prizeScale), SF: Math.round(4_000_000 * prizeScale), F: Math.round(6_000_000 * prizeScale) },
    },
    dates: { start: '03-03', end: '11-21', weekday }, importance: region === 'EU' && id === 'champions_euro' ? 5 : 4, coefficient: coef, color, accent,
  };
}

const L = (sourceId: string, positions: number[]): SlotRule => ({ type: 'league', sourceId, positions });
const CUP = (sourceId: string): SlotRule => ({ type: 'cupWinner', sourceId });
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function defaultCompetitions(): Record<string, CompTemplate> {
  const out: Record<string, CompTemplate> = {};
  for (const d of DIVISIONS) out[d.id] = leagueTemplate(d, DIVISIONS);

  out.bra_cup = cupTemplate('bra_cup', 'Copa Nacional do Brasil', 'Copa BR', 'BRA', ['bra1', 'bra2', 'bra3', 'bra4'], 64, 1.3);
  out.arg_cup = cupTemplate('arg_cup', 'Copa Argentina', 'Copa ARG', 'ARG', ['arg1', 'arg2'], 40, 1.0);
  out.eng_cup = cupTemplate('eng_cup', 'Copa da Inglaterra', 'Copa ING', 'ENG', ['eng1', 'eng2'], 40, 1.6);
  out.esp_cup = cupTemplate('esp_cup', 'Copa do Rei Espanhola', 'Copa ESP', 'ESP', ['esp1', 'esp2'], 40, 1.4);
  out.ita_cup = cupTemplate('ita_cup', 'Copa da Itália', 'Copa ITA', 'ITA', ['ita1', 'ita2'], 40, 1.3);
  out.ger_cup = cupTemplate('ger_cup', 'Copa da Alemanha', 'Copa ALE', 'GER', ['ger1', 'ger2'], 36, 1.3);
  out.fra_cup = cupTemplate('fra_cup', 'Copa da França', 'Copa FRA', 'FRA', ['fra1', 'fra2'], 36, 1.2);

  out.bra_super = {
    ...cupTemplate('bra_super', 'Supercopa do Brasil', 'Supercopa', 'BRA', [], 2, 1.0),
    kind: 'super', numClubs: 2, participantsRule: { type: 'super', leagueId: 'bra1', cupId: 'bra_cup' },
    ko: { legs: 1, finalLegs: 1, awayGoals: false, extraTime: false, penalties: true, neutralFinal: true },
    prize: { participation: 500_000, win: 0, draw: 0, byPosition: [], champion: 1_500_000, tv: 0, byStage: {} },
    dates: { start: '01-28', end: '01-28', weekday: 3 }, importance: 3, color: '#f2c230', accent: '#0b6b3a',
  };

  out.est_sp = stateTemplate('est_sp', 'Estadual Bandeirante', 'Est. SP', ['SP'], '#111111', '#c8102e');
  out.est_rj = stateTemplate('est_rj', 'Estadual do Rio', 'Est. RJ', ['RJ'], '#1f3c88', '#ffffff');
  out.est_mg = stateTemplate('est_mg', 'Estadual Mineiro', 'Est. MG', ['MG'], '#b5242a', '#ffffff');
  out.est_rs = stateTemplate('est_rs', 'Estadual Gaúcho', 'Est. RS', ['RS'], '#2e7d32', '#f2c230');
  out.est_sul = stateTemplate('est_sul', 'Copa Sul', 'Copa Sul', ['PR', 'SC'], '#0b5394', '#ffffff');
  out.est_ne = stateTemplate('est_ne', 'Copa do Nordeste', 'Nordeste', ['BA', 'PE', 'CE', 'AL', 'RN', 'PB', 'SE', 'PI', 'MA'], '#e69138', '#0b5394');

  out.copa_americas = continental('copa_americas', 'Copa das Américas', 'Américas', 'SA', [
    L('bra1', range(1, 6)), CUP('bra_cup'), L('arg1', range(1, 4)), CUP('arg_cup'),
    L('uru1', [1, 2, 3]), L('chi1', [1, 2, 3]), L('col1', [1, 2, 3]), L('ecu1', [1, 2, 3]),
    L('par1', [1, 2]), L('per1', [1, 2]), L('bol1', [1, 2]), L('ven1', [1, 2]), { type: 'holder' },
  ], 8, 1.7, 2, '#0d2b4e', '#e8b923', 1.0);
  out.taca_elite = continental('taca_elite', 'Taça Continental de Elite', 'Taça Elite', 'SA', [
    L('bra1', range(7, 12)), L('arg1', range(5, 10)), L('uru1', [4, 5, 6]), L('chi1', [4, 5, 6]), L('col1', [4, 5, 6]), L('ecu1', [4, 5, 6]),
    L('par1', [3, 4]), L('per1', [3, 4]), L('bol1', [3, 4]), L('ven1', [3, 4]), { type: 'holder' },
  ], 8, 1.2, 4, '#5a1e1e', '#f0a830', 0.45);
  out.champions_euro = continental('champions_euro', 'Champions Euro', 'Champions', 'EU', [
    L('eng1', range(1, 7)), L('esp1', range(1, 7)), L('ita1', range(1, 6)), L('ger1', range(1, 6)), L('fra1', range(1, 6)), { type: 'holder' },
  ], 8, 2.4, 2, '#0a1a4a', '#c9d4ff', 2.2);
  out.europa_ch = continental('europa_ch', 'Europa Championship', 'Europa', 'EU', [
    L('eng1', [8, 9, 10]), CUP('eng_cup'), L('esp1', [8, 9, 10]), CUP('esp_cup'), L('ita1', [7, 8]), CUP('ita_cup'),
    L('ger1', [7, 8]), CUP('ger_cup'), L('fra1', [7]), CUP('fra_cup'), { type: 'holder' },
  ], 4, 1.8, 4, '#3a2200', '#ff8a1f', 0.8);
  return out;
}

export function defaultCountries(): CountryConfig[] {
  const codes = ['BRA', 'ARG', 'URU', 'CHI', 'COL', 'ECU', 'PAR', 'PER', 'BOL', 'VEN', 'ENG', 'ESP', 'ITA', 'GER', 'FRA'];
  const cups: Record<string, string> = { BRA: 'bra_cup', ARG: 'arg_cup', ENG: 'eng_cup', ESP: 'esp_cup', ITA: 'ita_cup', GER: 'ger_cup', FRA: 'fra_cup' };
  return codes.map((code) => ({
    code, name: NATIONS[code].name, region: ['ENG', 'ESP', 'ITA', 'GER', 'FRA'].includes(code) ? 'EU' : 'SA', enabled: true,
    leagues: DIVISIONS.filter((d) => d.country === code).sort((a, b) => a.tier - b.tier).map((d) => d.id),
    cup: cups[code], flag: NATIONS[code].flag,
  }));
}

export const AWARD_IDS = ['ballon', 'player', 'young', 'gk', 'def', 'mid', 'fwd', 'topscorer', 'coach', 'team', 'revelation', 'leagueBest', 'contBest', 'finalBest', 'leagueTop', 'contTop'] as const;

export function defaultAwards(): AwardsConfig {
  return {
    ballonName: 'Bola de Ouro', ballonDay: 28, nominees: 30, finalists: 3, minApps: 15, voters: 100, galaDate: '12-18',
    youngAge: 21, revelationAge: 23, enabled: true, scorerTieRule: 'all',
    weights: { performance: 30, goals: 18, assists: 10, titles: 18, regularity: 8, bigGames: 8, competitionLevel: 4, teamImportance: 2, continental: 2 },
    names: {
      ballon: 'Bola de Ouro', player: 'Melhor Jogador do Ano', young: 'Melhor Jovem', gk: 'Melhor Goleiro', def: 'Melhor Defensor', mid: 'Melhor Meio-Campista',
      fwd: 'Melhor Atacante', topscorer: 'Artilheiro do Ano', coach: 'Melhor Treinador', team: 'Time Ideal da Temporada', revelation: 'Revelação da Temporada',
      leagueBest: 'Craque da Liga', contBest: 'Melhor Jogador da Competição', finalBest: 'Melhor em Campo da Final',
    },
  };
}

export function defaultProgression(): ProgressionConfig {
  return { growthRate: 1, declineAge: 30, declineRate: 1, youthIntake: 'annual', intakeDates: ['01-20', '07-20'], retirementAgeShift: 0 };
}

/** Regulamento de substituições padrão (5 trocas em 3 oportunidades + 1 e 1 na prorrogação). */
function withSubs(comps: Record<string, CompTemplate>): Record<string, CompTemplate> {
  for (const t of Object.values(comps)) t.subs ??= { ...DEFAULT_REG };
  return comps;
}

export function defaultConfig(): UniverseConfig {
  return {
    currency: '€', startYear: 2027, countries: defaultCountries(), competitions: withSubs(defaultCompetitions()), awards: defaultAwards(), progression: defaultProgression(),
    transferWindows: [{ start: '01-01', end: '03-31' }, { start: '07-01', end: '08-31' }], freeAgentsAnytime: true, homeAdvantage: 1.08,
    gameName: 'Football Manager BR',
  };
}
