import type { KV } from './storage';

// Armazenamento na conta do usuário (servidor do jogo). Mesma interface do IndexedDB: o SaveManager
// não muda. O servidor guarda a versão anterior de cada carreira como cópia de segurança.
//
// A função da Netlify limita cada requisição a ~6 MB. Como uma carreira cresce a cada temporada e
// pode passar disso, o salvamento é dividido em pedaços (cada um bem abaixo do limite): o pedaço 0
// vai na chave `id` (com `_parts` nos metadados) e os demais em `id.part1`, `id.part2`, … O get
// remonta tudo; o list esconde os pedaços; o del apaga todos.

const H = { 'X-Requested-With': 'fmbr' };
const CHUNK = 3 * 1024 * 1024; // 3 MB por pedaço (abaixo do limite da função)
const MAX_PARTS = 64; // teto defensivo ao apagar pedaços
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0)));
const partKey = (id: string, i: number) => (i === 0 ? id : `${id}.part${i}`);
const isPart = (id: string) => /\.part\d+$/.test(id);

async function check(r: Response): Promise<Response> {
  if (r.ok) return r;
  let msg = `Erro ${r.status} no servidor.`;
  try {
    msg = (await r.json()).error ?? msg;
  } catch {
    /* corpo sem JSON */
  }
  throw new Error(msg);
}

export function remoteKV(base = '/api/kv', chunk = CHUNK): KV & { autoBackup: true } {
  const url = (store: string, id: string) => `${base}/${store}/${encodeURIComponent(id)}`;
  const putPart = async (store: string, id: string, body: BlobPart, meta: unknown, compressed: boolean) =>
    check(await fetch(url(store, id), {
      method: 'PUT', credentials: 'same-origin', body: body as BodyInit,
      headers: { ...H, 'Content-Type': 'application/octet-stream', 'X-Meta': b64(JSON.stringify(meta)), 'X-Compressed': compressed ? '1' : '0' },
    }));
  return {
    autoBackup: true,
    async get(store, id) {
      const r = await fetch(url(store, id), { headers: H, credentials: 'same-origin' });
      if (r.status === 404) return undefined;
      await check(r);
      const compressed = r.headers.get('X-Compressed') === '1';
      const meta = JSON.parse(unb64(r.headers.get('X-Meta') ?? '{}'));
      const parts = Number(meta._parts ?? 1);
      const blobs: Blob[] = [await r.blob()];
      for (let i = 1; i < parts; i++) blobs.push(await (await check(await fetch(url(store, partKey(id, i)), { headers: H, credentials: 'same-origin' }))).blob());
      delete meta._parts;
      const whole = blobs.length === 1 ? blobs[0] : new Blob(blobs);
      return { id, meta, compressed, payload: compressed ? whole : await whole.text() };
    },
    async put(store, rec) {
      const blob = typeof rec.payload === 'string' ? new Blob([rec.payload]) : rec.payload;
      const parts = Math.max(1, Math.ceil(blob.size / chunk));
      const baseMeta = parts > 1 ? { ...rec.meta, _parts: parts } : rec.meta;
      // pedaço 0 primeiro: é ele que dispara a cópia de segurança no servidor (com as partes antigas)
      await putPart(store, rec.id, blob.slice(0, chunk), baseMeta, rec.compressed);
      for (let i = 1; i < parts; i++) await putPart(store, partKey(rec.id, i), blob.slice(i * chunk, (i + 1) * chunk), { _part: i }, rec.compressed);
      // apaga pedaços que sobraram de um salvamento maior anterior
      for (let i = parts; i < MAX_PARTS; i++) {
        const d = await fetch(url(store, partKey(rec.id, i)), { method: 'DELETE', headers: H, credentials: 'same-origin' }).catch(() => null);
        if (!d) break;
      }
    },
    async del(store, id) {
      await check(await fetch(url(store, id), { method: 'DELETE', headers: H, credentials: 'same-origin' }));
      for (let i = 1; i < MAX_PARTS; i++) await fetch(url(store, partKey(id, i)), { method: 'DELETE', headers: H, credentials: 'same-origin' }).catch(() => undefined);
    },
    async list(store) {
      const r = await check(await fetch(`${base}/${store}`, { headers: H, credentials: 'same-origin' }));
      const rows = (await r.json()) as { id: string; meta: Record<string, unknown>; compressed: boolean }[];
      return rows.filter((x) => !isPart(x.id)).map((x) => { const m = { ...x.meta }; delete m._parts; return { id: x.id, meta: m as never, compressed: x.compressed, payload: '' }; });
    },
  };
}
