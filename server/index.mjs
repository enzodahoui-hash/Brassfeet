// Servidor do Football Manager BR: serve o jogo (pasta dist/) e oferece contas por e-mail e salvamentos na nuvem.
// Requisitos: Node.js 22.13+ (usa node:sqlite, embutido). Configuração por variáveis de ambiente (veja server/README.md).
import { createServer as createHttpServer } from 'node:http';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { sendMail, mailConfigured } from './mail.mjs';

const scrypt = promisify(scryptCb);
// carregado via require para funcionar também dentro do executor de testes (Vite não conhece node:sqlite)
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function loadConfig(env = process.env) {
  const baseUrl = (env.BASE_URL ?? `http://localhost:${env.PORT ?? 8080}`).replace(/\/$/, '');
  return {
    port: Number(env.PORT ?? 8080),
    host: env.HOST ?? '0.0.0.0',
    dataDir: resolve(env.DATA_DIR ?? join(ROOT, 'data')),
    distDir: resolve(env.DIST_DIR ?? join(ROOT, 'dist')),
    baseUrl,
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === '1' : baseUrl.startsWith('https://'),
    requireVerification: env.REQUIRE_EMAIL_VERIFICATION === '1',
    sessionDays: Number(env.SESSION_DAYS ?? 30),
    quotaMb: Number(env.QUOTA_MB ?? 300),
    maxRecordMb: Number(env.MAX_SAVE_MB ?? 40),
    trustProxy: env.TRUST_PROXY === '1',
    appName: env.APP_NAME ?? 'Football Manager BR',
  };
}

// ───────────────────────── banco de dados ─────────────────────────

