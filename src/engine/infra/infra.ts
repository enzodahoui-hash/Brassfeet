import type { Career, Club, FacilityId, Project, Staff, StaffRole } from '../types';
import { clamp } from '../core/rng';
import { fmtShort } from '../core/date';
import { post } from '../finance/ledger';
import { addNews } from '../news/news';
import { OPTIONS, WORK_MAP, applyStadiumWork, workQuote } from '../stadium/stadium';

export interface FacilityDef {
  id: FacilityId;
  name: string;
  group: 'tc' | 'youth';
  baseCost: number;
  maint: number;
  effect: string;
}

export const FACILITIES: FacilityDef[] = [
  { id: 'tc_pitches', name: 'Campos de treino', group: 'tc', baseCost: 400_000, maint: 3_000, effect: 'Qualidade do treinamento e menos lesões por carga' },
  { id: 'tc_equipment', name: 'Equipamentos', group: 'tc', baseCost: 250_000, maint: 2_000, effect: 'Eficiência do treino técnico e de goleiros' },
  { id: 'tc_gym', name: 'Academia e preparação física', group: 'tc', baseCost: 300_000, maint: 2_500, effect: 'Evolução física e recuperação' },
  { id: 'tc_technical', name: 'Instalações técnicas', group: 'tc', baseCost: 350_000, maint: 2_500, effect: 'Evolução técnica e capacidade da comissão' },
  { id: 'tc_recovery', name: 'Centro de recuperação', group: 'tc', baseCost: 380_000, maint: 3_000, effect: 'Recuperação física diária mais rápida' },
  { id: 'tc_medical', name: 'Departamento médico', group: 'tc', baseCost: 420_000, maint: 3_500, effect: 'Menos lesões e retorno mais rápido' },
  { id: 'tc_analysis', name: 'Análise de desempenho', group: 'tc', baseCost: 260_000, maint: 2_000, effect: 'Preparação tática e entrosamento' },
  { id: 'y_dorms', name: 'Alojamentos da base', group: 'youth', baseCost: 280_000, maint: 2_000, effect: 'Capacidade da base, retenção e atração de talentos' },
  { id: 'y_nutrition', name: 'Alimentação e suporte', group: 'youth', baseCost: 150_000, maint: 1_500, effect: 'Desenvolvimento físico dos jovens' },
  { id: 'y_study', name: 'Salas de estudo', group: 'youth', baseCost: 120_000, maint: 800, effect: 'Desenvolvimento mental e satisfação' },
  { id: 'y_living', name: 'Espaços de convivência', group: 'youth', baseCost: 120_000, maint: 800, effect: 'Moral e permanência dos jovens' },
  { id: 'y_recovery', name: 'Recuperação da base', group: 'youth', baseCost: 160_000, maint: 1_200, effect: 'Condição física dos jovens' },
  { id: 'y_monitoring', name: 'Acompanhamento individual', group: 'youth', baseCost: 200_000, maint: 1_500, effect: 'Planos individuais e qualidade das revelações' },
];
export const FACILITY_MAP = Object.fromEntries(FACILITIES.map((f) => [f.id, f])) as Record<FacilityId, FacilityDef>;

export function facilityQuote(club: Club, id: FacilityId, option: keyof typeof OPTIONS): { cost: number; days: number; maint: number; from: number; to: number; blocked?: string } {
  const def = FACILITY_MAP[id];
  const from = club.facilities[id];
  const o = OPTIONS[option];
  const to = Math.min(10, from + o.levels);
  return {
    cost: Math.round(def.baseCost * Math.pow(1.55, from - 1) * o.cost),
    days: Math.round((25 + from * 14) * o.days),
    maint: Math.round(def.maint * o.maint * (to - from)),
    from, to, blocked: from >= 10 ? 'Nível máximo atingido.' : club.projects.some((p) => p.status === 'building' && p.target === id) ? 'Já existe uma obra em andamento nesta instalação.' : undefined,
  };
}

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);

// ───────────────────────── comissão técnica ─────────────────────────

