import type { Career, Club, CompInstance, Fixture, Stadium } from '../types';
import { clamp } from '../core/rng';
import { post } from '../finance/ledger';
import { compKey, leagueTable } from '../competitions/manager';

const tableCache = new WeakMap<CompInstance, { day: number; rows: ReturnType<typeof leagueTable> }>();
function cachedTable(c: Career, comp: CompInstance) {
  const e = tableCache.get(comp);
  if (e && e.day === c.day) return e.rows;
  const rows = leagueTable(c, comp);
  tableCache.set(comp, { day: c.day, rows });
  return rows;
}

export function totalCapacity(st: Stadium): number {
  return st.sectors.reduce((s, x) => s + x.capacity, 0);
}
export function availableCapacity(st: Stadium): number {
  return st.sectors.reduce((s, x) => s + Math.max(0, x.capacity - x.closed), 0);
}
export function stadiumQuality(st: Stadium): number {
  const seat = st.sectors.reduce((s, x) => s + x.seatLevel * x.capacity, 0) / Math.max(1, totalCapacity(st));
  const cover = st.sectors.filter((x) => x.covered).length / st.sectors.length;
  return clamp((seat + st.accessibility + st.security + st.screens + st.restaurants * 0.5 + st.parking * 0.5 + cover * 10) / 5.5 / 10, 0.1, 1);
}
const PRICE_FACTOR: Record<string, number> = { ENG: 1.9, ESP: 1.5, ITA: 1.3, GER: 1.3, FRA: 1.3, BRA: 0.75, ARG: 0.55 };
/** Preço de referência do ingresso (varia com o porte do clube e o mercado do país). */
export function referenceTicket(club: Pick<Club, 'level'> & { country?: string }): number {
  return Math.round((5 + club.level * 1.3) * (PRICE_FACTOR[club.country ?? ''] ?? 0.45));
}

export interface Attendance {
  demand: number;
  attendance: number;
  gate: number;
  boxes: number;
  concessions: number;
  occupancy: number;
}

/** Público e receitas de um jogo: depende de torcida, importância, adversário, momento, preço e estádio. */
export function computeAttendance(c: Career, f: Fixture, comp: CompInstance | undefined): Attendance {
  const home = c.clubs[f.home];
  const away = c.clubs[f.away];
  const st = home.stadium;
  const cap = availableCapacity(st);
  const t = comp ? c.config.competitions[comp.templateId] : undefined;
  const base = 8000 + Math.sqrt(home.fans) * 25;
  let importance = 1;
  if (t?.kind === 'continental') importance = 1.3 + (f.tieId ? 0.25 : 0);
  else if (t?.kind === 'cup') importance = 1.05 + (f.tieId && comp?.stages[f.stageIdx]?.roundKeys?.[f.round] && ['QF', 'SF', 'F'].includes(comp.stages[f.stageIdx].roundKeys![f.round]) ? 0.35 : 0);
  else if (t?.kind === 'state') importance = 0.75;
  else if (t?.kind === 'super') importance = 1.4;
  if (f.derby) importance *= 1.25;
  const oppF = 0.82 + (away?.level ?? 10) / 45;
  let posF = 1;
  if (comp?.kind === 'league') {
    const table = cachedTable(c, comp);
    const pos = table.findIndex((r) => r.clubId === home.id);
    if (pos >= 0 && table.length) posF = 1.12 - (pos / table.length) * 0.25;
  }
  const mood = 0.7 + home.fanMood / 170;
  const price = Math.max(1, st.ticketPrice);
  const elasticity = Math.pow(referenceTicket(home) / price, 1.1);
  const quality = 0.88 + stadiumQuality(st) * 0.24;
  const demand = Math.round(base * importance * oppF * posF * mood * elasticity * quality * (f.neutral ? 1.2 : 1));
  const attendance = Math.max(0, Math.min(cap, demand));
  const gate = attendance * price;
  const boxOcc = clamp(0.45 + importance * 0.25, 0, 1);
  const boxes = Math.round(st.boxes * boxOcc * (500 + home.level * 70) + st.vip * attendance * 0.08);
  const spend = 0.8 + st.shops * 0.22 + st.restaurants * 0.2 + st.parking * 0.08;
  const concessions = Math.round(attendance * spend);
  return { demand, attendance, gate, boxes, concessions, occupancy: cap ? attendance / cap : 0 };
}

