import { describe, expect, test } from 'vitest';
// @ts-expect-error módulo JavaScript do servidor (sem tipos)
import { createCore } from '../server/core.mjs';
// @ts-expect-error módulo JavaScript do servidor (sem tipos)
import { blobsStore } from '../server/blobs-store.mjs';

// ───── Blobs falso em memória: imita a parte do @netlify/blobs que o store usa ─────
function fakeBlobs() {
  const stores = new Map<string, Map<string, { value: unknown; metadata: unknown }>>();
  const getStore = ({ name }: { name: string }) => {
    const map = stores.get(name) ?? new Map();
    stores.set(name, map);
    return {
      async set(key: string, value: unknown, opts: { onlyIfNew?: boolean; metadata?: unknown } = {}) {
        if (opts.onlyIfNew && map.has(key)) return { modified: false };
        map.set(key, { value, metadata: opts.metadata });
        return { modified: true };
      },
      async setJSON(key: string, value: unknown, opts: { onlyIfNew?: boolean } = {}) {
        if (opts.onlyIfNew && map.has(key)) return { modified: false };
        map.set(key, { value: JSON.stringify(value), metadata: undefined });
        return { modified: true };
      },
      async get(key: string, { type }: { type?: string } = {}) {
        const e = map.get(key);
        if (!e) return null;
        return type === 'json' ? JSON.parse(e.value as string) : e.value;
      },
      async getMetadata(key: string) {
        const e = map.get(key);
        return e ? { etag: '1', metadata: e.metadata } : null;
      },
      async getWithMetadata(key: string, _opts: { type?: string } = {}) {
        const e = map.get(key);
        return e ? { data: e.value, metadata: e.metadata, etag: '1' } : null;
      },
      async list({ prefix = '' }: { prefix?: string } = {}) {
        return { blobs: [...map.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, etag: '1' })) };
      },
      async delete(key: string) {
        map.delete(key);
      },
    };
  };
  return { getStore };
}

type Mail = { to: string; subject: string; text: string };
function makeCore(quotaMb = 300) {
  const mails: Mail[] = [];
  const cfg = { baseUrl: 'http://localhost', cookieSecure: false, requireVerification: false, sessionDays: 30, quotaMb, maxRecordMb: 10, appName: 'FM BR' };
  const core = createCore({ cfg, store: blobsStore(fakeBlobs()), mailer: async (_c: unknown, m: Mail) => void mails.push(m), mailConfigured: () => false });
  return { core, mails };
}

/** Cliente com "pote" de cookies que fala direto com o núcleo, como um navegador. */
function client(core: { handle: (r: unknown) => Promise<{ status: number; body: unknown; cookie?: { value: string; maxAge: number } }> }) {
  let cookie = '';
  return async (method: string, path: string, opts: { json?: unknown; body?: Uint8Array; meta?: unknown; compressed?: boolean } = {}) => {
    const [p, qs] = path.split('?');
    const headers: Record<string, string> = {};
    if (method !== 'GET') headers['x-requested-with'] = 'fmbr';
    let body: Uint8Array = Buffer.alloc(0);
    if (opts.json !== undefined) body = Buffer.from(JSON.stringify(opts.json));
    if (opts.body) body = opts.body;
    if (opts.meta !== undefined) headers['x-meta'] = Buffer.from(JSON.stringify(opts.meta)).toString('base64');
    if (opts.compressed) headers['x-compressed'] = '1';
    const r = await core.handle({ method, path: p, query: new URLSearchParams(qs ?? ''), headers, cookies: cookie ? { fmbr_sid: cookie } : {}, body, ip: '1.1.1.1' });
    if (r.cookie) cookie = r.cookie.value || '';
    return r;
  };
}
const tokenFrom = (text: string, key: string) => new RegExp(`${key}=([\\w-]+)`).exec(text)?.[1] ?? '';

