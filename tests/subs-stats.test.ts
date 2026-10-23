import { describe, expect, test } from 'vitest';
import { career, world } from './helpers';
import { MatchSim, simulateMatch, type MatchInput, type SideInput } from '../src/engine/match/engine';
import { autoLineup, slotsOf } from '../src/engine/clubs/lineup';
import { DEFAULT_REG, defaultSubPlan, newRule, ruleProblems } from '../src/engine/match/subs';
import type { Pos, SubPlan, SubRegulation, SubRule, World } from '../src/engine/types';
import { matchInput, playFixture } from '../src/engine/career/matches';
import { archiveSeason, compStat, statKey, statRows, sumRows } from '../src/engine/players/stats';
import { moveToClub } from '../src/engine/market/roster';
import { SaveManager, memoryKV } from '../src/engine/save/storage';
import { migrate } from '../src/engine/save/migrations';
import { POS_LINE } from '../src/engine/players/attributes';

const w: World = world();

function side(id: string, home: boolean, plan?: SubPlan, reg?: SubRegulation): SideInput {
  const c = w.clubs[id];
  const f = '4-3-3';
  const lu = autoLineup(w, c, f);
  return {
    clubId: id, name: c.name, short: c.short, starters: lu.starters.map((x) => w.players[x!]), slots: slotsOf(f).map((s) => s.pos), bench: lu.bench.map((x) => w.players[x]),
    tactics: { ...c.tactics, formation: f }, cohesion: 60, homeFactor: home ? 1.08 : 1, autoSubs: plan ? plan.mode !== 'manual' : true, plan, reg,
  };
}
const input = (seed: number, h: SideInput, a: SideInput, extra: Partial<MatchInput> = {}): MatchInput => ({ seed, home: h, away: a, neutral: false, importance: 3, bigGame: false, derby: false, needWinner: false, extraTime: false, penalties: false, pitch: 0.85, detail: true, ...extra });
const rule = (n: number, r: Partial<SubRule>): SubRule => ({ ...newRule(n), ...r });
const plan = (mode: SubPlan['mode'], over: Partial<SubPlan> = {}): SubPlan => ({ ...defaultSubPlan(mode), ...over });