/** Lança receitas do jogo para o mandante (finais neutras dividem a renda). */
export function postMatchdayRevenue(c: Career, f: Fixture, comp: CompInstance | undefined, att: Attendance): void {
  const home = c.clubs[f.home];
  const away = c.clubs[f.away];
  const real = c.finance.revenueRealism;
  const isUserHome = home.id === c.userClubId;
  const mult = isUserHome ? real : 1;
  const name = comp?.name ?? 'Amistoso';
  if (f.neutral) {
    const share = Math.round((att.gate + att.boxes) * 0.4);
    post(c, home, { key: `gate|${f.id}|${home.id}`, day: f.day, amount: share * (home.id === c.userClubId ? real : 1), cat: 'bilheteria', desc: `Renda da final (campo neutro) — ${name}` });
    post(c, away, { key: `gate|${f.id}|${away.id}`, day: f.day, amount: share * (away.id === c.userClubId ? real : 1), cat: 'bilheteria', desc: `Renda da final (campo neutro) — ${name}` });
    return;
  }
  post(c, home, { key: `gate|${f.id}`, day: f.day, amount: att.gate * mult, cat: 'bilheteria', desc: `Bilheteria x ${away.short} (${att.attendance.toLocaleString('pt-BR')} pagantes) — ${name}` });
  if (att.boxes) post(c, home, { key: `box|${f.id}`, day: f.day, amount: att.boxes * mult, cat: 'camarotes', desc: `Camarotes e área VIP x ${away.short}` });
  if (att.concessions) post(c, home, { key: `shop|${f.id}`, day: f.day, amount: att.concessions * mult, cat: 'produtos', desc: `Lojas, alimentação e estacionamento x ${away.short}` });
  home.stadium.attendances.push(att.attendance);
  if (home.stadium.attendances.length > 40) home.stadium.attendances.shift();
  // desgaste do gramado
  const p = home.stadium.pitch;
  p.condition = clamp(p.condition - 7 * (1.15 - p.drainage * 0.05), 15, 100);
}

/** Recuperação diária do gramado conforme manutenção e irrigação. */
export function dailyPitch(club: Club): void {
  const p = club.stadium.pitch;
  p.condition = clamp(p.condition + 0.35 + p.maintenance * 0.12 + p.irrigation * 0.05, 0, 40 + p.quality * 6);
}

/** Qualidade do campo (0..1) usada pelo motor da partida. */
export function pitchFactor(club: Club): number {
  const p = club.stadium.pitch;
  return clamp((p.condition / 100) * 0.6 + (p.quality / 10) * 0.4, 0.2, 1);
}

export function averageAttendance(club: Club): number {
  const a = club.stadium.attendances;
  return a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0;
}

// ───────────────────────── projetos do estádio ─────────────────────────

export interface StadiumWork {
  id: string;
  label: string;
  desc: string;
  field?: keyof Pick<Stadium, 'boxes' | 'vip' | 'shops' | 'restaurants' | 'parking' | 'screens' | 'accessibility' | 'security' | 'press'>;
  pitchField?: 'quality' | 'drainage' | 'irrigation' | 'lighting' | 'maintenance' | 'trainingPitch';
  sector?: boolean;
  baseCost: number;
  days: number;
  maint: number; // manutenção mensal adicional por nível
  effect: string;
}

