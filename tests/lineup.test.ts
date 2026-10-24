import { describe, it, expect } from 'vitest';
import { career } from './helpers';
import { presetLineup, LINEUP_PRESETS, isAvailable } from '../src/engine/clubs/lineup';
import type { Career } from '../src/engine/types';

function club(c: Career) {
  return c.clubs[c.userClubId];
}
function formationOf(c: Career) {
  return club(c).tactics.formation;
}

describe('Escalações pré-definidas (presetLineup)', () => {
  it('todo preset preenche 11 titulares, sem repetição e só com jogadores disponíveis', () => {
    const c = career('flamengo');
    const cl = club(c);
    const f = formationOf(c);
    for (const { id: preset } of LINEUP_PRESETS) {
      const l = presetLineup(c, cl, f, preset);
      const starters = l.starters.filter(Boolean) as string[];
      expect(starters.length, `${preset}: titulares`).toBe(l.starters.length);
      expect(new Set(starters).size, `${preset}: sem duplicados`).toBe(starters.length);
      for (const id of [...starters, ...l.bench]) {
        expect(isAvailable(c.players[id]), `${preset}: ${id} indisponível escalado`).toBe(true);
      }
    }
  });

  it('nunca escala um jogador lesionado, mesmo com overall alto', () => {
    const c = career('flamengo');
    const cl = club(c);
    const f = formationOf(c);
    // lesiona o jogador de maior overall do elenco
    const best = cl.playerIds.map((id) => c.players[id]).sort((a, b) => b.ovr - a.ovr)[0];
    best.injury = { name: 'Teste', daysLeft: 20, since: c.day, severity: 2 };
    for (const { id: preset } of LINEUP_PRESETS) {
      const l = presetLineup(c, cl, f, preset);
      expect([...l.starters, ...l.bench], `${preset} escalou lesionado`).not.toContain(best.id);
    }
  });

  it('não escala um jogador suspenso na competição', () => {
    const c = career('flamengo');
    const cl = club(c);
    const f = formationOf(c);
    const comp = Object.keys(c.competitions)[0];
    const best = cl.playerIds.map((id) => c.players[id]).sort((a, b) => b.ovr - a.ovr)[0];
    best.susp[comp] = 1;
    const l = presetLineup(c, cl, f, 'strong', comp);
    expect([...l.starters, ...l.bench]).not.toContain(best.id);
  });

  it('"Reservas" escala em geral jogadores diferentes de "Força máxima"', () => {
    const c = career('flamengo');
    const cl = club(c);
    const f = formationOf(c);
    const strong = new Set(presetLineup(c, cl, f, 'strong').starters.filter(Boolean) as string[]);
    const rotation = presetLineup(c, cl, f, 'rotation').starters.filter(Boolean) as string[];
    const overlap = rotation.filter((id) => strong.has(id)).length;
    // a maioria dos titulares deve ser poupada (algum pode repetir se faltar reserva na vaga)
    expect(overlap).toBeLessThan(rotation.length / 2);
  });

  it('"Base" rende um time mais jovem (ano de nascimento médio maior) que "Força máxima"', () => {
    const c = career('flamengo');
    const cl = club(c);
    const f = formationOf(c);
    const avgBirth = (ids: string[]) => ids.reduce((s, id) => s + c.players[id].birthYear, 0) / ids.length;
    const strong = presetLineup(c, cl, f, 'strong').starters.filter(Boolean) as string[];
    const youth = presetLineup(c, cl, f, 'youth').starters.filter(Boolean) as string[];
    expect(avgBirth(youth)).toBeGreaterThan(avgBirth(strong));
  });
});
