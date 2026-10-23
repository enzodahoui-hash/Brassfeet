import { describe, expect, test } from 'vitest';
import { world, career } from './helpers';
import { A, ATTR_COUNT, computeOvr, levelToOvr, ovrToLevel, positionFit, ratingAt } from '../src/engine/players/attributes';
import { PRESETS, defaultSpec, insertCreated, previewCreated } from '../src/engine/players/creator';
import { traitEffects } from '../src/engine/players/traits';
import { progressPlayer } from '../src/engine/players/progression';
import { Rng } from '../src/engine/core/rng';
import { simulateMatch } from '../src/engine/match/engine';
import { autoLineup, slotsOf } from '../src/engine/clubs/lineup';
import type { Player } from '../src/engine/types';

describe('Escala 0–25 e nível por posição', () => {
  test('nível geral depende da posição, não da média simples', () => {
    const w = world();
    const gk = Object.values(w.players).find((p) => p.pos === 'GK' && ovrToLevel(p.ovr) > 15)!;
    const st = Object.values(w.players).find((p) => p.pos === 'ST' && ovrToLevel(p.ovr) > 15)!;
    // o goleiro avaliado como centroavante cai muito; o centroavante no gol também
    expect(ratingAt(gk.attrs, 'ST')).toBeLessThan(ratingAt(gk.attrs, 'GK') - 15);
    expect(ratingAt(st.attrs, 'GK')).toBeLessThan(ratingAt(st.attrs, 'ST') - 25);
    const simpleAvg = gk.attrs.reduce((s, v) => s + v, 0) / ATTR_COUNT;
    expect(Math.abs(gk.ovr - simpleAvg)).toBeGreaterThan(5);
  });

  test('conversão nota ↔ nível é consistente e limitada a 0..25', () => {
    for (let l = 0; l <= 25; l++) expect(ovrToLevel(levelToOvr(l))).toBeCloseTo(l, 5);
    expect(ovrToLevel(5)).toBe(0);
    expect(ovrToLevel(120)).toBe(25);
  });

  test('todos os atributos ficam entre 1 e 100', () => {
    const w = world();
    let lo = 100, hi = 0;
    for (const p of Object.values(w.players)) for (const v of p.attrs) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThanOrEqual(1);
    expect(hi).toBeLessThanOrEqual(100);
  });

  test('distribuição de níveis por divisão é coerente e elite é rara', () => {
    const w = world();
    const avg = (div: string) => {
      const ls = Object.values(w.players).filter((p) => p.clubId && p.squad === 'senior' && w.clubs[p.clubId].divisionId === div).map((p) => ovrToLevel(p.ovr));
      return ls.reduce((s, x) => s + x, 0) / ls.length;
    };
    expect(avg('eng1')).toBeGreaterThan(avg('bra1'));
    expect(avg('bra1')).toBeGreaterThan(avg('bra2'));
    expect(avg('bra2')).toBeGreaterThan(avg('bra3'));
    expect(avg('bra3')).toBeGreaterThan(avg('bra4'));
    const all = Object.values(w.players).map((p) => ovrToLevel(p.ovr));
    const elite = all.filter((l) => l >= 22.5).length / all.length;
    expect(elite).toBeLessThan(0.01);
  });

  test('clubes gigantes começam na faixa 23+ e o nível é editável (não fixo)', () => {
    const w = world();
    expect(w.clubs.realmadrid.level).toBeGreaterThanOrEqual(23);
    expect(w.clubs.parissaintgermain.level).toBeGreaterThanOrEqual(23);
    expect(w.clubs.mirassol.level).toBeLessThan(15);
  });

  test('jogador fora de posição é penalizado', () => {
    expect(positionFit({ pos: 'ST', alt: [] }, 'ST')).toBe(1);
    expect(positionFit({ pos: 'ST', alt: [] }, 'CB')).toBeLessThan(0.8);
    expect(positionFit({ pos: 'RB', alt: ['RM'] }, 'RM')).toBeGreaterThan(0.9);
  });
});

describe('Criador de Craques', () => {
  test('cria jogador com atributos personalizados e ID único', () => {
    const w = world();
    const s = { ...defaultSpec(w), name: 'Teste Custom', attrs: new Array(ATTR_COUNT).fill(60), placement: 'free' as const };
    s.attrs[A.fin] = 95;
    const before = Object.keys(w.players).length;
    const p = insertCreated(w, s);
    expect(Object.keys(w.players).length).toBe(before + 1);
    expect(p.attrs[A.fin]).toBe(95);
    expect(p.origin).toBe('creator');
    const ids = new Set(Object.keys(w.players));
    expect(ids.size).toBe(Object.keys(w.players).length);
    const nums = new Set(Object.values(w.players).map((x) => x.num));
    expect(nums.size).toBe(Object.keys(w.players).length);
  });

  test('jovem de alto potencial e nível inicial baixo', () => {
    const w = world();
    const base = defaultSpec(w);
    const s = { ...base, ...PRESETS.find((x) => x.id === 'jovem')!.apply(base), placement: 'free' as const, name: 'Promessa X' };
    const pv = previewCreated(w, s);
    expect(pv.level).toBeLessThanOrEqual(10);
    expect(pv.potentialLevel).toBeGreaterThanOrEqual(21);
  });

  test('craque de nível 25 não é reduzido silenciosamente', () => {
    const w = world();
    const s = { ...defaultSpec(w), name: 'Lenda Máxima', level: 25, potential: 25, age: 25, placement: 'free' as const };
    const p = insertCreated(w, s);
    expect(Math.round(ovrToLevel(p.ovr))).toBe(25);
    expect(previewCreated(w, s).warnings.some((x) => x.includes('edição livre'))).toBe(true);
    // a progressão normal não corta o nível de criação
    const c = career();
    const q = insertCreated(c, { ...s, name: 'Lenda na carreira' });
    const lvl = ovrToLevel(q.ovr);
    progressPlayer(c, q, { rng: new Rng(1), effects: new Map() });
    expect(ovrToLevel(q.ovr)).toBeGreaterThan(lvl - 0.2);
  });

  test('avisa combinações contraditórias (goleiro com atributos de atacante)', () => {
    const w = world();
    const attrs = new Array(ATTR_COUNT).fill(30);
    for (const k of ['fin', 'dri', 'pas', 'tac'] as const) attrs[A[k]] = 90;
    const pv = previewCreated(w, { ...defaultSpec(w), pos: 'GK', style: null, attrs, placement: 'free' });
    expect(pv.warnings.length).toBeGreaterThan(0);
  });

  test('comparação e impacto financeiro antes de inserir no clube', () => {
    const c = career();
    const pv = previewCreated(c, { ...defaultSpec(c, c.userClubId), level: 18, potential: 20, placement: 'userPro' });
    expect(pv.comparisons.length).toBeGreaterThan(0);
    expect(pv.finance?.wageBillAfter).toBeGreaterThan(pv.finance!.wageBillBefore);
  });
});

