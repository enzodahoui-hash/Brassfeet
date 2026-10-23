import { useEffect, useState } from 'react';
import { useGame } from '../store';
import { Modal, Field, Confirm } from '../components/common';
import { Icon } from '../components/Icon';
import * as api from '../account';

/** Faixa de conta: mostra onde o progresso é salvo e dá acesso a entrar, criar conta ou sair. */
export function AccountBar({ compact = false }: { compact?: boolean }) {
  const s = useGame();
  if (!s.server) return compact ? null : <div className="account-bar"><Icon name="save" /><span className="small muted">Seu progresso fica salvo neste navegador. Contas por e-mail ficam disponíveis quando o jogo roda no servidor próprio.</span></div>;
  if (!s.account) {
    return (
      <div className="account-bar">
        <Icon name="save" />
        <span className="small" style={{ flex: 1, minWidth: 0 }}>Sem conta: o progresso fica só neste navegador. <strong>Crie uma conta</strong> para guardar suas carreiras e jogar de qualquer lugar.</span>
        <button className="btn sm" onClick={() => { s.accountModal = 'login'; s.bump(); }}>Entrar</button>
        <button className="btn sm primary" onClick={() => { s.accountModal = 'register'; s.bump(); }}>Criar conta</button>
      </div>
    );
  }
  return (
    <div className="account-bar">
      <Icon name="save" />
      <span className="small" style={{ flex: 1, minWidth: 0 }}>Conectado como <strong>{s.account.name}</strong> ({s.account.email}). Carreiras salvas na sua conta.{!s.account.verified && <span className="chip warn" style={{ marginLeft: 6 }}>e-mail não confirmado</span>}</span>
      <button className="btn sm" onClick={() => { s.accountModal = 'manage'; s.bump(); }}>Minha conta</button>
      <button className="btn sm ghost" onClick={() => void s.signOut()}>Sair</button>
    </div>
  );
}

export function AccountModal() {
  const s = useGame();
  const mode = s.accountModal!;
  const close = () => { s.accountModal = null; s.resetToken = null; s.bump(); };
  const go = (m: typeof s.accountModal) => { s.accountModal = m; s.bump(); };
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const enter = async (user: api.Account) => {
    s.useAccount(user);
    await s.refreshLists();
    const local = await s.localSaveCount();
    close();
    s.toast(`Bem-vindo, ${user.name}!${local ? ` Há ${local} salvamento(s) neste navegador: envie-os para a conta em Salvamentos.` : ''}`);
  };
  const titles = { login: 'Entrar', register: 'Criar conta', forgot: 'Esqueci a senha', reset: 'Nova senha', manage: 'Minha conta' } as const;
  return (
    <Modal title={titles[mode]} size="narrow" onClose={close}>
      <form className="stack" style={{ gap: 10 }} onSubmit={(e) => e.preventDefault()}>
        {mode === 'login' && <>
          <Field label="E-mail"><input id="acc-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Senha"><input id="acc-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <button className="btn primary" type="submit" disabled={busy || !email || !pw} onClick={() => run(async () => enter((await api.login(email, pw)).user))}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <div className="row small" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn sm ghost" onClick={() => go('forgot')}>Esqueci a senha</button>
            <button type="button" className="btn sm ghost" onClick={() => go('register')}>Criar conta</button>
          </div>
        </>}
        {mode === 'register' && <>
          <Field label="Nome"><input id="acc-name" type="text" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="E-mail"><input id="acc-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Senha (mínimo de 8 caracteres)"><input id="acc-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Repita a senha"><input id="acc-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          {pw2 && pw !== pw2 && <div className="small warn">As senhas não conferem.</div>}
          <button className="btn primary" type="submit" disabled={busy || !email || pw.length < 8 || pw !== pw2} onClick={() => run(async () => {
            const r = await api.register(name, email, pw);
            if (r.needsVerification) { setInfo(`Conta criada! Enviamos um link de confirmação para ${email}. Confirme e depois entre.`); go('login'); return; }
            await enter(r.user);
          })}>{busy ? 'Criando…' : 'Criar conta'}</button>
          <p className="tiny muted">Guardamos seu nome, e-mail, a senha protegida por hash e os salvamentos que você enviar. Você pode excluir a conta e todos os dados em "Minha conta".</p>
          <button type="button" className="btn sm ghost" onClick={() => go('login')}>Já tenho conta</button>
        </>}
        {mode === 'forgot' && <>
          <p className="small">Informe o e-mail da conta. Se ele estiver cadastrado, você receberá um link para criar uma nova senha (válido por 1 hora).</p>
          <Field label="E-mail"><input id="acc-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn primary" type="submit" disabled={busy || !email} onClick={() => run(async () => { await api.forgot(email); setInfo('Se o e-mail estiver cadastrado, o link de redefinição chegará em instantes. Confira também a caixa de spam.'); })}>Enviar link</button>
          <button type="button" className="btn sm ghost" onClick={() => go('login')}>Voltar para entrar</button>
        </>}
        {mode === 'reset' && <>
          <Field label="Nova senha (mínimo de 8 caracteres)"><input id="acc-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Repita a nova senha"><input id="acc-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          <button className="btn primary" type="submit" disabled={busy || pw.length < 8 || pw !== pw2} onClick={() => run(async () => { const r = await api.resetPassword(s.resetToken ?? '', pw); await enter(r.user); s.toast('Senha alterada.'); })}>Salvar nova senha</button>
        </>}
        {mode === 'manage' && s.account && <ManageAccount setErr={setErr} setInfo={setInfo} />}
        {err && <div className="small neg" role="alert">{err}</div>}
        {info && <div className="small pos" role="status">{info}</div>}
      </form>
    </Modal>
  );
}

