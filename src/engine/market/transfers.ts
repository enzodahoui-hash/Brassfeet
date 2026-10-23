import type { Career, Club, Negotiation, Player, Pos, TransferOffer } from '../types';
import { Rng, clamp, seedFrom } from '../core/rng';
import { mmdd, ymd } from '../core/date';
import { post } from '../finance/ledger';
import { addNews } from '../news/news';
import { ovrToLevel } from '../players/attributes';
import { traitEffects } from '../players/traits';
import { expectedWage, marketValue, roundMoney } from '../players/value';
import { MAX_SENIOR, MIN_SENIOR, closeSpell, moveToClub, removeFromClub } from './roster';
import { assignRoles } from '../universe/world';
import { canSpend } from '../infra/infra';

export const lvl = (p: Player) => ovrToLevel(p.ovr);

export function windowOpen(c: Career, day = c.day): boolean {
  const y = ymd(day).y;
  return c.config.transferWindows.some((w) => day >= mmdd(y, w.start) && day <= mmdd(y, w.end));
}

export function nextWindowText(c: Career): string {
  const y = ymd(c.day).y;
  for (const w of c.config.transferWindows) if (c.day < mmdd(y, w.start)) return `Próxima janela: ${w.start.split('-').reverse().join('/')}`;
  return `Próxima janela: ${c.config.transferWindows[0].start.split('-').reverse().join('/')}/${y + 1}`;
}

function roleFactor(p: Player): number {
  return { key: 1.5, first: 1.25, rotation: 1.05, backup: 0.9, prospect: 1.1 }[p.contract?.role ?? 'rotation'];
}

/** Preço pedido pelo clube vendedor: valor, importância, contrato, finanças e reputação. */
export function askingPrice(c: Career, p: Player): number {
  if (!p.clubId) return 0;
  const club = c.clubs[p.clubId];
  let v = p.value * roleFactor(p);
  const years = p.contract ? p.contract.endYear - c.season : 0;
  if (years <= 0) v *= 0.7;
  else if (years === 1) v *= 0.85;
  if (club.balance < 0) v *= 0.85;
  if (p.listed) v *= 0.85;
  if (club.playerIds.length > 30) v *= 0.92;
  const age = c.season - p.birthYear;
  if (age <= 21 && p.pot - p.ovr > 8) v *= 1.15;
  v = roundMoney(v);
  if (p.contract?.releaseClause) v = Math.min(v, p.contract.releaseClause);
  return v;
}

export function wageDemand(c: Career, p: Player, buyer: Club): number {
  const base = expectedWage(p, buyer.level, c.season);
  const current = p.contract?.wage ?? 0;
  const moving = p.clubId && p.clubId !== buyer.id ? 1.12 : 1;
  return roundMoney(Math.max(base * moving, current * (p.clubId && p.clubId !== buyer.id ? 1.08 : 1.02)));
}

/** Disposição do jogador em se transferir (positivo = aceita conversar). */
export function willingness(c: Career, p: Player, buyer: Club): { score: number; reason: string } {
  const te = traitEffects(p.traits);
  const cur = p.clubId ? c.clubs[p.clubId] : null;
  const age = c.season - p.birthYear;
  let score = 0;
  if (!cur) score += 2.5;
  else {
    score += (buyer.level - cur.level) * 0.28 + (buyer.reputation - cur.reputation) / 45;
    score -= te.loyalty * 2.2;
    if (cur.rivals.includes(buyer.id)) score -= 1.5 + te.loyalty * 2;
  }
  if (p.listed || p.happiness) score += 1.5;
  if (age >= 31) score += 1;
  score += te.ambition * (buyer.level - lvl(p)) * 0.2;
  const playerTier = lvl(p);
  if (buyer.level + 5 < playerTier) score -= (playerTier - buyer.level - 5) * 0.6;
  if (Object.values(c.competitions).some((x) => x.kind === 'continental' && x.season === c.season && x.participants.includes(buyer.id))) score += 0.5;
  const reason = score < -1.5 ? (cur && te.loyalty > 0 ? 'Muito identificado com o clube atual.' : 'Não tem interesse em um clube de menor expressão.') : score < 0 ? 'Hesitante, mas aceita ouvir.' : 'Interessado na proposta.';
  return { score, reason };
}

export function rosterFull(club: Club): boolean {
  return club.playerIds.length >= MAX_SENIOR;
}

// ───────────────────────── negociação do usuário ─────────────────────────

