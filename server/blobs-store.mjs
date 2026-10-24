// Store sobre Netlify Blobs, no mesmo formato que server/core.mjs espera.
// Guarda contas, sessões, tokens e salvamentos em "stores" de Blobs (chave → valor), com consistência forte.
// `getStore` é injetável para os testes (um falso em memória); em produção vem de @netlify/blobs.
import { createHash, randomBytes } from 'node:crypto';

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const newId = () => randomBytes(9).toString('base64url');

// O Netlify Blobs às vezes falha de forma intermitente (throttle/instabilidade); repetir algumas
// vezes com uma pequena espera evita que um blip derrube login/salvamento.
async function retry(fn, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }
  throw last;
}
const OPS = ['get', 'set', 'setJSON', 'getMetadata', 'getWithMetadata', 'list', 'delete'];
function withRetry(s) {
  const out = {};
  for (const op of OPS) out[op] = (...a) => retry(() => s[op](...a));
  return out;
}

export function blobsStore({ getStore }) {
  const open = (name) => withRetry(getStore({ name, consistency: 'strong' }));
  const users = open('fmbr_users'); // id → {id,email,name,pass,verified,created}
  const emails = open('fmbr_emails'); // sha(email) → id
  const sessions = open('fmbr_sessions'); // tokenHash → {user_id,expires}
  const usess = open('fmbr_usessions'); // `${userId}/${tokenHash}` → '' (índice por usuário)
  const tokens = open('fmbr_tokens'); // tokenHash → {token,user_id,kind,expires}
  const utok = open('fmbr_utokens'); // `${userId}/${kind}/${tokenHash}` → '' (índice)
  const kv = open('fmbr_kv'); // `${userId}/${store}/${id}` → bytes, metadata {meta,compressed,size,updated}
  const rate = open('fmbr_rate'); // sha(chave) → [timestamps]

  const getJson = async (store, key) => {
    const v = await store.get(key, { type: 'json' });
    return v ?? undefined;
  };

  return {
    userByEmail: async (email) => {
      const id = await emails.get(sha(email));
      return id ? getJson(users, id) : undefined;
    },
    userById: (id) => (id ? getJson(users, id) : undefined),
    async createUser(email, name, pass, verified, created) {
      const id = newId();
      // garante e-mail único de forma atômica: só grava se a chave ainda não existir
      const r = await emails.set(sha(email), id, { onlyIfNew: true });
      if (!r.modified) return null;
      const user = { id, email, name, pass, verified: !!verified, created };
      await users.setJSON(id, user);
      return user;
    },
    async setPass(id, pass) {
      const u = await getJson(users, id);
      if (u) await users.setJSON(id, { ...u, pass });
    },
    async setVerified(id) {
      const u = await getJson(users, id);
      if (u) await users.setJSON(id, { ...u, verified: true });
    },
    async deleteUser(id) {
      const u = await getJson(users, id);
      if (!u) return;
      await emails.delete(sha(u.email));
      await users.delete(id);
      for (const b of (await usess.list({ prefix: `${id}/` })).blobs) {
        await sessions.delete(b.key.slice(b.key.indexOf('/') + 1));
        await usess.delete(b.key);
      }
      for (const b of (await utok.list({ prefix: `${id}/` })).blobs) {
        await tokens.delete(b.key.slice(b.key.lastIndexOf('/') + 1));
        await utok.delete(b.key);
      }
      for (const b of (await kv.list({ prefix: `${id}/` })).blobs) await kv.delete(b.key);
    },
    async createSession(tokenHash, userId, expires) {
      await sessions.setJSON(tokenHash, { user_id: userId, expires });
      await usess.set(`${userId}/${tokenHash}`, '');
    },
    async getSession(tokenHash, t) {
      const s = await getJson(sessions, tokenHash);
      if (!s || s.expires <= t) return undefined;
      return s;
    },
    async deleteSession(tokenHash) {
      const s = await getJson(sessions, tokenHash);
      await sessions.delete(tokenHash);
      if (s) await usess.delete(`${s.user_id}/${tokenHash}`);
    },
    async deleteOtherSessions(userId, keep) {
      for (const b of (await usess.list({ prefix: `${userId}/` })).blobs) {
        const th = b.key.slice(b.key.indexOf('/') + 1);
        if (th === keep) continue;
        await sessions.delete(th);
        await usess.delete(b.key);
      }
    },
    purgeSessions: async () => {}, // sessões expiradas são ignoradas na leitura; não há varredura
    async createToken(tokenHash, userId, kind, expires) {
      await tokens.setJSON(tokenHash, { token: tokenHash, user_id: userId, kind, expires });
      await utok.set(`${userId}/${kind}/${tokenHash}`, '');
    },
    async getToken(tokenHash, kind, t) {
      const tk = await getJson(tokens, tokenHash);
      if (!tk || tk.kind !== kind || tk.expires <= t) return undefined;
      return tk;
    },
    async deleteToken(tokenHash) {
      const tk = await getJson(tokens, tokenHash);
      await tokens.delete(tokenHash);
      if (tk) await utok.delete(`${tk.user_id}/${tk.kind}/${tokenHash}`);
    },
    async deleteTokensOfKind(userId, kind) {
      for (const b of (await utok.list({ prefix: `${userId}/${kind}/` })).blobs) {
        await tokens.delete(b.key.slice(b.key.lastIndexOf('/') + 1));
        await utok.delete(b.key);
      }
    },
    async kvList(userId, store) {
      const rows = [];
      for (const b of (await kv.list({ prefix: `${userId}/${store}/` })).blobs) {
        const md = await kv.getMetadata(b.key);
        if (md) rows.push({ id: b.key.slice(b.key.lastIndexOf('/') + 1), ...md.metadata });
      }
      return rows.sort((a, z) => z.updated - a.updated);
    },
    async kvGet(userId, store, id) {
      const r = await kv.getWithMetadata(`${userId}/${store}/${id}`, { type: 'arrayBuffer' });
      if (!r) return undefined;
      return { meta: r.metadata.meta, payload: Buffer.from(r.data), compressed: r.metadata.compressed, size: r.metadata.size };
    },
    async kvPut(userId, store, id, meta, payload, compressed, size, updated) {
      const bytes = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
      await kv.set(`${userId}/${store}/${id}`, bytes, { metadata: { meta, compressed, size, updated } });
    },
    async kvDel(userId, store, id) {
      await kv.delete(`${userId}/${store}/${id}`);
    },
    async kvUsage(userId) {
      let used = 0;
      for (const b of (await kv.list({ prefix: `${userId}/` })).blobs) {
        const md = await kv.getMetadata(b.key);
        if (md) used += md.metadata.size ?? 0;
      }
      return used;
    },
    // limitador por janela: melhor esforço. Se o Blobs falhar aqui, libera (não derruba o login por causa do limitador).
    async rate(key, max, windowMs) {
      try {
        const k = sha(key);
        const t = Date.now();
        const arr = ((await getJson(rate, k)) ?? []).filter((x) => t - x < windowMs);
        arr.push(t);
        await rate.setJSON(k, arr);
        return arr.length <= max;
      } catch {
        return true;
      }
    },
  };
}
