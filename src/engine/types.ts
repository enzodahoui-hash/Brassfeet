import type { Day } from './core/date';
export type { Day };

// ───────────────────────── Jogadores ─────────────────────────

export type Pos = 'GK' | 'RB' | 'CB' | 'LB' | 'DM' | 'CM' | 'AM' | 'RM' | 'LM' | 'RW' | 'LW' | 'ST';
export type Foot = 'D' | 'E' | 'A'; // direito, esquerdo, ambidestro
export type SquadType = 'senior' | 'youth';
export type SquadRole = 'key' | 'first' | 'rotation' | 'backup' | 'prospect';
export type YouthPlan = 'technical' | 'physical' | 'tactical' | 'position' | 'balanced' | 'proPrep';
export type PlayerOrigin = 'generated' | 'star' | 'real' | 'creator' | 'youth' | 'editor';

/** Foto real com licença livre (Wikimedia Commons), sempre exibida com o crédito. */
export interface PlayerPhoto {
  src: string;
  author: string;
  license: string;
}

export interface Appearance {
  skin: number;
  hair: number;
  hairColor: number;
  beard: number;
  face: number;
}

/** Estatísticas de um jogador numa competição, por temporada e clube (todas vêm dos eventos simulados). */
export interface StatLine {
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  ratingSum: number;
  motm: number;
  cleanSheets: number; // jogos (60+ min) sem a equipe sofrer gol enquanto estava em campo
  conceded: number; // goleiros: gols sofridos
  shots: number;
  saves: number;
  sot: number; // finalizações no alvo
  xg: number; // gols esperados das finalizações
  keyPasses: number; // passes que originaram finalização (chances criadas)
  passes: number;
  passesOk: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  blocks: number;
  fouls: number;
  fouled: number;
  offsides: number;
  errGoal: number; // erros que resultaram em gol
  penScored: number;
  penMissed: number;
  penSaved: number;
  concededOn: number; // gols sofridos pela equipe com o jogador em campo
  missed: number; // jogos perdidos por lesão
}

export const STAT_FIELDS = ['apps', 'starts', 'minutes', 'goals', 'assists', 'yellow', 'red', 'ratingSum', 'motm', 'cleanSheets', 'conceded', 'shots', 'saves', 'sot', 'xg', 'keyPasses', 'passes', 'passesOk', 'tackles', 'interceptions', 'clearances', 'blocks', 'fouls', 'fouled', 'offsides', 'errGoal', 'penScored', 'penMissed', 'penSaved', 'concededOn', 'missed'] as const;

/** Registro permanente de uma temporada encerrada (por competição e clube); valores na ordem de STAT_FIELDS. */
export interface StatRecord {
  season: number;
  compId: string;
  tpl: string;
  comp: string;
  kind: CompKind;
  clubId: string;
  club: string;
  v: number[];
}

export type AchievementKind = 'gold_star' | 'red_star' | 'title' | 'award';

export interface Achievement {
  key: string; // único por conquista (evita duplicidade)
  kind: AchievementKind;
  season: number;
  label: string;
  compId?: string;
  compTemplateId?: string;
  compName?: string;
  goals?: number;
  clubId?: string;
  clubName?: string;
  awardId?: string;
  day: Day;
}

export interface CareerEntry {
  season: number;
  clubId: string;
  clubName: string;
  apps: number;
  goals: number;
  assists: number;
  avgRating: number;
  level: number;
  value: number;
  loan?: boolean;
}

/** Acúmulo de desempenho para a janela de avaliação da Bola de Ouro. */
export interface AwardWindow {
  apps: number;
  minutes: number;
  goals: number;
  assists: number;
  ratingSum: number;
  motm: number;
  bigGames: number;
  bigGameRatingSum: number;
  contApps: number;
  contGoals: number;
  cleanSheets: number;
  titles: number; // pontos de títulos (ponderados pelo prestígio)
  titleNames: string[];
  levelSum: number; // soma do nível da competição em cada partida
  teamGoalsShare: number; // participações em gols da equipe
}

export interface Contract {
  wage: number; // anual
  endYear: number; // último ano de contrato (vence em 31/12)
  releaseClause?: number;
  signedDay: Day;
  role: SquadRole;
}