describe('Substituições automáticas', () => {
  test('1. regras personalizadas: por posição (vale mesmo se o titular mudar) e por jogador', () => {
    const p = plan('rules', { rules: [rule(1, { label: 'Ponta aos 65', outPos: 'RW', minFrom: 65, minTo: 70 })] });
    const h = side('flamengo', true, p);
    const rwIdx = h.slots.indexOf('RW');
    // troca o titular da ponta antes do jogo: a regra por posição continua valendo
    const alt = h.bench.find((b) => b.pos !== 'GK')!;
    h.bench = h.bench.filter((b) => b !== alt).concat(h.starters[rwIdx]);
    h.starters[rwIdx] = alt;
    const sim = new MatchSim(input(11, h, side('palmeiras', false)));
    sim.runToEnd();
    const out = sim.outcome();
    const mine = out.subs.filter((s) => s.club === 'flamengo');
    const ruleSub = mine.find((s) => s.reason?.includes('Ponta aos 65'));
    expect(ruleSub).toBeTruthy();
    expect(ruleSub!.min).toBeGreaterThanOrEqual(65);
    expect(ruleSub!.min).toBeLessThanOrEqual(70);
    expect(ruleSub!.out).toBe(alt.id);
    expect(mine.filter((s) => !s.reason?.includes('Ponta')).every((s) => s.reason?.includes('lesionou'))).toBe(true); // modo "regras": nada além das regras (e lesões)
    // por jogador, com jogador escolhido para entrar
    const h2 = side('flamengo', true);
    const target = h2.starters.find((x) => x.pos === 'CM' || x.pos === 'DM' || x.pos === 'AM')!;
    const sub = h2.bench.find((x) => x.pos !== 'GK')!;
    h2.plan = plan('rules', { rules: [rule(1, { label: 'Troca combinada', outPid: target.id, inPid: sub.id, minFrom: 60 })] });
    const o2 = simulateMatch(input(12, h2, side('palmeiras', false)));
    const s2 = o2.subs.find((s) => s.reason?.includes('Troca combinada'));
    expect(s2?.out).toBe(target.id);
    expect(s2?.in).toBe(sub.id);
    expect(ruleProblems(rule(1, { outPos: null, outPid: null }))).not.toHaveLength(0);
  });

  test('2. cansaço e contexto: troca quem está abaixo do limite, com motivo; sem trocas desnecessárias', () => {
    let fatigueSubs = 0;
    let offense = 0;
    for (let i = 0; i < 40; i++) {
      const o = simulateMatch(input(100 + i, side('flamengo', true, plan('smart', { fatigue: i % 2 ? 80 : 65 })), side('palmeiras', false)));
      const mine = o.subs.filter((s) => s.club === 'flamengo');
      for (const s of mine) {
        expect(s.reason).toBeTruthy();
        if (s.reason!.includes('condição física')) fatigueSubs++;
        if (s.reason!.includes('presença ofensiva')) offense++;
      }
    }
    expect(fatigueSubs).toBeGreaterThan(40);
    expect(offense).toBeGreaterThan(0);
    // limite muito baixo: ninguém chega lá, então não há trocas (exceto lesões)
    let pointless = 0;
    for (let i = 0; i < 20; i++) {
      const o = simulateMatch(input(300 + i, side('flamengo', true, plan('fitness', { fatigue: 30 })), side('palmeiras', false)));
      pointless += o.subs.filter((s) => s.club === 'flamengo' && !s.reason?.includes('lesionou')).length;
    }
    expect(pointless).toBe(0);
    // escolha varia entre partidas quando há alternativas equivalentes, mas nunca sem critério (mesma função)
    const ins = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const o = simulateMatch(input(500 + i, side('flamengo', true, plan('fitness', { fatigue: 85 })), side('palmeiras', false)));
      for (const s of o.subs.filter((x) => x.club === 'flamengo')) ins.add(s.in);
    }
    expect(ins.size).toBeGreaterThan(3);
  });

  test('3. cinco substituições em três oportunidades; intervalo não conta', () => {
    const rules = [
      rule(1, { label: 'A', outPos: 'LW', minFrom: 46 }), rule(2, { label: 'B', outPos: 'RW', minFrom: 46 }),
      rule(3, { label: 'C', outPos: 'ST', minFrom: 60 }), rule(4, { label: 'D', outPos: 'LB', minFrom: 70 }),
      rule(5, { label: 'E', outPos: 'RB', minFrom: 80 }), rule(6, { label: 'F', outPos: 'CM', minFrom: 85 }),
    ];
    // procura uma partida sem lesões no time da casa (lesões também consomem trocas)
    let checked = 0;
    for (let seed = 21; seed < 60 && checked < 3; seed++) {
      const sim = new MatchSim(input(seed, side('flamengo', true, plan('rules', { rules })), side('palmeiras', false)));
      sim.runToEnd();
      const o = sim.outcome();
      if (o.injuries.some((x) => x.club === 'flamengo') || sim.teams[0].reds) continue;
      checked++;
      const mine = o.subs.filter((s) => s.club === 'flamengo');
      const info = sim.subsInfo(0);
      expect(mine.length).toBe(5);
      expect(mine.filter((s) => s.interval)).toHaveLength(2); // A e B no intervalo: não gastam oportunidade
      expect(info.windowsUsed).toBe(3);
      expect(new Set(mine.filter((s) => !s.interval).map((s) => s.min)).size).toBe(3);
      expect(mine.some((s) => s.reason?.includes('regra "F"'))).toBe(false); // sexta troca bloqueada pelo limite
    }
    expect(checked).toBe(3);
  });

  test('4. bloqueia trocas inválidas ou acima do limite; regulamento configurável', () => {
    const sim = new MatchSim(input(31, side('flamengo', true, plan('manual')), side('palmeiras', false), { detail: true }));
    for (let i = 0; i < 50; i++) sim.step();
    const t = sim.teams[0];
    const on = sim.on(t).filter((x) => x.slot !== 'GK');
    const bench = () => t.ps.filter((x) => !x.on && x.inMin < 0 && !x.started && !x.injured);
    expect(sim.substitute(0, 'inexistente', bench()[0].p.id)).toMatch(/não está em campo/);
    expect(sim.substitute(0, on[0].p.id, on[1].p.id)).toMatch(/banco/);
    // duas trocas no mesmo minuto = uma única oportunidade
    const w0 = sim.subsInfo(0).windowsUsed;
    const m0 = sim.subsInfo(0).made;
    expect(sim.substitute(0, on[0].p.id, bench()[0].p.id)).toBeNull();
    expect(sim.substitute(0, on[1].p.id, bench()[0].p.id)).toBeNull();
    expect(sim.subsInfo(0).windowsUsed).toBe(w0 + 1);
    expect(sim.subsInfo(0).made).toBe(m0 + 2);
    // quem saiu não volta
    expect(sim.substitute(0, on[2].p.id, on[0].p.id)).toMatch(/banco/);
    // usa as oportunidades restantes (uma troca por minuto) até o regulamento bloquear
    let k = 2;
    while (sim.subsInfo(0).windowsUsed < 3 && sim.subsInfo(0).made < 4) {
      sim.step();
      expect(sim.substitute(0, on[k++].p.id, bench()[0].p.id)).toBeNull();
    }
    sim.step();
    if (sim.subsInfo(0).made < 5) expect(sim.substitute(0, on[k].p.id, bench()[0].p.id)).toMatch(/oportunidades/); // 4ª interrupção não permitida
    else expect(sim.substitute(0, on[k].p.id, bench()[0].p.id)).toMatch(/Limite de 5/);
    // regulamento de 3 trocas
    const reg3: SubRegulation = { max: 3, windows: 3, etExtra: 1, etWindows: 1 };
    const s3 = new MatchSim(input(32, side('flamengo', true, plan('manual'), reg3), side('palmeiras', false, undefined, reg3)));
    for (let i = 0; i < 60; i++) s3.step();
    const t3 = s3.teams[0];
    const b3 = () => t3.ps.filter((x) => !x.on && x.inMin < 0 && !x.started && !x.injured);
    const on3 = s3.on(t3).filter((x) => x.slot !== 'GK');
    for (let k = 0; k < 3; k++) expect(s3.substitute(0, on3[k].p.id, b3()[0].p.id)).toBeNull();
    expect(s3.substitute(0, on3[3].p.id, b3()[0].p.id)).toMatch(/Limite de 3/);
    expect(DEFAULT_REG.max).toBe(5);
  });

  test('5. a função tática é preservada após a troca automática', () => {
    for (let i = 0; i < 15; i++) {
      const h = side('flamengo', true, plan('fitness', { fatigue: 85 }));
      const before = h.slots.slice().sort().join(',');
      const sim = new MatchSim(input(700 + i, h, side('palmeiras', false)));
      sim.runToEnd();
      const t = sim.teams[0];
      const onSlots = sim.on(t).map((x) => x.slot).sort().join(',');
      if (t.reds === 0 && !t.ps.some((x) => x.injured && x.on)) expect(onSlots).toBe(before);
      for (const s of sim.subsLog.filter((x) => x.club === 'flamengo' && x.reason?.includes('condição física'))) {
        const outP = t.ps.find((x) => x.p.id === s.out)!;
        const inP = t.ps.find((x) => x.p.id === s.in)!;
        expect(inP.slot).toBe(outP.slot);
      }
    }
  });

  test('6. minutos de titulares e reservas batem com a hora da troca', () => {
    const sim = new MatchSim(input(41, side('flamengo', true, plan('fitness', { fatigue: 85 })), side('palmeiras', false)));
    sim.runToEnd();
    const o = sim.outcome();
    const end = sim.minute;
    expect(o.subs.length).toBeGreaterThan(0);
    for (const s of o.subs) {
      const lo = o.lines.find((l) => l.pid === s.out)!;
      const li = o.lines.find((l) => l.pid === s.in)!;
      expect(li.started).toBe(false);
      expect(li.minutes).toBe(Math.max(1, end - s.min));
      if (lo.started) expect(lo.minutes).toBe(s.min);
    }
    // cada lado: soma dos minutos ≈ 11 × duração (menos expulsões/saídas)
    for (const side of [0, 1] as const) {
      const sum = o.lines.filter((l) => l.side === side).reduce((a, l) => a + l.minutes, 0);
      expect(sum).toBeLessThanOrEqual(11 * end + 5);
    }
  });
});

