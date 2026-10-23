import { describe, expect, test } from 'vitest';
import { advanceDays, career, world } from './helpers';
import { post, sumBy } from '../src/engine/finance/ledger';
import { defaultFinanceSettings, injectCapital, applyFinanceMode } from '../src/engine/finance/economy';
import { newCareer } from '../src/engine/career/create';
import { cancelProject, facilityQuote, hireStaff, startProject, progressProjects, clubEffects } from '../src/engine/infra/infra';
import { availableCapacity, computeAttendance, totalCapacity } from '../src/engine/stadium/stadium';
import { launchCollection, currentCollection, weeklyKitSales, restock, updateDesign } from '../src/engine/kits/commerce';
import { scoreKit, collectionProfit } from '../src/engine/kits/kits';
import { offerContract, releasePlayer, startNegotiation, submitBid, windowOpen, loanOut, loanTargets, returnFromLoan, renewContract, renewalDemand } from '../src/engine/market/transfers';
import { acceptCandidate, generateIntake, promote, potentialEstimate } from '../src/engine/youth/academy';
import { Rng } from '../src/engine/core/rng';
import { retirePlayer } from '../src/engine/players/retirement';
import { progressPlayer } from '../src/engine/players/progression';
import { ovrToLevel } from '../src/engine/players/attributes';
import { wageBill } from '../src/engine/universe/world';
import { dayOf } from '../src/engine/core/date';
import type { Career } from '../src/engine/types';

const fundsDay = (c: Career) => c.day;

describe('Finanças', () => {
  test('lançamento idempotente: a mesma receita nunca entra duas vezes', () => {
    const c = career('flamengo', 'fin1');
    const club = c.clubs[c.userClubId];
    const b = club.balance;
    expect(post(c, club, { key: 'teste|1', day: c.day, amount: 1000, cat: 'premiações', desc: 'x' })).toBe(true);
    expect(post(c, club, { key: 'teste|1', day: c.day, amount: 1000, cat: 'premiações', desc: 'x' })).toBe(false);
    expect(club.balance).toBe(b + 1000);
  });

  test('modos financeiros afetam apenas a carreira correspondente', () => {
    const w = world();
    const club = w.clubs.mirassol;
    const rich = newCareer(w, { clubId: 'mirassol', managerName: 'A', difficulty: 'normal', finance: defaultFinanceSettings('investidor', club, w as Career), id: 'rich' });
    const poor = newCareer(w, { clubId: 'mirassol', managerName: 'B', difficulty: 'normal', finance: defaultFinanceSettings('desafio', club, w as Career), id: 'poor' });
    expect(rich.clubs.mirassol.balance).toBeGreaterThan(poor.clubs.mirassol.balance + 40_000_000);
    expect(w.clubs.mirassol.balance).toBe(club.balance); // universo original intacto
    const casual = newCareer(w, { clubId: 'mirassol', managerName: 'C', difficulty: 'normal', finance: defaultFinanceSettings('casual', club, w as Career), id: 'cas' });
    expect(casual.finance.unlimited).toBe(true);
  });

  test('aporte extraordinário registrado separado da receita operacional', () => {
    const w = world();
    const c = newCareer(w, { clubId: 'mirassol', managerName: 'A', difficulty: 'normal', finance: defaultFinanceSettings('investidor', w.clubs.mirassol, w as Career), id: 'inj' });
    const s = sumBy(c.clubs.mirassol, 0, 1e9);
    expect(s.income['aporte']).toBe(c.finance.injection);
    expect(injectCapital(c, 5_000_000, 'Novo aporte')).toBeNull();
    expect(sumBy(c.clubs.mirassol, 0, 1e9).income['aporte']).toBe(c.finance.injection + 5_000_000);
    const real = career('mirassol', 'noinj');
    expect(injectCapital(real, 1000, 'x')).toMatch(/não estão habilitados/);
    void applyFinanceMode;
  });

  test('salários semanais e receitas mensais são lançados', () => {
    const c = career('flamengo', 'fin2');
    advanceDays(c, 40);
    const s = sumBy(c.clubs.flamengo, 0, 1e9);
    expect(s.expense['salários']).toBeGreaterThan(0);
    expect(s.income['patrocínio']).toBeGreaterThan(0);
    expect(s.income['bilheteria']).toBeGreaterThan(0);
  });
});

