import type { Career, CompTemplate, QualificationEntry } from '../types';
import { compKey, leagueTable } from './manager';

// Classificação continental automática:
// 1) valida tabelas finais 2) aplica desempates (já embutidos na tabela) 3) identifica campeões e vagas
// 4) distribui vagas por país 5) verifica quem já está classificado 6) redistribui conflitos
// 7) gera a lista oficial 8) (a criação dos confrontos ocorre na montagem da temporada) 9) registra no histórico.

export interface QualificationResult {
  lists: Record<string, QualificationEntry[]>;
  warnings: string[];
}

/** Ordem final da liga: tabela real da temporada ou, na primeira temporada, o ranking inicial por nível. */
function leagueOrder(c: Career, leagueId: string, season: number, initial: boolean): { order: string[]; real: boolean } {
  const comp = c.competitions[compKey(leagueId, season)];
  if (!initial && comp && comp.status === 'finished') return { order: leagueTable(c, comp).map((r) => r.clubId), real: true };
  const ids = Object.values(c.clubs).filter((cl) => cl.divisionId === leagueId).sort((a, b) => b.level - a.level || a.id.localeCompare(b.id)).map((cl) => cl.id);
  return { order: ids, real: false };
}

function templatesInOrder(c: Career): CompTemplate[] {
  return Object.values(c.config.competitions)
    .filter((t) => t.kind === 'continental' && t.enabled)
    .sort((a, b) => b.importance - a.importance || b.coefficient - a.coefficient);
}

/**
 * Calcula os classificados para as competições continentais da temporada seguinte.
 * `season` = temporada encerrada; `initial` = primeira temporada (sem resultados anteriores).
 */
export function computeQualification(c: Career, season: number, initial = false): QualificationResult {
  const warnings: string[] = [];
  const lists: Record<string, QualificationEntry[]> = {};
  const qualified = new Map<string, string>(); // clube -> competição
  const enabledCountries = new Set(c.config.countries.filter((x) => x.enabled).map((x) => x.code));
  const pointer: Record<string, number> = {}; // `${tpl}|${league}` -> próxima posição a usar

  for (const t of templatesInOrder(c)) {
    const list: QualificationEntry[] = [];
    lists[t.id] = list;
    const rules = (t.slots ?? []).slice().sort((a, b) => ['league', 'cupWinner', 'holder'].indexOf(a.type) - ['league', 'cupWinner', 'holder'].indexOf(b.type));
    const add = (clubId: string, reason: string) => {
      const club = c.clubs[clubId];
      if (!club) return false;
      list.push({ clubId, reason, country: club.country });
      qualified.set(clubId, t.id);
      return true;
    };
    for (const rule of rules) {
      if (rule.type === 'league' && rule.sourceId) {
        const lt = c.config.competitions[rule.sourceId];
        if (!lt || !lt.enabled || !enabledCountries.has(lt.country ?? '')) continue;
        const { order, real } = leagueOrder(c, rule.sourceId, season, initial);
        const positions = rule.positions ?? [];
        if (!positions.length) continue;
        const key = `${t.id}|${rule.sourceId}`;
        let i = Math.min(...positions) - 1;
        let filled = 0;
        while (filled < positions.length && i < order.length) {
          const id = order[i];
          if (!qualified.has(id)) {
            const pos = i + 1;
            const nominal = positions.includes(pos);
            add(id, real ? `${pos}º colocado — ${lt.name}${nominal ? '' : ' (vaga redistribuída)'}` : `Ranking inicial do universo — ${lt.name}`);
            filled++;
          }
          i++;
        }
        pointer[key] = i;
        if (filled < positions.length) warnings.push(`${t.name}: ${positions.length - filled} vaga(s) de ${lt.name} sem clube elegível. Revise a configuração no editor.`);
      } else if (rule.type === 'cupWinner' && rule.sourceId) {
        const cup = c.config.competitions[rule.sourceId];
        if (!cup || !cup.enabled || !enabledCountries.has(cup.country ?? '')) continue;
        const cupComp = c.competitions[compKey(rule.sourceId, season)];
        const winner = !initial && cupComp?.status === 'finished' ? cupComp.champion : undefined;
        if (winner && !qualified.has(winner)) {
          add(winner, `Campeão — ${cup.name}`);
          continue;
        }
        // redistribuição: próximo colocado da liga principal do país
        const country = c.config.countries.find((x) => x.code === cup.country);
        const topLeague = country?.leagues[0];
        if (!topLeague) continue;
        const key = `${t.id}|${topLeague}`;
        const { order } = leagueOrder(c, topLeague, season, initial);
        let i = pointer[key] ?? 0;
        while (i < order.length && qualified.has(order[i])) i++;
        if (i < order.length) {
          const why = winner ? `Vaga da ${cup.name} redistribuída (campeão já classificado)` : initial ? `Vaga da ${cup.name} — ranking inicial do universo` : `Vaga da ${cup.name} redistribuída`;
          add(order[i], `${why}: ${i + 1}º da ${c.config.competitions[topLeague]?.name}`);
          pointer[key] = i + 1;
        } else warnings.push(`${t.name}: não foi possível redistribuir a vaga da ${cup.name}.`);
      } else if (rule.type === 'holder') {
        const prev = c.competitions[compKey(t.id, season)];
        const holder = !initial && prev?.status === 'finished' ? prev.champion : undefined;
        if (holder && !qualified.has(holder)) add(holder, 'Atual campeão');
      }
    }
  }
  return { lists, warnings };
}

/** Projeção "se a temporada terminasse hoje" (usa tabelas parciais). */
export function projectedQualification(c: Career): QualificationResult {
  const clone: Career = { ...c, competitions: Object.fromEntries(Object.entries(c.competitions).map(([k, v]) => [k, v.kind === 'league' ? { ...v, status: 'finished' as const } : v])) };
  return computeQualification(clone, c.season, false);
}