describe('Backend na Netlify (núcleo + Netlify Blobs em memória)', () => {
  test('cadastro, sessão, saída e login com senha', async () => {
    const { core } = makeCore();
    const a = client(core);
    const reg = await a('POST', '/api/auth/register', { json: { name: 'Ana', email: 'Ana@Exemplo.com', password: 'segredo123' } });
    expect(reg.status).toBe(201);
    expect((reg.body as { user: { email: string } }).user.email).toBe('ana@exemplo.com');
    expect(((await a('GET', '/api/auth/me')).body as { user: { name: string } }).user.name).toBe('Ana');
    expect((await a('POST', '/api/auth/register', { json: { email: 'ana@exemplo.com', password: 'outrasenha1' } })).status).toBe(409);
    await a('POST', '/api/auth/logout', { json: {} });
    expect(((await a('GET', '/api/auth/me')).body as { user: unknown }).user).toBeNull();
    expect((await a('POST', '/api/auth/login', { json: { email: 'ana@exemplo.com', password: 'errada000' } })).status).toBe(401);
    expect((await a('POST', '/api/auth/login', { json: { email: 'ana@exemplo.com', password: 'segredo123' } })).status).toBe(200);
    expect((await a('GET', '/api/auth/me')).status).toBe(200);
  });

  test('proteção contra CSRF e validações', async () => {
    const { core } = makeCore();
    const a = client(core);
    const noHeader = await core.handle({ method: 'POST', path: '/api/auth/login', query: new URLSearchParams(), headers: {}, cookies: {}, body: Buffer.from('{}'), ip: '1.1.1.1' });
    expect(noHeader.status).toBe(403); // sem o cabeçalho do aplicativo
    expect((await a('POST', '/api/auth/register', { json: { email: 'sem-arroba', password: 'segredo123' } })).status).toBe(400);
    expect((await a('POST', '/api/auth/register', { json: { email: 'b@b.com', password: '123' } })).status).toBe(400);
  });

  test('confirmação de e-mail e redefinição de senha por link', async () => {
    const { core, mails } = makeCore();
    const a = client(core);
    await a('POST', '/api/auth/register', { json: { name: 'Bia', email: 'bia@exemplo.com', password: 'senhaforte1' } });
    const vtok = tokenFrom(mails.at(-1)!.text, 'token');
    const v = await a('GET', `/api/auth/verify?token=${vtok}`);
    expect(v.status).toBe(302);
    expect((v.body !== undefined, (v as { headers?: { Location?: string } }).headers?.Location)).toBe('/?verificado=1');
    expect(((await a('GET', '/api/auth/me')).body as { user: { verified: boolean } }).user.verified).toBe(true);
    expect(((await a('GET', `/api/auth/verify?token=${vtok}`)) as { headers?: { Location?: string } }).headers?.Location).toBe('/?verificado=0');
    const b = client(core);
    expect((await b('POST', '/api/auth/forgot', { json: { email: 'bia@exemplo.com' } })).status).toBe(200);
    expect((await b('POST', '/api/auth/forgot', { json: { email: 'ninguem@exemplo.com' } })).status).toBe(200); // não revela contas
    const rtok = tokenFrom(mails.filter((m) => m.to === 'bia@exemplo.com').at(-1)!.text, 'redefinir');
    expect((await b('POST', '/api/auth/reset', { json: { token: rtok, password: 'novasenha9' } })).status).toBe(200);
    expect((await b('POST', '/api/auth/reset', { json: { token: rtok, password: 'outra12345' } })).status).toBe(400); // link de uso único
    expect((await client(core)('POST', '/api/auth/login', { json: { email: 'bia@exemplo.com', password: 'novasenha9' } })).status).toBe(200);
    expect((await client(core)('POST', '/api/auth/login', { json: { email: 'bia@exemplo.com', password: 'senhaforte1' } })).status).toBe(401);
  });

  test('salvamentos isolados por conta, com cópia de segurança e cota', async () => {
    const { core } = makeCore(3); // cota de 3 MB
    const a = client(core);
    await a('POST', '/api/auth/register', { json: { name: 'Ana', email: 'ana@exemplo.com', password: 'segredo123' } });
    const put = (body: string) => a('PUT', '/api/kv/careers/c1', { body: Buffer.from(body), meta: { id: 'c1', name: 'Minha carreira' } });
    expect((await put('versao-1')).status).toBe(200);
    expect((await put('versao-2')).status).toBe(200);
    expect((await a('GET', '/api/kv/careers/c1')).body!.toString()).toBe('versao-2');
    expect((await a('GET', '/api/kv/backups/c1')).body!.toString()).toBe('versao-1'); // cópia automática
    expect(((await a('GET', '/api/kv/careers')).body as { meta: { name: string } }[])[0].meta.name).toBe('Minha carreira');
    // uma carreira grande (~2,5 MB) volta igual
    const big = Buffer.alloc(2_500_000, 7);
    await a('PUT', '/api/kv/universes/u1', { body: big, meta: { id: 'u1' } });
    expect(Buffer.compare((await a("GET", "/api/kv/universes/u1")).body as Uint8Array, big as Uint8Array)).toBe(0);
    // outra conta não enxerga
    const b = client(core);
    await b('POST', '/api/auth/register', { json: { name: 'Bia', email: 'bia@exemplo.com', password: 'senhaforte1' } });
    expect((await b('GET', '/api/kv/careers/c1')).status).toBe(404);
    expect((await b('GET', '/api/kv/careers')).body).toEqual([]);
    // sem login: recusado
    expect((await client(core)('GET', '/api/kv/careers')).status).toBe(401);
    // estoura a cota de 3 MB (já há ~2,5 MB guardados)
    expect((await a('PUT', '/api/kv/careers/c2', { body: Buffer.alloc(900_000, 1), meta: { id: 'c2' } })).status).toBe(413);
  });

  test('troca de senha encerra outras sessões; exclusão apaga conta e salvamentos', async () => {
    const { core } = makeCore();
    const a = client(core);
    const other = client(core);
    await a('POST', '/api/auth/register', { json: { name: 'Caio', email: 'caio@exemplo.com', password: 'senha12345' } });
    await other('POST', '/api/auth/login', { json: { email: 'caio@exemplo.com', password: 'senha12345' } });
    expect((await a('POST', '/api/auth/password', { json: { current: 'errada', password: 'nova123456' } })).status).toBe(401);
    expect((await a('POST', '/api/auth/password', { json: { current: 'senha12345', password: 'nova123456' } })).status).toBe(200);
    expect((await a('GET', '/api/auth/me')).status).toBe(200);
    expect(((await other('GET', '/api/auth/me')).body as { user: unknown }).user).toBeNull(); // sessão encerrada
    await a('PUT', '/api/kv/careers/x', { body: Buffer.from('dados'), meta: {} });
    expect((await a('DELETE', '/api/auth/account', { json: { password: 'errada' } })).status).toBe(401);
    expect((await a('DELETE', '/api/auth/account', { json: { password: 'nova123456' } })).status).toBe(200);
    expect((await client(core)('POST', '/api/auth/login', { json: { email: 'caio@exemplo.com', password: 'nova123456' } })).status).toBe(401);
    // o e-mail volta a ficar livre após a exclusão
    expect((await client(core)('POST', '/api/auth/register', { json: { email: 'caio@exemplo.com', password: 'outra98765' } })).status).toBe(201);
  });
});