export interface BidResult {
  status: 'accepted' | 'counter' | 'rejected';
  counter?: number;
  message: string;
}

function findNego(c: Career, id: string): Negotiation | undefined {
  return c.negotiations.find((n) => n.id === id);
}

export function startNegotiation(c: Career, pid: string, loan = false): { nego?: Negotiation; error?: string } {
  const p = c.players[pid];
  const buyer = c.clubs[c.userClubId];
  if (!p) return { error: 'Jogador não encontrado.' };
  if (p.clubId === buyer.id) return { error: 'O jogador já pertence ao seu clube.' };
  if (p.loan) return { error: 'O jogador está emprestado e não pode ser negociado agora.' };
  if (p.clubId && !windowOpen(c)) return { error: `Janela de transferências fechada. ${nextWindowText(c)}.` };
  if (!p.clubId && !c.config.freeAgentsAnytime && !windowOpen(c)) return { error: 'Contratações de jogadores livres só durante a janela.' };
  if (rosterFull(buyer)) return { error: `Elenco cheio (${MAX_SENIOR} jogadores). Libere ou venda alguém antes.` };
  const w = willingness(c, p, buyer);
  if (w.score < -1.5) return { error: `${p.name} recusou negociar: ${w.reason}` };
  const existing = c.negotiations.find((n) => n.playerId === pid && n.stage !== 'done' && n.stage !== 'failed');
  if (existing) return { nego: existing };
  const nego: Negotiation = {
    id: `ng${c.nextId++}`, playerId: pid, sellerId: p.clubId, buyerId: buyer.id, stage: p.clubId ? 'club' : 'player', fee: 0, installments: 1, loan,
    loanWagePct: 1, askingPrice: loan ? roundMoney(p.value * 0.06) : askingPrice(c, p), rounds: 0, wageDemand: wageDemand(c, p, buyer),
    yearsDemand: clamp(c.season - p.birthYear >= 31 ? 1 : c.season - p.birthYear <= 23 ? 5 : 3, 1, 5), log: [], day: c.day,
  };
  nego.log.push(w.reason);
  c.negotiations.push(nego);
  return { nego };
}

/** Proposta ao clube dono do jogador. A IA avalia valor, importância, finanças e paciência. */
export function submitBid(c: Career, negoId: string, fee: number, installments = 1, loanWagePct = 1): BidResult {
  const n = findNego(c, negoId);
  if (!n || n.stage !== 'club') return { status: 'rejected', message: 'Negociação inválida.' };
  const p = c.players[n.playerId];
  const buyer = c.clubs[n.buyerId];
  const seller = n.sellerId ? c.clubs[n.sellerId] : null;
  if (!seller) return { status: 'rejected', message: 'Jogador sem clube.' };
  const upfront = Math.round(fee / Math.max(1, installments));
  if (buyer.embargo && fee > 0) return { status: 'rejected', message: 'Seu clube está com bloqueio de contratações por causa das finanças.' };
  if (!canSpend(c, buyer, upfront)) return { status: 'rejected', message: 'Saldo insuficiente para a entrada da proposta.' };
  n.rounds++;
  n.fee = fee;
  n.installments = installments;
  n.loanWagePct = loanWagePct;
  let ask = n.askingPrice;
  if (installments > 1) ask = Math.round(ask * (1 + installments * 0.01));
  if (n.loan) {
    const role = p.contract?.role;
    if (role === 'key' || (role === 'first' && c.season - p.birthYear > 23)) {
      n.stage = 'failed';
      return { status: 'rejected', message: `${seller.name} não empresta um jogador tão importante.` };
    }
    ask = Math.round(ask * (loanWagePct < 1 ? 1 + (1 - loanWagePct) * 1.5 : 1));
  }
  if (p.contract?.releaseClause && fee >= p.contract.releaseClause && !n.loan) {
    n.stage = 'player';
    n.log.push(`Cláusula de rescisão paga: ${fee.toLocaleString('pt-BR')}.`);
    return { status: 'accepted', message: `Valor da cláusula de rescisão atingido. ${seller.name} é obrigado a liberar o jogador.` };
  }
  if (fee >= ask) {
    n.stage = 'player';
    n.log.push(`Proposta de ${fee.toLocaleString('pt-BR')} aceita.`);
    return { status: 'accepted', message: `${seller.name} aceitou a proposta. Agora negocie o contrato com o jogador.` };
  }
  if (n.rounds >= 4 || fee < ask * 0.55) {
    n.stage = n.rounds >= 4 ? 'failed' : 'club';
    n.log.push('Proposta recusada.');
    return { status: 'rejected', message: n.rounds >= 4 ? `${seller.name} encerrou as conversas.` : `${seller.name} considerou a oferta muito baixa.` };
  }
  const counter = roundMoney(ask * (fee >= ask * 0.85 ? 0.97 : 1));
  n.askingPrice = counter;
  n.log.push(`Contraproposta: ${counter.toLocaleString('pt-BR')}.`);
  return { status: 'counter', counter, message: `${seller.name} pede ${counter.toLocaleString('pt-BR')}.` };
}

