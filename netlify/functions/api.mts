// Função da Netlify que atende todas as rotas /api/* (contas e salvamentos na nuvem).
// Usa o mesmo núcleo do servidor Node (server/core.mjs), mas com armazenamento em Netlify Blobs.
import { getStore } from '@netlify/blobs';
import type { Config, Context } from '@netlify/functions';
// @ts-expect-error módulos JavaScript do servidor (sem tipos)
import { createCore } from '../../server/core.mjs';
// @ts-expect-error módulo JavaScript do servidor (sem tipos)
import { blobsStore } from '../../server/blobs-store.mjs';
// @ts-expect-error módulo JavaScript do servidor (sem tipos)
import { sendMail, mailConfigured } from '../../server/mail.mjs';

const env = (k: string, fallback = '') => process.env[k] ?? fallback;

function loadConfig() {
  // na Netlify, process.env.URL é o endereço público do site; serve para os links dos e-mails
  const baseUrl = (env('BASE_URL') || env('URL') || 'http://localhost:8888').replace(/\/$/, '');
  return {
    baseUrl,
    cookieSecure: env('COOKIE_SECURE') ? env('COOKIE_SECURE') === '1' : baseUrl.startsWith('https://'),
    requireVerification: env('REQUIRE_EMAIL_VERIFICATION') === '1',
    sessionDays: Number(env('SESSION_DAYS', '30')),
    quotaMb: Number(env('QUOTA_MB', '300')),
    // o limite de corpo da função é ~6 MB; 5 MB deixa margem (um salvamento comprimido tem ~3 MB)
    maxRecordMb: Number(env('MAX_SAVE_MB', '5')),
    appName: env('APP_NAME', 'Football Manager BR'),
  };
}

const cfg = loadConfig();
const core = createCore({ cfg, store: blobsStore({ getStore }), mailer: sendMail, mailConfigured });

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export default async (req: Request, context: Context): Promise<Response> => {
  const url = new URL(req.url);
  // a função é alcançada via redirect /api/* -> /.netlify/functions/api/:splat; normaliza para /api/...
  const path = url.pathname.startsWith('/.netlify/functions/api')
    ? '/api' + url.pathname.slice('/.netlify/functions/api'.length)
    : url.pathname;
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  const body = req.method === 'GET' || req.method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await req.arrayBuffer());

  let r;
  try {
    r = await core.handle({
      method: req.method,
      path,
      query: url.searchParams,
      headers,
      cookies: parseCookies(req.headers.get('cookie')),
      body,
      ip: context.ip,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    if (status === 500) console.error(e);
    r = { status, body: { error: status === 500 ? 'Erro interno. Tente novamente.' : (e as Error).message } };
  }

  const h = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  for (const [k, v] of Object.entries(r.headers ?? {})) h.set(k, String(v));
  if (!h.has('Content-Type')) h.set('Content-Type', !r.text && r.body && typeof r.body === 'object' && !Buffer.isBuffer(r.body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8');
  if (r.cookie) h.set('Set-Cookie', `fmbr_sid=${encodeURIComponent(r.cookie.value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${r.cookie.maxAge}${cfg.cookieSecure ? '; Secure' : ''}`);
  const payload = r.body === undefined || r.body === '' ? '' : Buffer.isBuffer(r.body) || typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
  return new Response(payload as BodyInit, { status: r.status, headers: h });
};

// servida em /.netlify/functions/api; o netlify.toml redireciona /api/* para cá (antes do catch-all do SPA)
export const config: Config = {};
