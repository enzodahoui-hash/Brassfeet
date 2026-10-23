import type { Career, Club, FinanceMode, FinanceSettings } from '../types';
import { clamp } from '../core/rng';
import { ymd } from '../core/date';
import { post } from './ledger';
import { wageBill } from '../universe/world';
import { facilitiesMonthlyCost, youthMonthlyCost } from '../infra/infra';
import { stadiumMonthlyCost, stadiumQuality } from '../stadium/stadium';
import { addNews } from '../news/news';

export const FINANCE_MODES: Record<FinanceMode, { name: string; desc: string }> = {
  realista: { name: 'Realista', desc: 'Caixa e receitas do clube conforme o universo do jogo. Valores aproximados e fictícios, não são balanços oficiais.' },
  equilibrado: { name: 'Equilibrado', desc: 'Orçamento padrão moderado para administrar a temporada e investir com cautela.' },
  desafio: { name: 'Desafio financeiro', desc: 'Pouco dinheiro: sobreviva com receitas, vendas e a base. Dívidas têm consequências.' },
  investidor: { name: 'Investidor rico', desc: 'Um aporte extraordinário no início, registrado separado da receita operacional.' },
  casual: { name: 'Ilimitado (casual)', desc: 'Modo diversão: orçamento muito alto e regras financeiras flexíveis. As operações continuam registradas.' },
};

export function defaultFinanceSettings(mode: FinanceMode, club: Club, world: { players: Career['players']; staff: Career['staff'] }): FinanceSettings {
  const bill = wageBill(world as Career, club);
  const base: FinanceSettings = {
    mode, initialBalance: club.balance, transferBudget: club.transferBudget, wageLimit: Math.round(bill * 1.1), revenueRealism: 1, costIntensity: 1,
    allowInjections: false, unlimited: false, injection: 0, financing: true,
  };
  switch (mode) {
    case 'realista':
      return base;
    case 'equilibrado':
      return { ...base, initialBalance: Math.round(Math.max(bill * 0.35, 2_000_000) / 100_000) * 100_000, transferBudget: Math.round(Math.max(bill * 0.2, 1_000_000) / 100_000) * 100_000 };
    case 'desafio':
      return { ...base, initialBalance: Math.round(bill * 0.04 / 10_000) * 10_000, transferBudget: 0, costIntensity: 1.15, revenueRealism: 0.92, wageLimit: Math.round(bill * 1.0) };
    case 'investidor':
      return { ...base, injection: Math.round(Math.max(50_000_000, bill * 1.5) / 1_000_000) * 1_000_000, allowInjections: true };
    case 'casual':
      return { ...base, initialBalance: 2_000_000_000, transferBudget: 1_000_000_000, unlimited: true, allowInjections: true, wageLimit: Math.round(bill * 10) };
  }
}

/** Aplica o modo financeiro escolhido apenas ao clube da carreira. */
export function applyFinanceMode(c: Career): void {
  const club = c.clubs[c.userClubId];
  const f = c.finance;
  club.balance = f.initialBalance;
  club.transferBudget = f.transferBudget;
  club.wageBudget = f.wageLimit;
  club.ledger = [];
  if (f.injection > 0) injectCapital(c, f.injection, 'Aporte inicial do investidor');
}

export function injectCapital(c: Career, amount: number, desc: string): string | null {
  const club = c.clubs[c.userClubId];
  if (!c.finance.allowInjections) return 'Aportes extraordinários não estão habilitados nesta carreira.';
  if (amount <= 0) return 'Valor inválido.';
  post(c, club, { key: `aporte|${c.day}|${c.nextId++}`, day: c.day, amount, cat: 'aporte', desc });
  club.transferBudget += Math.round(amount * 0.6);
  return null;
}

/** Desempenho recente (0..1) para patrocínio e sócios. */
function performanceIndex(club: Club): number {
  return clamp(club.fanMood / 100, 0, 1);
}