export const STADIUM_WORKS: StadiumWork[] = [
  { id: 'expand', label: 'Ampliar arquibancada', desc: 'Novo anel ou expansão de um setor. Parte do setor fica interditada durante a obra.', sector: true, baseCost: 0, days: 150, maint: 0, effect: 'Mais capacidade e receita de bilheteria' },
  { id: 'cover', label: 'Cobertura do setor', desc: 'Protege o torcedor da chuva e do sol.', sector: true, baseCost: 0, days: 90, maint: 0, effect: 'Mais conforto e público em jogos comuns' },
  { id: 'seats', label: 'Modernizar assentos', desc: 'Cadeiras novas e numeradas no setor.', sector: true, baseCost: 0, days: 45, maint: 0, effect: 'Conforto e qualidade do estádio' },
  { id: 'boxes', label: 'Novos camarotes (+10)', desc: 'Espaços corporativos de alto valor.', field: 'boxes', baseCost: 900_000, days: 120, maint: 6_000, effect: 'Receita de camarotes por jogo' },
  { id: 'vip', label: 'Área VIP', desc: 'Lounge e serviços premium.', field: 'vip', baseCost: 600_000, days: 90, maint: 5_000, effect: 'Receita VIP por público' },
  { id: 'shops', label: 'Lojas oficiais', desc: 'Pontos de venda de produtos.', field: 'shops', baseCost: 350_000, days: 60, maint: 3_000, effect: 'Gasto por torcedor e vendas de produtos' },
  { id: 'restaurants', label: 'Restaurantes', desc: 'Praças de alimentação.', field: 'restaurants', baseCost: 400_000, days: 75, maint: 3_500, effect: 'Gasto por torcedor' },
  { id: 'parking', label: 'Estacionamento', desc: 'Vagas e acesso facilitado.', field: 'parking', baseCost: 500_000, days: 90, maint: 2_500, effect: 'Gasto por torcedor e atratividade' },
  { id: 'screens', label: 'Painéis eletrônicos', desc: 'Telões e placas de LED.', field: 'screens', baseCost: 450_000, days: 45, maint: 4_000, effect: 'Atratividade e potencial de patrocínio' },
  { id: 'accessibility', label: 'Acessibilidade', desc: 'Rampas, elevadores e lugares adaptados.', field: 'accessibility', baseCost: 300_000, days: 60, maint: 1_500, effect: 'Qualidade e público' },
  { id: 'security', label: 'Segurança', desc: 'Câmeras, catracas e controle de acesso.', field: 'security', baseCost: 280_000, days: 45, maint: 2_000, effect: 'Qualidade e público em clássicos' },
  { id: 'press', label: 'Estrutura de imprensa', desc: 'Cabines e sala de coletivas.', field: 'press', baseCost: 220_000, days: 45, maint: 1_000, effect: 'Reputação e patrocínio' },
  { id: 'lighting', label: 'Iluminação moderna', desc: 'Refletores de LED.', pitchField: 'lighting', baseCost: 380_000, days: 40, maint: 2_500, effect: 'Jogos noturnos e patrocínio' },
  { id: 'pitchQuality', label: 'Qualidade do gramado', desc: 'Novo gramado (natural reforçado ou híbrido).', pitchField: 'quality', baseCost: 420_000, days: 50, maint: 3_000, effect: 'Partidas mais limpas e menos lesões' },
  { id: 'drainage', label: 'Sistema de drenagem', desc: 'Escoamento rápido da água.', pitchField: 'drainage', baseCost: 300_000, days: 40, maint: 1_200, effect: 'Menos desgaste após jogos e chuva' },
  { id: 'irrigation', label: 'Irrigação', desc: 'Irrigação automatizada.', pitchField: 'irrigation', baseCost: 200_000, days: 30, maint: 1_200, effect: 'Recuperação diária do gramado' },
  { id: 'maintenance', label: 'Plano de manutenção', desc: 'Equipe e máquinas de manutenção.', pitchField: 'maintenance', baseCost: 150_000, days: 15, maint: 4_000, effect: 'Recuperação mais rápida do gramado' },
  { id: 'trainingPitch', label: 'Campo anexo de treino', desc: 'Campo auxiliar ao estádio.', pitchField: 'trainingPitch', baseCost: 350_000, days: 60, maint: 2_000, effect: 'Treinos mais eficientes' },
];
export const WORK_MAP = Object.fromEntries(STADIUM_WORKS.map((w) => [w.id, w]));

export const OPTIONS = {
  economy: { label: 'Econômica', cost: 0.65, days: 0.85, maint: 1.4, levels: 1 },
  standard: { label: 'Padrão', cost: 1, days: 1, maint: 1, levels: 1 },
  premium: { label: 'Alta qualidade', cost: 2.4, days: 1.25, maint: 0.75, levels: 2 },
} as const;

