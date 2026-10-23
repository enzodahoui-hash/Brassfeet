import type { Career, World } from '../types';
import { migrate, validateCareerShape, validateWorldShape } from './migrations';
import { resetIndex } from '../career/index';
import { SCHEMA_VERSION } from '../universe/world';

// Persistência local versionada. Carreiras e universos ficam em stores separados do IndexedDB:
// os dados do editor nunca se misturam com o estado de uma carreira.
// Cada registro guarda o JSON comprimido (gzip) quando o navegador oferece CompressionStream.

export interface SaveMeta {
  id: string;
  name: string;
  clubName: string;
  clubId: string;
  season: number;
  day: number;
  updated: number;
  manager: string;
  schemaVersion: number;
  bytes: number;
  universe: string;
}

export interface UniverseMeta {
  id: string;
  name: string;
  description: string;
  updated: number;
  clubs: number;
  players: number;
  schemaVersion: number;
}

export interface Record_ {
  id: string;
  meta: SaveMeta | UniverseMeta;
  payload: Blob | string;
  compressed: boolean;
}

export interface KV {
  /** true quando o próprio armazenamento guarda a versão anterior (servidor): evita baixar e reenviar a carreira. */
  autoBackup?: boolean;
  get(store: string, id: string): Promise<Record_ | undefined>;
  put(store: string, rec: Record_): Promise<void>;
  del(store: string, id: string): Promise<void>;
  list(store: string): Promise<Record_[]>;
}

const DB_NAME = 'football-manager-br';
const STORES = ['careers', 'universes', 'backups'];

export function idbKV(idb: IDBFactory = indexedDB): KV {
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () =>
    (dbp ??= new Promise((res, rej) => {
      const r = idb.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error ?? new Error('Não foi possível abrir o banco local.'));
    }));
  const tx = async <T,>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((res, rej) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req.result);
      t.onerror = () => rej(t.error ?? new Error('Falha de gravação.'));
      t.onabort = () => rej(t.error ?? new Error('Gravação abortada (espaço insuficiente?).'));
    });
  };
  return {
    get: (s, id) => tx(s, 'readonly', (os) => os.get(id) as IDBRequest<Record_ | undefined>),
    put: async (s, rec) => void (await tx(s, 'readwrite', (os) => os.put(rec))),
    del: async (s, id) => void (await tx(s, 'readwrite', (os) => os.delete(id))),
    list: (s) => tx(s, 'readonly', (os) => os.getAll() as IDBRequest<Record_[]>),
  };
}

/** Armazenamento em memória (testes e fallback quando o IndexedDB está bloqueado). */
export function memoryKV(): KV {
  const m = new Map<string, Map<string, Record_>>();
  const st = (s: string) => m.get(s) ?? (m.set(s, new Map()), m.get(s)!);
  return {
    get: async (s, id) => st(s).get(id),
    put: async (s, rec) => void st(s).set(rec.id, rec),
    del: async (s, id) => void st(s).delete(id),
    list: async (s) => [...st(s).values()],
  };
}

const hasCompression = typeof CompressionStream !== 'undefined' && typeof Blob !== 'undefined' && typeof Response !== 'undefined';

export async function compress(text: string): Promise<{ payload: Blob | string; compressed: boolean }> {
  if (!hasCompression) return { payload: text, compressed: false };
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return { payload: await new Response(stream).blob(), compressed: true };
}