export interface Injury {
  name: string;
  daysLeft: number;
  since: Day;
  severity: number; // 1..3
}

export interface YouthInfo {
  plan: YouthPlan;
  joined: Day;
  scoutNoise: number; // -1..1 erro fixo da avaliação, escalado pela comissão
  devPos?: Pos;
  mentoring: boolean;
  recentGain: number;
  promotedDay?: Day;
}

export interface LoanInfo {
  fromClubId: string;
  toClubId: string;
  until: Day;
  wagePct: number; // % do salário pago pelo clube de destino
  fee: number;
  fromSquad?: SquadType;
  start?: Day;
  apps: number;
  goals: number;
  minutes: number;
  ratingSum: number;
}

export interface CreatorMeta {
  formativeClub?: string;
  backstory?: string;
  promise?: string;
  expectations?: string;
  createdDay?: Day;
  freeEdit: boolean;
}

export interface Player {
  id: string;
  num: number; // número interno único
  firstName: string;
  lastName: string;
  name: string; // nome esportivo
  nat: string;
  birthYear: number;
  pos: Pos;
  alt: Pos[];
  foot: Foot;
  height: number;
  weight: number;
  attrs: number[]; // ver ATTRS (1..100)
  ovr: number; // nota 1..100 ponderada pela posição (cache)
  pot: number; // potencial em nota 1..100
  style: string | null;
  traits: string[];
  clubId: string | null;
  squad: SquadType;
  shirt: number;
  contract: Contract | null;
  value: number;
  reputation: number; // 0..100
  morale: number;
  condition: number;
  sharpness: number;
  form: number[]; // últimas notas de partida
  injury: Injury | null;
  injuries: { name: string; days: number; season: number }[];
  susp: Record<string, number>; // competição -> jogos de suspensão
  yellows: Record<string, number>;
  stats: Record<string, StatLine>; // temporada em andamento: `${season}|${compId}|${clubId}`
  statArchive?: StatRecord[]; // temporadas encerradas (nunca apagado)
  history: CareerEntry[];
  achievements: Achievement[];
  win?: AwardWindow; // criado sob demanda (janela da Bola de Ouro)
  youth?: YouthInfo;
  loan?: LoanInfo;
  listed?: boolean;
  loanListed?: boolean;
  origin: PlayerOrigin;
  appearance: Appearance;
  experience: number; // 0..100
  joined: Day;
  recentMinutes: number[]; // minutos nas últimas semanas
  happiness?: string; // motivo de insatisfação, se houver
  creator?: CreatorMeta;
  farewell?: boolean;
  futureRole?: StaffRole;
  awardsCount?: Record<string, number>;
  nominations?: { nominated: number; finalist: number; won: number };
  photo?: PlayerPhoto;
  wd?: string; // identificador no Wikidata (jogadores reais)
}

export interface RetiredPlayer {
  id: string;
  name: string;
  nat: string;
  pos: Pos;
  birthYear: number;
  retiredSeason: number;
  lastClub: string;
  peakLevel: number;
  history: CareerEntry[];
  achievements: Achievement[];
  apps: number;
  goals: number;
  newRole?: string;
  appearance: Appearance;
  origin: PlayerOrigin;
}

// ───────────────────────── Clubes ─────────────────────────

export interface CrestDesign {
  shape: 'shield' | 'round' | 'diamond' | 'classic' | 'square';
  pattern: 'plain' | 'stripes' | 'halves' | 'sash' | 'chevron' | 'quarters' | 'band';
  c1: string;
  c2: string;
  c3: string;
  symbol: 'none' | 'star' | 'ball' | 'crown' | 'bird' | 'lion' | 'tower' | 'wave' | 'bolt' | 'cross';
  initials: string;
  stars: number;
}