export const STAFF_ROLES: { id: StaffRole; name: string; desc: string }[] = [
  { id: 'coach', name: 'Treinadores do profissional', desc: 'Qualidade do treino e evolução do elenco principal' },
  { id: 'youthCoach', name: 'Treinadores da base', desc: 'Evolução dos jovens e precisão da avaliação de potencial' },
  { id: 'fitness', name: 'Preparadores físicos', desc: 'Condição física, recuperação e prevenção de lesões' },
  { id: 'gkCoach', name: 'Preparadores de goleiros', desc: 'Evolução dos goleiros' },
  { id: 'analyst', name: 'Analistas de desempenho', desc: 'Entrosamento e preparação para jogos' },
  { id: 'scout', name: 'Olheiros', desc: 'Qualidade e quantidade de revelações da base' },
  { id: 'medical', name: 'Equipe médica', desc: 'Prevenção e tempo de recuperação de lesões' },
  { id: 'devSpecialist', name: 'Especialistas em desenvolvimento', desc: 'Planos individuais de jovens' },
];
export const ROLE_NAME = Object.fromEntries(STAFF_ROLES.map((r) => [r.id, r.name])) as Record<StaffRole, string>;

export function staffCapacity(club: Club, role: StaffRole): number {
  const f = club.facilities;
  switch (role) {
    case 'coach': return 2 + Math.floor(f.tc_technical / 3);
    case 'youthCoach': return 1 + Math.floor((f.y_monitoring + f.y_dorms) / 6);
    case 'fitness': return 1 + Math.floor(f.tc_gym / 3);
    case 'gkCoach': return 1 + Math.floor(f.tc_equipment / 5);
    case 'analyst': return 1 + Math.floor(f.tc_analysis / 3);
    case 'scout': return 2 + Math.floor(club.reputation / 30);
    case 'medical': return 1 + Math.floor(f.tc_medical / 3);
    case 'devSpecialist': return Math.floor(f.y_monitoring / 3);
  }
}

export function clubStaff(c: Career, club: Club, role?: StaffRole): Staff[] {
  return club.staffIds.map((id) => c.staff[id]).filter((s) => s && (!role || s.role === role));
}

/** 0..1 com retorno decrescente: contratar muitos não multiplica o efeito. */
export function roleScore(c: Career, club: Club, role: StaffRole): number {
  if (club.id !== c.userClubId) return clamp(club.staffLevel / 20, 0, 1) * 0.85;
  const staff = clubStaff(c, club, role).sort((a, b) => b.ability - a.ability);
  if (!staff.length) return 0.15;
  let s = 0;
  staff.forEach((x, i) => (s += (x.ability / 20) * Math.pow(0.45, i)));
  return clamp(s / 1.45, 0, 1);
}

/** Índices de efeito usados por progressão, lesões, base e partidas (todos limitados). */
export function clubEffects(c: Career, club: Club) {
  const f = club.facilities;
  const tc = avg([f.tc_pitches, f.tc_equipment, f.tc_technical, f.tc_gym]) / 10;
  const youthF = avg([f.y_dorms, f.y_nutrition, f.y_study, f.y_living, f.y_monitoring, f.y_recovery]) / 10;
  const coach = roleScore(c, club, 'coach');
  const ycoach = roleScore(c, club, 'youthCoach');
  const fit = roleScore(c, club, 'fitness');
  const med = roleScore(c, club, 'medical');
  const ana = roleScore(c, club, 'analyst');
  const scout = roleScore(c, club, 'scout');
  const dev = roleScore(c, club, 'devSpecialist');
  const gk = roleScore(c, club, 'gkCoach');
  const trainingPitch = club.stadium.pitch.trainingPitch / 10;
  return {
    training: 0.62 + tc * 0.24 + coach * 0.24 + trainingPitch * 0.05, // ~0,62..1,15
    youthDev: 0.6 + youthF * 0.28 + ycoach * 0.25 + dev * 0.1,
    recovery: 1 + (f.tc_recovery / 10) * 0.35 + fit * 0.25 + med * 0.2,
    injuryRisk: clamp(1 - (f.tc_medical / 10) * 0.22 - fit * 0.12 - (f.tc_pitches / 10) * 0.08, 0.55, 1.1),
    injuryHeal: 1 + (f.tc_medical / 10) * 0.25 + med * 0.3,
    cohesion: 1 + ana * 0.3 + (f.tc_analysis / 10) * 0.2,
    analysis: ana * 0.6 + (f.tc_analysis / 10) * 0.4,
    scouting: scout,
    youthAccuracy: clamp(ycoach * 0.6 + scout * 0.25 + dev * 0.15, 0, 1),
    intakeQuality: youthF * 0.5 + ycoach * 0.3 + scout * 0.4,
    gk,
    physical: (f.tc_gym / 10) * 0.6 + fit * 0.4,
    youthCapacity: 8 + f.y_dorms * 2,
  };
}

