import type { Career, Club, Player, StatLine, World } from '../types';
import { addInto, normalizeLine } from '../players/stats';
import { DEFAULT_REG, defaultSubPlan } from '../match/subs';
import { SCHEMA_VERSION } from '../universe/world';
import { defaultAwards, defaultConfig, defaultProgression } from '../data/competitions';
import { defaultKitCollection } from '../kits/kits';

// Migrações de salvamento: cada passo leva a versão N → N+1 preservando os dados existentes.
// Campos novos recebem valores padrão válidos; nada é apagado.

type Data = Record<string, unknown> & { schemaVersion?: number };

const MIGRATIONS: Record<number, (d: Data) => void> = {
  // v1 → v2: infraestrutura, estádio detalhado, modos financeiros e uniformes
  1: (d) => {
    const w = d as unknown as World & Partial<Career>;
    for (const club of Object.values(w.clubs ?? {})) {
      const cl = club as Club;
      cl.projects ??= [];
      cl.installments ??= [];
      cl.loans ??= [];
      cl.totalInvested ??= {};
      cl.kits ??= [defaultKitCollection(cl, w.config?.startYear ?? 2027)];
      cl.staffIds ??= [];
      cl.events ??= [];
      cl.stadium.history ??= [];
      cl.stadium.attendances ??= [];
    }
    if ('userClubId' in w && w.finance === undefined) {
      (w as Career).finance = { mode: 'realista', initialBalance: 0, transferBudget: 0, wageLimit: 0, revenueRealism: 1, costIntensity: 1, allowInjections: false, unlimited: false, injection: 0, financing: true };
    }
  },
  // v2 → v3: criador de craques, notas 0..25, premiações
  2: (d) => {
    const w = d as unknown as World & Partial<Career>;
    w.config.awards ??= defaultAwards();
    w.config.progression ??= defaultProgression();
    for (const p of Object.values(w.players ?? {})) {
      const pl = p as Player;
      pl.traits ??= [];
      pl.style ??= null;
      pl.achievements ??= [];
      pl.history ??= [];
      pl.nominations ??= { nominated: 0, finalist: 0, won: 0 };
    }
    if ('userClubId' in w) {
      (w as Career).awards ??= {};
      (w as Career).records ??= {};
    }
  },
  // v3 → v4: ligas sul-americanas/europeias, continentais, estrelas de artilharia
  3: (d) => {
    const w = d as unknown as World & Partial<Career>;
    const def = defaultConfig();
    for (const [k, t] of Object.entries(def.competitions)) if (!w.config.competitions[k]) w.config.competitions[k] = t;
    for (const c of def.countries) if (!w.config.countries.some((x) => x.code === c.code)) w.config.countries.push({ ...c, enabled: false });
    for (const club of Object.values(w.clubs ?? {})) (club as Club).training ??= { focus: 'balanced', intensity: 1 };
    if ('userClubId' in w) {
      const c = w as Career;
      c.qualification ??= {};
      c.qualificationWarnings ??= [];
      c.champions ??= {};
      c.offers ??= [];
      c.negotiations ??= [];
      c.intakeCandidates ??= [];
    }
  },
  // v4 → v5: estatísticas completas por clube + histórico permanente; substituições automáticas e regulamento
  4: (d) => {
    const w = d as unknown as World & Partial<Career>;
    for (const p of Object.values(w.players ?? {})) {
      const pl = p as Player;
      const next: Record<string, StatLine> = {};
      for (const [k, line] of Object.entries(pl.stats ?? {})) {
        const parts = k.split('|');
        const key = parts.length >= 3 ? k : `${parts[0]}|${parts[1]}|${pl.clubId ?? 'livre'}`;
        next[key] = next[key] ? addInto(next[key], normalizeLine(line)) : normalizeLine(line);
      }
      pl.stats = next;
      pl.statArchive ??= [];
    }
    for (const t of Object.values(w.config.competitions)) t.subs ??= { ...DEFAULT_REG };
    if ('userClubId' in w) {
      const c = w as Career;
      const club = c.clubs[c.userClubId];
      if (club) club.subPlan ??= defaultSubPlan();
    }
  },
};

export function migrate<T extends Data>(data: T): { data: T; from: number; to: number; steps: number[] } {
  const from = Number(data.schemaVersion ?? 1);
  if (from > SCHEMA_VERSION) throw new Error(`Este salvamento é de uma versão mais nova do jogo (formato ${from}). Atualize o jogo para abri-lo.`);
  const steps: number[] = [];
  for (let v = from; v < SCHEMA_VERSION; v++) {
    MIGRATIONS[v]?.(data);
    steps.push(v);
  }
  data.schemaVersion = SCHEMA_VERSION;
  return { data, from, to: SCHEMA_VERSION, steps };
}

/** Validação estrutural mínima para detectar arquivos corrompidos. */
export function validateWorldShape(d: unknown): string[] {
  const errs: string[] = [];
  const w = d as Partial<World>;
  if (!w || typeof w !== 'object') return ['Arquivo vazio ou ilegível.'];
  if (!w.config || !w.config.competitions) errs.push('Configuração do universo ausente.');
  if (!w.clubs || typeof w.clubs !== 'object') errs.push('Lista de clubes ausente.');
  if (!w.players || typeof w.players !== 'object') errs.push('Lista de jogadores ausente.');
  if (typeof w.nextId !== 'number') errs.push('Contador de identificadores ausente.');
  if (errs.length) return errs;
  let bad = 0;
  for (const p of Object.values(w.players!)) if (!Array.isArray(p.attrs) || p.attrs.length < 22) bad++;
  if (bad) errs.push(`${bad} jogador(es) com atributos inválidos.`);
  for (const club of Object.values(w.clubs!)) for (const id of club.playerIds) if (!w.players![id]) {
    errs.push(`Clube ${club.name} referencia jogador inexistente (${id}).`);
    break;
  }
  return errs;
}

export function validateCareerShape(d: unknown): string[] {
  const errs = validateWorldShape(d);
  const c = d as Partial<Career>;
  if (!c.userClubId || !c.clubs?.[c.userClubId]) errs.push('Clube do usuário inexistente.');
  if (typeof c.day !== 'number' || typeof c.season !== 'number') errs.push('Data da carreira inválida.');
  if (!c.competitions || !c.fixtures) errs.push('Competições ausentes.');
  return errs;
}
