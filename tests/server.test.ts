import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error módulo JavaScript do servidor (sem tipos)
import { createApp, loadConfig, openDb } from '../server/index.mjs';
import { remoteKV } from '../src/engine/save/remote';
import { SaveManager } from '../src/engine/save/storage';
import { career } from './helpers';

let server: Server;
let base = '';
let dir = '';
const mails: { to: string; subject: string; text: string }[] = [];
const realFetch = globalThis.fetch;

/** Cliente com "pote" de cookies (como um navegador). */
function client() {
  let cookie = '';
  return async (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const headers: Record<string, string> = { 'X-Requested-With': 'fmbr', ...(init.headers as Record<string, string>) };
    if (cookie) headers.cookie = cookie;
    if (init.json !== undefined) headers['Content-Type'] = 'application/json';
    const r = await realFetch(base + path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, redirect: 'manual' });
    const set = r.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    return r;
  };
}
const linkToken = (text: string, key: string) => new RegExp(`${key}=([\\w-]+)`).exec(text)?.[1] ?? '';

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'fmbr-srv-'));
  const cfg = { ...loadConfig({ DATA_DIR: dir, BASE_URL: 'http://localhost:9', QUOTA_MB: '30' }), distDir: join(dir, 'dist') };
  const app = createApp(cfg, openDb(dir), async (_cfg: unknown, m: { to: string; subject: string; text: string }) => { mails.push(m); });
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('Contas por e-mail', () => {
  test('cadastro, sessão, saída e login com senha', async () => {
    const a = client();
    const r = await a('/api/auth/register', { method: 'POST', json: { name: 'Ana', email: 'Ana@Exemplo.com', password: 'segredo123' } });
    expect(r.status).toBe(201);
    expect((await r.json()).user.email).toBe('ana@exemplo.com');
    expect(mails.at(-1)!.subject).toMatch(/confirme/);
    expect((await (await a('/api/auth/me')).json()).user.name).toBe('Ana');
    expect((await a('/api/auth/register', { method: 'POST', json: { email: 'ana@exemplo.com', password: 'outrasenha1' } })).status).toBe(409);
    await a('/api/auth/logout', { method: 'POST', json: {} });
    expect((await (await a('/api/auth/me')).json()).user).toBeNull();
    expect((await a('/api/auth/login', { method: 'POST', json: { email: 'ana@exemplo.com', password: 'errada000' } })).status).toBe(401);
    expect((await a('/api/auth/login', { method: 'POST', json: { email: 'ana@exemplo.com', password: 'segredo123' } })).status).toBe(200);
    expect((await a('/api/auth/me')).status).toBe(200);
  });

  test('validações: e-mail inválido, senha curta e proteção contra CSRF', async () => {
    const a = client();
    expect((await a('/api/auth/register', { method: 'POST', json: { email: 'sem-arroba', password: 'segredo123' } })).status).toBe(400);
    expect((await a('/api/auth/register', { method: 'POST', json: { email: 'b@b.com', password: '123' } })).status).toBe(400);
    const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ana@exemplo.com', password: 'segredo123' }) });
    expect(r.status).toBe(403); // sem o cabeçalho do aplicativo
  });

  test('confirmação de e-mail e redefinição de senha por link', async () => {
    const a = client();
    await a('/api/auth/register', { method: 'POST', json: { name: 'Bia', email: 'bia@exemplo.com', password: 'senhaforte1' } });
    const vtok = linkToken(mails.at(-1)!.text, 'token');
    const v = await a(`/api/auth/verify?token=${vtok}`);
    expect(v.status).toBe(302);
    expect(v.headers.get('location')).toBe('/?verificado=1');
    expect((await (await a('/api/auth/me')).json()).user.verified).toBe(true);
    // link reutilizado não vale
    expect((await a(`/api/auth/verify?token=${vtok}`)).headers.get('location')).toBe('/?verificado=0');
    const b = client();
    expect((await b('/api/auth/forgot', { method: 'POST', json: { email: 'bia@exemplo.com' } })).status).toBe(200);
    expect((await b('/api/auth/forgot', { method: 'POST', json: { email: 'ninguem@exemplo.com' } })).status).toBe(200); // não revela contas
    const rtok = linkToken(mails.filter((m) => m.to === 'bia@exemplo.com').at(-1)!.text, 'redefinir');
    expect((await b('/api/auth/reset', { method: 'POST', json: { token: rtok, password: 'novasenha9' } })).status).toBe(200);
    expect((await b('/api/auth/reset', { method: 'POST', json: { token: rtok, password: 'outra12345' } })).status).toBe(400);
    expect((await client()('/api/auth/login', { method: 'POST', json: { email: 'bia@exemplo.com', password: 'novasenha9' } })).status).toBe(200);
    expect((await client()('/api/auth/login', { method: 'POST', json: { email: 'bia@exemplo.com', password: 'senhaforte1' } })).status).toBe(401);
  });

  test('salvamentos isolados por conta, com cópia de segurança e cota', async () => {
    const a = client();
    await a('/api/auth/login', { method: 'POST', json: { email: 'ana@exemplo.com', password: 'segredo123' } });
    const meta = Buffer.from(JSON.stringify({ id: 'c1', name: 'Minha carreira' })).toString('base64');
    const put = (body: string) => a('/api/kv/careers/c1', { method: 'PUT', body, headers: { 'Content-Type': 'application/octet-stream', 'X-Meta': meta, 'X-Compressed': '0' } });
    expect((await put('versao-1')).status).toBe(200);
    expect((await put('versao-2')).status).toBe(200);
    expect(await (await a('/api/kv/careers/c1')).text()).toBe('versao-2');
    expect(await (await a('/api/kv/backups/c1')).text()).toBe('versao-1');
    expect((await (await a('/api/kv/careers')).json())[0].meta.name).toBe('Minha carreira');
    // outra conta não enxerga
    const b = client();
    await b('/api/auth/login', { method: 'POST', json: { email: 'bia@exemplo.com', password: 'novasenha9' } });
    expect((await b('/api/kv/careers/c1')).status).toBe(404);
    expect(await (await b('/api/kv/careers')).json()).toEqual([]);
    // sem login: recusado
    expect((await client()('/api/kv/careers')).status).toBe(401);
    // cota de 30 MB
    const big = 'x'.repeat(31 * 1024 * 1024);
    expect((await a('/api/kv/universes/u1', { method: 'PUT', body: big, headers: { 'X-Meta': meta, 'X-Compressed': '0' } })).status).toBe(413);
  });

  test('carreira real salva e carregada pela conta (SaveManager + servidor)', async () => {
    const a = client();
    await a('/api/auth/login', { method: 'POST', json: { email: 'ana@exemplo.com', password: 'segredo123' } });
    // o armazenamento remoto usa fetch relativo: aqui ele passa pelo cliente com cookies
    const orig = globalThis.fetch;
    globalThis.fetch = ((url: string, init: RequestInit = {}) => a(String(url), init)) as typeof fetch;
    try {
      const c = career('flamengo', 'conta-1');
      const sm = new SaveManager(remoteKV('/api/kv'));
      await sm.saveCareer(c);
      c.saveName = 'Segunda gravação';
      await sm.saveCareer(c);
      const list = await sm.listCareers();
      console.log(`tamanho do salvamento comprimido: ${(list[0].bytes / 1e6).toFixed(1)} MB`);
      expect(list.find((x) => x.id === 'conta-1')?.name).toBe('Segunda gravação');
      const { career: back } = await sm.loadCareer('conta-1');
      expect(back.userClubId).toBe('flamengo');
      expect(Object.keys(back.players).length).toBe(Object.keys(c.players).length);
      await sm.deleteCareer('conta-1');
      expect((await sm.listCareers()).some((x) => x.id === 'conta-1')).toBe(false);
    } finally {
      globalThis.fetch = orig;
    }
  }, 60_000);

  test('carreira grande é dividida em pedaços e carregada íntegra (cópia de segurança e exclusão)', async () => {
    const a = client();
    await a('/api/auth/login', { method: 'POST', json: { email: 'ana@exemplo.com', password: 'segredo123' } });
    const orig = globalThis.fetch;
    globalThis.fetch = ((u: string, init: RequestInit = {}) => a(String(u), init)) as typeof fetch;
    try {
      const c = career('flamengo', 'grande-1');
      const sm = new SaveManager(remoteKV('/api/kv', 1024 * 1024)); // pedaços de 1 MB forçam a divisão
      await sm.saveCareer(c);
      c.saveName = 'v2';
      await sm.saveCareer(c); // segunda gravação gera cópia de segurança com partes
      const list = await sm.listCareers();
      expect(list.filter((x) => x.id.includes('.part'))).toHaveLength(0); // partes não aparecem na lista
      expect(list.find((x) => x.id === 'grande-1')?.name).toBe('v2');
      const { career: back } = await sm.loadCareer('grande-1');
      expect(back.userClubId).toBe('flamengo');
      expect(Object.keys(back.players).length).toBe(Object.keys(c.players).length);
      // a cópia de segurança (também em pedaços) carrega íntegra
      const backup = await remoteKV('/api/kv').get('backups', 'grande-1');
      expect(backup).toBeTruthy();
      await sm.deleteCareer('grande-1');
      const kv = remoteKV('/api/kv');
      expect(await kv.get('careers', 'grande-1')).toBeUndefined();
      expect(await kv.get('careers', 'grande-1.part1')).toBeUndefined();
      expect(await kv.get('backups', 'grande-1.part1')).toBeUndefined();
    } finally {
      globalThis.fetch = orig;
    }
  }, 60_000);

  test('troca de senha encerra outras sessões; exclusão apaga conta e salvamentos', async () => {
    const a = client();
    const other = client();
    await a('/api/auth/register', { method: 'POST', json: { name: 'Caio', email: 'caio@exemplo.com', password: 'senha12345' } });
    await other('/api/auth/login', { method: 'POST', json: { email: 'caio@exemplo.com', password: 'senha12345' } });
    expect((await a('/api/auth/password', { method: 'POST', json: { current: 'errada', password: 'nova123456' } })).status).toBe(401);
    expect((await a('/api/auth/password', { method: 'POST', json: { current: 'senha12345', password: 'nova123456' } })).status).toBe(200);
    expect((await a('/api/auth/me')).status).toBe(200);
    expect((await (await other('/api/auth/me')).json()).user).toBeNull();
    await a('/api/kv/careers/x', { method: 'PUT', body: 'dados', headers: { 'X-Meta': Buffer.from('{}').toString('base64') } });
    expect((await a('/api/auth/account', { method: 'DELETE', json: { password: 'errada' } })).status).toBe(401);
    expect((await a('/api/auth/account', { method: 'DELETE', json: { password: 'nova123456' } })).status).toBe(200);
    expect((await client()('/api/auth/login', { method: 'POST', json: { email: 'caio@exemplo.com', password: 'nova123456' } })).status).toBe(401);
  });

  test('limite de tentativas de login', async () => {
    const a = client();
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await a('/api/auth/login', { method: 'POST', json: { email: 'ana@exemplo.com', password: `errada${i}x` } })).status;
    expect(last).toBe(429);
  });
});
