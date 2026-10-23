import type { Career, Club, LedgerCategory, LedgerEntry, World } from '../types';

export const INCOME_CATS: LedgerCategory[] = ['bilheteria', 'premiações', 'patrocínio', 'comercial', 'venda de jogadores', 'empréstimos (taxa)', 'produtos', 'camisas', 'camarotes', 'sócios', 'aporte', 'direitos de TV', 'outras receitas'];
export const EXPENSE_CATS: LedgerCategory[] = ['salários', 'contratações', 'parcelas', 'comissões', 'manutenção estádio', 'manutenção instalações', 'comissão técnica', 'médico', 'obras', 'base', 'produção de uniformes', 'marketing', 'juros', 'rescisões', 'outras despesas'];

const MAX_AI_LEDGER = 20;
const MAX_USER_LEDGER = 4000;

/** Índice de chaves por clube (não serializado) para garantir lançamento único por evento. */
const keyCache = new WeakMap<Club, Set<string>>();
function keysOf(club: Club): Set<string> {
  let s = keyCache.get(club);
  if (!s) {
    s = new Set(club.ledger.map((e) => e.key));
    for (const k of club.paidKeys ?? []) s.add(k);
    keyCache.set(club, s);
  }
  return s;
}

/** Chaves já pagas de clubes da IA cujo histórico detalhado foi resumido (mantidas por temporada). */
export function paidKey(club: Club, key: string): boolean {
  return keysOf(club).has(key);
}

export interface PostOpts {
  key: string;
  day: number;
  amount: number;
  cat: LedgerCategory;
  desc: string;
}

/**
 * Lança uma receita (+) ou despesa (−) no caixa. Idempotente: a mesma chave nunca é lançada duas vezes.
 * Retorna false se a chave já existia.
 */
export function post(world: World | Career, club: Club, o: PostOpts, isUser = false): boolean {
  if (!o.amount) return false;
  const keys = keysOf(club);
  if (keys.has(o.key)) return false;
  const amount = Math.round(o.amount);
  const entry: LedgerEntry = { id: `${o.key}`, key: o.key, day: o.day, amount, cat: o.cat, desc: o.desc };
  club.ledger.push(entry);
  keys.add(o.key);
  club.balance += amount;
  const userClub = isUser || ('userClubId' in world && (world as Career).userClubId === club.id);
  const cap = userClub ? MAX_USER_LEDGER : MAX_AI_LEDGER;
  if (club.ledger.length > cap) {
    // compacta lançamentos antigos preservando as chaves (evita pagamentos duplicados)
    const removed = club.ledger.splice(0, club.ledger.length - cap);
    const store = (club.paidKeys ??= []);
    for (const r of removed) if (/^(prize|part|stage|champ|award|sale|buy)/.test(r.key)) store.push(r.key);
    if (store.length > 600) store.splice(0, store.length - 600);
  }
  return true;
}

export function resetLedgerCache(club: Club): void {
  keyCache.delete(club);
}

export function sumBy(club: Club, from: number, to: number): { income: Record<string, number>; expense: Record<string, number>; totalIn: number; totalOut: number } {
  const income: Record<string, number> = {};
  const expense: Record<string, number> = {};
  let totalIn = 0, totalOut = 0;
  for (const e of club.ledger) {
    if (e.day < from || e.day > to) continue;
    if (e.amount >= 0) {
      income[e.cat] = (income[e.cat] ?? 0) + e.amount;
      totalIn += e.amount;
    } else {
      expense[e.cat] = (expense[e.cat] ?? 0) - e.amount;
      totalOut -= e.amount;
    }
  }
  return { income, expense, totalIn, totalOut };
}

export function fmtMoney(v: number, cur = '€'): string {
  const s = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${s}${cur} ${(a / 1e9).toFixed(2).replace('.', ',')} bi`;
  if (a >= 1e6) return `${s}${cur} ${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace('.', ',')} mi`;
  if (a >= 1e3) return `${s}${cur} ${Math.round(a / 1e3)} mil`;
  return `${s}${cur} ${Math.round(a)}`;
}