export function hireStaff(c: Career, staffId: string): string | null {
  const club = c.clubs[c.userClubId];
  const s = c.staff[staffId];
  if (!s || s.clubId) return 'Profissional indisponível.';
  if (clubStaff(c, club, s.role).length >= staffCapacity(club, s.role)) return `Capacidade máxima de ${ROLE_NAME[s.role].toLowerCase()} atingida. Melhore as instalações para ampliar a equipe.`;
  const fee = Math.round(s.wage * 0.5);
  if (!canSpend(c, club, fee)) return 'Saldo insuficiente para a luva de contratação.';
  post(c, club, { key: `staffhire|${s.id}|${c.day}`, day: c.day, amount: -fee, cat: 'comissão técnica', desc: `Contratação de ${s.name} (${ROLE_NAME[s.role]})` });
  s.clubId = club.id;
  club.staffIds.push(s.id);
  club.totalInvested.staff = (club.totalInvested.staff ?? 0) + fee;
  addNews(c, { kind: 'staff', icon: 'staff', title: `${club.name} contrata ${s.name}`, body: `${s.name} chega para reforçar a área de ${ROLE_NAME[s.role].toLowerCase()} (nível ${s.ability}/20).`, clubIds: [club.id], playerIds: [] });
  return null;
}

export function fireStaff(c: Career, staffId: string): string | null {
  const club = c.clubs[c.userClubId];
  const s = c.staff[staffId];
  if (!s || s.clubId !== club.id) return 'Profissional não pertence ao clube.';
  const comp = Math.round(s.wage * 0.5);
  post(c, club, { key: `stafffire|${s.id}|${c.day}`, day: c.day, amount: -comp, cat: 'rescisões', desc: `Rescisão de ${s.name}` });
  s.clubId = null;
  club.staffIds = club.staffIds.filter((x) => x !== s.id);
  return null;
}

/** Curso de capacitação: +1 de nível, uma vez por temporada por profissional. */
export function trainStaff(c: Career, staffId: string): string | null {
  const club = c.clubs[c.userClubId];
  const s = c.staff[staffId];
  if (!s || s.clubId !== club.id) return 'Profissional não pertence ao clube.';
  if (s.ability >= 20) return 'Já está no nível máximo.';
  const key = `course|${s.id}|${c.season}`;
  if (club.ledger.some((e) => e.key === key)) return 'Este profissional já fez um curso nesta temporada.';
  const cost = Math.round(s.wage * 0.6);
  if (!canSpend(c, club, cost)) return 'Saldo insuficiente.';
  post(c, club, { key, day: c.day, amount: -cost, cat: 'comissão técnica', desc: `Curso de capacitação: ${s.name}` });
  s.ability += 1;
  s.wage = Math.round(s.wage * 1.06);
  club.totalInvested.staff = (club.totalInvested.staff ?? 0) + cost;
  return null;
}

// ───────────────────────── obras ─────────────────────────

export function canSpend(c: Career, club: Club, amount: number): boolean {
  if (c.finance.unlimited && club.id === c.userClubId) return true;
  return club.balance >= amount;
}

export interface StartProjectOpts {
  kind: 'facility' | 'stadium';
  target: string;
  option: keyof typeof OPTIONS;
  sectorId?: string;
  financed?: boolean;
}

export function startProject(c: Career, o: StartProjectOpts): string | null {
  const club = c.clubs[c.userClubId];
  let q: { cost: number; days: number; maint: number; from: number; to: number; blocked?: string; seats?: number; closed?: number };
  let label: string;
  if (o.kind === 'facility') {
    q = facilityQuote(club, o.target as FacilityId, o.option);
    label = FACILITY_MAP[o.target as FacilityId].name;
  } else {
    q = workQuote(club, o.target, o.option, o.sectorId);
    const sec = club.stadium.sectors.find((s) => s.id === o.sectorId);
    label = WORK_MAP[o.target].label + (sec ? ` — setor ${sec.name}` : '');
    if (club.projects.some((p) => p.status === 'building' && p.target === o.target && p.sectorId === o.sectorId)) return 'Já existe uma obra igual em andamento.';
  }
  if (q.blocked) return q.blocked;
  const upfront = o.financed ? Math.round(q.cost * 0.3) : q.cost;
  if (o.financed && !c.finance.financing) return 'O financiamento de obras não está habilitado nesta carreira.';
  if (!canSpend(c, club, upfront)) return `Saldo insuficiente: a obra exige ${upfront.toLocaleString('pt-BR')} de entrada.`;
  const id = `pj${c.nextId++}`;
  const p: Project = {
    id, kind: o.kind, target: o.target, label, option: o.option, fromLevel: q.from, toLevel: q.to, cost: q.cost, paid: upfront, start: c.day, end: c.day + q.days,
    status: 'building', maintenanceDelta: q.maint, sectorId: o.sectorId, capacityDelta: q.seats, closedSeats: q.closed, financed: o.financed,
  };
  club.projects.push(p);
  post(c, club, { key: `proj|${id}`, day: c.day, amount: -upfront, cat: 'obras', desc: `Início da obra: ${label} (${OPTIONS[o.option].label})` });
  if (o.financed) {
    const rest = q.cost - upfront;
    const months = 12;
    club.installments.push({ id: `inst${id}`, desc: `Financiamento: ${label}`, amountPerMonth: Math.round((rest * 1.08) / months), remaining: months, cat: 'parcelas' });
  }
  const groupKey = o.kind === 'stadium' ? 'stadium' : FACILITY_MAP[o.target as FacilityId].group === 'youth' ? 'youth' : 'training';
  club.totalInvested[groupKey] = (club.totalInvested[groupKey] ?? 0) + q.cost;
  if (p.closedSeats && p.sectorId) {
    const sec = club.stadium.sectors.find((s) => s.id === p.sectorId);
    if (sec) sec.closed += p.closedSeats;
  }
  addNews(c, { kind: 'stadium', icon: 'stadium', title: `Obra iniciada: ${label}`, body: `Conclusão prevista para ${fmtShort(p.end)}. Investimento total de ${q.cost.toLocaleString('pt-BR')}.`, clubIds: [club.id], playerIds: [], link: { screen: o.kind === 'stadium' ? 'stadium' : 'infra' } });
  return null;
}