export type KitPattern = 'plain' | 'hstripes' | 'vstripes' | 'diagonal' | 'hoops' | 'sash' | 'halves' | 'gradient' | 'geometric' | 'pinstripes' | 'chevron';
export interface KitDesign {
  primary: string;
  secondary: string;
  detail: string;
  pattern: KitPattern;
  collar: 'round' | 'v' | 'polo' | 'crew';
  sleeves: 'short' | 'long';
  sleeveColor: 'primary' | 'secondary' | 'detail';
  cuffs: boolean;
  decoration: 'none' | 'shoulder' | 'sidepanels' | 'chestband' | 'pinline';
  sponsor: string;
  brand: string;
  numberColor: string;
}

export interface KitCollection {
  id: string;
  season: number;
  name: string;
  home: KitDesign;
  away: KitDesign;
  third: KitDesign;
  gk: KitDesign;
  launched: boolean;
  launchDay?: Day;
  price: number;
  unitCost: number;
  produced: number;
  stock: number;
  sold: number;
  lostSales: number;
  revenue: number;
  productionCost: number;
  marketing: number;
  discount: number; // 0..0.6
  designScore: number;
  acceptance: number;
  status: 'rascunho' | 'à venda' | 'esgotado' | 'liquidação' | 'encerrada';
  restockPending?: { units: number; arrives: Day };
  weeklySales: number[];
}

export interface Sector {
  id: string;
  name: string;
  capacity: number;
  tiers: number;
  covered: boolean;
  seatLevel: number; // 1..10
  closed: number; // assentos interditados por obra
}

export interface PitchInfo {
  quality: number; // 1..10
  drainage: number;
  irrigation: number;
  lighting: number;
  maintenance: number;
  trainingPitch: number;
  condition: number; // 0..100
}

export interface Stadium {
  name: string;
  sectors: Sector[];
  boxes: number;
  vip: number;
  shops: number;
  restaurants: number;
  parking: number;
  screens: number;
  accessibility: number;
  security: number;
  press: number;
  pitch: PitchInfo;
  ticketPrice: number;
  history: { day: Day; desc: string; cost: number }[];
  attendances: number[];
}

export type FacilityId =
  | 'tc_pitches' | 'tc_equipment' | 'tc_gym' | 'tc_technical' | 'tc_recovery' | 'tc_medical' | 'tc_analysis'
  | 'y_dorms' | 'y_nutrition' | 'y_study' | 'y_living' | 'y_recovery' | 'y_monitoring';

export type StaffRole = 'coach' | 'youthCoach' | 'fitness' | 'gkCoach' | 'analyst' | 'scout' | 'medical' | 'devSpecialist';

export interface Staff {
  id: string;
  name: string;
  nat: string;
  age: number;
  role: StaffRole;
  ability: number; // 1..20
  specialty: string;
  wage: number; // anual
  clubId: string | null;
  exPlayerId?: string;
  reputation: number;
}

export interface Project {
  id: string;
  kind: 'facility' | 'stadium';
  target: string; // facility id ou tipo de obra
  label: string;
  option: 'economy' | 'standard' | 'premium';
  fromLevel: number;
  toLevel: number;
  cost: number;
  paid: number;
  start: Day;
  end: Day;
  status: 'building' | 'done' | 'cancelled';
  capacityDelta?: number;
  closedSeats?: number;
  sectorId?: string;
  maintenanceDelta: number;
  financed?: boolean;
}

export type LedgerCategory =
  | 'bilheteria' | 'premiações' | 'patrocínio' | 'comercial' | 'venda de jogadores' | 'empréstimos (taxa)'
  | 'produtos' | 'camisas' | 'camarotes' | 'sócios' | 'aporte' | 'direitos de TV' | 'outras receitas'
  | 'salários' | 'contratações' | 'parcelas' | 'comissões' | 'manutenção estádio' | 'manutenção instalações'
  | 'comissão técnica' | 'médico' | 'obras' | 'base' | 'produção de uniformes' | 'marketing' | 'juros' | 'rescisões' | 'outras despesas';

export interface LedgerEntry {
  id: string;
  key: string; // chave de idempotência
  day: Day;
  amount: number; // positivo receita, negativo despesa
  cat: LedgerCategory;
  desc: string;
}

export interface Installment {
  id: string;
  desc: string;
  amountPerMonth: number;
  remaining: number;
  toClubId?: string;
  cat: LedgerCategory;
}

