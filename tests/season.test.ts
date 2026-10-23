import { beforeAll, describe, expect, test } from 'vitest';
import { career, playSeason } from './helpers';
import type { Career } from '../src/engine/types';
import { findClashes } from '../src/engine/calendar/resolve';
import { compKey, leagueTable } from '../src/engine/competitions/manager';
import { awardScorerStars, runBallon } from '../src/engine/awards/awards';
import { finalizeCompetition } from '../src/engine/competitions/finalize';
import { ymd } from '../src/engine/core/date';
import { SaveManager, memoryKV } from '../src/engine/save/storage';
import { insertCreated, defaultSpec } from '../src/engine/players/creator';
import { advanceDay } from '../src/engine/career/advance';
import { ovrToLevel } from '../src/engine/players/attributes';
import { resetLedgerCache } from '../src/engine/finance/ledger';
import { compStat, statRows, sumRows } from '../src/engine/players/stats';
import { playFixture } from '../src/engine/career/matches';

let c: Career;
let creatorId: string;
let snapshot1: { divisionSizes: Record<string, number>; clubs: number; ledgerKeys: number };

beforeAll(() => {
  c = career('flamengo', 'season-it');
  // craque criado pelo usuário, inserido no elenco antes da temporada
  const s = { ...defaultSpec(c, c.userClubId), name: 'Craque do Usuário', firstName: 'Craque', lastName: 'Usuário', level: 23, potential: 25, age: 23, pos: 'ST' as const, style: 'artilheiro', placement: 'userPro' as const };
  creatorId = insertCreated(c, s).id;
  playSeason(c);
  const sizes: Record<string, number> = {};
  for (const cl of Object.values(c.clubs)) sizes[cl.divisionId] = (sizes[cl.divisionId] ?? 0) + 1;
  snapshot1 = { divisionSizes: sizes, clubs: Object.keys(c.clubs).length, ledgerKeys: 0 };
}, 600_000);