/** Salários semanais (jogadores + comissão), segundas-feiras. */
export function weeklyWages(c: Career): void {
  const week = `${c.season}-${c.day}`;
  for (const club of Object.values(c.clubs)) {
    let players = 0;
    for (const id of club.playerIds.concat(club.youthIds)) {
      const p = c.players[id];
      if (!p?.contract) continue;
      const share = p.loan && p.loan.toClubId === club.id ? p.loan.wagePct : 1;
      players += p.contract.wage * share;
    }
    // jogadores emprestados por este clube: paga a parte restante
    const user = club.id === c.userClubId;
    if (user) {
      for (const p of Object.values(c.players)) if (p.loan && p.loan.fromClubId === club.id && p.contract) players += p.contract.wage * (1 - p.loan.wagePct);
    }
    let staff = 0;
    if (user) for (const id of club.staffIds) staff += c.staff[id]?.wage ?? 0;
    const mult = user ? c.finance.costIntensity : 1;
    post(c, club, { key: `wage|${week}`, day: c.day, amount: -Math.round((players / 52) * mult), cat: 'salários', desc: 'Folha salarial semanal' });
    if (staff) post(c, club, { key: `staffwage|${week}`, day: c.day, amount: -Math.round((staff / 52) * mult), cat: 'comissão técnica', desc: 'Salários da comissão técnica' });
  }
}

/** Receitas e custos mensais (dia 1 de cada mês). */
export function monthlyFinance(c: Career): void {
  const { y, m } = ymd(c.day);
  const tag = `${y}-${m}`;
  for (const club of Object.values(c.clubs)) {
    const user = club.id === c.userClubId;
    const real = user ? c.finance.revenueRealism : 1;
    const cost = user ? c.finance.costIntensity : 1;
    const perf = performanceIndex(club);
    const repF = 0.85 + club.reputation / 330;
    const st = club.stadium;
    const sponsor = (club.revenueBase * 0.36) / 12 * (0.8 + perf * 0.4) * repF * (1 + (st.screens + st.press) * 0.008) * real;
    const tv = (club.revenueBase * 0.3) / 12 * real;
    const commercial = (club.revenueBase * 0.14) / 12 * (0.85 + perf * 0.3) * real;
    const members = (club.revenueBase * 0.1) / 12 * (0.7 + perf * 0.6) * real;
    post(c, club, { key: `spons|${tag}`, day: c.day, amount: sponsor, cat: 'patrocínio', desc: 'Patrocínios (mensal)' });
    post(c, club, { key: `tv|${tag}`, day: c.day, amount: tv, cat: 'direitos de TV', desc: 'Direitos de transmissão (mensal)' });
    post(c, club, { key: `comm|${tag}`, day: c.day, amount: commercial, cat: 'comercial', desc: 'Receitas comerciais e licenciamento' });
    post(c, club, { key: `memb|${tag}`, day: c.day, amount: members, cat: 'sócios', desc: 'Programa de sócios-torcedores' });
    if (user) {
      post(c, club, { key: `stmaint|${tag}`, day: c.day, amount: -stadiumMonthlyCost(club) * cost, cat: 'manutenção estádio', desc: 'Manutenção e operação do estádio' });
      post(c, club, { key: `facmaint|${tag}`, day: c.day, amount: -facilitiesMonthlyCost(club) * cost, cat: 'manutenção instalações', desc: 'Manutenção do CT e da base' });
      post(c, club, { key: `youth|${tag}`, day: c.day, amount: -youthMonthlyCost(club) * cost, cat: 'base', desc: 'Operação das categorias de base' });
      post(c, club, { key: `med|${tag}`, day: c.day, amount: -(8000 + club.facilities.tc_medical * 2500) * cost, cat: 'médico', desc: 'Departamento médico' });
      post(c, club, { key: `adm|${tag}`, day: c.day, amount: -((club.revenueBase * 0.06) / 12 + (wageBill(c, club) * 0.04) / 12) * cost, cat: 'outras despesas', desc: 'Administração, viagens e logística' });
    } else {
      // clubes da IA: custos operacionais agregados proporcionais ao porte
      post(c, club, { key: `ops|${tag}`, day: c.day, amount: -(club.revenueBase * 0.08) / 12, cat: 'outras despesas', desc: 'Custos operacionais' });
    }
    // parcelas
    for (const inst of club.installments) {
      if (inst.remaining <= 0) continue;
      post(c, club, { key: `inst|${inst.id}|${tag}`, day: c.day, amount: -inst.amountPerMonth, cat: inst.cat, desc: inst.desc });
      if (inst.toClubId && c.clubs[inst.toClubId]) post(c, c.clubs[inst.toClubId], { key: `instin|${inst.id}|${tag}`, day: c.day, amount: inst.amountPerMonth, cat: 'venda de jogadores', desc: `Parcela recebida: ${inst.desc}` });
      inst.remaining--;
    }
    club.installments = club.installments.filter((i) => i.remaining > 0);
    for (const loan of club.loans) {
      if (loan.remaining <= 0) continue;
      post(c, club, { key: `loan|${loan.id}|${tag}`, day: c.day, amount: -loan.monthly, cat: 'juros', desc: 'Parcela de empréstimo bancário' });
      loan.remaining--;
    }
    club.loans = club.loans.filter((l) => l.remaining > 0);
    // cheque especial: juros sobre saldo negativo
    if (club.balance < 0 && !(user && c.finance.unlimited)) {
      post(c, club, { key: `od|${tag}`, day: c.day, amount: Math.round(club.balance * 0.015), cat: 'juros', desc: 'Juros do saldo negativo' });
    }
  }
  void stadiumQuality;
}

