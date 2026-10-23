import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store';
import { PageHead, Panel, Table, Confirm, Modal, Field, NumInput } from '../components/common';
import { Icon } from '../components/Icon';
import { fmtDay } from '../../engine/core/date';
import { parseCareerText } from '../../engine/save/storage';
import { downloadText, slug } from '../helpers';
import { AccountBar } from './Account';

export function Saves() {
  const s = useGame();
  const c = s.career!;
  const fileRef = useRef<HTMLInputElement>(null);
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [load, setLoad] = useState<string | null>(null);
  useEffect(() => {
    void s.refreshLists();
  }, [s]);

  const exportSave = async (id: string, name: string) => {
    try {
      if (id === c.id) await s.save(false);
      const r = await downloadText(`carreira-${slug(name)}.json`, await s.sm.exportCareerText(id));
      s.toast(r.msg, r.ok ? 'ok' : 'warn');
    } catch (e) {
      s.toast((e as Error).message, 'err');
    }
  };
  const importFile = async (f: File) => {
    try {
      const text = await f.text();
      parseCareerText(text);
      const meta = await s.sm.importCareerText(text);
      await s.refreshLists();
      s.toast(`Carreira "${meta.name}" importada.`);
    } catch (e) {
      s.toast((e as Error).message, 'err');
    }
  };
  return (
    <div className="page">
      <PageHead title="Salvamentos" sub={s.lastSaved ? `Último salvamento: ${new Date(s.lastSaved).toLocaleTimeString('pt-BR')}` : 'Os salvamentos ficam no IndexedDB deste navegador.'}
        actions={<>
          <button className="btn primary" onClick={() => void s.save(true)} disabled={s.saving}><Icon name="save" />Salvar agora</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" />Importar</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
        </>} />
      <AccountBar />
      {s.account && <UploadLocal />}
      <div style={{ height: 10 }} />
      {!s.storageOk && <div className="chip warn" style={{ marginBottom: 10 }}>O armazenamento local está indisponível: exporte a carreira como arquivo para não perder o progresso.</div>}
      <Panel flush>
        <Table rows={s.saves} rowKey={(r) => r.id} rowCls={(r) => (r.id === c.id ? 'sel' : '')} cols={[
          { key: 'n', label: 'Salvamento', render: (r) => <span><strong>{r.name}</strong>{r.id === c.id && <span className="chip good" style={{ marginLeft: 6 }}>atual</span>}</span> },
          { key: 'c', label: 'Clube', render: (r) => r.clubName },
          { key: 's', label: 'Data no jogo', render: (r) => fmtDay(r.day) },
          { key: 'm', label: 'Treinador', render: (r) => r.manager },
          { key: 'u', label: 'Gravado em', render: (r) => <span className="small">{new Date(r.updated).toLocaleString('pt-BR')}</span> },
          { key: 'v', label: 'Versão', render: (r) => r.schemaVersion, cls: 'n' },
          { key: 'b', label: 'Tamanho', render: (r) => `${(r.bytes / 1e6).toFixed(1)} MB`, cls: 'n' },
          { key: 'a', label: '', render: (r) => (
            <span className="row tight">
              {r.id !== c.id && <button className="btn sm" onClick={() => setLoad(r.id)}>Carregar</button>}
              <button className="btn sm" onClick={() => setRename({ id: r.id, name: r.name })}>Renomear</button>
              <button className="btn sm" onClick={() => void exportSave(r.id, r.name)} aria-label="Exportar"><Icon name="download" /></button>
              <button className="btn sm danger" onClick={() => setDel(r.id)} aria-label="Excluir"><Icon name="trash" /></button>
            </span>
          ) },
        ]} empty="Nenhum salvamento ainda." />
      </Panel>
      <div style={{ height: 12 }} />
      <Panel title="Salvamento automático">
        <div className="row">
          <Field label="Salvar a cada (dias de jogo)"><NumInput value={s.settings.autosaveDays} min={1} max={60} onChange={(v) => s.saveSettings({ autosaveDays: Math.max(1, Math.min(60, v)) })} /></Field>
          <label className="inline small"><input type="checkbox" checked={s.settings.stopOnDecisions} onChange={(e) => s.saveSettings({ stopOnDecisions: e.target.checked })} />Parar o avanço quando surgir uma decisão</label>
          <button className="btn sm" onClick={() => s.go({ name: 'tactics' })}>Configurar substituições automáticas em Táticas</button>
        </div>
        <p className="tiny muted">Cada gravação mantém a versão anterior como cópia de segurança. Se o salvamento principal for corrompido, a cópia é restaurada automaticamente ao carregar.</p>
      </Panel>
      {rename && (
        <Modal title="Renomear salvamento" size="narrow" onClose={() => setRename(null)} footer={<><button className="btn" onClick={() => setRename(null)}>Cancelar</button><button className="btn primary" disabled={!rename.name.trim()} onClick={async () => {
          const r = rename;
          setRename(null);
          try {
            if (r.id === c.id) {
              c.saveName = r.name.trim();
              await s.save(false);
            } else await s.sm.renameCareer(r.id, r.name.trim());
            await s.refreshLists();
            s.toast('Salvamento renomeado.');
          } catch (e) {
            s.toast((e as Error).message, 'err');
          }
        }}>Salvar</button></>}>
          <Field label="Nome"><input type="text" value={rename.name} maxLength={50} onChange={(e) => setRename({ ...rename, name: e.target.value })} autoFocus /></Field>
        </Modal>
      )}
      {del && <Confirm title="Excluir salvamento?" danger confirmLabel="Excluir" text={del === c.id ? 'Este é o salvamento da carreira aberta. Ele e sua cópia de segurança serão apagados; a carreira continua aberta até você sair e pode ser salva de novo.' : 'O salvamento e sua cópia de segurança serão apagados permanentemente deste navegador.'} onNo={() => setDel(null)} onYes={async () => { const id = del; setDel(null); await s.sm.deleteCareer(id); await s.refreshLists(); s.toast('Salvamento excluído.'); }} />}
      {load && <Confirm title="Carregar outra carreira?" confirmLabel="Salvar e carregar" text="A carreira atual será salva antes de abrir a outra." onNo={() => setLoad(null)} onYes={async () => { const id = load; setLoad(null); await s.save(false); await s.loadCareer(id); }} />}
    </div>
  );
}

/** Envia para a conta os salvamentos que estão só neste navegador. */
function UploadLocal() {
  const s = useGame();
  const [n, setN] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void s.localSaveCount().then(setN);
  }, [s]);
  if (!n) return null;
  return (
    <div className="account-bar" style={{ marginTop: 8 }}>
      <Icon name="upload" />
      <span className="small" style={{ flex: 1 }}>Há {n} salvamento(s) guardado(s) só neste navegador.</span>
      <button className="btn sm primary" disabled={busy} onClick={async () => { setBusy(true); try { const k = await s.uploadLocalSaves(); s.toast(`${k} salvamento(s) enviados para a sua conta.`); setN(0); } catch (e) { s.toast((e as Error).message, 'err'); } setBusy(false); }}>{busy ? 'Enviando…' : 'Enviar para a conta'}</button>
    </div>
  );
}
