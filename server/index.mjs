// Servidor do Football Manager BR: serve o jogo (pasta dist/) e oferece contas por e-mail e salvamentos na nuvem.
// Requisitos: Node.js 22.13+ (usa node:sqlite, embutido). Configuração por variáveis de ambiente (veja server/README.md).
// A lógica de contas/salvamentos fica em server/core.mjs (compartilhada com a função da Netlify); aqui ficam
// o store sobre SQLite, o servidor HTTP e a entrega dos arquivos do jogo.
import { createServer as createHttpServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { sendMail, mailConfigured } from './mail.mjs';
import { createCore } from './core.mjs';

// carregado via require para funcionar também dentro do executor de testes (Vite não conhece node:sqlite)
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const now = () => Date.now();

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

/** Limitador simples em memória (por chave), suficiente para uma instância. */
function makeLimiter() {
  const hits = new Map();
  return (key, max, windowMs) => {
    const t = now();
    const arr = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    arr.push(t);
    hits.set(key, arr);
    if (hits.size > 50_000) hits.clear();
    return arr.length <= max;
  };
}

/** Store sobre SQLite, no formato que o núcleo espera. */
export function sqliteStore(db) {
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
  const limit = makeLimiter();
  return {
    userByEmail: (email) => q.userByEmail.get(email),
    userById: (id) => q.userById.get(id),
    createUser(email, name, pass, verified, created) {
      if (q.userByEmail.get(email)) return null;
      const info = q.insertUser.run(email, name, pass, verified, created);
      return q.userById.get(Number(info.lastInsertRowid));
    },
    setPass: (id, pass) => void q.setPass.run(pass, id),
    setVerified: (id) => void q.setVerified.run(id),
    deleteUser: (id) => void q.deleteUser.run(id),
    createSession: (tokenHash, userId, expires) => void q.insertSession.run(tokenHash, userId, expires),
    getSession: (tokenHash, t) => q.session.get(tokenHash, t),
    deleteSession: (tokenHash) => void q.deleteSession.run(tokenHash),
    deleteOtherSessions: (userId, keep) => void q.deleteUserSessions.run(userId, keep),
    purgeSessions: (t) => void q.purge.run(t),
    createToken: (tokenHash, userId, kind, expires) => void q.insertToken.run(tokenHash, userId, kind, expires),
    getToken: (tokenHash, kind, t) => q.token.get(tokenHash, kind, t),
    deleteToken: (tokenHash) => void q.deleteToken.run(tokenHash),
    deleteTokensOfKind: (userId, kind) => void q.deleteTokens.run(userId, kind),
    kvList: (userId, store) => q.kvList.all(userId, store),
    kvGet: (userId, store, id) => q.kvGet.get(userId, store, id),
    kvPut: (userId, store, id, meta, payload, compressed, size, updated) => void q.kvPut.run(userId, store, id, meta, payload, compressed, size, updated),
    kvDel: (userId, store, id) => void q.kvDel.run(userId, store, id),
    kvUsage: (userId) => Number(q.kvUsage.get(userId).used),
    rate: (key, max, windowMs) => limit(key, max, windowMs),
  };
}

// ───────────────────────── arquivos estáticos e HTTP ─────────────────────────

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.js.map': 'application/json' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https://upload.wikimedia.org; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

function parseCookies(header) {
  const out = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
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

export function createApp(cfg = loadConfig(), db = openDb(cfg.dataDir), mailer = sendMail) {
  const core = createCore({ cfg, store: sqliteStore(db), mailer, mailConfigured });
  const clientIp = (req) => (cfg.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '') || req.socket.remoteAddress || '?';

  async function serveApi(req, res, url) {
    const body = req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : await readBody(req, cfg.maxRecordMb * 1024 * 1024);
    const r = await core.handle({
      method: req.method,
      path: url.pathname,
      query: url.searchParams,
      headers: req.headers,
      cookies: parseCookies(req.headers.cookie),
      body,
      ip: clientIp(req),
    });
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...r.headers };
    if (!headers['Content-Type']) headers['Content-Type'] = !r.text && r.body && typeof r.body === 'object' && !Buffer.isBuffer(r.body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8';
    if (r.cookie) headers['Set-Cookie'] = `fmbr_sid=${encodeURIComponent(r.cookie.value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${r.cookie.maxAge}${cfg.cookieSecure ? '; Secure' : ''}`;
    const data = r.body === undefined || r.body === '' ? '' : Buffer.isBuffer(r.body) || typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    res.writeHead(r.status, headers);
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  async function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(cfg.distDir, rel));
    if (!file.startsWith(cfg.distDir)) return send(res, 403, 'Acesso negado.');
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
  const send = (res, status, msg) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(msg); };

  return async function handler(req, res) {
    const url = new URL(req.url ?? '/', 'http://local');
    try {
      if (url.pathname.startsWith('/api/')) return await serveApi(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Método não permitido.');
      return await serveStatic(req, res, url);
    } catch (e) {
      const status = e.status ?? 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) send(res, status, status === 500 ? 'Erro interno. Tente novamente.' : e.message);
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
