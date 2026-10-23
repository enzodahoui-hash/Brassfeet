import { buildDefaultWorld } from '../src/engine/universe/world';
import { newCareer } from '../src/engine/career/create';
import { advanceDay } from '../src/engine/career/advance';
import { playFixture } from '../src/engine/career/matches';
import type { Career, World } from '../src/engine/types';

let cachedWorld: World | null = null;
/** Universo padrão (gerado uma vez por arquivo de teste e clonado para cada uso). */
export function world(): World {
  cachedWorld ??= buildDefaultWorld();
  return structuredClone(cachedWorld);
}

export function career(clubId = 'flamengo', id = 'ct'): Career {
  return newCareer(world(), { clubId, managerName: 'Teste', difficulty: 'normal', id });
}

/** Avança até o fim da temporada atual jogando as partidas do usuário em modo rápido. */
export function playSeason(c: Career, maxDays = 500): void {
  const start = c.season;
  for (let i = 0; i < maxDays && c.season === start; i++) {
    const r = advanceDay(c);
    if (r.status === 'user_match' && r.fixtureId) playFixture(c, c.fixtures[r.fixtureId], true);
  }
}

export function advanceDays(c: Career, n: number): void {
  for (let i = 0; i < n; i++) {
    const r = advanceDay(c);
    if (r.status === 'user_match' && r.fixtureId) playFixture(c, c.fixtures[r.fixtureId], true);
  }
}