/** Cancela a obra: o valor gasto proporcional ao avanço é perdido; reembolso parcial do restante já pago. */
export function cancelProject(c: Career, projectId: string): { error?: string; refund?: number; lost?: number } {
  const club = c.clubs[c.userClubId];
  const p = club.projects.find((x) => x.id === projectId && x.status === 'building');
  if (!p) return { error: 'Obra não encontrada.' };
  const progress = clamp((c.day - p.start) / Math.max(1, p.end - p.start), 0, 1);
  const unspent = p.paid * (1 - progress);
  const refund = Math.round(unspent * 0.5);
  const lost = p.paid - refund;
  p.status = 'cancelled';
  if (refund) post(c, club, { key: `projrefund|${p.id}`, day: c.day, amount: refund, cat: 'outras receitas', desc: `Reembolso parcial da obra cancelada: ${p.label}` });
  if (p.financed) club.installments = club.installments.filter((i) => i.id !== `inst${p.id}`);
  if (p.closedSeats && p.sectorId) {
    const sec = club.stadium.sectors.find((s) => s.id === p.sectorId);
    if (sec) sec.closed = Math.max(0, sec.closed - p.closedSeats);
  }
  club.stadium.history.push({ day: c.day, desc: `Obra cancelada: ${p.label} (perda de ${lost.toLocaleString('pt-BR')})`, cost: lost });
  return { refund, lost };
}

/** Avanço diário das obras de todos os clubes do usuário. */
export function progressProjects(c: Career): void {
  const club = c.clubs[c.userClubId];
  for (const p of club.projects) {
    if (p.status !== 'building' || c.day < p.end) continue;
    p.status = 'done';
    if (p.kind === 'facility') club.facilities[p.target as FacilityId] = p.toLevel;
    else applyStadiumWork(club, p.target, p.sectorId, p.toLevel, p.capacityDelta ?? 0);
    if (p.closedSeats && p.sectorId) {
      const sec = club.stadium.sectors.find((s) => s.id === p.sectorId);
      if (sec) sec.closed = Math.max(0, sec.closed - p.closedSeats);
    }
    club.stadium.history.push({ day: c.day, desc: `${p.label} concluída (nível ${p.fromLevel} → ${p.toLevel})`, cost: p.cost });
    club.events.push({ day: c.day, text: `Obra concluída: ${p.label}` });
    addNews(c, { kind: 'stadium', icon: 'stadium', title: `Obra concluída: ${p.label}`, body: `A estrutura passou do nível ${p.fromLevel} para ${p.toLevel}${p.capacityDelta ? ` e ganhou ${p.capacityDelta.toLocaleString('pt-BR')} lugares` : ''}.`, clubIds: [club.id], playerIds: [], link: { screen: p.kind === 'stadium' ? 'stadium' : 'infra' } });
  }
}

export function facilitiesMonthlyCost(club: Club): number {
  let s = 0;
  for (const f of FACILITIES) s += f.maint * club.facilities[f.id];
  return Math.round(s);
}

export function youthMonthlyCost(club: Club): number {
  return Math.round(4000 + club.youthIds.length * 900 + club.facilities.y_dorms * 1500);
}