describe('Estatísticas do elenco', () => {
  test('7. estatísticas individuais registradas após cada partida, sem contadores paralelos', () => {
    const c = career('flamengo', 'stats-7');
    const f = Object.values(c.fixtures).filter((x) => x.status === 'scheduled' && (x.home === 'flamengo' || x.away === 'flamengo')).sort((a, b) => a.day - b.day)[0];
    const out = playFixture(c, f, true);
    const comp = c.competitions[f.compId];
    let goals = 0;
    for (const l of out.lines) {
      const p = c.players[l.pid];
      const clubId = l.side === 0 ? f.home : f.away;
      const s = p.stats[statKey(comp.season, comp.id, clubId)];
      expect(s.apps).toBe(1);
      expect(s.minutes).toBe(l.minutes);
      expect(s.starts).toBe(l.started ? 1 : 0);
      expect(s.goals).toBe(l.goals);
      expect(s.passes).toBeGreaterThanOrEqual(s.passesOk);
      goals += s.goals;
    }
    expect(goals).toBe(f.result!.goals.filter((g) => !g.disallowed && g.type !== 'og').length);
    // reaplicar o mesmo resultado não duplica
    playFixture(c, f, true);
    for (const l of out.lines) expect(compStat(c.players[l.pid], comp.season, comp.id)!.apps).toBe(1);
  });

  test('9 e 11. transferência preserva números por clube; arquivar e reprocessar não duplica', () => {
    const c = career('flamengo', 'stats-9');
    const fx = Object.values(c.fixtures).filter((x) => x.status === 'scheduled' && (x.home === 'flamengo' || x.away === 'flamengo')).sort((a, b) => a.day - b.day).slice(0, 3);
    for (const f of fx) playFixture(c, f, false);
    const p = Object.values(c.players).find((x) => x.clubId === 'flamengo' && statRows(c, x).reduce((a, r) => a + r.s.apps, 0) >= 2)!;
    const before = sumRows(statRows(c, p));
    moveToClub(c, p, c.clubs.palmeiras, 'senior');
    moveToClub(c, p, c.clubs.palmeiras, 'senior'); // repetir não duplica histórico
    expect(p.history.filter((h) => h.clubId === 'flamengo' && h.season === c.season)).toHaveLength(1);
    const fp = Object.values(c.fixtures).filter((x) => x.status === 'scheduled' && (x.home === 'palmeiras' || x.away === 'palmeiras')).sort((a, b) => a.day - b.day)[0];
    // garante que ele jogue: põe nos titulares do Palmeiras
    const pal = c.clubs.palmeiras;
    pal.lineup = autoLineup(c, pal, pal.tactics.formation);
    const rows0 = statRows(c, p);
    expect(sumRows(rows0, (r) => r.clubId === 'flamengo').apps).toBe(before.apps);
    playFixture(c, fp, false);
    const rows = statRows(c, p);
    const byClub = (id: string) => sumRows(rows, (r) => r.clubId === id);
    expect(byClub('flamengo').apps).toBe(before.apps);
    expect(byClub('flamengo').apps + byClub('palmeiras').apps).toBe(sumRows(rows).apps);
    // arquivar duas vezes não duplica e a soma continua igual
    const total = sumRows(statRows(c, p));
    archiveSeason(c, c.season);
    archiveSeason(c, c.season);
    expect(sumRows(statRows(c, p))).toEqual(total);
    const recs = (p.statArchive ?? []).map((r) => `${r.season}|${r.compId}|${r.clubId}`);
    expect(new Set(recs).size).toBe(recs.length);
  });

  test('12 e 13. totais por competição = total geral; salvar e recarregar mantém tudo', async () => {
    const c = career('flamengo', 'stats-13');
    const fx = Object.values(c.fixtures).filter((x) => x.status === 'scheduled').sort((a, b) => a.day - b.day).slice(0, 40);
    for (const f of fx) playFixture(c, f, false);
    const players = Object.values(c.players).filter((p) => Object.keys(p.stats).length);
    expect(players.length).toBeGreaterThan(100);
    for (const p of players.slice(0, 300)) {
      const rows = statRows(c, p);
      const total = sumRows(rows);
      const comps = [...new Set(rows.map((r) => r.compId))];
      const byComp = comps.reduce((a, id) => a + sumRows(rows, (r) => r.compId === id).goals, 0);
      expect(byComp).toBe(total.goals);
      expect(comps.reduce((a, id) => a + sumRows(rows, (r) => r.compId === id).apps, 0)).toBe(total.apps);
    }
    archiveSeason(c, c.season);
    const sm = new SaveManager(memoryKV());
    await sm.saveCareer(c);
    const { career: back } = await sm.loadCareer(c.id);
    for (const p of players.slice(0, 200)) {
      expect(sumRows(statRows(back, back.players[p.id]))).toEqual(sumRows(statRows(c, p)));
      expect(back.players[p.id].statArchive).toEqual(p.statArchive);
    }
    expect(back.clubs.flamengo.subPlan ?? null).toEqual(c.clubs.flamengo.subPlan ?? null);
  });

  test('migração v4 → v5: chaves antigas ganham o clube e campos novos zerados', () => {
    const old = { schemaVersion: 4, config: structuredClone(w.config), clubs: {}, players: { x: { id: 'x', clubId: 'flamengo', stats: { '2027|bra1-2027': { apps: 3, starts: 2, minutes: 200, goals: 1, assists: 0, yellow: 0, red: 0, ratingSum: 20, motm: 0, cleanSheets: 0, conceded: 0, shots: 4, saves: 0 } } } }, userClubId: 'flamengo' } as unknown as Record<string, unknown>;
    for (const t of Object.values((old.config as World['config']).competitions)) delete t.subs;
    migrate(old);
    const p = (old.players as Record<string, { stats: Record<string, Record<string, number>>; statArchive: unknown[] }>).x;
    expect(Object.keys(p.stats)).toEqual(['2027|bra1-2027|flamengo']);
    expect(p.stats['2027|bra1-2027|flamengo'].goals).toBe(1);
    expect(p.stats['2027|bra1-2027|flamengo'].tackles).toBe(0);
    expect(p.statArchive).toEqual([]);
    expect((old.config as World['config']).competitions.bra1.subs).toEqual(DEFAULT_REG);
  });

  test('estatísticas por posição vêm da simulação (goleiros defendem, defensores cortam)', () => {
    const totals = { gkSaves: 0, defClear: 0, attShots: 0, n: 0 };
    for (let i = 0; i < 30; i++) {
      const o = simulateMatch(input(900 + i, side('flamengo', true), side('palmeiras', false)));
      for (const l of o.lines) {
        const line = POS_LINE[l.slot as Pos];
        if (line === 'G') totals.gkSaves += l.saves;
        if (line === 'D') totals.defClear += l.clearances + l.blocks;
        if (line === 'A') totals.attShots += l.shots;
      }
      totals.n++;
    }
    expect(totals.gkSaves / totals.n).toBeGreaterThan(3);
    expect(totals.defClear / totals.n).toBeGreaterThan(2);
    expect(totals.attShots / totals.n).toBeGreaterThan(8);
    void matchInput;
  });
});