describe('Infraestrutura e estádio', () => {
  test('compra com saldo suficiente e conclusão no prazo correto', () => {
    const c = career('flamengo', 'inf1');
    const club = c.clubs.flamengo;
    club.balance = 50_000_000;
    const q = facilityQuote(club, 'tc_gym', 'standard');
    const before = club.facilities.tc_gym;
    expect(startProject(c, { kind: 'facility', target: 'tc_gym', option: 'standard' })).toBeNull();
    expect(club.balance).toBe(50_000_000 - q.cost);
    const p = club.projects[club.projects.length - 1];
    expect(p.end - p.start).toBe(q.days);
    c.day = p.end - 1;
    progressProjects(c);
    expect(club.facilities.tc_gym).toBe(before);
    c.day = p.end;
    progressProjects(c);
    expect(club.facilities.tc_gym).toBe(before + 1);
    expect(p.status).toBe('done');
  });

  test('bloqueia compra sem recursos (sem financiamento)', () => {
    const c = career('mirassol', 'inf2');
    c.clubs.mirassol.balance = 1000;
    expect(startProject(c, { kind: 'facility', target: 'tc_medical', option: 'premium' })).toMatch(/Saldo insuficiente/);
  });

  test('cancelamento explicita custo perdido e reembolso parcial', () => {
    const c = career('flamengo', 'inf3');
    c.clubs.flamengo.balance = 50_000_000;
    startProject(c, { kind: 'facility', target: 'y_dorms', option: 'standard' });
    const p = c.clubs.flamengo.projects.at(-1)!;
    c.day = p.start + Math.round((p.end - p.start) / 2);
    const r = cancelProject(c, p.id);
    expect(r.refund).toBeGreaterThan(0);
    expect(r.lost).toBeGreaterThan(r.refund!);
    expect(p.status).toBe('cancelled');
  });

  test('ampliação do estádio interdita setor durante a obra e aumenta a capacidade', () => {
    const c = career('mirassol', 'st1');
    const club = c.clubs.mirassol;
    club.balance = 100_000_000;
    const cap0 = totalCapacity(club.stadium);
    expect(startProject(c, { kind: 'stadium', target: 'expand', option: 'standard', sectorId: 's2' })).toBeNull();
    expect(availableCapacity(club.stadium)).toBeLessThan(cap0);
    expect(totalCapacity(club.stadium)).toBe(cap0); // não aumenta instantaneamente
    const p = club.projects.at(-1)!;
    c.day = p.end;
    progressProjects(c);
    expect(totalCapacity(club.stadium)).toBe(cap0 + 5000);
    expect(availableCapacity(club.stadium)).toBe(totalCapacity(club.stadium));
  });

  test('bilheteria responde a capacidade e preço', () => {
    const c = career('mirassol', 'st2');
    const f = Object.values(c.fixtures).find((x) => x.home === 'mirassol')!;
    const comp = c.competitions[f.compId];
    const a = computeAttendance(c, f, comp);
    c.clubs.mirassol.stadium.sectors[2].capacity += 20000;
    const b = computeAttendance(c, f, comp);
    expect(b.attendance).toBeGreaterThanOrEqual(a.attendance);
    c.clubs.mirassol.stadium.ticketPrice *= 4;
    const d = computeAttendance(c, f, comp);
    expect(d.attendance).toBeLessThan(b.attendance);
  });

  test('comissão técnica melhora efeitos com limites de capacidade', () => {
    const c = career('flamengo', 'stf');
    const club = c.clubs.flamengo;
    club.balance = 1e9;
    const before = clubEffects(c, club).youthDev;
    const best = Object.values(c.staff).filter((s) => !s.clubId && s.role === 'youthCoach').sort((a, b) => b.ability - a.ability)[0];
    const err = hireStaff(c, best.id);
    if (err) expect(err).toMatch(/Capacidade/);
    else expect(clubEffects(c, club).youthDev).toBeGreaterThanOrEqual(before);
    expect(clubEffects(c, club).youthDev).toBeLessThan(1.3);
  });
});