/** Consequências de gastos excessivos para o clube do usuário. */
export function financialHealth(c: Career): void {
  const club = c.clubs[c.userClubId];
  if (c.finance.unlimited) {
    club.embargo = false;
    return;
  }
  const limit = -club.revenueBase * 0.15;
  if (club.balance < 0) club.overdraftDays++;
  else club.overdraftDays = 0;
  const was = club.embargo;
  club.embargo = club.balance < limit;
  if (club.embargo && !was) {
    addNews(c, { kind: 'money', icon: 'warning', title: `${club.name} sofre bloqueio de contratações`, body: 'Com as contas no vermelho, a diretoria e a federação impedem novas contratações com custo até o saldo voltar a um nível seguro. Venda jogadores ou reduza a folha.', clubIds: [club.id], playerIds: [], important: true, link: { screen: 'finance' } });
  }
  if (club.overdraftDays === 60) {
    addNews(c, { kind: 'money', icon: 'warning', title: `Crise financeira no ${club.name}`, body: 'Dois meses de saldo negativo: a torcida se preocupa e a moral do elenco cai.', clubIds: [club.id], playerIds: [], important: true, link: { screen: 'finance' } });
    for (const id of club.playerIds) c.players[id].morale = clamp(c.players[id].morale - 8, 0, 100);
    club.fanMood = clamp(club.fanMood - 8, 0, 100);
  }
}

export function takeBankLoan(c: Career, amount: number, months: number): string | null {
  const club = c.clubs[c.userClubId];
  if (!c.finance.financing) return 'Empréstimos não estão habilitados nesta carreira.';
  const max = club.revenueBase * 0.5 - club.loans.reduce((s, l) => s + l.monthly * l.remaining, 0);
  if (amount <= 0 || amount > max) return `Valor acima do limite de crédito (${Math.max(0, Math.round(max)).toLocaleString('pt-BR')}).`;
  const rate = 0.012 + (club.balance < 0 ? 0.008 : 0);
  const monthly = Math.round((amount * rate) / (1 - Math.pow(1 + rate, -months)));
  club.loans.push({ id: `bl${c.nextId++}`, principal: amount, monthly, remaining: months, rate });
  post(c, club, { key: `loanin|${c.day}|${c.nextId++}`, day: c.day, amount, cat: 'outras receitas', desc: `Empréstimo bancário (${months}x de ${monthly.toLocaleString('pt-BR')})` });
  return null;
}