export interface BankLoan {
  id: string;
  principal: number;
  monthly: number;
  remaining: number;
  rate: number;
}

export interface Objective {
  id: string;
  kind: 'title' | 'top' | 'midtable' | 'avoid' | 'promotion' | 'cup' | 'continental' | 'finance' | 'youth';
  label: string;
  target: number;
  importance: 1 | 2 | 3;
  status?: 'ok' | 'fail' | 'pending';
}

export interface Tactics {
  formation: string;
  mentality: -2 | -1 | 0 | 1 | 2;
  pressing: 0 | 1 | 2;
  line: 0 | 1 | 2;
  tempo: 0 | 1 | 2;
  passing: 'short' | 'mixed' | 'direct';
  counter: boolean;
  marking: 'zonal' | 'man';
  width: 0 | 1 | 2;
  setPieces: 'mixed' | 'near' | 'far' | 'short';
  captain: string | null;
  penaltyTaker: string | null;
  freeKickTaker: string | null;
}

export type SubMode = 'manual' | 'rules' | 'fitness' | 'smart';
export type ScoreCond = 'any' | 'winning' | 'drawing' | 'losing';

export interface SubRule {
  id: string;
  enabled: boolean;
  priority: number; // 1 = mais alta
  label: string;
  outPid?: string | null; // jogador que sai (ou por posição)
  outPos?: Pos | null;
  inPid?: string | null; // jogador que entra (ou melhor reserva para a posição)
  inPos?: Pos | null;
  minFrom?: number | null; // janela de minutos
  minTo?: number | null;
  condBelow?: number | null; // dispara se a condição física cair abaixo
  minOvrDiff?: number | null; // reserva precisa ser pelo menos X pontos melhor (pode ser negativo)
  score: ScoreCond;
  preserveRole: boolean; // mantém a função tática do titular
  yellowRisk?: boolean; // só dispara se o titular estiver amarelado com risco de expulsão
  extraAttacker?: boolean; // entra como atacante extra (muda a função)
}

export interface SubPlan {
  mode: SubMode;
  fatigue: number; // limite geral de condição física (%)
  posFatigue: Partial<Record<Pos, number>>;
  confirm: boolean; // pedir confirmação na partida ao vivo
  variety: boolean; // "Substituições automáticas por cansaço e contexto": alterna reservas equivalentes
  rules: SubRule[];
}

export interface Lineup {
  starters: (string | null)[]; // ordem dos slots da formação
  bench: string[];
}

export interface ClubSeasonRecord {
  season: number;
  compId: string;
  compName: string;
  position: number;
  points: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}

export interface Club {
  id: string;
  name: string;
  short: string;
  city: string;
  country: string;
  state?: string;
  colors: [string, string, string];
  crest: CrestDesign;
  level: number; // 0..25 nível do clube (reputação/força estrutural)
  reputation: number; // 0..100
  divisionId: string;
  fans: number;
  fanMood: number;
  stadium: Stadium;
  balance: number;
  revenueBase: number; // receita recorrente anual de referência
  transferBudget: number;
  wageBudget: number;
  ledger: LedgerEntry[];
  installments: Installment[];
  loans: BankLoan[];
  coach: { name: string; nat: string; rep: number };
  board: { confidence: number; objectives: Objective[]; president: string; members: string[]; warnings: number };
  playerIds: string[];
  youthIds: string[];
  tactics: Tactics;
  lineup: Lineup | null;
  facilities: Record<FacilityId, number>;
  projects: Project[];
  staffIds: string[];
  staffLevel: number; // qualidade abstrata da comissão (clubes da IA) 1..20
  kits: KitCollection[];
  titles: { compTemplateId: string; compName: string; season: number }[];
  seasons: ClubSeasonRecord[];
  events: { day: Day; text: string }[];
  cohesion: number;
  lastStarters: string[];
  overdraftDays: number;
  embargo: boolean;
  rivals: string[];
  totalInvested: Record<string, number>;
  paidKeys?: string[]; // chaves de lançamentos antigos já compactados (idempotência)
  training: TrainingPlan;
  subPlan?: SubPlan;
}