describe('Uniformes', () => {
  test('avaliação estética reproduzível (sem números aleatórios)', () => {
    const c = career('flamengo', 'k1');
    const k = currentCollection(c);
    const a = scoreKit(k.home, c.clubs.flamengo, c.season);
    const b = scoreKit(k.home, c.clubs.flamengo, c.season);
    expect(a).toEqual(b);
    const ugly = { ...k.home, primary: '#ffff00', secondary: '#ff00ff', numberColor: '#ffff10', pattern: 'geometric' as const };
    expect(scoreKit(ugly, c.clubs.flamengo, c.season).total).toBeLessThan(a.total);
  });

  test('lançamento cria estoque, despesas e receitas; lucro ≠ receita bruta', () => {
    const c = career('flamengo', 'k2');
    const club = c.clubs.flamengo;
    club.balance = 50_000_000;
    const k = currentCollection(c);
    expect(updateDesign(c, k.id, 'home', { ...k.home, pattern: 'vstripes' })).toBeNull();
    const b0 = club.balance;
    expect(launchCollection(c, k.id, { price: 80, units: 20000, marketing: 300000, unitCost: 14, name: 'Teste' })).toBeNull();
    expect(club.balance).toBe(b0 - 20000 * 14 - 300000);
    expect(k.stock).toBe(20000);
    for (let i = 0; i < 6; i++) {
      c.day += 7;
      weeklyKitSales(c);
    }
    expect(k.sold).toBeGreaterThan(0);
    expect(k.stock).toBe(20000 - k.sold);
    expect(k.revenue).toBe(sumBy(club, 0, 1e9).income['camisas']);
    expect(collectionProfit(k)).toBe(k.revenue - k.productionCost - k.marketing);
  });

  test('demanda acima do estoque gera vendas perdidas e permite reposição', () => {
    const c = career('flamengo', 'k3');
    c.clubs.flamengo.balance = 50_000_000;
    const k = currentCollection(c);
    launchCollection(c, k.id, { price: 60, units: 100, marketing: 0, unitCost: 14, name: 'Mini' });
    c.day += 7;
    weeklyKitSales(c);
    expect(k.stock).toBe(0);
    expect(k.lostSales).toBeGreaterThan(0);
    expect(k.status).toBe('esgotado');
    expect(restock(c, k.id, 5000)).toBeNull();
    c.day += 14;
    weeklyKitSales(c);
    expect(k.produced).toBe(5100);
  });
});

describe('Mercado', () => {
  test('compra completa: clube aceita, jogador assina, elencos e finanças atualizam', () => {
    const c = career('palmeiras', 'mk1');
    c.clubs.palmeiras.balance = 200_000_000;
    expect(windowOpen(c)).toBe(true);
    const target = Object.values(c.players).find((p) => p.clubId && p.clubId !== 'palmeiras' && ovrToLevel(p.ovr) > 11 && ovrToLevel(p.ovr) < 15 && c.clubs[p.clubId].level < 14 && !p.loan)!;
    const seller = c.clubs[target.clubId!];
    const sellerBal = seller.balance;
    const { nego, error } = startNegotiation(c, target.id);
    expect(error).toBeUndefined();
    let r = submitBid(c, nego!.id, nego!.askingPrice);
    expect(r.status).toBe('accepted');
    let k = offerContract(c, nego!.id, nego!.wageDemand, nego!.yearsDemand);
    if (k.status === 'counter') k = offerContract(c, nego!.id, k.wage!, k.years!);
    expect(k.status).toBe('accepted');
    expect(target.clubId).toBe('palmeiras');
    expect(c.clubs.palmeiras.playerIds).toContain(target.id);
    expect(seller.playerIds).not.toContain(target.id);
    expect(seller.balance).toBeGreaterThan(sellerBal);
    void r;
  });

  test('janela fechada bloqueia negociação com clubes', () => {
    const c = career('palmeiras', 'mk2');
    c.day = dayOf(c.season, 5, 10);
    const target = Object.values(c.players).find((p) => p.clubId && p.clubId !== 'palmeiras')!;
    expect(startNegotiation(c, target.id).error).toMatch(/Janela/);
  });

  test('liberar jogador paga rescisão e o deixa livre', () => {
    const c = career('flamengo', 'mk3');
    const p = c.players[c.clubs.flamengo.playerIds[20]];
    expect(releasePlayer(c, p.id)).toBeNull();
    expect(p.clubId).toBeNull();
    expect(sumBy(c.clubs.flamengo, 0, 1e9).expense['rescisões']).toBeGreaterThan(0);
  });

  test('renovação exige salário compatível', () => {
    const c = career('flamengo', 'mk4');
    const p = c.players[c.clubs.flamengo.playerIds[0]];
    const d = renewalDemand(c, p);
    expect(renewContract(c, p.id, Math.round(d.wage * 0.5), d.years).status).toBe('counter');
    const ok = renewContract(c, p.id, d.wage, d.years);
    expect(['accepted', 'rejected']).toContain(ok.status);
  });

  test('empréstimo e retorno preservam histórico', () => {
    const c = career('flamengo', 'mk5');
    const p = Object.values(c.players).filter((x) => x.clubId === 'flamengo' && x.squad === 'senior' && c.season - x.birthYear >= 18).sort((a, b) => a.ovr - b.ovr)[0];
    const targets = loanTargets(c, p);
    expect(targets.length).toBeGreaterThan(0);
    expect(loanOut(c, p.id, targets[0].id, 1)).toBeNull();
    expect(p.clubId).toBe(targets[0].id);
    expect(p.loan?.fromClubId).toBe('flamengo');
    returnFromLoan(c, p);
    expect(p.clubId).toBe('flamengo');
    expect(p.loan).toBeUndefined();
    expect(p.history.some((h) => h.loan)).toBe(true);
  });
});