export interface ContractResult {
  status: 'accepted' | 'counter' | 'rejected';
  wage?: number;
  years?: number;
  message: string;
}

/** Proposta salarial ao jogador. */
export function offerContract(c: Career, negoId: string, wage: number, years: number, releaseClause?: number): ContractResult {
  const n = findNego(c, negoId);
  if (!n || n.stage !== 'player') return { status: 'rejected', message: 'Negociação inválida.' };
  const p = c.players[n.playerId];
  const buyer = c.clubs[n.buyerId];
  if (n.loan) {
    return completeTransfer(c, n, p.contract?.wage ?? wage, Math.max(0, (p.contract?.endYear ?? c.season) - c.season + 1));
  }
  n.rounds++;
  const w = willingness(c, p, buyer);
  const demand = n.wageDemand * (w.score < 0 ? 1.08 : w.score > 2 ? 0.95 : 1);
  const yearsOk = Math.abs(years - n.yearsDemand) <= 2;
  const clauseOk = !releaseClause || releaseClause >= p.value * 1.5 || traitEffects(p.traits).loyalty > 0;
  if (wage >= demand * 0.97 && yearsOk && clauseOk) return completeTransfer(c, n, wage, years, releaseClause);
  if (n.rounds >= 7) {
    n.stage = 'failed';
    return { status: 'rejected', message: `${p.name} desistiu da negociação.` };
  }
  const counterWage = roundMoney(Math.max(demand, wage * 1.02));
  n.wageDemand = counterWage;
  const msg = !clauseOk ? 'O jogador não aceita uma cláusula de rescisão tão baixa.' : !yearsOk ? `${p.name} prefere um contrato de ${n.yearsDemand} ano(s).` : `${p.name} pede ${counterWage.toLocaleString('pt-BR')} por ano.`;
  return { status: 'counter', wage: counterWage, years: n.yearsDemand, message: msg };
}

function completeTransfer(c: Career, n: Negotiation, wage: number, years: number, releaseClause?: number): ContractResult {
  const p = c.players[n.playerId];
  const buyer = c.clubs[n.buyerId];
  const seller = n.sellerId ? c.clubs[n.sellerId] : null;
  if (rosterFull(buyer)) {
    n.stage = 'failed';
    return { status: 'rejected', message: 'Elenco cheio.' };
  }
  const tag = `${n.id}`;
  if (n.loan && seller) {
    if (n.fee) {
      post(c, buyer, { key: `buy|${tag}`, day: c.day, amount: -n.fee, cat: 'empréstimos (taxa)', desc: `Taxa de empréstimo: ${p.name}` });
      post(c, seller, { key: `sale|${tag}`, day: c.day, amount: n.fee, cat: 'empréstimos (taxa)', desc: `Taxa de empréstimo: ${p.name}` });
    }
    loanPlayer(c, p, buyer, n.loanWagePct, n.fee);
  } else {
    if (seller && n.fee > 0) {
      const per = Math.round(n.fee / n.installments);
      post(c, buyer, { key: `buy|${tag}`, day: c.day, amount: -per, cat: 'contratações', desc: `Contratação de ${p.name} (${seller.short})${n.installments > 1 ? ` — 1/${n.installments}` : ''}` });
      post(c, seller, { key: `sale|${tag}`, day: c.day, amount: per, cat: 'venda de jogadores', desc: `Venda de ${p.name} para ${buyer.short}` });
      if (n.installments > 1) buyer.installments.push({ id: `tr${tag}`, desc: `Parcela: ${p.name}`, amountPerMonth: per, remaining: n.installments - 1, toClubId: seller.id, cat: 'parcelas' });
      post(c, buyer, { key: `fee|${tag}`, day: c.day, amount: -Math.round(n.fee * 0.05), cat: 'comissões', desc: `Comissão de intermediários: ${p.name}` });
      buyer.transferBudget = Math.max(0, buyer.transferBudget - n.fee);
    } else if (!seller) {
      post(c, buyer, { key: `bonus|${tag}`, day: c.day, amount: -Math.round(wage * 0.1), cat: 'contratações', desc: `Luvas de assinatura: ${p.name}` });
    }
    moveToClub(c, p, buyer, 'senior');
    p.contract = { wage, endYear: c.season + years - 1, signedDay: c.day, role: 'rotation', releaseClause };
    p.morale = clamp(p.morale + 10, 0, 100);
    p.happiness = undefined;
    assignRoles(c, buyer);
  }
  n.stage = 'done';
  addNews(c, {
    kind: 'transfer', icon: 'transfer', title: n.loan ? `${p.name} chega por empréstimo ao ${buyer.name}` : `${buyer.name} anuncia ${p.name}`,
    body: n.loan ? `O jogador chega emprestado pelo ${seller?.name}.` : seller ? `Contratado junto ao ${seller.name} por ${n.fee.toLocaleString('pt-BR')}, com contrato até ${c.season + years - 1}.` : `Sem clube, assina até ${c.season + years - 1}.`,
    clubIds: [buyer.id, ...(seller ? [seller.id] : [])], playerIds: [p.id], link: { screen: 'player', id: p.id },
  });
  return { status: 'accepted', message: `${p.name} é o novo reforço do ${buyer.name}!` };
}

