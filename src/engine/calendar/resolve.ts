import type { Career, Fixture } from '../types';
import { clubBusy, clubFixturesOn, moveFixture, registerFixture } from '../career/index';

// Regra de remarcação: um clube nunca joga duas vezes no mesmo dia nem em dias consecutivos.
// Jogos de liga/estaduais (flexíveis) cedem a data para jogos de copa/continentais com data fixa.

function conflict(c: Career, f: Fixture): boolean {
  return clubBusy(c, f.home, f.day, f.id) || clubBusy(c, f.away, f.day, f.id);
}

function isFlexible(c: Career, f: Fixture): boolean {
  const kind = c.competitions[f.compId]?.kind;
  return (kind === 'league' || kind === 'state') && f.status === 'scheduled' && f.day > c.day;
}

function freeFor(c: Career, f: Fixture, day: number, avoid?: Fixture): boolean {
  if (day <= c.day) return false;
  if (clubBusy(c, f.home, day, f.id) || clubBusy(c, f.away, day, f.id)) return false;
  if (avoid && Math.abs(day - avoid.day) <= 1 && (avoid.home === f.home || avoid.home === f.away || avoid.away === f.home || avoid.away === f.away)) return false;
  return true;
}

function relocate(c: Career, f: Fixture, minDay: number, maxDay: number, avoid?: Fixture): boolean {
  for (let off = 1; off <= Math.max(f.day - minDay, maxDay - f.day); off++) {
    for (const d of [f.day + off, f.day - off]) {
      if (d < minDay || d > maxDay) continue;
      if (freeFor(c, f, d, avoid)) {
        moveFixture(c, f, d);
        return true;
      }
    }
  }
  return false;
}

/** Registra um jogo e resolve conflitos de calendário de forma coerente. */
export function placeFixture(c: Career, f: Fixture, minDay: number, maxDay: number): void {
  registerFixture(c, f);
  if (!conflict(c, f)) return;
  // 1) tenta remarcar jogos flexíveis (liga) que conflitam
  for (const club of [f.home, f.away]) {
    for (let d = f.day - 1; d <= f.day + 1; d++) {
      for (const other of clubFixturesOn(c, club, d)) {
        if (other.id === f.id || !isFlexible(c, other)) continue;
        relocate(c, other, Math.max(c.day + 1, other.day - 10), other.day + 24, f);
      }
    }
  }
  if (!conflict(c, f)) return;
  // 2) move o próprio jogo dentro da janela permitida
  if (relocate(c, f, Math.max(minDay, c.day + 1), maxDay)) return;
  // 3) último recurso: procura a próxima data livre
  relocate(c, f, c.day + 1, f.day + 90);
}

/** Verificação global: nenhum clube com dois jogos no mesmo dia. */
export function findClashes(c: Career): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const f of Object.values(c.fixtures)) {
    if (f.status === 'void') continue;
    for (const club of [f.home, f.away]) {
      const k = `${club}|${f.day}`;
      const prev = seen.get(k);
      if (prev && prev !== f.id) out.push(`${club} em ${f.day}: ${prev} e ${f.id}`);
      else seen.set(k, f.id);
    }
  }
  return out;
}