export function currentWorkLevel(st: Stadium, w: StadiumWork, sectorId?: string): number {
  if (w.field) return w.field === 'boxes' ? Math.round(st.boxes / 10) : (st[w.field] as number);
  if (w.pitchField) return st.pitch[w.pitchField];
  const sec = st.sectors.find((s) => s.id === sectorId);
  if (!sec) return 0;
  if (w.id === 'seats') return sec.seatLevel;
  if (w.id === 'cover') return sec.covered ? 1 : 0;
  return sec.tiers;
}

export function workQuote(club: Club, workId: string, option: keyof typeof OPTIONS, sectorId?: string): { cost: number; days: number; maint: number; seats: number; closed: number; from: number; to: number; max: number; blocked?: string } {
  const w = WORK_MAP[workId];
  const st = club.stadium;
  const o = OPTIONS[option];
  const from = currentWorkLevel(st, w, sectorId);
  const sec = st.sectors.find((s) => s.id === sectorId);
  if (w.sector && !sec) return { cost: 0, days: 0, maint: 0, seats: 0, closed: 0, from, to: from, max: 10, blocked: 'Escolha um setor.' };
  if (w.id === 'expand') {
    const seats = { economy: 2500, standard: 5000, premium: 10000 }[option];
    const cost = Math.round(seats * (option === 'economy' ? 750 : option === 'standard' ? 1100 : 1500));
    const max = 4;
    return { cost, days: Math.round(w.days * o.days), maint: Math.round(seats * 0.25), seats, closed: Math.round(sec!.capacity * 0.5), from, to: from + 1, max, blocked: from >= max ? 'Setor já no limite de anéis.' : undefined };
  }
  if (w.id === 'cover') {
    const cost = Math.round(sec!.capacity * 260 * o.cost);
    return { cost, days: Math.round(w.days * o.days), maint: Math.round(sec!.capacity * 0.08 * o.maint), seats: 0, closed: Math.round(sec!.capacity * 0.25), from, to: 1, max: 1, blocked: sec!.covered ? 'Setor já coberto.' : undefined };
  }
  if (w.id === 'seats') {
    const to = Math.min(10, from + o.levels);
    const cost = Math.round(sec!.capacity * (45 + from * 12) * o.cost);
    return { cost, days: Math.round(w.days * o.days), maint: Math.round(sec!.capacity * 0.02 * o.maint), seats: 0, closed: Math.round(sec!.capacity * 0.6), from, to, max: 10, blocked: from >= 10 ? 'Nível máximo.' : undefined };
  }
  const to = Math.min(10, from + o.levels);
  const cost = Math.round(w.baseCost * Math.pow(1.45, from) * o.cost);
  return { cost, days: Math.round((w.days + from * 6) * o.days), maint: Math.round(w.maint * o.maint * (to - from)), seats: 0, closed: 0, from, to, max: 10, blocked: from >= 10 ? 'Nível máximo.' : undefined };
}

export function applyStadiumWork(club: Club, workId: string, sectorId: string | undefined, to: number, seats: number): void {
  const w = WORK_MAP[workId];
  const st = club.stadium;
  if (w.field) {
    if (w.field === 'boxes') st.boxes += 10 * Math.max(1, to - Math.round(st.boxes / 10));
    else (st[w.field] as number) = to;
  } else if (w.pitchField) {
    st.pitch[w.pitchField] = to;
    if (w.pitchField === 'quality') st.pitch.condition = Math.max(st.pitch.condition, 90);
  } else {
    const sec = st.sectors.find((s) => s.id === sectorId);
    if (!sec) return;
    if (workId === 'expand') {
      sec.capacity += seats;
      sec.tiers += 1;
    } else if (workId === 'cover') sec.covered = true;
    else if (workId === 'seats') sec.seatLevel = to;
  }
}

/** Custos mensais de operação do estádio. */
export function stadiumMonthlyCost(club: Club): number {
  const st = club.stadium;
  return Math.round(totalCapacity(st) * 0.55 + st.boxes * 400 + (st.vip + st.shops + st.restaurants + st.parking + st.screens) * 1500 + (st.pitch.maintenance * 2500 + st.pitch.irrigation * 600 + st.pitch.quality * 500));
}

export function leagueOfClub(c: Career, club: Club): CompInstance | undefined {
  return c.competitions[compKey(club.divisionId, c.season)];
}
