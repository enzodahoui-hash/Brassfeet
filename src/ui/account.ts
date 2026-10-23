// Cliente da API de contas do servidor do jogo. Sem servidor (por exemplo, no arquivo único ou em
// hospedagem estática), o jogo segue funcionando e salva apenas neste navegador.

export interface Account {
  id: number;
  email: string;
  name: string;
  verified: boolean;
  created: number;
}

export interface Health {
  ok: boolean;
  mail: boolean;
  verification: boolean;
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: { 'X-Requested-With': 'fmbr', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((data as { error?: string }).error ?? `Erro ${r.status}.`), { status: r.status });
  return data as T;
}

export async function health(): Promise<Health | null> {
  try {
    const r = await fetch('/api/health', { credentials: 'same-origin' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    return (await r.json()) as Health;
  } catch {
    return null;
  }
}

export const me = async (): Promise<Account | null> => {
  try {
    return (await call<{ user: Account | null }>('/auth/me')).user;
  } catch {
    return null;
  }
};
export const login = (email: string, password: string) => call<{ user: Account }>('/auth/login', 'POST', { email, password });
export const register = (name: string, email: string, password: string) => call<{ user: Account; needsVerification?: boolean }>('/auth/register', 'POST', { name, email, password });
export const logout = () => call<{ ok: true }>('/auth/logout', 'POST', {});
export const forgot = (email: string) => call<{ ok: true }>('/auth/forgot', 'POST', { email });
export const resetPassword = (token: string, password: string) => call<{ user: Account }>('/auth/reset', 'POST', { token, password });
export const resendVerification = () => call<{ ok: true }>('/auth/resend', 'POST', {});
export const changePassword = (current: string, password: string) => call<{ ok: true }>('/auth/password', 'POST', { current, password });
export const deleteAccount = (password: string) => call<{ ok: true }>('/auth/account', 'DELETE', { password });
export const usage = () => call<{ used: number; quota: number }>('/usage');
