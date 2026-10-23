import type { Career, KitCollection, KitDesign } from '../types';
import { clamp } from '../core/rng';
import { post } from '../finance/ledger';
import { addNews } from '../news/news';
import { canSpend } from '../infra/infra';
import { collectionProfit, defaultKitCollection, scoreKit, weeklyKitDemand } from './kits';
import { ovrToLevel } from '../players/attributes';
import { traitEffects } from '../players/traits';

export function currentCollection(c: Career): KitCollection {
  const club = c.clubs[c.userClubId];
  let k = club.kits.find((x) => x.season === c.season);
  if (!k) {
    const prev = club.kits.filter((x) => x.season < c.season).sort((a, b) => b.season - a.season)[0];
    k = defaultKitCollection(club, c.season);
    if (prev) {
      k.home = { ...prev.home };
      k.away = { ...prev.away };
      k.third = { ...prev.third };
      k.gk = { ...prev.gk };
    }
    club.kits.push(k);
  }
  return k;
}

export function previousDesigns(c: Career, season: number): KitDesign[] {
  return c.clubs[c.userClubId].kits.filter((k) => k.season < season && k.launched).map((k) => k.home);
}

export function updateDesign(c: Career, collectionId: string, kind: 'home' | 'away' | 'third' | 'gk', design: KitDesign): string | null {
  const club = c.clubs[c.userClubId];
  const k = club.kits.find((x) => x.id === collectionId);
  if (!k) return 'Coleção não encontrada.';
  if (k.launched) return 'A coleção já foi lançada; crie uma nova na próxima temporada.';
  k[kind] = design;
  const sc = scoreKit(k.home, club, k.season, 'home', previousDesigns(c, k.season));
  k.designScore = sc.total;
  k.acceptance = sc.acceptance;
  return null;
}

/** Lançamento: produção inicial e marketing saem do caixa; aceitação calculada do design. */
export function launchCollection(c: Career, collectionId: string, o: { price: number; units: number; marketing: number; unitCost: number; name: string }): string | null {
  const club = c.clubs[c.userClubId];
  const k = club.kits.find((x) => x.id === collectionId);
  if (!k) return 'Coleção não encontrada.';
  if (k.launched) return 'Coleção já lançada.';
  if (o.price < 10 || o.units < 100) return 'Defina preço (mín. 10) e produção (mín. 100 unidades).';
  const production = Math.round(o.units * o.unitCost);
  const total = production + o.marketing;
  if (!canSpend(c, club, total)) return `Saldo insuficiente: produção + marketing custam ${total.toLocaleString('pt-BR')}.`;
  const sc = scoreKit(k.home, club, k.season, 'home', previousDesigns(c, k.season));
  Object.assign(k, { launched: true, launchDay: c.day, price: o.price, unitCost: o.unitCost, produced: o.units, stock: o.units, marketing: o.marketing, productionCost: production, designScore: sc.total, acceptance: sc.acceptance, status: 'à venda', name: o.name || k.name });
  post(c, club, { key: `kitprod|${k.id}`, day: c.day, amount: -production, cat: 'produção de uniformes', desc: `Produção inicial: ${o.units.toLocaleString('pt-BR')} camisas (${k.name})` });
  if (o.marketing) post(c, club, { key: `kitmkt|${k.id}`, day: c.day, amount: -o.marketing, cat: 'marketing', desc: `Campanha de lançamento: ${k.name}` });
  club.totalInvested.kits = (club.totalInvested.kits ?? 0) + total;
  const reception = sc.acceptance >= 75 ? 'é aclamado pela torcida' : sc.acceptance >= 55 ? 'tem boa recepção' : 'divide opiniões';
  addNews(c, { kind: 'kit', icon: 'kit', title: `Novo uniforme do ${club.name} ${reception}`, body: `A "${k.name}" chega às lojas por ${o.price.toLocaleString('pt-BR')}. Nota de design ${sc.total}/100, aceitação estimada de ${sc.acceptance}%.`, clubIds: [club.id], playerIds: [], link: { screen: 'kits' } });
  return null;
}