export function cancelNegotiation(c: Career, negoId: string): void {
  const n = findNego(c, negoId);
  if (n && n.stage !== 'done') n.stage = 'failed';
}

// ───────────────────────── empréstimos ─────────────────────────

export function loanPlayer(c: Career, p: Player, to: Club, wagePct: number, fee: number, until?: number): void {
  const from = p.clubId!;
  const fromSquad = p.squad;
  closeSpell(c, p);
  removeFromClub(c, p);
  p.clubId = to.id;
  p.squad = 'senior';
  to.playerIds.push(p.id);
  p.loan = { fromClubId: from, toClubId: to.id, until: until ?? mmdd(c.season, '12-28'), wagePct, fee, apps: 0, goals: 0, minutes: 0, ratingSum: 0, fromSquad, start: c.day };
  p.joined = c.day;
  p.shirt = 0;
}

export function returnFromLoan(c: Career, p: Player): void {
  if (!p.loan) return;
  const home = c.clubs[p.loan.fromClubId];
  const to = c.clubs[p.loan.toClubId];
  const loan = p.loan;
  closeSpell(c, p, true);
  removeFromClub(c, p);
  p.loan = undefined;
  if (home) {
    p.clubId = home.id;
    p.squad = loan.fromSquad === 'youth' && c.season - p.birthYear <= 19 ? 'youth' : 'senior';
    (p.squad === 'youth' ? home.youthIds : home.playerIds).push(p.id);
    p.shirt = 0;
    if (home.id === c.userClubId) {
      addNews(c, { kind: 'transfer', icon: 'transfer', title: `${p.name} retorna de empréstimo`, body: `Pelo ${to?.name ?? 'clube'}: ${loan.apps} jogos, ${loan.goals} gols, nota média ${loan.apps ? (loan.ratingSum / loan.apps).toFixed(2) : '-'}.`, clubIds: [home.id], playerIds: [p.id], link: { screen: 'player', id: p.id } });
    }
  }
}

/** Clubes da IA aptos a receber o jogador emprestado (nível compatível). */
export function loanTargets(c: Career, p: Player): Club[] {
  const l = lvl(p);
  return Object.values(c.clubs)
    .filter((cl) => cl.id !== c.userClubId && cl.id !== p.clubId && cl.level >= l - 4 && cl.level <= l + 2.5 && cl.playerIds.length < MAX_SENIOR - 1)
    .sort((a, b) => Math.abs(a.level - (l - 1)) - Math.abs(b.level - (l - 1)))
    .slice(0, 12);
}