describe('Base, promoção e aposentadoria', () => {
  test('jovem da base evolui ao longo das semanas', () => {
    const c = career('flamengo', 'y1');
    const kid = c.players[c.clubs.flamengo.youthIds.find((id) => c.players[id].pot - c.players[id].ovr > 8) ?? c.clubs.flamengo.youthIds[0]];
    const o0 = kid.ovr;
    const ctx = { rng: new Rng(2), effects: new Map() };
    for (let i = 0; i < 20; i++) progressPlayer(c, kid, ctx);
    expect(kid.ovr).toBeGreaterThan(o0);
  });

  test('promoção ao profissional atualiza elenco, contrato e folha', () => {
    const c = career('flamengo', 'y2');
    const club = c.clubs.flamengo;
    const id = club.youthIds[0];
    const p = c.players[id];
    const bill = wageBill(c, club);
    expect(promote(c, p, 'rotation')).toBeNull();
    expect(club.playerIds).toContain(id);
    expect(club.youthIds).not.toContain(id);
    expect(p.squad).toBe('senior');
    expect(p.contract!.role).toBe('rotation');
    expect(wageBill(c, club)).toBeGreaterThanOrEqual(bill);
  });

  test('revelações com potencial incerto e aceite do candidato', () => {
    const c = career('flamengo', 'y3');
    const club = c.clubs.flamengo;
    const cands = generateIntake(c, club, new Rng(9));
    expect(cands.length).toBeGreaterThanOrEqual(2);
    c.intakeCandidates.push(...cands.map((p) => p.id));
    const est = potentialEstimate(c, cands[0]);
    expect(est.high).toBeGreaterThanOrEqual(est.low);
    for (const p of club.youthIds.slice(0, 4)) club.youthIds.length > 2 && promote(c, c.players[p], 'prospect');
    expect(acceptCandidate(c, cands[0].id)).toBeNull();
    expect(club.youthIds).toContain(cands[0].id);
  });

  test('aposentadoria preserva histórico e atualiza o elenco', () => {
    const c = career('flamengo', 'r1');
    const p = c.players[c.clubs.flamengo.playerIds[3]];
    p.history.push({ season: 2026, clubId: 'flamengo', clubName: 'Gávea', apps: 40, goals: 10, assists: 5, avgRating: 7, level: 15, value: 1e6 });
    const id = p.id;
    const r = retirePlayer(c, p, new Rng(1));
    expect(c.players[id]).toBeUndefined();
    expect(c.retired[id].history).toHaveLength(1);
    expect(r.apps).toBe(40);
    expect(c.clubs.flamengo.playerIds).not.toContain(id);
    void fundsDay;
  });
});