export interface TrainingPlan {
  focus: 'balanced' | 'technical' | 'physical' | 'tactical' | 'recovery' | 'matchPrep';
  intensity: 0 | 1 | 2;
}

// ───────────────────────── Competições ─────────────────────────

export type CompKind = 'league' | 'cup' | 'state' | 'super' | 'continental';
export type Tiebreak = 'points' | 'wins' | 'gd' | 'gf' | 'h2h' | 'awayGoals' | 'fewestRed' | 'lots';

export interface SlotRule {
  type: 'league' | 'cupWinner' | 'holder';
  sourceId?: string; // id do template da liga/copa
  positions?: number[];
  count?: number;
  priority?: number;
}

export interface CompTemplate {
  id: string;
  name: string;
  short: string;
  kind: CompKind;
  region: string; // código do país ou 'SA'/'EU'
  country?: string;
  state?: string;
  tier?: number;
  enabled: boolean;
  format: 'league' | 'knockout' | 'groupsKO' | 'leaguePlayoff';
  numClubs: number;
  turns: 1 | 2;
  points: { win: number; draw: number; loss: number };
  tiebreakers: Tiebreak[];
  promote?: number; // quantos sobem desta divisão
  relegate?: number; // quantos descem
  upperId?: string;
  lowerId?: string;
  ko: { legs: 1 | 2; finalLegs: 1 | 2; awayGoals: boolean; extraTime: boolean; penalties: boolean; neutralFinal: boolean; twoLegsFrom?: number };
  subs?: SubRegulation;
  groups?: { count: number; size: number; advance: number; turns: 1 | 2 };
  playoffTeams?: number;
  slots?: SlotRule[]; // para continentais
  participantsRule?: { type: 'divisions'; ids: string[]; max?: number } | { type: 'state'; state: string; max: number } | { type: 'super'; leagueId: string; cupId: string };
  prize: { participation: number; win: number; draw: number; byPosition: number[]; byStage: Record<string, number>; champion: number; tv: number };
  dates: { start: string; end: string; weekday: number; extra?: number };
  importance: number; // 1..5
  coefficient: number; // nível competitivo (0.5..2)
  color: string;
  accent: string;
}

/** Regulamento de substituições: jogadores substituídos e oportunidades (interrupções) no tempo de jogo. */
export interface SubRegulation {
  max: number;
  windows: number; // oportunidades fora do intervalo
  etExtra: number; // substituição adicional na prorrogação
  etWindows: number; // oportunidade adicional na prorrogação
}

export interface Tie {
  id: string;
  round: number;
  a: string | null;
  b: string | null;
  fixtureIds: string[];
  winner?: string;
  loser?: string;
  aggA?: number;
  aggB?: number;
  note?: string;
}

export interface StandingRow {
  clubId: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  red: number;
  form: string[];
}

export interface Stage {
  id: string;
  type: 'league' | 'knockout';
  name: string;
  groups: string[][]; // league: grupos; knockout: [participantes]
  turns: 1 | 2;
  roundNames: string[];
  roundDays: Day[][]; // por rodada, dias (1 ou 2 pernas)
  ties: Tie[];
  fixtureIds: string[];
  done: boolean;
  advance?: number;
  byes?: string[];
  roundKeys?: string[];
  roundLegs?: (1 | 2)[];
  drawn?: boolean;
}

export interface CompInstance {
  id: string;
  templateId: string;
  season: number;
  name: string;
  kind: CompKind;
  region: string;
  participants: string[];
  qualNotes: { clubId: string; reason: string }[];
  stages: Stage[];
  current: number;
  status: 'scheduled' | 'running' | 'finished';
  champion?: string;
  runnerUp?: string;
  finalized: boolean;
  topScorers?: { playerId: string; name: string; clubId: string; goals: number }[];
  topAssists?: { playerId: string; name: string; clubId: string; assists: number }[];
  finalTable?: StandingRow[];
  groupTables?: StandingRow[][];
  pruned?: boolean;
  bestPlayer?: string;
  finalMotm?: string;
  teamOfComp?: string[];
  eliminated: Record<string, string>; // clube -> fase
  startDay: Day;
  endDay: Day;
}