export function openDb(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'fmbr.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      pass TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      store TEXT NOT NULL,
      id TEXT NOT NULL,
      meta TEXT NOT NULL,
      payload BLOB NOT NULL,
      compressed INTEGER NOT NULL,
      size INTEGER NOT NULL,
      updated INTEGER NOT NULL,
      PRIMARY KEY (user_id, store, id)
    );
  `);
  return db;
}

// ───────────────────────── utilidades ─────────────────────────

const sha = (s) => createHash('sha256').update(s).digest('hex');
const now = () => Date.now();
const STORES = new Set(['careers', 'backups', 'universes']);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
async function checkPassword(pw, stored) {
  const [, saltHex, keyHex] = (stored ?? 'scrypt$00$00').split('$');
  const key = await scrypt(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const ref = Buffer.from(keyHex, 'hex');
  return ref.length === key.length && timingSafeEqual(ref, key);
}
const DUMMY_HASH = 'scrypt$' + '00'.repeat(16) + '$' + '00'.repeat(64);

function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
const fail = (res, status, msg) => send(res, status, { error: msg });

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const ch of req) {
    size += ch.length;
    if (size > limit) throw Object.assign(new Error('Arquivo grande demais.'), { status: 413 });
    chunks.push(ch);
  }
  return Buffer.concat(chunks);
}
async function readJson(req) {
  const buf = await readBody(req, 64 * 1024);
  try {
    return JSON.parse(buf.toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('Requisição inválida.'), { status: 400 });
  }
}
function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Limitador simples em memória (por chave), suficiente para uma instância. */
function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const arr = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    arr.push(t);
    hits.set(key, arr);
    if (hits.size > 50_000) hits.clear();
    return arr.length <= max;
  };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https://upload.wikimedia.org; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

// ───────────────────────── aplicação ─────────────────────────

export function createApp(cfg = loadConfig(), db = openDb(cfg.dataDir), mailer = sendMail) {
  const loginLimit = limiter(10, 15 * 60_000);
  const mailLimit = limiter(5, 60 * 60_000);
  const registerLimit = limiter(20, 60 * 60_000);
  const q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (email, name, pass, verified, created) VALUES (?, ?, ?, ?, ?)'),
    setPass: db.prepare('UPDATE users SET pass = ? WHERE id = ?'),
    setVerified: db.prepare('UPDATE users SET verified = 1 WHERE id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)'),
    session: db.prepare('SELECT * FROM sessions WHERE token = ? AND expires > ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?'),
    purge: db.prepare('DELETE FROM sessions WHERE expires < ?'),
    insertToken: db.prepare('INSERT INTO tokens (token, user_id, kind, expires) VALUES (?, ?, ?, ?)'),
    token: db.prepare('SELECT * FROM tokens WHERE token = ? AND kind = ? AND expires > ?'),
    deleteToken: db.prepare('DELETE FROM tokens WHERE token = ?'),
    deleteTokens: db.prepare('DELETE FROM tokens WHERE user_id = ? AND kind = ?'),
    kvList: db.prepare('SELECT id, meta, compressed, size, updated FROM kv WHERE user_id = ? AND store = ? ORDER BY updated DESC'),
    kvGet: db.prepare('SELECT * FROM kv WHERE user_id = ? AND store = ? AND id = ?'),
    kvPut: db.prepare('INSERT INTO kv (user_id, store, id, meta, payload, compressed, size, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, store, id) DO UPDATE SET meta = excluded.meta, payload = excluded.payload, compressed = excluded.compressed, size = excluded.size, updated = excluded.updated'),
    kvDel: db.prepare('DELETE FROM kv WHERE user_id = ? AND store = ? AND id = ?'),
    kvUsage: db.prepare('SELECT COALESCE(SUM(size), 0) AS used FROM kv WHERE user_id = ?'),
  };
  const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, verified: !!u.verified, created: u.created });

  function newSession(res, userId) {
    const token = randomBytes(32).toString('base64url');
    q.insertSession.run(sha(token), userId, now() + cfg.sessionDays * 86_400_000);
    setCookie(res, token, cfg.sessionDays * 86_400);
    return token;
  }
  function setCookie(res, value, maxAge) {
    res.setHeader('Set-Cookie', `fmbr_sid=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${cfg.cookieSecure ? '; Secure' : ''}`);
  }
  function currentUser(req) {
    const tok = cookies(req).fmbr_sid;
    if (!tok) return null;
    const s = q.session.get(sha(tok), now());
    if (!s) return null;
    const u = q.userById.get(s.user_id);
    return u ? { ...u, sid: sha(tok) } : null;
  }
  async function issueToken(user, kind, hours) {
    const token = randomBytes(32).toString('base64url');
    q.deleteTokens.run(user.id, kind);
    q.insertToken.run(sha(token), user.id, kind, now() + hours * 3_600_000);
    return token;
  }
  async function mailVerification(user) {
    const token = await issueToken(user, 'verify', 48);
    const link = `${cfg.baseUrl}/api/auth/verify?token=${token}`;
    await mailer(cfg, { to: user.email, subject: `${cfg.appName}: confirme seu e-mail`, text: `Olá, ${user.name}!\n\nConfirme seu e-mail para proteger sua conta e seus salvamentos:\n${link}\n\nO link vale por 48 horas. Se você não criou esta conta, ignore esta mensagem.` });
  }
  const ip = (req) => (cfg.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '') || req.socket.remoteAddress || '?';

  // ───── rotas da API ─────
  async function api(req, res, url) {
    const path = url.pathname;
    const method = req.method ?? 'GET';
    // proteção contra CSRF: requisições que alteram dados precisam do cabeçalho do aplicativo
    if (method !== 'GET' && method !== 'HEAD' && req.headers['x-requested-with'] !== 'fmbr') return fail(res, 403, 'Requisição recusada.');

    if (path === '/api/health') return send(res, 200, { ok: true, mail: mailConfigured(), verification: cfg.requireVerification });

    if (path === '/api/auth/register' && method === 'POST') {
      if (!registerLimit(ip(req))) return fail(res, 429, 'Muitas contas criadas a partir desta rede. Tente mais tarde.');
      const b = await readJson(req);
      const email = String(b.email ?? '').trim().toLowerCase();
      const name = String(b.name ?? '').trim().slice(0, 60) || email.split('@')[0];
      const password = String(b.password ?? '');
      if (!EMAIL_RE.test(email)) return fail(res, 400, 'Informe um e-mail válido.');
      if (password.length < 8 || password.length > 200) return fail(res, 400, 'A senha precisa ter pelo menos 8 caracteres.');
      if (q.userByEmail.get(email)) return fail(res, 409, 'Já existe uma conta com este e-mail. Entre ou use "Esqueci a senha".');
      const info = q.insertUser.run(email, name, await hashPassword(password), 0, now());
      const user = q.userById.get(Number(info.lastInsertRowid));
      try {
        await mailVerification(user);
      } catch (e) {
        console.error('[e-mail] falha ao enviar verificação:', e.message);
      }
      if (cfg.requireVerification) return send(res, 201, { user: publicUser(user), needsVerification: true });
      newSession(res, user.id);
      return send(res, 201, { user: publicUser(user) });
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const b = await readJson(req);
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!loginLimit(`${ip(req)}|${email}`)) return fail(res, 429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
      const user = q.userByEmail.get(email);
      const ok = await checkPassword(String(b.password ?? ''), user?.pass ?? DUMMY_HASH);
      if (!user || !ok) return fail(res, 401, 'E-mail ou senha incorretos.');
      if (cfg.requireVerification && !user.verified) return fail(res, 403, 'Confirme seu e-mail antes de entrar. Enviamos um link na criação da conta.');
      newSession(res, user.id);
      q.purge.run(now());
      return send(res, 200, { user: publicUser(user) });
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      const tok = cookies(req).fmbr_sid;
      if (tok) q.deleteSession.run(sha(tok));
      setCookie(res, '', 0);
      return send(res, 200, { ok: true });
    }

    if (path === '/api/auth/me' && method === 'GET') {
      const u = currentUser(req);
      return send(res, 200, { user: u ? publicUser(u) : null }); // sem sessão: user = null (não é erro)
    }

    if (path === '/api/auth/forgot' && method === 'POST') {
      const b = await readJson(req);
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!mailLimit(`${ip(req)}|${email}`)) return fail(res, 429, 'Muitos pedidos. Tente mais tarde.');
      const user = q.userByEmail.get(email);
      if (user) {
        const token = await issueToken(user, 'reset', 1);
        const link = `${cfg.baseUrl}/?redefinir=${token}`;
        try {
          await mailer(cfg, { to: user.email, subject: `${cfg.appName}: redefinição de senha`, text: `Olá, ${user.name}!\n\nPara criar uma nova senha, abra:\n${link}\n\nO link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore esta mensagem; sua senha atual continua valendo.` });
        } catch (e) {
          console.error('[e-mail] falha ao enviar redefinição:', e.message);
        }
      }
      // mesma resposta exista ou não a conta (não revela quais e-mails estão cadastrados)
      return send(res, 200, { ok: true });
    }

    if (path === '/api/auth/reset' && method === 'POST') {
      const b = await readJson(req);
      const password = String(b.password ?? '');
      if (password.length < 8 || password.length > 200) return fail(res, 400, 'A senha precisa ter pelo menos 8 caracteres.');
      const t = q.token.get(sha(String(b.token ?? '')), 'reset', now());
      if (!t) return fail(res, 400, 'Link inválido ou expirado. Peça um novo em "Esqueci a senha".');
      q.deleteToken.run(t.token);
      q.setPass.run(await hashPassword(password), t.user_id);
      q.setVerified.run(t.user_id); // quem recebeu o e-mail comprovou o endereço
      q.deleteUserSessions.run(t.user_id, '');
      newSession(res, t.user_id);
      return send(res, 200, { user: publicUser(q.userById.get(t.user_id)) });
    }

    if (path === '/api/auth/verify' && method === 'GET') {
      const t = q.token.get(sha(url.searchParams.get('token') ?? ''), 'verify', now());
      if (!t) return send(res, 302, '', { Location: '/?verificado=0' });
      q.deleteToken.run(t.token);
      q.setVerified.run(t.user_id);
      return send(res, 302, '', { Location: '/?verificado=1' });
    }

    // a partir daqui, só usuários conectados
    const user = currentUser(req);
    if (!user) return fail(res, 401, 'Entre na sua conta para continuar.');

    if (path === '/api/auth/resend' && method === 'POST') {
      if (user.verified) return send(res, 200, { ok: true });
      if (!mailLimit(`resend|${user.id}`)) return fail(res, 429, 'Muitos pedidos. Tente mais tarde.');
      await mailVerification(user);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/auth/password' && method === 'POST') {
      const b = await readJson(req);
      if (!(await checkPassword(String(b.current ?? ''), user.pass))) return fail(res, 401, 'Senha atual incorreta.');
      const pw = String(b.password ?? '');
      if (pw.length < 8 || pw.length > 200) return fail(res, 400, 'A nova senha precisa ter pelo menos 8 caracteres.');
      q.setPass.run(await hashPassword(pw), user.id);
      q.deleteUserSessions.run(user.id, user.sid); // encerra as outras sessões
      return send(res, 200, { ok: true });
    }
    if (path === '/api/auth/account' && method === 'DELETE') {
      const b = await readJson(req);
      if (!(await checkPassword(String(b.password ?? ''), user.pass))) return fail(res, 401, 'Senha incorreta.');
      q.deleteUser.run(user.id); // sessões, tokens e salvamentos saem junto (ON DELETE CASCADE)
      setCookie(res, '', 0);
      return send(res, 200, { ok: true });
    }
    if (path === '/api/usage' && method === 'GET') {
      return send(res, 200, { used: Number(q.kvUsage.get(user.id).used), quota: cfg.quotaMb * 1024 * 1024 });
    }

    const m = path.match(/^\/api\/kv\/([a-z]+)(?:\/([\w.-]{1,120}))?$/);
    if (m && STORES.has(m[1])) {
      const [, store, id] = m;
      if (!id && method === 'GET') {
        const rows = q.kvList.all(user.id, store).map((r) => ({ id: r.id, meta: JSON.parse(r.meta), compressed: !!r.compressed, size: r.size, updated: r.updated }));
        return send(res, 200, rows);
      }
      if (id && method === 'GET') {
        const r = q.kvGet.get(user.id, store, id);
        if (!r) return fail(res, 404, 'Salvamento não encontrado.');
        return send(res, 200, Buffer.from(r.payload), { 'Content-Type': 'application/octet-stream', 'X-Meta': Buffer.from(r.meta).toString('base64'), 'X-Compressed': r.compressed ? '1' : '0' });
      }
      if (id && method === 'PUT') {
        const payload = await readBody(req, cfg.maxRecordMb * 1024 * 1024);
        let meta;
        try {
          meta = JSON.parse(Buffer.from(String(req.headers['x-meta'] ?? ''), 'base64').toString('utf8'));
        } catch {
          return fail(res, 400, 'Metadados inválidos.');
        }
        const prev = q.kvGet.get(user.id, store, id);
        const used = Number(q.kvUsage.get(user.id).used) - (prev?.size ?? 0) + payload.length;
        if (used > cfg.quotaMb * 1024 * 1024) return fail(res, 413, `Espaço da conta esgotado (${cfg.quotaMb} MB). Exclua salvamentos antigos.`);
        // cópia de segurança automática da versão anterior de cada carreira
        if (store === 'careers' && prev) q.kvPut.run(user.id, 'backups', id, prev.meta, prev.payload, prev.compressed, prev.size, now());
        q.kvPut.run(user.id, store, id, JSON.stringify(meta), payload, req.headers['x-compressed'] === '1' ? 1 : 0, payload.length, now());
        return send(res, 200, { ok: true });
      }
      if (id && method === 'DELETE') {
        q.kvDel.run(user.id, store, id);
        if (store === 'careers') q.kvDel.run(user.id, 'backups', id);
        return send(res, 200, { ok: true });
      }
    }
    return fail(res, 404, 'Rota não encontrada.');
  }

  // ───── arquivos estáticos (o jogo) ─────
  async function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(cfg.distDir, rel));
    if (!file.startsWith(cfg.distDir)) return fail(res, 403, 'Acesso negado.');
    let target = file;
    let st = await stat(target).catch(() => null);
    if (!st || !st.isFile()) {
      // rotas do aplicativo caem no index.html (SPA)
      target = join(cfg.distDir, 'index.html');
      st = await stat(target).catch(() => null);
      if (!st) return send(res, 503, 'O jogo ainda não foi compilado. Rode "npm run build".');
    }
    const body = await readFile(target);
    const immutable = target.includes(`${join(cfg.distDir, 'assets')}`);
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] ?? 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', ...SECURITY_HEADERS });
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  return async function handler(req, res) {
    const url = new URL(req.url ?? '/', 'http://local');
    try {
      if (url.pathname.startsWith('/api/')) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return await api(req, res, url);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Método não permitido.');
      return await serveStatic(req, res, url);
    } catch (e) {
      const status = e.status ?? 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) fail(res, status, status === 500 ? 'Erro interno. Tente novamente.' : e.message);
    }
  };
}

export function start(cfg = loadConfig()) {
  if (!existsSync(cfg.distDir)) console.warn(`[aviso] pasta ${cfg.distDir} não encontrada: rode "npm run build" antes.`);
  const server = createHttpServer(createApp(cfg));
  server.listen(cfg.port, cfg.host, () => {
    console.log(`${cfg.appName} no ar em ${cfg.baseUrl} (porta ${cfg.port}).`);
    console.log(`Banco de dados: ${join(cfg.dataDir, 'fmbr.sqlite')} · e-mail: ${mailConfigured() ? 'SMTP configurado' : 'modo de teste (links aparecem neste log)'}`);
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start();
