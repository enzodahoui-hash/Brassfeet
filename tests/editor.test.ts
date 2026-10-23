import { describe, expect, test } from 'vitest';
import { career, world } from './helpers';
import { createClub, deleteClub, deletePlayer, duplicatePlayer, duplicateUniverse, editorCreatePlayer, exportUniverseText, redistributePlayers, searchPlayers, updateClub, updateCompetition, updatePlayer, validateCompetition, batchCreate, generateYouth, recalcValues, worldFromCareer } from '../src/engine/editor/editor';
import { A, ovrToLevel } from '../src/engine/players/attributes';
import { buildDefaultWorld, SCHEMA_VERSION } from '../src/engine/universe/world';
import { SaveManager, memoryKV, parseCareerText, parseUniverseText } from '../src/engine/save/storage';
import { migrate } from '../src/engine/save/migrations';
import { newCareer } from '../src/engine/career/create';

describe('Editor de jogadores', () => {
  test('edita atributos, posição, potencial e recalcula a nota', () => {
    const w = world();
    const p = Object.values(w.players).find((x) => x.pos === 'ST')!;
    const before = p.ovr;
    expect(updatePlayer(w, p.id, { attrs: { [A.fin]: 99, [A.psn]: 99 }, potentialLevel: 25, name: 'Editado' })).toBeNull();
    expect(p.ovr).toBeGreaterThan(before);
    expect(p.name).toBe('Editado');
    expect(Math.round(ovrToLevel(p.pot))).toBe(25);
    updatePlayer(w, p.id, { attrs: { [A.fin]: 500 } });
    expect(p.attrs[A.fin]).toBe(100);
  });

  test('criar, duplicar, pesquisar e excluir', () => {
    const w = world();
    const p = editorCreatePlayer(w, { pos: 'CM', nat: 'BRA', age: 20, level: 12, potential: 18, clubId: 'flamengo', name: 'Meia Teste' });
    expect(w.clubs.flamengo.playerIds).toContain(p.id);
    const d = duplicatePlayer(w, p.id)!;
    expect(d.id).not.toBe(p.id);
    expect(searchPlayers(w, { q: 'meia teste' }).length).toBe(2);
    expect(searchPlayers(w, { clubId: 'flamengo', pos: 'CM' }).some((x) => x.id === p.id)).toBe(true);
    expect(deletePlayer(w, p.id)).toBeNull();
    expect(w.players[p.id]).toBeUndefined();
    expect(w.clubs.flamengo.playerIds).not.toContain(p.id);
  });

  test('criação em lote, gerador de jovens e editor de valores', () => {
    const w = world();
    const batch = batchCreate(w, { count: 10, nat: 'ARG', minAge: 18, maxAge: 22, minLevel: 8, maxLevel: 12, clubId: null });
    expect(batch).toHaveLength(10);
    for (const p of batch) {
      expect(ovrToLevel(p.ovr)).toBeGreaterThan(6);
      expect(ovrToLevel(p.ovr)).toBeLessThan(14);
    }
    const youth = generateYouth(w, 'mirassol', 3);
    expect(youth.every((p) => p.squad === 'youth' && w.clubs.mirassol.youthIds.includes(p.id))).toBe(true);
    const v = w.players[batch[0].id].value;
    recalcValues(w, 2, (p) => p.id === batch[0].id);
    expect(w.players[batch[0].id].value).toBeGreaterThan(v * 1.5);
  });
});

describe('Editor de clubes e competições', () => {
  test('editar clube valida dados', () => {
    const w = world();
    expect(updateClub(w, 'flamengo', { short: 'X' })).toMatch(/sigla/);
    expect(updateClub(w, 'flamengo', { name: 'Novo Nome', level: 30, capacity: 90000, stadiumName: 'Arena Nova' })).toBeNull();
    expect(w.clubs.flamengo.level).toBe(25);
    expect(w.clubs.flamengo.stadium.name).toBe('Arena Nova');
    expect(w.clubs.flamengo.stadium.sectors.reduce((s, x) => s + x.capacity, 0)).toBeGreaterThan(89000);
  });

  test('criar e excluir clube', () => {
    const w = world();
    const club = createClub(w, { name: 'Clube Novo FC', short: 'CNF', city: 'Curitiba', country: 'BRA', divisionId: 'bra4', level: 5, colors: ['#123456', '#ffffff', '#000000'], capacity: 8000, fans: 50000, state: 'PR' });
    expect(typeof club).not.toBe('string');
    const c = club as Exclude<typeof club, string>;
    expect(c.playerIds.length).toBeGreaterThan(18);
    expect(createClub(w, { name: 'Clube Novo FC', short: 'CNF', city: 'X', country: 'BRA', divisionId: 'bra4', level: 5, colors: ['#1', '#2', '#3'], capacity: 1, fans: 1 })).toMatch(/Já existe/);
    expect(deleteClub(w, c.id)).toBeNull();
    expect(w.clubs[c.id]).toBeUndefined();
  });

  test('validação de competição e efeito adiado numa carreira', () => {
    const w = world();
    const t = w.config.competitions.bra1;
    expect(validateCompetition(w, { ...t, points: { win: 1, draw: 1, loss: 0 } }).errors.length).toBeGreaterThan(0);
    expect(validateCompetition(w, { ...t, relegate: 3 }).errors.some((e) => e.includes('Rebaixados'))).toBe(true);
    const c = career('flamengo', 'ed1');
    const r = updateCompetition(c, 'bra1', { name: 'Brasileirão Personalizado', turns: 1 });
    expect(r.errors).toEqual([]);
    expect(r.deferred).toBe(true);
    expect(c.competitions['bra1-2027'].name).toBe('Brasileirão Personalizado 2027');
    // a temporada atual mantém o calendário de 2 turnos
    expect(c.competitions['bra1-2027'].stages[0].turns).toBe(2);
  });

  test('redistribuição mantém elencos dentro dos limites', () => {
    const w = world();
    const big = w.clubs.mirassol;
    const donor = w.clubs.ceara;
    for (const id of donor.playerIds.slice(0, 14)) {
      big.playerIds.push(id);
      w.players[id].clubId = big.id;
    }
    donor.playerIds = donor.playerIds.slice(14);
    redistributePlayers(w, 'bra1');
    for (const cl of Object.values(w.clubs).filter((x) => x.divisionId === 'bra1')) {
      expect(cl.playerIds.length).toBeLessThanOrEqual(34);
      expect(cl.playerIds.length).toBeGreaterThanOrEqual(18);
    }
  });
});