export async function decompress(payload: Blob | string, compressed: boolean): Promise<string> {
  if (!compressed || typeof payload === 'string') return payload as string;
  const stream = payload.stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function careerMeta(c: Career, bytes: number): SaveMeta {
  const club = c.clubs[c.userClubId];
  return { id: c.id, name: c.saveName, clubName: club.name, clubId: club.id, season: c.season, day: c.day, updated: Date.now(), manager: c.manager.name, schemaVersion: SCHEMA_VERSION, bytes, universe: c.meta.name };
}

export class SaveManager {
  constructor(private kv: KV) {}

  /** Grava a carreira mantendo a versão anterior como backup (proteção contra falhas de gravação). */
  async saveCareer(c: Career): Promise<SaveMeta> {
    const json = JSON.stringify(c);
    const { payload, compressed } = await compress(json);
    const meta = careerMeta(c, typeof payload === 'string' ? payload.length : payload.size);
    if (!this.kv.autoBackup) {
      const prev = await this.kv.get('careers', c.id);
      if (prev) await this.kv.put('backups', { ...prev, id: `${c.id}` });
    }
    await this.kv.put('careers', { id: c.id, meta, payload, compressed });
    return meta;
  }

  async listCareers(): Promise<SaveMeta[]> {
    const all = await this.kv.list('careers');
    return all.map((r) => r.meta as SaveMeta).sort((a, b) => b.updated - a.updated);
  }

  async loadCareer(id: string): Promise<{ career: Career; recovered?: boolean; migratedFrom?: number }> {
    const rec = await this.kv.get('careers', id);
    if (!rec) throw new Error('Salvamento não encontrado.');
    try {
      return { ...(await this.parseCareer(rec)) };
    } catch (e) {
      const bak = await this.kv.get('backups', id);
      if (!bak) throw new Error(`Salvamento corrompido e sem cópia de segurança: ${(e as Error).message}`);
      const r = await this.parseCareer(bak);
      return { ...r, recovered: true };
    }
  }

  private async parseCareer(rec: Record_): Promise<{ career: Career; migratedFrom?: number }> {
    const text = await decompress(rec.payload, rec.compressed);
    return parseCareerText(text);
  }

  async renameCareer(id: string, name: string): Promise<void> {
    const rec = await this.kv.get('careers', id);
    if (!rec) throw new Error('Salvamento não encontrado.');
    const text = await decompress(rec.payload, rec.compressed);
    const c = JSON.parse(text) as Career;
    c.saveName = name;
    const { payload, compressed } = await compress(JSON.stringify(c));
    await this.kv.put('careers', { id, meta: { ...(rec.meta as SaveMeta), name, updated: Date.now() }, payload, compressed });
  }

  async deleteCareer(id: string): Promise<void> {
    await this.kv.del('careers', id);
    await this.kv.del('backups', id);
  }

  async exportCareerText(id: string): Promise<string> {
    const rec = await this.kv.get('careers', id);
    if (!rec) throw new Error('Salvamento não encontrado.');
    return decompress(rec.payload, rec.compressed);
  }

  async importCareerText(text: string): Promise<SaveMeta> {
    const { career } = parseCareerText(text);
    if (await this.kv.get('careers', career.id)) career.id = `${career.id}-imp${Date.now().toString(36)}`;
    return this.saveCareer(career);
  }

  // ───── universos personalizados ─────

  async saveUniverse(w: World): Promise<UniverseMeta> {
    const { payload, compressed } = await compress(JSON.stringify(w));
    const meta: UniverseMeta = { id: w.meta.id, name: w.meta.name, description: w.meta.description, updated: Date.now(), clubs: Object.keys(w.clubs).length, players: Object.keys(w.players).length, schemaVersion: SCHEMA_VERSION };
    await this.kv.put('universes', { id: w.meta.id, meta, payload, compressed });
    return meta;
  }

  async listUniverses(): Promise<UniverseMeta[]> {
    return (await this.kv.list('universes')).map((r) => r.meta as UniverseMeta).sort((a, b) => b.updated - a.updated);
  }

  async loadUniverse(id: string): Promise<World> {
    const rec = await this.kv.get('universes', id);
    if (!rec) throw new Error('Universo não encontrado.');
    return parseUniverseText(await decompress(rec.payload, rec.compressed));
  }

  async deleteUniverse(id: string): Promise<void> {
    await this.kv.del('universes', id);
  }
}

function precheck(d: unknown): void {
  const w = d as Partial<World> | null;
  if (!w || typeof w !== 'object' || !w.config || !w.clubs || !w.players) throw new Error('Arquivo inválido: estrutura básica (configuração, clubes e jogadores) ausente.');
}

export function parseCareerText(text: string): { career: Career; migratedFrom?: number } {
  let data: Career;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um salvamento válido (JSON ilegível).');
  }
  precheck(data);
  const { from } = migrate(data as unknown as Record<string, unknown>);
  const errs = validateCareerShape(data);
  if (errs.length) throw new Error(`Salvamento inválido: ${errs.join(' ')}`);
  resetIndex(data);
  return { career: data, migratedFrom: from < SCHEMA_VERSION ? from : undefined };
}

export function parseUniverseText(text: string): World {
  let data: World;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um universo válido (JSON ilegível).');
  }
  if (data && typeof data === 'object' && 'userClubId' in (data as object)) throw new Error('Este arquivo é um salvamento de carreira, não um universo.');
  precheck(data);
  migrate(data as unknown as Record<string, unknown>);
  const errs = validateWorldShape(data);
  if (errs.length) throw new Error(`Universo inválido: ${errs.join(' ')}`);
  return data;
}
