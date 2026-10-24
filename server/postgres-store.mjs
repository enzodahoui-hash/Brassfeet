// Store sobre Postgres (ex.: Neon na Vercel), no mesmo formato que server/core.mjs espera.
// Espelha o sqliteStore (server/index.mjs). Payloads ficam como TEXT base64 para não
// depender da forma como o driver serializa BYTEA sobre HTTP.
import { randomBytes } from 'node:crypto';

const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY, email text UNIQUE NOT NULL, name text, pass text,
    verified int NOT NULL DEFAULT 0, created bigint NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (token text PRIMARY KEY, user_id text NOT NULL, expires bigint NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tokens (token text PRIMARY KEY, user_id text NOT NULL, kind text NOT NULL, expires bigint NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS kv (
    user_id text NOT NULL, store text NOT NULL, id text NOT NULL,
    meta text NOT NULL, payload text NOT NULL, compressed int NOT NULL DEFAULT 0,
    size bigint NOT NULL DEFAULT 0, updated bigint NOT NULL,
    PRIMARY KEY (user_id, store, id))`,
  `CREATE INDEX IF NOT EXISTS kv_user_store ON kv (user_id, store)`,
];

/** Limitador de taxa em memória (por instância — melhor esforço, igual ao SQLite). */
function makeLimiter() {
  const hits = new Map();
  return (key, max, windowMs) => {
    const t = Date.now();
    const arr = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    arr.push(t);
    hits.set(key, arr);
    if (hits.size > 50_000) hits.clear();
    return arr.length <= max;
  };
}

/**
 * `sql` é um cliente que expõe `query(text, params)` (ex.: o retorno de `neon()` do
 * @neondatabase/serverless). Cria as tabelas sob demanda (idempotente) no primeiro uso.
 */
export function postgresStore(sql) {
  let ready;
  const init = () => (ready ??= (async () => { for (const stmt of DDL) await sql.query(stmt); })());
  const rowsOf = (res) => (Array.isArray(res) ? res : res?.rows ?? []);
  const all = async (text, params) => { await init(); return rowsOf(await sql.query(text, params)); };
  const one = async (text, params) => (await all(text, params))[0];
  const run = async (text, params) => { await init(); await sql.query(text, params); };
  const limit = makeLimiter();
  const user = (r) => (r ? { ...r, verified: Number(r.verified), created: Number(r.created) } : r);

  return {
    userByEmail: async (email) => user(await one('SELECT * FROM users WHERE email = $1', [email])),
    userById: async (id) => user(await one('SELECT * FROM users WHERE id = $1', [id])),
    async createUser(email, name, pass, verified, created) {
      const id = randomBytes(12).toString('hex');
      const r = await one(
        'INSERT INTO users (id, email, name, pass, verified, created) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING RETURNING *',
        [id, email, name, pass, verified, created],
      );
      return r ? user(r) : null; // null = e-mail já cadastrado
    },
    setPass: (id, pass) => run('UPDATE users SET pass = $1 WHERE id = $2', [pass, id]),
    setVerified: (id) => run('UPDATE users SET verified = 1 WHERE id = $1', [id]),
    deleteUser: (id) => run('DELETE FROM users WHERE id = $1', [id]),

    createSession: (tokenHash, userId, expires) =>
      run('INSERT INTO sessions (token, user_id, expires) VALUES ($1,$2,$3) ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, expires = excluded.expires', [tokenHash, userId, expires]),
    getSession: (tokenHash, t) => one('SELECT * FROM sessions WHERE token = $1 AND expires > $2', [tokenHash, t]),
    deleteSession: (tokenHash) => run('DELETE FROM sessions WHERE token = $1', [tokenHash]),
    deleteOtherSessions: (userId, keep) => run('DELETE FROM sessions WHERE user_id = $1 AND token != $2', [userId, keep]),
    purgeSessions: (t) => run('DELETE FROM sessions WHERE expires < $1', [t]),

    createToken: (tokenHash, userId, kind, expires) =>
      run('INSERT INTO tokens (token, user_id, kind, expires) VALUES ($1,$2,$3,$4) ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, kind = excluded.kind, expires = excluded.expires', [tokenHash, userId, kind, expires]),
    getToken: (tokenHash, kind, t) => one('SELECT * FROM tokens WHERE token = $1 AND kind = $2 AND expires > $3', [tokenHash, kind, t]),
    deleteToken: (tokenHash) => run('DELETE FROM tokens WHERE token = $1', [tokenHash]),
    deleteTokensOfKind: (userId, kind) => run('DELETE FROM tokens WHERE user_id = $1 AND kind = $2', [userId, kind]),

    async kvList(userId, store) {
      const rows = await all('SELECT id, meta, compressed, size, updated FROM kv WHERE user_id = $1 AND store = $2 ORDER BY updated DESC', [userId, store]);
      return rows.map((r) => ({ id: r.id, meta: r.meta, compressed: Number(r.compressed), size: Number(r.size), updated: Number(r.updated) }));
    },
    async kvGet(userId, store, id) {
      const r = await one('SELECT * FROM kv WHERE user_id = $1 AND store = $2 AND id = $3', [userId, store, id]);
      if (!r) return undefined;
      return { user_id: r.user_id, store: r.store, id: r.id, meta: r.meta, payload: Buffer.from(r.payload, 'base64'), compressed: Number(r.compressed), size: Number(r.size), updated: Number(r.updated) };
    },
    kvPut: (userId, store, id, meta, payload, compressed, size, updated) =>
      run('INSERT INTO kv (user_id, store, id, meta, payload, compressed, size, updated) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id, store, id) DO UPDATE SET meta = excluded.meta, payload = excluded.payload, compressed = excluded.compressed, size = excluded.size, updated = excluded.updated',
        [userId, store, id, meta, Buffer.from(payload).toString('base64'), compressed, size, updated]),
    kvDel: (userId, store, id) => run('DELETE FROM kv WHERE user_id = $1 AND store = $2 AND id = $3', [userId, store, id]),
    async kvUsage(userId) {
      const r = await one('SELECT COALESCE(SUM(size), 0) AS used FROM kv WHERE user_id = $1', [userId]);
      return Number(r?.used ?? 0);
    },

    rate: (key, max, windowMs) => limit(key, max, windowMs),
  };
}