describe('Personalidade', () => {
  test('traços têm benefícios e contrapartidas', () => {
    const amb = traitEffects(['ambicioso']);
    expect(amb.dev).toBeGreaterThan(0);
    expect(amb.ambition).toBeGreaterThan(0);
    expect(amb.wageDemand).toBeGreaterThan(0);
    const temp = traitEffects(['temperamental']);
    expect(temp.cards).toBeGreaterThan(0);
    expect(temp.consistency).toBeLessThan(0);
    const leal = traitEffects(['leal']);
    expect(leal.dev).toBeLessThan(0);
  });

  test('temperamental recebe mais cartões em simulação', () => {
    const w = world();
    const club = w.clubs.atleticomineiro;
    const opp = w.clubs.cruzeiro;
    const run = (traits: string[]) => {
      let cards = 0;
      for (const p of club.playerIds) w.players[p].traits = traits;
      for (let i = 0; i < 150; i++) {
        const side = (cl: typeof club, home: boolean) => {
          const lu = autoLineup(w, cl, '4-3-3');
          return { clubId: cl.id, name: cl.name, short: cl.short, starters: lu.starters.map((x) => w.players[x!]), slots: slotsOf('4-3-3').map((s) => s.pos), bench: lu.bench.map((x) => w.players[x]), tactics: cl.tactics, cohesion: 60, homeFactor: home ? 1.08 : 1, autoSubs: true };
        };
        const o = simulateMatch({ seed: i + 1, home: side(club, true), away: side(opp, false), neutral: false, importance: 3, bigGame: false, derby: false, needWinner: false, extraTime: false, penalties: false, pitch: 0.8, detail: false });
        cards += o.cards.filter((c) => c.club === club.id).length;
      }
      return cards;
    };
    expect(run(['temperamental', 'competitivo'])).toBeGreaterThan(run(['disciplinado']) * 1.3);
  });

  test('ambicioso/dedicado evoluem mais rápido que leal', () => {
    const c = career();
    const base = Object.values(c.players).find((p) => c.season - p.birthYear === 18 && p.pot - p.ovr > 10 && p.clubId)!;
    const mk = (traits: string[]): Player => ({ ...structuredClone(base), traits });
    const a = mk(['ambicioso', 'dedicado']);
    const b = mk(['leal']);
    const rngA = new Rng(5), rngB = new Rng(5);
    for (let i = 0; i < 30; i++) {
      progressPlayer(c, a, { rng: rngA, effects: new Map() });
      progressPlayer(c, b, { rng: rngB, effects: new Map() });
    }
    expect(a.ovr).toBeGreaterThan(b.ovr);
  });
});

describe('Evolução', () => {
  test('jovem evolui, veterano declina, ninguém dispara para 25', () => {
    const c = career();
    const young = Object.values(c.players).filter((p) => c.season - p.birthYear <= 19 && p.pot - p.ovr > 8).slice(0, 40);
    const old = Object.values(c.players).filter((p) => c.season - p.birthYear >= 34).slice(0, 40);
    const y0 = young.map((p) => p.ovr), o0 = old.map((p) => p.ovr);
    const ctx = { rng: new Rng(3), effects: new Map() };
    for (let w = 0; w < 52 * 3; w++) {
      for (const p of young) {
        p.recentMinutes = [90, 90, 90, 90];
        progressPlayer(c, p, ctx);
      }
      for (const p of old) progressPlayer(c, p, ctx);
    }
    const gainY = young.reduce((s, p, i) => s + p.ovr - y0[i], 0) / young.length;
    const gainO = old.reduce((s, p, i) => s + p.ovr - o0[i], 0) / old.length;
    expect(gainY).toBeGreaterThan(3);
    expect(gainO).toBeLessThan(0);
    for (const p of young) {
      expect(p.ovr).toBeLessThanOrEqual(p.pot + 0.01);
      expect(computeOvr(p)).toBeCloseTo(p.ovr, 5);
    }
    const reached = young.filter((p) => ovrToLevel(p.ovr) >= 23).length;
    expect(reached / young.length).toBeLessThan(0.15);
  });
});