export interface SubLog {
  min: number;
  out: string;
  in: string;
  club: string;
  auto?: boolean;
  reason?: string;
  interval?: boolean;
}

export interface GoalEv {
  min: number;
  pid: string;
  aid?: string;
  club: string;
  type: 'open' | 'pen' | 'fk' | 'header' | 'og';
  disallowed?: boolean;
  et?: boolean;
}
export interface CardEv {
  min: number;
  pid: string;
  club: string;
  red: boolean;
  second?: boolean;
}

export interface MatchStats {
  poss: [number, number];
  shots: [number, number];
  sot: [number, number];
  corners: [number, number];
  fouls: [number, number];
  saves: [number, number];
  offsides: [number, number];
  yellows: [number, number];
  reds: [number, number];
  xg: [number, number];
}

export interface MatchEvent {
  min: number;
  side: 0 | 1 | -1;
  type: string;
  text: string;
  pid?: string;
  pid2?: string;
  big?: boolean;
}

export interface FixtureResult {
  hg: number;
  ag: number;
  et: boolean;
  pens?: [number, number];
  goals: GoalEv[];
  cards: CardEv[];
  stats: MatchStats;
  motm?: string;
  attendance: number;
  injuries: { pid: string; club: string; min: number }[];
  ratings?: Record<string, number>;
  lineups?: [string[], string[]];
  subs?: SubLog[];
  events?: MatchEvent[];
  report?: string[];
  interventions?: number;
}

export interface Fixture {
  id: string;
  compId: string;
  stageIdx: number;
  round: number;
  group?: number;
  tieId?: string;
  leg?: 1 | 2;
  day: Day;
  origDay: Day;
  home: string;
  away: string;
  neutral: boolean;
  status: 'scheduled' | 'played' | 'void';
  seed: number;
  result?: FixtureResult;
  bigGame: boolean;
  derby: boolean;
}

// ───────────────────────── Universo / Carreira ─────────────────────────

export interface CountryConfig {
  code: string;
  name: string;
  region: 'SA' | 'EU';
  enabled: boolean;
  leagues: string[]; // ids de templates de liga em ordem de divisão
  cup?: string;
  flag: [string, string, string];
}

export interface AwardsConfig {
  ballonName: string;
  ballonDay: number; // 25..31 de outubro
  nominees: number;
  finalists: number;
  minApps: number;
  voters: number;
  galaDate: string; // MM-DD
  youngAge: number;
  revelationAge: number;
  enabled: boolean;
  weights: {
    performance: number;
    goals: number;
    assists: number;
    titles: number;
    regularity: number;
    bigGames: number;
    competitionLevel: number;
    teamImportance: number;
    continental: number;
  };
  names: Record<string, string>;
  scorerTieRule: 'all' | 'fewerApps' | 'moreAssists';
}

export interface ProgressionConfig {
  growthRate: number; // multiplicador global
  declineAge: number;
  declineRate: number;
  youthIntake: 'annual' | 'semiannual' | 'off';
  intakeDates: string[];
  retirementAgeShift: number;
}

export interface UniverseConfig {
  currency: string;
  startYear: number;
  countries: CountryConfig[];
  competitions: Record<string, CompTemplate>;
  awards: AwardsConfig;
  progression: ProgressionConfig;
  transferWindows: { start: string; end: string }[];
  freeAgentsAnytime: boolean;
  homeAdvantage: number;
  gameName: string;
}

export interface World {
  schemaVersion: number;
  meta: { id: string; name: string; createdAt: number; base: string; description: string; custom: boolean };
  config: UniverseConfig;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  staff: Record<string, Staff>;
  retired: Record<string, RetiredPlayer>;
  nextId: number;
}

export type Difficulty = 'facil' | 'normal' | 'dificil';
export type FinanceMode = 'realista' | 'equilibrado' | 'desafio' | 'investidor' | 'casual';

export interface FinanceSettings {
  mode: FinanceMode;
  initialBalance: number;
  transferBudget: number;
  wageLimit: number;
  revenueRealism: number; // multiplicador de receitas
  costIntensity: number; // multiplicador de custos operacionais
  allowInjections: boolean;
  unlimited: boolean;
  injection: number;
  financing: boolean;
}