export function loanOut(c: Career, pid: string, toClubId: string, wagePct: number): string | null {
  const p = c.players[pid];
  const to = c.clubs[toClubId];
  if (!p || p.clubId !== c.userClubId) return 'Jogador não pertence ao seu clube.';
  if (!windowOpen(c)) return `Empréstimos só durante a janela. ${nextWindowText(c)}.`;
  if (c.season - p.birthYear < 17) return 'Jogadores com menos de 17 anos não podem ser emprestados.';
  if (!loanTargets(c, p).some((x) => x.id === toClubId)) return 'Este clube não tem interesse ou nível compatível.';
  loanPlayer(c, p, to, wagePct, 0);
  addNews(c, { kind: 'transfer', icon: 'transfer', title: `${p.name} é emprestado ao ${to.name}`, body: `O ${to.name} pagará ${Math.round(wagePct * 100)}% do salário. Retorno previsto ao fim da temporada.`, clubIds: [c.userClubId, to.id], playerIds: [p.id], link: { screen: 'player', id: p.id } });
  return null;
}

// ───────────────────────── vendas, renovações e dispensas ─────────────────────────

export function releasePlayer(c: Career, pid: string): string | null {
  const p = c.players[pid];
  const club = c.clubs[c.userClubId];
  if (!p || p.clubId !== club.id || p.loan) return 'Jogador não pertence ao seu clube.';
  const years = p.contract ? Math.max(0, p.contract.endYear - c.season) + 0.5 : 0;
  const comp = Math.round((p.contract?.wage ?? 0) * years * 0.5);
  post(c, club, { key: `release|${p.id}|${c.day}`, day: c.day, amount: -comp, cat: 'rescisões', desc: `Rescisão de contrato: ${p.name}` });
  moveToClub(c, p, null);
  p.contract = null;
  p.morale = 50;
  addNews(c, { kind: 'transfer', icon: 'transfer', title: `${club.name} rescinde com ${p.name}`, body: `A multa rescisória foi de ${comp.toLocaleString('pt-BR')}. O jogador está livre no mercado.`, clubIds: [club.id], playerIds: [p.id] });
  return null;
}

export function renewalDemand(c: Career, p: Player): { wage: number; years: number } {
  const club = c.clubs[p.clubId!];
  const te = traitEffects(p.traits);
  const base = expectedWage(p, club.level, c.season);
  const wage = roundMoney(Math.max(base * (1 + te.wageDemand * 0.5), (p.contract?.wage ?? 0) * (te.loyalty > 0 ? 1.0 : 1.05)));
  const age = c.season - p.birthYear;
  return { wage, years: age >= 32 ? 1 : age >= 29 ? 2 : age <= 22 ? 5 : 3 };
}

export function renewContract(c: Career, pid: string, wage: number, years: number): ContractResult {
  const p = c.players[pid];
  if (!p || p.clubId !== c.userClubId || !p.contract) return { status: 'rejected', message: 'Jogador inválido.' };
  const d = renewalDemand(c, p);
  const te = traitEffects(p.traits);
  if (te.ambition > 0 && c.clubs[p.clubId].level + 3 < lvl(p) && p.morale < 55) return { status: 'rejected', message: `${p.name} não quer renovar: busca um clube maior.` };
  if (wage >= d.wage * 0.97 && Math.abs(years - d.years) <= 2) {
    p.contract = { ...p.contract, wage, endYear: Math.max(p.contract.endYear, c.season + years), signedDay: c.day };
    p.morale = clamp(p.morale + 8, 0, 100);
    if (p.happiness === 'Pede aumento salarial') p.happiness = undefined;
    addNews(c, { kind: 'transfer', icon: 'transfer', title: `${p.name} renova contrato`, body: `Novo vínculo até ${p.contract.endYear}, salário anual de ${wage.toLocaleString('pt-BR')}.`, clubIds: [c.userClubId], playerIds: [p.id] });
    return { status: 'accepted', message: `${p.name} renovou até ${p.contract.endYear}.` };
  }
  p.morale = clamp(p.morale - 2, 0, 100);
  return { status: 'counter', wage: d.wage, years: d.years, message: `${p.name} pede ${d.wage.toLocaleString('pt-BR')} por ano e ${d.years} ano(s) de contrato.` };
}

