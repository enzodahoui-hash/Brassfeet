import type { KV } from './storage';

// Armazenamento na conta do usuário (servidor do jogo). Mesma interface do IndexedDB: o SaveManager
// não muda. O servidor guarda a versão anterior de cada carreira como cópia de segurança.

const H = { 'X-Requested-With': 'fmbr' };
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0)));

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

export function remoteKV(base = '/api/kv'): KV & { autoBackup: true } {
  return {
    autoBackup: true,
    async get(store, id) {
      const r = await fetch(`${base}/${store}/${encodeURIComponent(id)}`, { headers: H, credentials: 'same-origin' });
      if (r.status === 404) return undefined;
      await check(r);
      const compressed = r.headers.get('X-Compressed') === '1';
      const meta = JSON.parse(unb64(r.headers.get('X-Meta') ?? ''));
      return { id, meta, compressed, payload: compressed ? await r.blob() : await r.text() };
    },
    async put(store, rec) {
      await check(await fetch(`${base}/${store}/${encodeURIComponent(rec.id)}`, {
        method: 'PUT', credentials: 'same-origin', body: rec.payload,
        headers: { ...H, 'Content-Type': 'application/octet-stream', 'X-Meta': b64(JSON.stringify(rec.meta)), 'X-Compressed': rec.compressed ? '1' : '0' },
      }));
    },
    async del(store, id) {
      await check(await fetch(`${base}/${store}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: H, credentials: 'same-origin' }));
    },
    async list(store) {
      const r = await check(await fetch(`${base}/${store}`, { headers: H, credentials: 'same-origin' }));
      const rows = (await r.json()) as { id: string; meta: never; compressed: boolean }[];
      return rows.map((x) => ({ id: x.id, meta: x.meta, compressed: x.compressed, payload: '' }));
    },
  };
}