function ManageAccount({ setErr, setInfo }: { setErr: (e: string | null) => void; setInfo: (e: string | null) => void }) {
  const s = useGame();
  const acc = s.account!;
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [use, setUse] = useState<{ used: number; quota: number } | null>(null);
  useEffect(() => {
    void api.usage().then(setUse).catch(() => undefined);
  }, []);
  const mb = (v: number) => `${(v / 1024 / 1024).toFixed(1)} MB`;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="small"><strong>{acc.name}</strong> · {acc.email} {acc.verified ? <span className="chip good">confirmado</span> : <span className="chip warn">não confirmado</span>}</div>
      {!acc.verified && <button type="button" className="btn sm" onClick={async () => { try { await api.resendVerification(); setInfo(`Link de confirmação reenviado para ${acc.email}.`); } catch (e) { setErr((e as Error).message); } }}>Reenviar e-mail de confirmação</button>}
      {use && <div className="small muted">Espaço usado: {mb(use.used)} de {mb(use.quota)}</div>}
      <h4>Trocar senha</h4>
      <Field label="Senha atual"><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
      <Field label="Nova senha (mínimo de 8 caracteres)"><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      <button type="button" className="btn" disabled={!cur || pw.length < 8} onClick={async () => { setErr(null); try { await api.changePassword(cur, pw); setCur(''); setPw(''); setInfo('Senha alterada. As outras sessões foram encerradas.'); } catch (e) { setErr((e as Error).message); } }}>Alterar senha</button>
      <h4>Excluir conta</h4>
      <p className="tiny muted">Apaga a conta e todos os salvamentos guardados nela. Os salvamentos deste navegador não são afetados.</p>
      <button type="button" className="btn danger sm" onClick={() => setDel(true)}>Excluir minha conta</button>
      {del && (
        <Confirm title="Excluir conta?" danger confirmLabel="Excluir definitivamente" onNo={() => setDel(false)} text={<div className="stack" style={{ gap: 8 }}><span>Esta ação não pode ser desfeita. Digite sua senha para confirmar.</span><input type="password" aria-label="Senha para confirmar" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></div>} onYes={async () => {
          try {
            await api.deleteAccount(delPw);
            setDel(false);
            s.accountModal = null;
            s.useAccount(null);
            s.closeCareer();
            s.toast('Conta excluída.');
          } catch (e) {
            setErr((e as Error).message);
            setDel(false);
          }
        }} />
      )}
    </div>
  );
}