export function respondOffer(c: Career, offerId: string, action: 'accept' | 'reject' | 'counter', counter?: number): string {
  const o = c.offers.find((x) => x.id === offerId);
  if (!o || o.status !== 'pending') return 'Proposta indisponível.';
  const p = c.players[o.playerId];
  const buyer = c.clubs[o.fromClubId];
  if (!p || p.clubId !== c.userClubId) {
    o.status = 'expired';
    return 'O jogador não está mais no clube.';
  }
  if (action === 'reject') {
    o.status = 'rejected';
    if (willingness(c, p, buyer).score > 1.5) {
      p.morale = clamp(p.morale - 6, 0, 100);
      p.happiness = 'Queria aceitar a proposta recusada';
    }
    return 'Proposta recusada.';
  }
  let fee = o.fee;
  if (action === 'counter') {
    if (!counter) return 'Informe o valor.';
    const max = p.value * (1.1 + buyer.level / 100);
    if (counter > max || buyer.balance < counter * 0.6) {
      o.status = 'rejected';
      return `${buyer.name} não aceitou a contraproposta e desistiu.`;
    }
    fee = counter;
  }
  if (!windowOpen(c)) {
    o.status = 'expired';
    return 'A janela de transferências fechou.';
  }
  const seller = c.clubs[c.userClubId];
  post(c, seller, { key: `sale|${o.id}`, day: c.day, amount: fee, cat: 'venda de jogadores', desc: `Venda de ${p.name} para ${buyer.short}` });
  post(c, buyer, { key: `buy|${o.id}`, day: c.day, amount: -fee, cat: 'contratações', desc: `Compra de ${p.name}` });
  moveToClub(c, p, buyer, 'senior');
  p.contract = { wage: wageDemand(c, p, buyer), endYear: c.season + 3, signedDay: c.day, role: 'first' };
  o.status = 'completed';
  assignRoles(c, buyer);
  addNews(c, { kind: 'transfer', icon: 'transfer', title: `${p.name} é vendido ao ${buyer.name}`, body: `Negócio de ${fee.toLocaleString('pt-BR')}.`, clubIds: [seller.id, buyer.id], playerIds: [p.id], link: { screen: 'player', id: p.id } });
  return `${p.name} vendido por ${fee.toLocaleString('pt-BR')}.`;
}

// ───────────────────────── mercado da IA ─────────────────────────

function positionNeed(c: Career, club: Club): Pos | null {
  const counts: Partial<Record<Pos, Player[]>> = {};
  for (const id of club.playerIds) {
    const p = c.players[id];
    if (!p) continue;
    (counts[p.pos] ??= []).push(p);
  }
  const want: [Pos, number][] = [['GK', 2], ['CB', 3], ['RB', 1], ['LB', 1], ['DM', 1], ['CM', 2], ['AM', 1], ['RW', 1], ['LW', 1], ['ST', 2]];
  let worst: Pos | null = null;
  let worstScore = Infinity;
  for (const [pos, n] of want) {
    const list = (counts[pos] ?? []).filter((p) => !p.injury || p.injury.daysLeft < 30).sort((a, b) => b.ovr - a.ovr);
    if (list.length < n) return pos;
    const best = list.slice(0, n).reduce((s, p) => s + lvl(p), 0) / n;
    const gap = best - club.level;
    if (gap < worstScore) {
      worstScore = gap;
      worst = pos;
    }
  }
  return worstScore < -1.2 ? worst : null;
}

