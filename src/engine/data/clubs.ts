// Clubes reais por divisão (temporada 2026 na América do Sul, 2026/27 na Europa), gerados por
// scripts/real/build.mjs a partir da Wikipédia e do Wikidata. Escudos e uniformes continuam sendo
// desenhos próprios do jogo (sem logotipos oficiais). Os níveis 0..25 são estimativas editáveis.
import REAL_CLUBS from './real/clubs.json';

// [chave, nome, sigla, cidade, cores 'c1,c2,c3', nível, estádio, capacidade (mil), torcida (mil), estado, qid Wikidata]
export type ClubSeed = [string, string, string, string, string, number, string, number, number, string?, string?];

export interface DivisionSeed {
  id: string;
  country: string;
  tier: number;
  name: string;
  short: string;
  clubs: ClubSeed[];
  procedural?: { count: number; cities: [string, string?][]; level: [number, number]; style: 'pt' | 'es' | 'en' | 'it' | 'de' | 'fr' };
}

const META: Omit<DivisionSeed, 'clubs'>[] = [
  { id: 'bra1', country: 'BRA', tier: 1, name: 'Brasileiro Série A', short: 'Série A' },
  { id: 'bra2', country: 'BRA', tier: 2, name: 'Brasileiro Série B', short: 'Série B' },
  { id: 'bra3', country: 'BRA', tier: 3, name: 'Brasileiro Série C', short: 'Série C' },
  { id: 'bra4', country: 'BRA', tier: 4, name: 'Brasileiro Série D', short: 'Série D' },
  { id: 'arg1', country: 'ARG', tier: 1, name: 'Liga Argentina', short: 'Liga ARG' },
  { id: 'arg2', country: 'ARG', tier: 2, name: 'Primera Nacional', short: 'Nacional ARG' },
  { id: 'uru1', country: 'URU', tier: 1, name: 'Liga Uruguaia', short: 'Liga URU' },
  { id: 'chi1', country: 'CHI', tier: 1, name: 'Liga Chilena', short: 'Liga CHI' },
  { id: 'chi2', country: 'CHI', tier: 2, name: 'Ascenso Chileno', short: 'Ascenso CHI' },
  { id: 'col1', country: 'COL', tier: 1, name: 'Liga Colombiana', short: 'Liga COL' },
  { id: 'ecu1', country: 'ECU', tier: 1, name: 'Liga Equatoriana', short: 'Liga ECU' },
  { id: 'par1', country: 'PAR', tier: 1, name: 'Liga Paraguaia', short: 'Liga PAR' },
  { id: 'per1', country: 'PER', tier: 1, name: 'Liga Peruana', short: 'Liga PER' },
  { id: 'bol1', country: 'BOL', tier: 1, name: 'Liga Boliviana', short: 'Liga BOL' },
  { id: 'ven1', country: 'VEN', tier: 1, name: 'Liga Venezuelana', short: 'Liga VEN' },
  { id: 'eng1', country: 'ENG', tier: 1, name: 'Liga Inglesa', short: 'Liga ING' },
  { id: 'eng2', country: 'ENG', tier: 2, name: 'Segunda Inglesa', short: 'Seg. ING' },
  { id: 'esp1', country: 'ESP', tier: 1, name: 'Liga Espanhola', short: 'Liga ESP' },
  { id: 'esp2', country: 'ESP', tier: 2, name: 'Segunda Espanhola', short: 'Seg. ESP' },
  { id: 'ita1', country: 'ITA', tier: 1, name: 'Liga Italiana', short: 'Liga ITA' },
  { id: 'ita2', country: 'ITA', tier: 2, name: 'Série B Italiana', short: 'Seg. ITA' },
  { id: 'ger1', country: 'GER', tier: 1, name: 'Liga Alemã', short: 'Liga ALE' },
  { id: 'ger2', country: 'GER', tier: 2, name: '2ª Liga Alemã', short: 'Seg. ALE' },
  { id: 'fra1', country: 'FRA', tier: 1, name: 'Liga Francesa', short: 'Liga FRA' },
  { id: 'fra2', country: 'FRA', tier: 2, name: '2ª Liga Francesa', short: 'Seg. FRA' },
];

export const DIVISIONS: DivisionSeed[] = META.map((m) => ({ ...m, clubs: ((REAL_CLUBS as Record<string, unknown[][]>)[m.id] ?? []).map((c) => c.map((x) => (x === null ? undefined : x)) as ClubSeed) }));

export const NAME_PATTERNS: Record<string, string[]> = {
  pt: ['{c} Esporte Clube', 'Atlético {c}', '{c} Futebol Clube', 'Sociedade Esportiva {c}', 'União {c}', 'Grêmio {c}', 'América de {c}', 'Ferroviário de {c}', 'Operário de {c}', 'Independente de {c}', 'Esportivo {c}', 'Nacional de {c}'],
  es: ['Club Atlético {c}', 'Deportivo {c}', '{c} FC', 'Unión {c}', 'Sporting {c}', 'Club Social {c}', 'Atlético {c}', 'Racing de {c}', 'Juventud {c}', 'Independiente {c}', 'Real {c}', 'CD {c}'],
  en: ['{c} Athletic', '{c} Rovers', '{c} Albion', '{c} Wanderers', '{c} Borough', '{c} Harriers', '{c} Rangers', '{c} Town', '{c} County', '{c} Argyle', '{c} Villa', '{c} Corinthians'],
  it: ['AC {c}', 'US {c}', '{c} Calcio', 'Virtus {c}', 'Sporting {c}', 'Unione {c}', 'Atletico {c}', 'Real {c}'],
  de: ['FC {c}', 'SV {c}', 'VfL {c}', 'Borussia {c}', 'SC {c}', 'TSV {c}', 'Eintracht {c}', 'Fortuna {c}', 'Arminia {c}', 'Dynamo {c}', 'Hertha {c}', 'Union {c}'],
  fr: ['FC {c}', 'AS {c}', 'Olympique {c}', 'Stade {c}', 'Racing {c}', 'SC {c}', 'US {c}', 'En Avant {c}', 'Sporting {c}', 'Girondins de {c}'],
};

export const STADIUM_PATTERNS: Record<string, string[]> = {
  pt: ['Estádio Municipal de {c}', 'Arena {c}', 'Estádio do Povo de {c}', 'Estádio Centenário de {c}'],
  es: ['Estadio Municipal de {c}', 'Estadio {c}', 'Coliseo de {c}', 'Estadio Centenario de {c}'],
  en: ['{c} Park', '{c} Road', '{c} Lane Stadium', '{c} Community Ground'],
  it: ['Stadio Comunale di {c}', 'Stadio {c}', 'Arena di {c}'],
  de: ['{c} Stadion', 'Arena {c}', 'Sportpark {c}'],
  fr: ['Stade Municipal de {c}', 'Stade de {c}', 'Parc des Sports de {c}'],
};

export const PALETTE = ['#c8102e', '#003da5', '#00843d', '#ffd100', '#111111', '#ffffff', '#f47920', '#5b2a86', '#4aa3df', '#7a1f2b', '#002f6c', '#e4002b'];
