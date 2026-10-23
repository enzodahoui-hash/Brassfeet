import { describe, expect, test } from 'vitest';
import { world } from './helpers';
import { MatchSim, simulateMatch, type MatchInput, type SideInput } from '../src/engine/match/engine';
import { autoLineup, slotsOf, validateLineup } from '../src/engine/clubs/lineup';
import type { Tactics, World } from '../src/engine/types';

const w: World = world();

function side(id: string, home: boolean, tactics?: Partial<Tactics>, formation?: string): SideInput {
  const c = w.clubs[id];
  const f = formation ?? c.tactics.formation;
  const lu = autoLineup(w, c, f);
  return { clubId: id, name: c.name, short: c.short, starters: lu.starters.map((x) => w.players[x!]), slots: slotsOf(f).map((s) => s.pos), bench: lu.bench.map((x) => w.players[x]), tactics: { ...c.tactics, ...tactics }, cohesion: 60, homeFactor: home ? 1.08 : 1, autoSubs: true };
}
function input(seed: number, h: SideInput, a: SideInput, extra: Partial<MatchInput> = {}): MatchInput {
  return { seed, home: h, away: a, neutral: false, importance: 3, bigGame: false, derby: false, needWinner: false, extraTime: false, penalties: false, pitch: 0.85, detail: true, ...extra };
}

