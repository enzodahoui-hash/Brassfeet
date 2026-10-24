// Função serverless da Vercel que atende todas as rotas /api/* (contas e salvamentos na nuvem).
// Mesmo núcleo do servidor Node (server/core.mjs), com armazenamento em Postgres (ex.: Neon).
import { neon } from '@neondatabase/serverless';
import { createCore } from '../server/core.mjs';
import { postgresStore } from '../server/postgres-store.mjs';
import { sendMail, mailConfigured } from '../server/mail.mjs';

const env = (k, fallback = '') => process.env[k] ?? fallback;

function loadConfig() {
  // VERCEL_URL é o host do deploy (sem protocolo); serve para os links dos e-mails.
  const baseUrl = (env('BASE_URL') || (env('VERCEL_URL') ? `https://${env('VERCEL_URL')}` : '') || 'http://localhost:3000').replace(/\/$/, '');
  return {
    baseUrl,
    cookieSecure: env('COOKIE_SECURE') ? env('COOKIE_SECURE') === '1' : baseUrl.startsWith('https://'),
    requireVerification: env('REQUIRE_EMAIL_VERIFICATION') === '1',
    sessionDays: Number(env('SESSION_DAYS', '30')),
    quotaMb: Number(env('QUOTA_MB', '300')),
    maxRecordMb: Number(env('MAX_SAVE_MB', '5')),
    appName: env('APP_NAME', 'Football Manager BR'),
  };
}

const cfg = loadConfig();
// Criado sob demanda: se o banco ainda não foi conectado, falha com erro claro no uso.
let _sql;
const getSql = () => {
  const url = env('DATABASE_URL') || env('POSTGRES_URL');
  if (!url) throw Object.assign(new Error('Banco de dados não configurado (defina DATABASE_URL).'), { status: 503 });
  return (_sql ??= neon(url));
};
// o neon() HTTP aceita a forma sql(text, params) e devolve as linhas — ideal para serverless
const core = createCore({ cfg, store: postgresStore({ query: (text, params = []) => getSql()(text, params) }), mailer: sendMail, mailConfigured });

function parseCookies(header) {
  const out = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host ?? 'localhost'}`);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : String(v ?? '');
  const body = req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : await readRawBody(req);

  let r;
  try {
    r = await core.handle({
      method: req.method,
      path: url.pathname,
      query: url.searchParams,
      headers,
      cookies: parseCookies(req.headers.cookie),
      body,
      ip: (headers['x-forwarded-for'] ?? '').split(',')[0].trim(),
    });
  } catch (e) {
    const status = e?.status ?? 500;
    if (status === 500) console.error(e);
    r = { status, body: { error: status === 500 ? 'Erro interno. Tente novamente.' : e.message } };
  }

  const h = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(r.headers ?? {}) };
  if (!h['Content-Type'] && !h['content-type']) {
    h['Content-Type'] = !r.text && r.body && typeof r.body === 'object' && !Buffer.isBuffer(r.body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8';
  }
  if (r.cookie) h['Set-Cookie'] = `fmbr_sid=${encodeURIComponent(r.cookie.value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${r.cookie.maxAge}${cfg.cookieSecure ? '; Secure' : ''}`;
  const payload = r.body === undefined || r.body === '' ? '' : Buffer.isBuffer(r.body) || typeof r.body === 'string' ? r.body : JSON.stringify(r.body);

  res.statusCode = r.status;
  for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
  res.end(payload);
}