export interface NewsItem {
  id: string;
  day: Day;
  kind: string;
  icon: string;
  title: string;
  body: string;
  clubIds: string[];
  playerIds: string[];
  link?: { screen: string; id?: string };
  important?: boolean;
}

export interface DecisionOption {
  id: string;
  label: string;
  hint?: string;
}
export interface Decision {
  id: string;
  day: Day;
  kind: string;
  title: string;
  text: string;
  playerId?: string;
  clubId?: string;
  data?: Record<string, unknown>;
  options: DecisionOption[];
  resolved?: string;
  expires?: Day;
}

export interface AwardCandidate {
  playerId: string;
  name: string;
  clubId: string;
  clubName: string;
  nat: string;
  pos: Pos;
  level: number;
  score: number;
  breakdown: Record<string, number>;
  stats: { apps: number; goals: number; assists: number; avg: number; titles: string[]; contGoals: number; motm: number };
  votes?: number;
  firstPlaces?: number;
  rank?: number;
}

export interface AwardResult {
  key: string; // `${awardId}|${edition}` (único)
  awardId: string;
  name: string;
  edition: number;
  season: number;
  day: Day;
  scope?: string; // competição, liga
  winnerId: string | null;
  winnerName: string;
  winnerClubId?: string;
  winnerClubName?: string;
  winnerNat?: string;
  candidates: AwardCandidate[];
  finalists: string[];
  simulated: true;
  team?: { pos: string; playerId: string; name: string; clubName: string }[];
  coach?: { name: string; clubId: string; clubName: string; score: number; isUser: boolean };
  headlines: string[];
  windowLabel?: string;
}

export interface SeasonSummary {
  season: number;
  userClubId: string;
  userClubName: string;
  userPosition?: number;
  userDivision?: string;
  champions: { compTemplateId: string; compName: string; clubId: string; clubName: string }[];
  promoted: { clubId: string; to: string }[];
  relegated: { clubId: string; to: string }[];
  topScorers: { compName: string; name: string; goals: number }[];
  boardVerdict?: string;
}

export interface QualificationEntry {
  clubId: string;
  reason: string;
  country: string;
}

export interface ManagerInfo {
  name: string;
  nat: string;
  reputation: number;
  history: { season: number; clubId: string; clubName: string; finish?: string }[];
  trophies: { compName: string; season: number }[];
  fired: number;
}

export interface Career extends World {
  id: string;
  saveName: string;
  userClubId: string;
  manager: ManagerInfo;
  difficulty: Difficulty;
  finance: FinanceSettings;
  day: Day;
  season: number;
  competitions: Record<string, CompInstance>;
  fixtures: Record<string, Fixture>;
  news: NewsItem[];
  inbox: Decision[];
  awards: Record<string, AwardResult>;
  seasonHistory: SeasonSummary[];
  champions: Record<string, { season: number; clubId: string; clubName: string; runnerUpName?: string }[]>;
  qualification: Record<string, QualificationEntry[]>; // templateId -> próxima temporada
  qualificationWarnings: string[];
  intakeCandidates: string[]; // ids de jovens aguardando avaliação
  shortlist: string[];
  flags: Record<string, boolean>;
  rngState: number;
  seasonEnded: boolean;
  firedPending: boolean;
  lastAdvance: number;
  tutorialDone: boolean;
  records: Record<string, { label: string; value: number; holder: string; season: number }>;
  coachTalk?: { day: Day; text: string };
  offers: TransferOffer[];
  negotiations: Negotiation[];
}

export interface TransferOffer {
  id: string;
  day: Day;
  playerId: string;
  fromClubId: string; // clube interessado
  toClubId: string; // clube dono
  fee: number;
  loan: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'completed';
  counter?: number;
  expires: Day;
}

export interface Negotiation {
  id: string;
  playerId: string;
  sellerId: string | null;
  buyerId: string;
  stage: 'club' | 'player' | 'done' | 'failed';
  fee: number;
  installments: number;
  loan: boolean;
  loanWagePct: number;
  askingPrice: number;
  rounds: number;
  wageDemand: number;
  yearsDemand: number;
  log: string[];
  day: Day;
}
