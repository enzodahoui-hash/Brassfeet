import { describe, expect, test } from 'vitest';
import { roundRobin, standings } from '../src/engine/competitions/table';
import { tieState, koRounds } from '../src/engine/competitions/manager';
import { computeQualification } from '../src/engine/competitions/qualification';
import { career } from './helpers';
import { findClashes } from '../src/engine/calendar/resolve';
import type { Fixture, Tie } from '../src/engine/types';
import { defaultCompetitions } from '../src/engine/data/competitions';

function fx(id: string, home: string, away: string, hg: number, ag: number, extra: Partial<Fixture> = {}): Fixture {
  return { id, compId: 'x', stageIdx: 0, round: 0, day: 1, origDay: 1, home, away, neutral: false, status: 'played', seed: 1, bigGame: false, derby: false, result: { hg, ag, et: false, goals: [], cards: [], stats: {} as never, attendance: 0, injuries: [] }, ...extra };
}

describe('Calendário de pontos corridos', () => {
  test('turno e returno: todos se enfrentam duas vezes, mando alternado', () => {
    const teams = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const rounds = roundRobin(teams, 2, 9);
    expect(rounds).toHaveLength(38);
    const pairs = new Map<string, number>();
    const home = new Map<string, number>();
    for (const r of rounds) {
      const seen = new Set<string>();
      expect(r).toHaveLength(10);
      for (const [h, a] of r) {
        expect(seen.has(h) || seen.has(a)).toBe(false);
        seen.add(h);
        seen.add(a);
        pairs.set(`${h}>${a}`, (pairs.get(`${h}>${a}`) ?? 0) + 1);
        home.set(h, (home.get(h) ?? 0) + 1);
      }
    }
    for (const a of teams) for (const b of teams) if (a !== b) expect(pairs.get(`${a}>${b}`)).toBe(1);
    for (const t of teams) expect(home.get(t)).toBe(19);
  });

  test('número ímpar de clubes funciona com folga', () => {
    const rounds = roundRobin(['a', 'b', 'c', 'd', 'e'], 1, 3);
    expect(rounds).toHaveLength(5);
    expect(rounds.flat()).toHaveLength(10);
  });
});

describe('Classificação e desempate', () => {
  const pts = { win: 3, draw: 1, loss: 0 };
  test('pontos, vitórias, saldo e gols', () => {
    const fs = [fx('1', 'A', 'B', 2, 0), fx('2', 'C', 'D', 1, 1), fx('3', 'A', 'C', 0, 1), fx('4', 'B', 'D', 3, 0)];
    const t = standings(fs, ['A', 'B', 'C', 'D'], pts, ['points', 'wins', 'gd', 'gf', 'lots'], 's');
    expect(t[0].clubId).toBe('C');
    expect(t[0].pts).toBe(4);
    expect(t.find((r) => r.clubId === 'A')!.pts).toBe(3);
    expect(t.reduce((s, r) => s + r.gf, 0)).toBe(t.reduce((s, r) => s + r.ga, 0));
  });

  test('confronto direto decide empate de pontos', () => {
    // A e B empatam em pontos e saldo; B venceu o confronto direto
    const fs = [fx('1', 'A', 'B', 0, 1), fx('2', 'A', 'C', 3, 0), fx('3', 'B', 'C', 0, 0), fx('4', 'C', 'A', 0, 0)];
    const t = standings(fs, ['A', 'B', 'C'], pts, ['points', 'h2h', 'gd', 'lots'], 's');
    expect(t[0].pts).toBe(t[1].pts);
    expect(t[0].clubId).toBe('B');
  });

  test('partida anulada não conta', () => {
    const fs = [fx('1', 'A', 'B', 5, 0, { status: 'void' }), fx('2', 'B', 'A', 1, 0)];
    const t = standings(fs, ['A', 'B'], pts, ['points'], 's');
    expect(t[0].clubId).toBe('B');
    expect(t[1].gf).toBe(0);
  });

  test('sorteio é reprodutível', () => {
    const a = standings([], ['A', 'B', 'C'], pts, ['points', 'lots'], 'x').map((r) => r.clubId);
    const b = standings([], ['A', 'B', 'C'], pts, ['points', 'lots'], 'x').map((r) => r.clubId);
    expect(a).toEqual(b);
  });
});