/** Semana de mercado: clubes da IA compram, vendem e fazem propostas ao usuário. */
export function aiMarketWeek(c: Career): void {
  if (!windowOpen(c)) return;
  const rng = new Rng(seedFrom(c.id, 'market', c.day));
  const clubs = rng.shuffle(Object.values(c.clubs).filter((x) => x.id !== c.userClubId));
  const players = Object.values(c.players).filter((p) => p.squad === 'senior' && !p.loan);
  const byPos: Partial<Record<Pos, Player[]>> = {};
  for (const p of players) (byPos[p.pos] ??= []).push(p);
  let deals = 0;
  for (const club of clubs) {
    if (deals >= 30) break;
    if (!rng.chance(0.07)) continue;
    const need = positionNeed(c, club);
    if (!need || club.playerIds.length >= MAX_SENIOR - 1) continue;
    const budget = Math.max(club.transferBudget, club.balance * 0.4);
    const pool = (byPos[need] ?? []).filter((p) => {
      if (p.clubId === club.id) return false;
      const l = lvl(p);
      const age = c.season - p.birthYear;
      if (l < club.level - 1.2 || l > club.level + 2.5 || age > 31) return false;
      const owner = p.clubId ? c.clubs[p.clubId] : null;
      if (owner && owner.level > club.level + 1.5) return false;
      return true;
    });
    if (!pool.length) continue;
    const sample = rng.shuffle(pool.slice()).slice(0, 25);
    sample.sort((a, b) => b.ovr / Math.sqrt(Math.max(1, a.value)) - a.ovr / Math.sqrt(Math.max(1, b.value)));
    for (const target of sample) {
      const fee = target.clubId ? roundMoney(askingPrice(c, target) * rng.range(0.95, 1.08)) : 0;
      if (fee > budget) continue;
      if (willingness(c, target, club).score < 0) continue;
      if (target.clubId === c.userClubId) {
        if (!c.offers.some((o) => o.playerId === target.id && o.status === 'pending')) {
          c.offers.push({ id: `of${c.nextId++}`, day: c.day, playerId: target.id, fromClubId: club.id, toClubId: c.userClubId, fee, loan: false, status: 'pending', expires: c.day + 7 });
          addNews(c, { kind: 'transfer', icon: 'transfer', title: `${club.name} faz proposta por ${target.name}`, body: `Oferta de ${fee.toLocaleString('pt-BR')}. Responda na tela de Mercado.`, clubIds: [c.userClubId, club.id], playerIds: [target.id], important: true, link: { screen: 'market' } });
        }
        break;
      }
      const seller = target.clubId ? c.clubs[target.clubId] : null;
      if (seller && seller.playerIds.length <= MIN_SENIOR) continue;
      const tag = `ai${c.nextId++}`;
      if (seller) {
        post(c, club, { key: `buy|${tag}`, day: c.day, amount: -fee, cat: 'contratações', desc: `Compra de ${target.name}` });
        post(c, seller, { key: `sale|${tag}`, day: c.day, amount: fee, cat: 'venda de jogadores', desc: `Venda de ${target.name}` });
      }
      moveToClub(c, target, club, 'senior');
      target.contract = { wage: wageDemand(c, target, club), endYear: c.season + rng.int(2, 4), signedDay: c.day, role: 'first' };
      club.transferBudget = Math.max(0, club.transferBudget - fee);
      assignRoles(c, club);
      if (seller) assignRoles(c, seller);
      deals++;
      if (fee >= 8_000_000 || target.origin === 'star' || target.origin === 'creator') {
        addNews(c, { kind: 'transfer', icon: 'transfer', title: `${club.name} contrata ${target.name}`, body: seller ? `Negócio de ${fee.toLocaleString('pt-BR')} com o ${seller.name}.` : 'O jogador estava sem clube.', clubIds: [club.id, ...(seller ? [seller.id] : [])], playerIds: [target.id], link: { screen: 'player', id: target.id } });
      }
      break;
    }
  }
  // propostas espontâneas por jogadores do usuário (listados ou em destaque)
  const user = c.clubs[c.userClubId];
  for (const id of user.playerIds) {
    const p = c.players[id];
    if (!p || c.offers.some((o) => o.playerId === id && o.status === 'pending')) continue;
    const interest = (p.listed ? 0.35 : 0) + ((p.win?.goals ?? 0) + (p.win?.assists ?? 0) > 10 ? 0.06 : 0) + (p.achievements.some((a) => a.kind === 'award' && a.season >= c.season - 1) ? 0.05 : 0);
    if (!rng.chance(interest)) continue;
    const buyers = Object.values(c.clubs).filter((cl) => cl.id !== user.id && cl.level >= lvl(p) - 2 && cl.playerIds.length < MAX_SENIOR - 1 && Math.max(cl.transferBudget, cl.balance * 0.4) > p.value * 0.7);
    if (!buyers.length) continue;
    const buyer = rng.pick(buyers);
    const fee = roundMoney(p.value * rng.range(p.listed ? 0.75 : 0.9, 1.25));
    c.offers.push({ id: `of${c.nextId++}`, day: c.day, playerId: p.id, fromClubId: buyer.id, toClubId: user.id, fee, loan: false, status: 'pending', expires: c.day + 7 });
    addNews(c, { kind: 'transfer', icon: 'transfer', title: `${buyer.name} quer ${p.name}`, body: `Proposta de ${fee.toLocaleString('pt-BR')} recebida.`, clubIds: [user.id, buyer.id], playerIds: [p.id], important: true, link: { screen: 'market' } });
  }
  for (const o of c.offers) if (o.status === 'pending' && o.expires < c.day) o.status = 'expired';
  if (c.offers.length > 80) c.offers = c.offers.filter((o) => o.status === 'pending').concat(c.offers.filter((o) => o.status !== 'pending').slice(-40));
}