describe('Motor de partidas', () => {
  test('reprodutível a partir da semente registrada', () => {
    const a = simulateMatch(input(42, side('flamengo', true), side('palmeiras', false)));
    const b = simulateMatch(input(42, side('flamengo', true), side('palmeiras', false)));
    expect(a.hg).toBe(b.hg);
    expect(a.ag).toBe(b.ag);
    expect(a.events.map((e) => e.text)).toEqual(b.events.map((e) => e.text));
  });

  test('intervenções ao vivo também são reproduzíveis', () => {
    const run = () => {
      const sim = new MatchSim(input(7, side('flamengo', true), side('palmeiras', false, {}), { detail: true }));
      for (let i = 0; i < 60; i++) sim.step();
      const t = sim.teams[0];
      const out = t.ps.find((x) => x.on && x.slot !== 'GK')!.p.id;
      const inn = t.ps.find((x) => !x.on && x.inMin < 0)!.p.id;
      expect(sim.substitute(0, out, inn)).toBeNull();
      sim.setTactics(0, { mentality: 2, pressing: 2 });
      sim.runToEnd();
      return sim.outcome();
    };
    const a = run(), b = run();
    expect([a.hg, a.ag]).toEqual([b.hg, b.ag]);
    expect(a.interventions).toBe(2);
    expect(a.subs.length).toBeGreaterThan(0);
  });

  test('2000 partidas: resultados plausíveis e estatísticas consistentes', () => {
    let goals = 0, maxGoals = 0, draws = 0, homeWins = 0;
    const pairs = [['flamengo', 'palmeiras'], ['botafogo', 'fluminense'], ['realmadrid', 'barcelona'], ['mirassol', 'atleticomineiro'], ['bayerndemunique', 'borussiadortmund']];
    for (let i = 0; i < 2000; i++) {
      const [h, a] = pairs[i % pairs.length];
      const o = simulateMatch(input(i * 31 + 5, side(h, true), side(a, false), { detail: false }));
      goals += o.hg + o.ag;
      maxGoals = Math.max(maxGoals, o.hg + o.ag);
      if (o.hg === o.ag) draws++;
      if (o.hg > o.ag) homeWins++;
      const valid = o.goals.filter((g) => !g.disallowed);
      expect(valid.length).toBe(o.hg + o.ag);
      expect(o.stats.sot[0]).toBeGreaterThanOrEqual(o.hg);
      expect(o.stats.sot[1]).toBeGreaterThanOrEqual(o.ag);
      expect(o.stats.shots[0]).toBeGreaterThanOrEqual(o.stats.sot[0]);
      expect(o.stats.poss[0] + o.stats.poss[1]).toBe(100);
      for (const l of o.lines) {
        expect(l.rating).toBeGreaterThanOrEqual(3);
        expect(l.rating).toBeLessThanOrEqual(10);
      }
    }
    const avg = goals / 2000;
    expect(avg).toBeGreaterThan(2.0);
    expect(avg).toBeLessThan(3.6);
    expect(maxGoals).toBeLessThan(16);
    expect(draws / 2000).toBeGreaterThan(0.15);
    expect(homeWins / 2000).toBeGreaterThan(0.35);
  });

  test('qualidade importa mas não garante vitória', () => {
    let big = 0, small = 0;
    for (let i = 0; i < 300; i++) {
      const o = simulateMatch(input(i + 1000, side('mirassol', true), side('flamengo', false), { detail: false }));
      if (o.ag > o.hg) big++;
      if (o.hg > o.ag) small++;
    }
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(10); // zebras acontecem
  });

  test('táticas têm consequências (ofensiva gera mais finalizações; pressão alta cansa)', () => {
    let shOff = 0, shDef = 0, condHigh = 0, condLow = 0;
    for (let i = 0; i < 200; i++) {
      const off = simulateMatch(input(i + 50, side('palmeiras', true, { mentality: 2, tempo: 2 }), side('atleticomineiro', false), { detail: false }));
      const def = simulateMatch(input(i + 50, side('palmeiras', true, { mentality: -2, tempo: 0 }), side('atleticomineiro', false), { detail: false }));
      shOff += off.stats.shots[0];
      shDef += def.stats.shots[0];
      const hp = simulateMatch(input(i + 9, side('palmeiras', true, { pressing: 2 }), side('atleticomineiro', false), { detail: false }));
      const lp = simulateMatch(input(i + 9, side('palmeiras', true, { pressing: 0 }), side('atleticomineiro', false), { detail: false }));
      condHigh += hp.lines.filter((l) => l.side === 0 && l.minutes > 80).reduce((s, l) => s + l.condAfter, 0);
      condLow += lp.lines.filter((l) => l.side === 0 && l.minutes > 80).reduce((s, l) => s + l.condAfter, 0);
    }
    expect(shOff).toBeGreaterThan(shDef * 1.1);
    expect(condHigh).toBeLessThan(condLow);
  });

  test('time escalado fora de posição rende menos', () => {
    let normal = 0, messy = 0;
    const base = side('palmeiras', true);
    const scrambled = { ...base, slots: base.slots.slice().reverse().map((s, i) => (i === 0 ? 'GK' : s)) as SideInput['slots'] };
    scrambled.slots = ['GK', 'ST', 'ST', 'LW', 'RW', 'CB', 'CB', 'CM', 'LB', 'RB', 'DM'];
    for (let i = 0; i < 200; i++) {
      const a = simulateMatch(input(i + 300, base, side('atleticomineiro', false), { detail: false }));
      const b = simulateMatch(input(i + 300, scrambled, side('atleticomineiro', false), { detail: false }));
      normal += a.hg - a.ag;
      messy += b.hg - b.ag;
    }
    expect(normal).toBeGreaterThan(messy);
  });

  test('mata-mata sempre tem vencedor (prorrogação/pênaltis)', () => {
    for (let i = 0; i < 100; i++) {
      const o = simulateMatch(input(i + 77, side('botafogo', true), side('fluminense', false), { needWinner: true, extraTime: true, penalties: true, detail: false }));
      const decided = o.hg !== o.ag || (o.pens && o.pens[0] !== o.pens[1]);
      expect(decided).toBe(true);
    }
  });

  test('validação de escalação detecta duplicados e indisponíveis', () => {
    const club = w.clubs.flamengo;
    const lu = autoLineup(w, club, '4-3-3');
    expect(validateLineup(w, club, lu, '4-3-3').filter((i) => i.level === 'error')).toHaveLength(0);
    const dup = { ...lu, starters: lu.starters.map((x, i) => (i === 2 ? lu.starters[1] : x)) };
    expect(validateLineup(w, club, dup, '4-3-3').some((i) => i.text.includes('duas vezes'))).toBe(true);
    const p = w.players[lu.starters[5]!];
    p.injury = { name: 'Teste', daysLeft: 10, since: 0, severity: 1 };
    expect(validateLineup(w, club, lu, '4-3-3').some((i) => i.text.includes('Lesionado'))).toBe(true);
    p.injury = null;
  });
});