describe('Mata-mata', () => {
  test('pré-eliminatória encaixa em potência de 2', () => {
    const t = defaultCompetitions().eng_cup;
    const { rounds, prelim } = koRounds(40, t);
    expect(prelim).toBe(8);
    expect(rounds[0].key).toBe('PRE');
    expect(rounds[rounds.length - 1].key).toBe('F');
  });

  test('agregado, gols fora e pênaltis', () => {
    const c = career('flamengo', 'ko');
    const tie: Tie = { id: 't', round: 0, a: 'A', b: 'B', fixtureIds: ['l1', 'l2'] };
    c.fixtures.l1 = fx('l1', 'A', 'B', 1, 1);
    c.fixtures.l2 = fx('l2', 'B', 'A', 2, 1);
    expect(tieState(c, tie, false).winner).toBe('B');
    c.fixtures.l2 = fx('l2', 'B', 'A', 2, 2);
    // 3x3 no agregado; A marcou 2 fora, B marcou 1 fora
    expect(tieState(c, tie, true).winner).toBe('A');
    const pen = fx('l2', 'B', 'A', 1, 1);
    pen.result!.pens = [5, 4];
    c.fixtures.l2 = pen;
    const st = tieState(c, tie, false);
    expect(st.winner).toBe('B');
    expect(st.note).toContain('pênaltis');
  });
});

describe('Montagem da temporada', () => {
  test('todas as competições criadas, sem jogos simultâneos', () => {
    const c = career('flamengo', 'build');
    const comps = Object.values(c.competitions);
    for (const id of ['bra1', 'bra2', 'bra3', 'bra4', 'arg1', 'uru1', 'chi1', 'col1', 'ecu1', 'par1', 'per1', 'bol1', 'ven1', 'eng1', 'esp1', 'ita1', 'ger1', 'fra1', 'copa_americas', 'taca_elite', 'champions_euro', 'europa_ch', 'bra_cup', 'bra_super', 'est_sp']) {
      expect(comps.some((x) => x.templateId === id)).toBe(true);
    }
    expect(findClashes(c)).toEqual([]);
    // nenhum clube em duas divisões
    const seen = new Map<string, string>();
    for (const comp of comps.filter((x) => x.kind === 'league')) for (const id of comp.participants) {
      expect(seen.has(id)).toBe(false);
      seen.set(id, comp.id);
    }
  });

  test('vagas iniciais: número correto e sem clube em duas continentais', () => {
    const c = career('flamengo', 'q0');
    const q = computeQualification(c, c.season - 1, true);
    expect(q.lists.copa_americas).toHaveLength(32);
    expect(q.lists.taca_elite).toHaveLength(32);
    expect(q.lists.champions_euro).toHaveLength(32);
    expect(q.lists.europa_ch).toHaveLength(16);
    const all = Object.values(q.lists).flat().map((e) => e.clubId);
    expect(new Set(all).size).toBe(all.length);
    // América do Sul só com clubes sul-americanos; Europa só europeus
    const sa = new Set(['BRA', 'ARG', 'URU', 'CHI', 'COL', 'ECU', 'PAR', 'PER', 'BOL', 'VEN']);
    for (const e of q.lists.copa_americas.concat(q.lists.taca_elite)) expect(sa.has(e.country)).toBe(true);
    for (const e of q.lists.champions_euro.concat(q.lists.europa_ch)) expect(sa.has(e.country)).toBe(false);
    expect(q.warnings).toEqual([]);
  });
});