/** Clubes da IA completam elencos com jogadores livres e dispensam excessos. */
export function aiSquadMaintenance(c: Career): void {
  const rng = new Rng(seedFrom(c.id, 'squads', c.season, c.day));
  const free = Object.values(c.players).filter((p) => !p.clubId && p.squad === 'senior').sort((a, b) => b.ovr - a.ovr);
  for (const club of Object.values(c.clubs)) {
    if (club.id === c.userClubId) continue;
    while (club.playerIds.length > MAX_SENIOR) {
      const worst = club.playerIds.map((id) => c.players[id]).filter((p) => p && !p.loan).sort((a, b) => a.ovr - b.ovr)[0];
      if (!worst) break;
      moveToClub(c, worst, null);
      worst.contract = null;
    }
    let guard = 0;
    while (club.playerIds.length < MIN_SENIOR + 2 && guard++ < 10) {
      const need = positionNeed(c, club);
      const idx = free.findIndex((p) => (!need || p.pos === need) && lvl(p) <= club.level + 2 && lvl(p) >= club.level - 6);
      if (idx < 0) break;
      const p = free.splice(idx, 1)[0];
      moveToClub(c, p, club, 'senior');
      p.contract = { wage: wageDemand(c, p, club), endYear: c.season + rng.int(1, 3), signedDay: c.day, role: 'rotation' };
    }
    assignRoles(c, club);
  }
}

/** Fim de contratos (31/12): renovações automáticas da IA e saída de quem não renovou. */
export function expireContracts(c: Career): void {
  const rng = new Rng(seedFrom(c.id, 'contracts', c.season));
  for (const p of Object.values(c.players)) {
    if (!p.contract || p.contract.endYear > c.season || !p.clubId) continue;
    if (p.loan) continue;
    const club = c.clubs[p.clubId];
    const age = c.season - p.birthYear;
    if (club.id === c.userClubId) {
      if (p.squad === 'youth') {
        p.contract.endYear = c.season + 1; // vínculo de formação renovado automaticamente
        continue;
      }
      moveToClub(c, p, null);
      p.contract = null;
      addNews(c, { kind: 'transfer', icon: 'transfer', title: `${p.name} deixa o ${club.name}`, body: 'O contrato terminou sem renovação; o jogador está livre no mercado.', clubIds: [club.id], playerIds: [p.id] });
      continue;
    }
    const valuable = (p.contract.role === 'key' || p.contract.role === 'first' || p.squad === 'youth') && age < 33;
    if (valuable ? rng.chance(0.82) : rng.chance(0.35)) {
      p.contract = { ...p.contract, endYear: c.season + rng.int(1, age >= 30 ? 2 : 4), wage: Math.max(p.contract.wage, expectedWage(p, club.level, c.season + 1)) };
    } else {
      moveToClub(c, p, null);
      p.contract = null;
    }
  }
}

export function offerIsPending(c: Career, o: TransferOffer): boolean {
  return o.status === 'pending' && o.expires >= c.day;
}

export function marketSearch(c: Career, f: { q?: string; pos?: Pos | ''; minAge?: number; maxAge?: number; minLvl?: number; maxLvl?: number; maxValue?: number; free?: boolean; country?: string; listed?: boolean }, limit = 300): Player[] {
  const q = f.q?.toLowerCase().trim();
  const out: Player[] = [];
  for (const p of Object.values(c.players)) {
    if (p.squad !== 'senior' || p.clubId === c.userClubId) continue;
    if (f.free && p.clubId) continue;
    if (f.listed && !p.listed) continue;
    if (f.pos && p.pos !== f.pos) continue;
    const age = c.season - p.birthYear;
    if (f.minAge && age < f.minAge) continue;
    if (f.maxAge && age > f.maxAge) continue;
    const l = lvl(p);
    if (f.minLvl !== undefined && l < f.minLvl) continue;
    if (f.maxLvl !== undefined && l > f.maxLvl + 0.99) continue;
    if (f.maxValue && p.value > f.maxValue) continue;
    if (f.country && (p.clubId ? c.clubs[p.clubId]?.country : '') !== f.country) continue;
    if (q && !p.name.toLowerCase().includes(q) && !(p.clubId && c.clubs[p.clubId]?.name.toLowerCase().includes(q))) continue;
    out.push(p);
  }
  out.sort((a, b) => b.ovr - a.ovr);
  return out.slice(0, limit);
}

export function playerMarketStatus(c: Career, p: Player): string {
  if (!p.clubId) return 'Livre';
  if (p.loan) return 'Emprestado';
  if (p.listed) return 'À venda';
  const years = p.contract ? p.contract.endYear - c.season : 0;
  if (years <= 0) return 'Fim de contrato';
  return 'Sob contrato';
}

export { marketValue };