export function restock(c: Career, collectionId: string, units: number): string | null {
  const club = c.clubs[c.userClubId];
  const k = club.kits.find((x) => x.id === collectionId);
  if (!k || !k.launched) return 'Coleção não lançada.';
  if (k.restockPending) return 'Já há uma reposição a caminho.';
  const cost = Math.round(units * k.unitCost * 1.08);
  if (!canSpend(c, club, cost)) return 'Saldo insuficiente.';
  post(c, club, { key: `kitrestock|${k.id}|${c.day}`, day: c.day, amount: -cost, cat: 'produção de uniformes', desc: `Reposição de estoque: ${units.toLocaleString('pt-BR')} camisas` });
  k.productionCost += cost;
  k.restockPending = { units, arrives: c.day + 14 };
  return null;
}

export function setDiscount(c: Career, collectionId: string, discount: number): void {
  const k = c.clubs[c.userClubId].kits.find((x) => x.id === collectionId);
  if (!k) return;
  k.discount = clamp(discount, 0, 0.6);
  if (k.discount >= 0.3 && k.stock > 0) k.status = 'liquidação';
  else if (k.stock > 0) k.status = 'à venda';
}

export function extraMarketing(c: Career, collectionId: string, amount: number): string | null {
  const club = c.clubs[c.userClubId];
  const k = club.kits.find((x) => x.id === collectionId);
  if (!k || !k.launched) return 'Coleção não lançada.';
  if (!canSpend(c, club, amount)) return 'Saldo insuficiente.';
  post(c, club, { key: `kitmkt2|${k.id}|${c.day}`, day: c.day, amount: -amount, cat: 'marketing', desc: `Campanha extra: ${k.name}` });
  k.marketing += amount;
  club.totalInvested.kits = (club.totalInvested.kits ?? 0) + amount;
  return null;
}

/** Vendas semanais: estoque diminui; demanda acima do estoque vira venda perdida. */
export function weeklyKitSales(c: Career): void {
  const club = c.clubs[c.userClubId];
  const stars = club.playerIds.map((id) => c.players[id]).filter(Boolean).sort((a, b) => b.reputation - a.reputation).slice(0, 3);
  const starPower = clamp(stars.reduce((s, p) => s + (p.reputation / 100) * (1 + traitEffects(p.traits).popularity) * (ovrToLevel(p.ovr) >= 20 ? 1.3 : 1), 0) / 6, 0, 0.8);
  for (const k of club.kits) {
    if (!k.launched || k.status === 'encerrada') continue;
    if (k.restockPending && c.day >= k.restockPending.arrives) {
      k.stock += k.restockPending.units;
      k.produced += k.restockPending.units;
      k.restockPending = undefined;
      if (k.status === 'esgotado') k.status = 'à venda';
    }
    const weeks = Math.floor((c.day - (k.launchDay ?? c.day)) / 7);
    let demand = weeklyKitDemand(k, club, weeks, starPower);
    if (k.season < c.season) demand = Math.round(demand * 0.25);
    const discountBoost = 1 + k.discount * 1.2;
    demand = Math.round(demand * discountBoost);
    const sold = Math.min(k.stock, demand);
    const lost = demand - sold;
    k.stock -= sold;
    k.sold += sold;
    k.lostSales += lost;
    k.weeklySales.push(sold);
    if (k.weeklySales.length > 60) k.weeklySales.shift();
    const revenue = Math.round(sold * k.price * (1 - k.discount));
    k.revenue += revenue;
    if (revenue) post(c, club, { key: `kitsale|${k.id}|${c.day}`, day: c.day, amount: revenue, cat: 'camisas', desc: `Vendas de camisas (${sold.toLocaleString('pt-BR')} un.) — ${k.name}` });
    if (k.stock === 0 && k.status !== 'esgotado') {
      k.status = 'esgotado';
      addNews(c, { kind: 'kit', icon: 'kit', title: `Camisa do ${club.name} esgota nas lojas`, body: `A procura superou o estoque${lost ? ` (${lost.toLocaleString('pt-BR')} vendas perdidas nesta semana)` : ''}. Avalie uma reposição.`, clubIds: [club.id], playerIds: [], link: { screen: 'kits' } });
    }
    if (k.season < c.season - 1) k.status = 'encerrada';
  }
}

export { collectionProfit };