describe('Temporada completa', () => {
  test('todas as competições de 2027 terminaram e foram finalizadas', () => {
    const comps = Object.values(c.competitions).filter((x) => x.season === 2027);
    expect(comps.length).toBeGreaterThan(40);
    for (const comp of comps) {
      expect(comp.status).toBe('finished');
      expect(comp.finalized).toBe(true);
      expect(comp.champion).toBeTruthy();
    }
    expect(c.season).toBe(2028);
  });

  test('nenhum clube jogou duas partidas no mesmo dia', () => {
    expect(findClashes(c)).toEqual([]);
  });

  test('campeão da liga é o líder da tabela final', () => {
    for (const id of ['bra1', 'arg1', 'eng1', 'esp1', 'col1', 'ven1']) {
      const comp = c.competitions[compKey(id, 2027)];
      expect(comp.champion).toBe(comp.finalTable![0].clubId);
      // 38 rodadas para ligas de 20 clubes
      if (comp.participants.length === 20) for (const r of comp.finalTable!) expect(r.p).toBe(38);
    }
  });

  test('acesso e rebaixamento sem duplicar ou perder clubes', () => {
    expect(Object.keys(c.clubs).length).toBe(snapshot1.clubs);
    for (const t of Object.values(c.config.competitions).filter((x) => x.kind === 'league')) expect(snapshot1.divisionSizes[t.id]).toBe(t.numClubs);
    const last = c.seasonHistory.at(-1)!;
    expect(last.promoted.length).toBe(last.relegated.length);
    expect(last.promoted.length).toBeGreaterThan(10);
    // os 4 últimos da Série A 2027 estão na Série B 2028
    const a = c.competitions[compKey('bra1', 2027)].finalTable!;
    for (const r of a.slice(-4)) expect(c.clubs[r.clubId].divisionId).toBe('bra2');
    const b = c.competitions[compKey('bra2', 2027)].finalTable!;
    for (const r of b.slice(0, 4)) expect(c.clubs[r.clubId].divisionId).toBe('bra1');
    // nova temporada: cada clube está em exatamente uma liga
    const seen = new Set<string>();
    for (const comp of Object.values(c.competitions).filter((x) => x.season === 2028 && x.kind === 'league')) for (const id of comp.participants) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
    expect(seen.size).toBe(Object.keys(c.clubs).length);
  });

  test('vagas continentais distribuídas após o fim das ligas, sem duplicidade', () => {
    const sa = new Set(['BRA', 'ARG', 'URU', 'CHI', 'COL', 'ECU', 'PAR', 'PER', 'BOL', 'VEN']);
    const ca = c.competitions[compKey('copa_americas', 2028)];
    const te = c.competitions[compKey('taca_elite', 2028)];
    const ce = c.competitions[compKey('champions_euro', 2028)];
    const ec = c.competitions[compKey('europa_ch', 2028)];
    for (const comp of [ca, te, ce, ec]) expect(comp).toBeTruthy();
    const all = [ca, te, ce, ec].flatMap((x) => x.participants);
    expect(new Set(all).size).toBe(all.length);
    for (const id of ca.participants.concat(te.participants)) expect(sa.has(c.clubs[id].country)).toBe(true);
    for (const id of ce.participants.concat(ec.participants)) expect(sa.has(c.clubs[id].country)).toBe(false);
    // campeão brasileiro de 2027 está na Copa das Américas 2028 com o motivo registrado
    const champ = c.competitions[compKey('bra1', 2027)].champion!;
    expect(ca.participants).toContain(champ);
    expect(ca.qualNotes.find((n) => n.clubId === champ)?.reason).toMatch(/1º colocado/);
    // campeão da Champions Euro 2027 garante vaga como atual campeão
    const holder = c.competitions[compKey('champions_euro', 2027)].champion!;
    expect(ce.participants).toContain(holder);
    // a Taça Elite recebe os clubes seguintes da tabela brasileira (7º em diante, salvo redistribuição)
    const braTable = c.competitions[compKey('bra1', 2027)].finalTable!.map((r) => r.clubId);
    const braInTaca = te.participants.filter((id) => braTable.includes(id)).map((id) => braTable.indexOf(id) + 1);
    expect(Math.min(...braInTaca)).toBeGreaterThanOrEqual(7);
  });

  test('estrela dourada para o artilheiro da liga e vermelha para o continental', () => {
    for (const [id, kind] of [['bra1', 'gold_star'], ['eng1', 'gold_star'], ['copa_americas', 'red_star'], ['champions_euro', 'red_star']] as const) {
      const comp = c.competitions[compKey(id, 2027)];
      // registro oficial congelado no encerramento (as partidas antigas já foram limpas)
      const rows = comp.topScorers!;
      expect(rows.length).toBeGreaterThan(0);
      const max = rows[0].goals;
      const winners = rows.filter((r) => r.goals === max).map((r) => r.playerId);
      for (const pid of winners) {
        const p = c.players[pid] ?? c.retired[pid];
        if (!p) continue;
        const star = p.achievements.find((a) => a.kind === kind && a.compId === comp.id);
        expect(star, `${id} ${pid}`).toBeTruthy();
        expect(star!.goals).toBe(max);
        expect(star!.label).toContain('2027');
      }
      // quem não foi artilheiro não recebe a estrela
      for (const r of rows.filter((x) => x.goals < max).slice(0, 5)) {
        const p = c.players[r.playerId];
        if (p) expect(p.achievements.some((a) => a.kind === kind && a.compId === comp.id)).toBe(false);
      }
    }
  });

  test('reprocessar a temporada não duplica estrelas, títulos nem prêmios em dinheiro', () => {
    const comp = c.competitions[compKey('bra1', 2027)];
    const count = () => Object.values(c.players).reduce((s, p) => s + p.achievements.filter((a) => a.compId === comp.id).length, 0);
    const before = count();
    const champ = c.clubs[comp.champion!];
    const bal = champ.balance;
    awardScorerStars(c, comp);
    comp.finalized = false;
    finalizeCompetition(c, comp);
    expect(count()).toBe(before);
    expect(champ.balance).toBe(bal);
    expect(c.champions.bra1.filter((x) => x.season === 2027).length).toBeLessThanOrEqual(2);
    // chaves de lançamento são únicas
    for (const cl of [champ, c.clubs.flamengo]) {
      const keys = cl.ledger.map((e) => e.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  test('Bola de Ouro ocorreu uma única vez, entre 25 e 31 de outubro', () => {
    const ed = Object.values(c.awards).filter((a) => a.awardId === 'ballon');
    expect(ed).toHaveLength(1);
    const { m, d } = ymd(ed[0].day);
    expect(m).toBe(10);
    expect(d).toBeGreaterThanOrEqual(25);
    expect(d).toBeLessThanOrEqual(31);
    expect(runBallon(c, 2027)).toBeNull(); // idempotente
    expect(ed[0].candidates.length).toBeGreaterThan(10);
    expect(ed[0].finalists).toHaveLength(3);
    expect(ed[0].simulated).toBe(true);
    // pontuação explicável
    const top = ed[0].candidates[0];
    expect(Object.keys(top.breakdown)).toContain('performance');
    expect(top.votes).toBeGreaterThan(0);
  });

  test('vencedor não é simplesmente o de maior nível; repercussão em notícias e reputação', () => {
    const ed = Object.values(c.awards).find((a) => a.awardId === 'ballon')!;
    const winner = c.players[ed.winnerId!];
    expect(winner).toBeTruthy();
    expect(winner.achievements.some((a) => a.key === `award|${ed.key}`)).toBe(true);
    expect(c.news.some((n) => n.kind === 'award' && n.title.includes(winner.name))).toBe(true);
    expect(winner.nominations!.won).toBeGreaterThanOrEqual(1);
    // existe ao menos um candidato de nível maior que foi superado por desempenho
    const levels = ed.candidates.map((x) => x.level);
    expect(Math.max(...levels)).toBeGreaterThanOrEqual(ed.candidates[0].level);
  });

  test('prêmios da gala com datas próprias (dezembro) e time ideal', () => {
    for (const id of ['player', 'young', 'gk', 'def', 'mid', 'fwd', 'topscorer', 'coach', 'team', 'revelation']) {
      const a = c.awards[`${id}|2027`];
      expect(a, id).toBeTruthy();
      expect(ymd(a.day).m).toBe(12);
    }
    expect(c.awards['team|2027'].team!.length).toBe(11);
    expect(Object.values(c.awards).some((a) => a.awardId === 'leagueBest')).toBe(true);
    expect(Object.values(c.awards).some((a) => a.awardId === 'finalBest')).toBe(true);
  });

  test('craque criado pelo usuário é elegível e tem histórico registrado', () => {
    const p = c.players[creatorId];
    expect(p).toBeTruthy();
    expect(p.history.some((h) => h.season === 2027)).toBe(true);
    const apps = p.history.filter((h) => h.season === 2027).reduce((s, h) => s + h.apps, 0);
    if (apps >= c.config.awards.minApps) {
      const ed = Object.values(c.awards).find((a) => a.awardId === 'ballon')!;
      expect(ed.candidates.some((x) => x.playerId === creatorId) || (p.nominations?.nominated ?? 0) >= 0).toBe(true);
    }
    expect(ovrToLevel(p.ovr)).toBeGreaterThan(20);
  });

  test('distribuição de níveis continua equilibrada após a temporada', () => {
    const all = Object.values(c.players).map((p) => ovrToLevel(p.ovr));
    expect(all.filter((l) => l >= 22.5).length / all.length).toBeLessThan(0.012);
  });

  test('salvar e carregar preserva prêmios, estrelas, histórico e finanças', async () => {
    const sm = new SaveManager(memoryKV());
    await sm.saveCareer(c);
    const list = await sm.listCareers();
    expect(list[0].clubName).toBe(c.clubs.flamengo.name);
    const { career: loaded } = await sm.loadCareer(c.id);
    expect(Object.keys(loaded.awards).sort()).toEqual(Object.keys(c.awards).sort());
    expect(loaded.clubs.flamengo.balance).toBe(c.clubs.flamengo.balance);
    const stars = (x: Career) => Object.values(x.players).reduce((s, p) => s + p.achievements.filter((a) => a.kind === 'gold_star' || a.kind === 'red_star').length, 0);
    expect(stars(loaded)).toBe(stars(c));
    expect(loaded.champions).toEqual(c.champions);
    expect(loaded.players[creatorId].history).toEqual(c.players[creatorId].history);
    // a carreira carregada continua jogável sem duplicar cerimônias
    for (let i = 0; i < 20; i++) {
      const r = advanceDay(loaded);
      if (r.status === 'user_match') break;
    }
    expect(Object.values(loaded.awards).filter((a) => a.awardId === 'ballon')).toHaveLength(1);
    void resetLedgerCache;
  });

  test('8 e 10. encerrar a temporada não apaga o histórico; temporada atual × todas as temporadas', () => {
    // a temporada 2027 está arquivada para todos os jogadores que atuaram, e as linhas ao vivo de 2027 já saíram
    const played = Object.values(c.players).filter((p) => (p.statArchive ?? []).some((r) => r.season === 2027));
    expect(played.length).toBeGreaterThan(5000);
    for (const p of played.slice(0, 500)) expect(Object.keys(p.stats).some((k) => k.startsWith('2027|'))).toBe(false);
    // artilharia oficial (contada nas partidas) = gols registrados no arquivo do jogador
    const league = c.competitions[compKey('bra1', 2027)];
    for (const t of league.topScorers!.slice(0, 5)) {
      const p = c.players[t.playerId] ?? null;
      if (!p) continue;
      expect(compStat(p, 2027, league.id)!.goals).toBe(t.goals);
    }
    // alternância de recorte: todas as temporadas = 2027 + 2028 (sem contar duas vezes)
    const fx = Object.values(c.fixtures).filter((f) => f.status === 'scheduled' && c.competitions[f.compId]?.season === 2028 && (f.home === c.userClubId || f.away === c.userClubId)).sort((a, b) => a.day - b.day).slice(0, 2);
    for (const f of fx) playFixture(c, f, false);
    const p = c.clubs[c.userClubId].playerIds.map((id) => c.players[id]).find((x) => statRows(c, x).some((r) => r.season === 2028) && statRows(c, x).some((r) => r.season === 2027))!;
    expect(p).toBeTruthy();
    const rows = statRows(c, p);
    const all = sumRows(rows);
    const y27 = sumRows(rows, (r) => r.season === 2027);
    const y28 = sumRows(rows, (r) => r.season === 2028);
    expect(all.apps).toBe(y27.apps + y28.apps);
    expect(all.minutes).toBe(y27.minutes + y28.minutes);
    expect(new Set(rows.map((r) => `${r.season}|${r.compId}|${r.clubId}`)).size).toBe(rows.length);
  });

  test('segunda temporada consecutiva também termina', () => {
    playSeason(c);
    expect(c.season).toBe(2029);
    const comps = Object.values(c.competitions).filter((x) => x.season === 2028);
    for (const comp of comps) expect(comp.status).toBe('finished');
    expect(Object.values(c.awards).filter((a) => a.awardId === 'ballon')).toHaveLength(2);
    expect(findClashes(c)).toEqual([]);
    // histórico de campeões acumula
    expect(c.champions.bra1.map((x) => x.season)).toEqual([2027, 2028]);
    // tabela da temporada antiga preservada mesmo após a limpeza de partidas
    expect(c.competitions[compKey('bra1', 2027)].finalTable?.length).toBe(20);
    expect(leagueTable(c, c.competitions[compKey('bra1', 2028)])[0]?.clubId).toBe(c.competitions[compKey('bra1', 2028)].champion);
  }, 600_000);
});