describe('Universos, importação e exportação', () => {
  test('universo padrão é determinístico (restauração)', () => {
    const a = buildDefaultWorld();
    const b = buildDefaultWorld();
    expect(Object.keys(a.players).length).toBe(Object.keys(b.players).length);
    expect(a.players.p100.name).toBe(b.players.p100.name);
    expect(a.clubs.flamengo.balance).toBe(b.clubs.flamengo.balance);
  });

  test('exporta, importa e duplica universos personalizados', async () => {
    const w = world();
    updateClub(w, 'flamengo', { name: 'Gávea Editado' });
    const dup = duplicateUniverse(w, 'Cenário Alternativo');
    expect(dup.meta.id).not.toBe(w.meta.id);
    const text = exportUniverseText(dup);
    const back = parseUniverseText(text);
    expect(back.clubs.flamengo.name).toBe('Gávea Editado');
    const sm = new SaveManager(memoryKV());
    await sm.saveUniverse(back);
    expect((await sm.listUniverses())[0].name).toBe('Cenário Alternativo');
    const loaded = await sm.loadUniverse(back.meta.id);
    expect(loaded.clubs.flamengo.name).toBe('Gávea Editado');
    // uma carreira criada a partir do universo editado não altera o universo
    const c = newCareer(loaded, { clubId: 'flamengo', managerName: 'X', difficulty: 'normal', id: 'u1' });
    c.clubs.flamengo.name = 'Mudou na carreira';
    expect(loaded.clubs.flamengo.name).toBe('Gávea Editado');
    const fromCareer = worldFromCareer(c, 'Snapshot');
    expect(fromCareer.meta.custom).toBe(true);
    expect('userClubId' in fromCareer).toBe(false);
  });

  test('importação rejeita arquivos corrompidos ou do tipo errado', () => {
    expect(() => parseUniverseText('{oops')).toThrow(/ilegível/);
    expect(() => parseUniverseText('{}')).toThrow(/inválido/);
    const c = career('flamengo', 'imp');
    expect(() => parseUniverseText(JSON.stringify(c))).toThrow(/carreira/);
    expect(() => parseCareerText('{"x":1}')).toThrow();
  });
});

describe('Salvamentos', () => {
  test('salvar, listar, renomear, exportar, importar e excluir', async () => {
    const sm = new SaveManager(memoryKV());
    const c = career('mirassol', 'sv1');
    await sm.saveCareer(c);
    await sm.renameCareer(c.id, 'Minha carreira');
    let list = await sm.listCareers();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Minha carreira');
    const text = await sm.exportCareerText(c.id);
    const meta = await sm.importCareerText(text);
    expect(meta.id).not.toBe(c.id);
    list = await sm.listCareers();
    expect(list).toHaveLength(2);
    await sm.deleteCareer(c.id);
    expect(await sm.listCareers()).toHaveLength(1);
  });

  test('recupera cópia de segurança quando o salvamento principal corrompe', async () => {
    const kv = memoryKV();
    const sm = new SaveManager(kv);
    const c = career('flamengo', 'sv2');
    await sm.saveCareer(c);
    c.saveName = 'versão 2';
    await sm.saveCareer(c);
    const rec = await kv.get('careers', c.id);
    await kv.put('careers', { ...rec!, payload: 'lixo', compressed: false });
    const r = await sm.loadCareer(c.id);
    expect(r.recovered).toBe(true);
    expect(r.career.userClubId).toBe('flamengo');
  });

  test('migração de salvamentos antigos preserva dados e preenche padrões', () => {
    const c = career('flamengo', 'mig');
    const old = JSON.parse(JSON.stringify(c));
    old.schemaVersion = 1;
    delete old.awards;
    delete old.records;
    delete old.qualification;
    delete old.offers;
    for (const cl of Object.values(old.clubs) as Record<string, unknown>[]) {
      delete cl.projects;
      delete cl.kits;
      delete cl.training;
    }
    for (const p of Object.values(old.players) as Record<string, unknown>[]) {
      delete p.traits;
      delete p.achievements;
    }
    const { from, to } = migrate(old);
    expect(from).toBe(1);
    expect(to).toBe(SCHEMA_VERSION);
    expect(old.awards).toEqual({});
    expect(old.clubs.flamengo.projects).toEqual([]);
    expect(old.clubs.flamengo.kits.length).toBeGreaterThan(0);
    expect(old.clubs.flamengo.training.focus).toBe('balanced');
    expect(old.players.p1.traits).toEqual([]);
    expect(old.clubs.flamengo.name).toBe(c.clubs.flamengo.name);
    const reparsed = parseCareerText(JSON.stringify(old));
    expect(reparsed.career.userClubId).toBe('flamengo');
    expect(() => migrate({ schemaVersion: 99 } as never)).toThrow(/mais nova/);
  });
});
