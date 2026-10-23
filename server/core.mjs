// Núcleo das contas e salvamentos, independente de onde roda (servidor Node ou função da Netlify).
// Toda a lógica (senhas, sessões, CSRF, limite de tentativas, cota, e-mails) vive aqui e fala com
// um "store" abstrato. O servidor Node usa um store sobre SQLite; a Netlify usa um store sobre Blobs.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
export const sha = (s) => createHash('sha256').update(s).digest('hex');
const now = () => Date.now();
export const STORES = new Set(['careers', 'backups', 'universes']);
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const DUMMY_HASH = 'scrypt$' + '00'.repeat(16) + '$' + '00'.repeat(64);

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function checkPassword(pw, stored) {
  const [, saltHex, keyHex] = (stored ?? DUMMY_HASH).split('$');
  const key = await scrypt(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const ref = Buffer.from(keyHex, 'hex');
  return ref.length === key.length && timingSafeEqual(ref, key);
}

/** Erro com código HTTP, para respostas de API. */
export const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Descritores de resposta que os adaptadores (Node/Netlify) convertem para o formato real. */
const json = (status, body, headers = {}) => ({ status, body, headers });
const text = (status, body, headers = {}) => ({ status, body, headers, text: true });
const fail = (status, error) => ({ status, body: { error } });
const redirect = (location) => ({ status: 302, body: '', headers: { Location: location }, text: true });

/**
 * Monta o tratador da API. `store` implementa o armazenamento; `mailer(cfg, {to,subject,text})` envia e-mail;
 * `mailConfigured()` diz se há SMTP. Retorna `handle(reqLike)` → descritor de resposta.
 *
 * reqLike: { method, path, query (URLSearchParams), headers (minúsculas), cookies ({}), body (Buffer), ip }
 * resposta: { status, body, headers?, cookie?: {value, maxAge}, text?: bool }
 */
export function createCore({ cfg, store, mailer, mailConfigured = () => false }) {
  const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, verified: !!u.verified, created: u.created });
  const readJson = (body) => {
    try {
      return JSON.parse((body?.length ? body.toString('utf8') : '') || '{}');
    } catch {
      throw httpError(400, 'Requisição inválida.');
    }
  };
  const quotaBytes = cfg.quotaMb * 1024 * 1024;

  async function newSession(userId) {
    const token = randomBytes(32).toString('base64url');
    await store.createSession(sha(token), userId, now() + cfg.sessionDays * 86_400_000);
    return { value: token, maxAge: cfg.sessionDays * 86_400 };
  }
  async function currentUser(req) {
    const tok = req.cookies.fmbr_sid;
    if (!tok) return null;
    const s = await store.getSession(sha(tok), now());
    if (!s) return null;
    const u = await store.userById(s.user_id);
    return u ? { ...u, sid: sha(tok) } : null;
  }
  async function issueToken(user, kind, hours) {
    const token = randomBytes(32).toString('base64url');
    await store.deleteTokensOfKind(user.id, kind);
    await store.createToken(sha(token), user.id, kind, now() + hours * 3_600_000);
    return token;
  }
  async function mailVerification(user) {
    const token = await issueToken(user, 'verify', 48);
    const link = `${cfg.baseUrl}/api/auth/verify?token=${token}`;
    await mailer(cfg, { to: user.email, subject: `${cfg.appName}: confirme seu e-mail`, text: `Olá, ${user.name}!\n\nConfirme seu e-mail para proteger sua conta e seus salvamentos:\n${link}\n\nO link vale por 48 horas. Se você não criou esta conta, ignore esta mensagem.` });
  }

  async function handle(req) {
    const path = req.path;
    const method = (req.method ?? 'GET').toUpperCase();
    // proteção contra CSRF: requisições que alteram dados precisam do cabeçalho do aplicativo
    if (method !== 'GET' && method !== 'HEAD' && req.headers['x-requested-with'] !== 'fmbr') return fail(403, 'Requisição recusada.');

    if (path === '/api/health') return json(200, { ok: true, mail: mailConfigured(), verification: cfg.requireVerification });

    if (path === '/api/auth/register' && method === 'POST') {
      if (!(await store.rate(`register|${req.ip}`, 20, 60 * 60_000))) return fail(429, 'Muitas contas criadas a partir desta rede. Tente mais tarde.');
      const b = readJson(req.body);
      const email = String(b.email ?? '').trim().toLowerCase();
      const name = String(b.name ?? '').trim().slice(0, 60) || email.split('@')[0];
      const password = String(b.password ?? '');
      if (!EMAIL_RE.test(email)) return fail(400, 'Informe um e-mail válido.');
      if (password.length < 8 || password.length > 200) return fail(400, 'A senha precisa ter pelo menos 8 caracteres.');
      const user = await store.createUser(email, name, await hashPassword(password), 0, now());
      if (!user) return fail(409, 'Já existe uma conta com este e-mail. Entre ou use "Esqueci a senha".');
      try {
        await mailVerification(user);
      } catch (e) {
        console.error('[e-mail] falha ao enviar verificação:', e.message);
      }
      if (cfg.requireVerification) return json(201, { user: publicUser(user), needsVerification: true });
      return { ...json(201, { user: publicUser(user) }), cookie: await newSession(user.id) };
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const b = readJson(req.body);
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!(await store.rate(`login|${req.ip}|${email}`, 10, 15 * 60_000))) return fail(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
      const user = await store.userByEmail(email);
      const ok = await checkPassword(String(b.password ?? ''), user?.pass ?? DUMMY_HASH);
      if (!user || !ok) return fail(401, 'E-mail ou senha incorretos.');
      if (cfg.requireVerification && !user.verified) return fail(403, 'Confirme seu e-mail antes de entrar. Enviamos um link na criação da conta.');
      await store.purgeSessions?.(now());
      return { ...json(200, { user: publicUser(user) }), cookie: await newSession(user.id) };
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      const tok = req.cookies.fmbr_sid;
      if (tok) await store.deleteSession(sha(tok));
      return { ...json(200, { ok: true }), cookie: { value: '', maxAge: 0 } };
    }

    if (path === '/api/auth/me' && method === 'GET') {
      const u = await currentUser(req);
      return json(200, { user: u ? publicUser(u) : null }); // sem sessão: user = null (não é erro)
    }

    if (path === '/api/auth/forgot' && method === 'POST') {
      const b = readJson(req.body);
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!(await store.rate(`forgot|${req.ip}|${email}`, 5, 60 * 60_000))) return fail(429, 'Muitos pedidos. Tente mais tarde.');
      const user = await store.userByEmail(email);
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
      return json(200, { ok: true });
    }

    if (path === '/api/auth/reset' && method === 'POST') {
      const b = readJson(req.body);
      const password = String(b.password ?? '');
      if (password.length < 8 || password.length > 200) return fail(400, 'A senha precisa ter pelo menos 8 caracteres.');
      const t = await store.getToken(sha(String(b.token ?? '')), 'reset', now());
      if (!t) return fail(400, 'Link inválido ou expirado. Peça um novo em "Esqueci a senha".');
      await store.deleteToken(t.token);
      await store.setPass(t.user_id, await hashPassword(password));
      await store.setVerified(t.user_id); // quem recebeu o e-mail comprovou o endereço
      await store.deleteOtherSessions(t.user_id, '');
      return { ...json(200, { user: publicUser(await store.userById(t.user_id)) }), cookie: await newSession(t.user_id) };
    }

    if (path === '/api/auth/verify' && method === 'GET') {
      const t = await store.getToken(sha(req.query.get('token') ?? ''), 'verify', now());
      if (!t) return redirect('/?verificado=0');
      await store.deleteToken(t.token);
      await store.setVerified(t.user_id);
      return redirect('/?verificado=1');
    }

    // a partir daqui, só usuários conectados
    const user = await currentUser(req);
    if (!user) return fail(401, 'Entre na sua conta para continuar.');

    if (path === '/api/auth/resend' && method === 'POST') {
      if (user.verified) return json(200, { ok: true });
      if (!(await store.rate(`resend|${user.id}`, 5, 60 * 60_000))) return fail(429, 'Muitos pedidos. Tente mais tarde.');
      await mailVerification(user);
      return json(200, { ok: true });
    }
    if (path === '/api/auth/password' && method === 'POST') {
      const b = readJson(req.body);
      if (!(await checkPassword(String(b.current ?? ''), user.pass))) return fail(401, 'Senha atual incorreta.');
      const pw = String(b.password ?? '');
      if (pw.length < 8 || pw.length > 200) return fail(400, 'A nova senha precisa ter pelo menos 8 caracteres.');
      await store.setPass(user.id, await hashPassword(pw));
      await store.deleteOtherSessions(user.id, user.sid); // encerra as outras sessões
      return json(200, { ok: true });
    }
    if (path === '/api/auth/account' && method === 'DELETE') {
      const b = readJson(req.body);
      if (!(await checkPassword(String(b.password ?? ''), user.pass))) return fail(401, 'Senha incorreta.');
      await store.deleteUser(user.id); // sessões, tokens e salvamentos saem junto
      return { ...json(200, { ok: true }), cookie: { value: '', maxAge: 0 } };
    }
    if (path === '/api/usage' && method === 'GET') {
      return json(200, { used: await store.kvUsage(user.id), quota: quotaBytes });
    }

    const m = path.match(/^\/api\/kv\/([a-z]+)(?:\/([\w.-]{1,120}))?$/);
    if (m && STORES.has(m[1])) {
      const [, kvStore, id] = m;
      if (!id && method === 'GET') {
        const rows = (await store.kvList(user.id, kvStore)).map((r) => ({ id: r.id, meta: JSON.parse(r.meta), compressed: !!r.compressed, size: r.size, updated: r.updated }));
        return json(200, rows);
      }
      if (id && method === 'GET') {
        const r = await store.kvGet(user.id, kvStore, id);
        if (!r) return fail(404, 'Salvamento não encontrado.');
        return text(200, Buffer.from(r.payload), { 'Content-Type': 'application/octet-stream', 'X-Meta': Buffer.from(r.meta).toString('base64'), 'X-Compressed': r.compressed ? '1' : '0' });
      }
      if (id && method === 'PUT') {
        const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');
        if (payload.length > cfg.maxRecordMb * 1024 * 1024) return fail(413, 'Arquivo grande demais.');
        let meta;
        try {
          meta = JSON.parse(Buffer.from(String(req.headers['x-meta'] ?? ''), 'base64').toString('utf8'));
        } catch {
          return fail(400, 'Metadados inválidos.');
        }
        const prev = await store.kvGet(user.id, kvStore, id);
        const used = (await store.kvUsage(user.id)) - (prev?.size ?? 0) + payload.length;
        if (used > quotaBytes) return fail(413, `Espaço da conta esgotado (${cfg.quotaMb} MB). Exclua salvamentos antigos.`);
        // cópia de segurança automática da versão anterior de cada carreira
        if (kvStore === 'careers' && prev) await store.kvPut(user.id, 'backups', id, prev.meta, prev.payload, prev.compressed, prev.size, now());
        await store.kvPut(user.id, kvStore, id, JSON.stringify(meta), payload, req.headers['x-compressed'] === '1' ? 1 : 0, payload.length, now());
        return json(200, { ok: true });
      }
      if (id && method === 'DELETE') {
        await store.kvDel(user.id, kvStore, id);
        if (kvStore === 'careers') await store.kvDel(user.id, 'backups', id);
        return json(200, { ok: true });
      }
    }
    return fail(404, 'Rota não encontrada.');
  }

  return { handle, publicUser };
}
