import type { Career } from '../types';
import { compKey, leagueTable } from './manager';

export interface MoveResult {
  promoted: { clubId: string; from: string; to: string }[];
  relegated: { clubId: string; from: string; to: string }[];
  errors: string[];
}

/** Acesso e rebaixamento simultâneos ao fim da temporada, preservando o tamanho de cada divisão. */
export function applyPromotionRelegation(c: Career, season: number): MoveResult {
  const res: MoveResult = { promoted: [], relegated: [], errors: [] };
  const sizesBefore: Record<string, number> = {};
  for (const cl of Object.values(c.clubs)) sizesBefore[cl.divisionId] = (sizesBefore[cl.divisionId] ?? 0) + 1;
  const moves: { clubId: string; to: string; from: string; up: boolean }[] = [];
  for (const country of c.config.countries) {
    if (!country.enabled) continue;
    for (let i = 0; i < country.leagues.length - 1; i++) {
      const upperId = country.leagues[i];
      const lowerId = country.leagues[i + 1];
      const upper = c.config.competitions[upperId];
      const lower = c.config.competitions[lowerId];
      const down = upper?.relegate ?? 0;
      const up = lower?.promote ?? 0;
      if (!down && !up) continue;
      if (down !== up) {
        res.errors.push(`${upper.name} rebaixa ${down} e ${lower.name} promove ${up}: números diferentes. Nenhuma troca aplicada entre essas divisões.`);
        continue;
      }
      const uc = c.competitions[compKey(upperId, season)];
      const lc = c.competitions[compKey(lowerId, season)];
      if (!uc || !lc || uc.status !== 'finished' || lc.status !== 'finished') {
        res.errors.push(`Acesso/rebaixamento entre ${upper.name} e ${lower.name} não aplicado: campeonato não encerrado.`);
        continue;
      }
      const ut = leagueTable(c, uc);
      const lt = leagueTable(c, lc);
      const rel = ut.slice(ut.length - down).map((r) => r.clubId);
      const pro = lt.slice(0, up).map((r) => r.clubId);
      for (const id of rel) moves.push({ clubId: id, from: upperId, to: lowerId, up: false });
      for (const id of pro) moves.push({ clubId: id, from: lowerId, to: upperId, up: true });
    }
  }
  // um clube não pode receber dois movimentos
  const seen = new Set<string>();
  for (const m of moves) {
    if (seen.has(m.clubId)) {
      res.errors.push(`Clube ${m.clubId} com movimentos conflitantes; mantido na divisão.`);
      continue;
    }
    seen.add(m.clubId);
    const club = c.clubs[m.clubId];
    if (!club || club.divisionId !== m.from) continue;
    club.divisionId = m.to;
    (m.up ? res.promoted : res.relegated).push({ clubId: m.clubId, from: m.from, to: m.to });
    club.events.push({ day: c.day, text: `${m.up ? 'Acesso' : 'Rebaixamento'}: ${c.config.competitions[m.from]?.name} → ${c.config.competitions[m.to]?.name} (${season})` });
  }
  const sizesAfter: Record<string, number> = {};
  for (const cl of Object.values(c.clubs)) sizesAfter[cl.divisionId] = (sizesAfter[cl.divisionId] ?? 0) + 1;
  for (const k of Object.keys(sizesBefore)) if (sizesBefore[k] !== sizesAfter[k]) res.errors.push(`Divisão ${k} mudou de tamanho (${sizesBefore[k]} → ${sizesAfter[k]}).`);
  return res;
}
