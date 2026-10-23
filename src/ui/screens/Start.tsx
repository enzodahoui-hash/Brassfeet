import { useMemo, useRef, useState } from 'react';
import type { Club, Difficulty, FinanceMode, FinanceSettings, World } from '../../engine/types';
import { useGame, tick } from '../store';
import { Icon, BrandMark } from '../components/Icon';
import { Crest } from '../components/graphics';
import { Lvl, Money, Field, NumInput, Table, Panel } from '../components/common';
import { levelLabel, ovrToLevel } from '../../engine/players/attributes';
import { FINANCE_MODES, defaultFinanceSettings } from '../../engine/finance/economy';
import { fmtMoney } from '../../engine/finance/ledger';
import { nationName } from '../../engine/data/nations';
import { totalCapacity } from '../../engine/stadium/stadium';
import { Editor } from './Editor';
import { parseCareerText } from '../../engine/save/storage';
import { AccountBar } from './Account';

type View = 'title' | 'new' | 'load' | 'editor';

export function StartScreen() {
  const s = useGame();
  const [view, setView] = useState<View>('title');
  const fileRef = useRef<HTMLInputElement>(null);
  const latest = s.saves[0];

  const importFile = async (f: File) => {
    try {
      const text = await f.text();
      parseCareerText(text);
      await s.sm.importCareerText(text);
      await s.refreshLists();
      s.toast('Carreira importada.');
    } catch (e) {
      s.toast((e as Error).message, 'err');
    }
  };

  if (view === 'new') return <NewCareer onCancel={() => setView('title')} />;
  if (view === 'load') return <LoadList onBack={() => setView('title')} />;
  if (view === 'editor')
    return (
      <div>
        <div className="top" style={{ position: 'sticky', gridColumn: 'auto' }}>
          <button className="btn" onClick={() => setView('title')}><Icon name="back" />Menu inicial</button>
          <strong>Editor do Universo</strong>
        </div>
        <Editor standalone />
      </div>
    );

  return (
    <div className="title-screen">
      <section className="title-hero">
        <div className="floodlight" />
        <div className="row"><BrandMark className="brand-mark" /><span className="muted small" style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>Manager de futebol · versão 0.1</span></div>
        <div className="logo">Football<span>Manager BR</span></div>
        <p>Assuma um dos 472 clubes reais de 15 países, com os elencos atuais, monte o elenco, revele jovens, amplie o estádio, crie uniformes e dispute ligas, copas, a Copa das Américas e a Champions Euro. Temporada após temporada.</p>
        <div className="row small muted">
          <span className="chip">10 países sul-americanos</span><span className="chip">5 ligas europeias</span><span className="chip">Notas de 0 a 25</span><span className="chip">Editor completo</span>
        </div>
        <p className="tiny muted" style={{ maxWidth: '60ch' }}>Clubes e jogadores reais, com elencos de outubro de 2026 (fontes: Wikipédia e Wikidata; fotos do Wikimedia Commons com crédito). Níveis, atributos, valores e finanças são estimativas do jogo, não dados oficiais. Escudos, uniformes, patrocínios e nomes das competições são criações próprias, sem marcas oficiais.</p>
      </section>
      <section className="title-menu">
        <AccountBar />
        <button className="menu-card" disabled={!latest} onClick={() => latest && void s.loadCareer(latest.id)}>
          <Icon name="play" />
          <div><div className="t">Continuar</div><div className="d">{latest ? `${latest.name} · ${latest.clubName} · temporada ${latest.season}` : 'Nenhuma carreira salva ainda'}</div></div>
        </button>
        <button className="menu-card" onClick={() => setView('new')}>
          <Icon name="plus" />
          <div><div className="t">Nova carreira</div><div className="d">Escolha universo, clube, dificuldade e modo financeiro</div></div>
        </button>
        <button className="menu-card" onClick={() => setView('load')} disabled={!s.saves.length}>
          <Icon name="save" />
          <div><div className="t">Carregar carreira</div><div className="d">{s.saves.length} salvamento(s) neste navegador</div></div>
        </button>
        <button className="menu-card" onClick={() => setView('editor')}>
          <Icon name="editor" />
          <div><div className="t">Editor do Universo</div><div className="d">Crie universos personalizados: jogadores, clubes, competições e regras</div></div>
        </button>
        <button className="menu-card" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" />
          <div><div className="t">Importar carreira</div><div className="d">Abrir um arquivo .json exportado</div></div>
        </button>
        {s.installPrompt && (
          <button className="menu-card" onClick={() => void s.installApp()}>
            <Icon name="download" />
            <div><div className="t">Instalar aplicativo</div><div className="d">Ícone na tela inicial, tela cheia e abre sem internet</div></div>
          </button>
        )}
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
        {!s.storageOk && <div className="chip warn">Armazenamento local bloqueado: o progresso não será salvo neste navegador.</div>}
      </section>
    </div>
  );
}

function LoadList({ onBack }: { onBack: () => void }) {
  const s = useGame();
  return (
    <div className="wizard">
      <div className="row"><button className="btn" onClick={onBack}><Icon name="back" />Voltar</button><h1>Carregar carreira</h1></div>
      <div style={{ height: 12 }} />
      <Panel flush>
        <Table rows={s.saves} rowKey={(r) => r.id} onRow={(r) => void s.loadCareer(r.id)} cols={[
          { key: 'n', label: 'Salvamento', render: (r) => <strong>{r.name}</strong> },
          { key: 'c', label: 'Clube', render: (r) => r.clubName },
          { key: 's', label: 'Temporada', render: (r) => r.season, cls: 'n' },
          { key: 'm', label: 'Treinador', render: (r) => r.manager },
          { key: 'u', label: 'Atualizado', render: (r) => new Date(r.updated).toLocaleString('pt-BR') },
          { key: 'b', label: 'Tamanho', render: (r) => `${(r.bytes / 1e6).toFixed(1)} MB`, cls: 'n' },
        ]} />
      </Panel>
    </div>
  );
}

const STEPS = ['Universo', 'Clube', 'Treinador', 'Finanças', 'Resumo'];

function NewCareer({ onCancel }: { onCancel: () => void }) {
  const s = useGame();
  const [step, setStep] = useState(0);
  const [world, setWorld] = useState<World | null>(null);
  const [worldId, setWorldId] = useState('padrao');
  const [country, setCountry] = useState('BRA');
  const [div, setDiv] = useState('bra1');
  const [q, setQ] = useState('');
  const [clubId, setClubId] = useState<string | null>(null);
  const [manager, setManager] = useState('');
  const [nat, setNat] = useState('BRA');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [mode, setMode] = useState<FinanceMode>('realista');
  const [fin, setFin] = useState<FinanceSettings | null>(null);
  const [loading, setLoading] = useState(false);

  const pickWorld = async (id: string) => {
    setLoading(true);
    await tick();
    try {
      const w = id === 'padrao' ? s.defaultWorld() : await s.sm.loadUniverse(id);
      setWorld(w);
      setWorldId(id);
      setStep(1);
    } catch (e) {
      s.toast((e as Error).message, 'err');
    }
    setLoading(false);
  };

  const club: Club | null = world && clubId ? world.clubs[clubId] : null;
  const countries = world?.config.countries.filter((c) => c.enabled) ?? [];
  const clubs = useMemo(() => {
    if (!world) return [];
    const ql = q.trim().toLowerCase();
    return Object.values(world.clubs).filter((c) => (ql ? c.name.toLowerCase().includes(ql) || c.city.toLowerCase().includes(ql) : c.divisionId === div)).sort((a, b) => b.level - a.level);
  }, [world, div, q]);

  const chooseMode = (m: FinanceMode) => {
    setMode(m);
    if (club && world) setFin(defaultFinanceSettings(m, club, world as never));
  };

  const start = async () => {
    if (!world || !club || !fin) return;
    await s.startCareer(world, { clubId: club.id, managerName: manager.trim() || 'Treinador', managerNat: nat, difficulty, finance: fin });
  };

  return (
    <div className="wizard">
      <div className="row"><button className="btn" onClick={step === 0 ? onCancel : () => setStep(step - 1)}><Icon name="back" />{step === 0 ? 'Cancelar' : 'Voltar'}</button><h1>Nova carreira</h1></div>
      <div className="steps">{STEPS.map((t, i) => <span key={t} className={i === step ? 'on' : i < step ? 'done' : ''}>{i + 1}. {t}</span>)}</div>

      {step === 0 && (
        <div className="grid g3">
          <button className={`choice ${worldId === 'padrao' ? 'on' : ''}`} onClick={() => void pickWorld('padrao')} disabled={loading}>
            <span className="t">Universo padrão</span>
            <span className="small muted">15 países, 472 clubes reais com os elencos de outubro de 2026. Pronto para jogar.</span>
          </button>
          {s.universes.map((u) => (
            <button key={u.id} className={`choice ${worldId === u.id ? 'on' : ''}`} onClick={() => void pickWorld(u.id)} disabled={loading}>
              <span className="t">{u.name}</span>
              <span className="small muted">{u.description || 'Universo personalizado'} · {u.clubs} clubes · {u.players} jogadores</span>
            </button>
          ))}
          {loading && <div className="row"><span className="spinner" /> Carregando universo…</div>}
        </div>
      )}

      {step === 1 && world && (
        <div className="grid g-main">
          <Panel title="Escolha seu clube" right={<input type="search" placeholder="Buscar clube ou cidade" value={q} onChange={(e) => setQ(e.target.value)} />} flush>
            <div style={{ padding: '8px 12px' }} className="row">
              {countries.map((c) => (
                <button key={c.code} className={`btn sm ${country === c.code ? 'primary' : ''}`} onClick={() => { setCountry(c.code); setDiv(c.leagues[0]); setQ(''); }}>{c.name}</button>
              ))}
            </div>
            <div style={{ padding: '0 12px 8px' }} className="row">
              {countries.find((c) => c.code === country)?.leagues.map((l) => (
                <button key={l} className={`btn sm ${div === l ? 'go' : 'ghost'}`} onClick={() => { setDiv(l); setQ(''); }}>{world.config.competitions[l]?.name}</button>
              ))}
            </div>
            <Table rows={clubs} rowKey={(r) => r.id} onRow={(r) => setClubId(r.id)} rowCls={(r) => (r.id === clubId ? 'me' : '')} cols={[
              { key: 'n', label: 'Clube', render: (r) => <span className="row tight" style={{ flexWrap: 'nowrap' }}><Crest crest={r.crest} size={20} />{r.name}</span>, sort: (r) => r.name },
              { key: 'c', label: 'Cidade', render: (r) => r.city },
              { key: 'l', label: 'Nível', render: (r) => <Lvl v={r.level} size="sm" tip={levelLabel(r.level)} />, sort: (r) => r.level, cls: 'c' },
              { key: 't', label: 'Torcida', render: (r) => r.fans.toLocaleString('pt-BR'), sort: (r) => r.fans, cls: 'n' },
              { key: 'cap', label: 'Estádio', render: (r) => totalCapacity(r.stadium).toLocaleString('pt-BR'), sort: (r) => totalCapacity(r.stadium), cls: 'n' },
              { key: 'b', label: 'Caixa', render: (r) => fmtMoney(r.balance, world.config.currency), sort: (r) => r.balance, cls: 'n' },
            ]} />
          </Panel>
          <div className="stack">
            {club ? <ClubPreview world={world} club={club} /> : <Panel><div className="empty">Selecione um clube na lista para ver os detalhes.</div></Panel>}
            <button className="btn primary lg" disabled={!club} onClick={() => { setStep(2); chooseMode(mode); }}>Continuar com {club?.short ?? '…'}</button>
          </div>
        </div>
      )}

      {step === 2 && club && (
        <div className="grid g2">
          <Panel title="Treinador">
            <div className="stack">
              <Field label="Seu nome"><input type="text" value={manager} maxLength={40} placeholder="Ex.: Ana Ribeiro" onChange={(e) => setManager(e.target.value)} /></Field>
              <Field label="Nacionalidade">
                <select value={nat} onChange={(e) => setNat(e.target.value)}>
                  {['BRA', 'ARG', 'URU', 'POR', 'ESP', 'ITA', 'ENG', 'GER', 'FRA', 'COL', 'CHI'].map((n) => <option key={n} value={n}>{nationName(n)}</option>)}
                </select>
              </Field>
            </div>
          </Panel>
          <Panel title="Dificuldade">
            <div className="stack">
              {([['facil', 'Fácil', 'Diretoria paciente; demissão só em campanhas desastrosas.'], ['normal', 'Normal', 'Expectativas proporcionais ao porte do clube.'], ['dificil', 'Difícil', 'Diretoria exigente e pouca tolerância a fracassos.']] as const).map(([id, t, d]) => (
                <button key={id} className={`choice ${difficulty === id ? 'on' : ''}`} onClick={() => setDifficulty(id)}><span className="t">{t}</span><span className="small muted">{d}</span></button>
              ))}
              <p className="tiny muted">A dificuldade não altera o motor de partidas: os dois times sempre seguem as mesmas regras.</p>
            </div>
          </Panel>
          <div className="row"><button className="btn primary lg" onClick={() => setStep(3)}>Continuar</button></div>
        </div>
      )}

      {step === 3 && club && fin && world && (
        <div className="stack">
          <div className="grid g3">
            {(Object.keys(FINANCE_MODES) as FinanceMode[]).map((m) => (
              <button key={m} className={`choice ${mode === m ? 'on' : ''}`} onClick={() => chooseMode(m)}>
                <span className="t">{FINANCE_MODES[m].name}</span>
                <span className="small muted">{FINANCE_MODES[m].desc}</span>
              </button>
            ))}
          </div>
          <Panel title="Configuração financeira desta carreira" right={<span className="chip info">Não altera outros salvamentos</span>}>
            <div className="grid g3">
              <Field label="Caixa inicial"><NumInput value={fin.initialBalance} step={100000} width={170} onChange={(v) => setFin({ ...fin, initialBalance: Math.max(0, v) })} /></Field>
              <Field label="Orçamento de transferências"><NumInput value={fin.transferBudget} step={100000} width={170} onChange={(v) => setFin({ ...fin, transferBudget: Math.max(0, v) })} /></Field>
              <Field label="Limite de folha salarial (anual)"><NumInput value={fin.wageLimit} step={100000} width={170} onChange={(v) => setFin({ ...fin, wageLimit: Math.max(0, v) })} /></Field>
              <Field label={`Realismo das receitas: ${Math.round(fin.revenueRealism * 100)}%`}><input type="range" min={0.6} max={1.4} step={0.05} value={fin.revenueRealism} onChange={(e) => setFin({ ...fin, revenueRealism: Number(e.target.value) })} /></Field>
              <Field label={`Intensidade dos custos: ${Math.round(fin.costIntensity * 100)}%`}><input type="range" min={0.6} max={1.5} step={0.05} value={fin.costIntensity} onChange={(e) => setFin({ ...fin, costIntensity: Number(e.target.value) })} /></Field>
              <Field label="Aporte do investidor (registrado à parte)">
                <div className="row tight">
                  <NumInput value={fin.injection} step={1000000} width={150} onChange={(v) => setFin({ ...fin, injection: Math.max(0, Math.min(5e9, v)), allowInjections: v > 0 || fin.allowInjections })} />
                  {[50e6, 150e6, 500e6].map((v) => <button key={v} className="btn sm" onClick={() => setFin({ ...fin, injection: v, allowInjections: true })}>{fmtMoney(v)}</button>)}
                </div>
              </Field>
              <label className="inline"><input type="checkbox" checked={fin.allowInjections} onChange={(e) => setFin({ ...fin, allowInjections: e.target.checked })} />Permitir aportes extraordinários durante a carreira</label>
              <label className="inline"><input type="checkbox" checked={fin.financing} onChange={(e) => setFin({ ...fin, financing: e.target.checked })} />Permitir financiamento de obras e empréstimos</label>
              <label className="inline"><input type="checkbox" checked={fin.unlimited} onChange={(e) => setFin({ ...fin, unlimited: e.target.checked })} />Recursos ilimitados (modo casual)</label>
            </div>
            {mode === 'realista' && <p className="tiny muted">Os valores do modo realista são uma representação aproximada e fictícia do universo do jogo, não um balanço oficial verificado.</p>}
          </Panel>
          <div className="row"><button className="btn primary lg" onClick={() => setStep(4)}>Continuar</button></div>
        </div>
      )}

      {step === 4 && club && fin && world && (
        <div className="grid g-main">
          <ClubPreview world={world} club={club} />
          <Panel title="Resumo da carreira">
            <div className="stack">
              <div className="row"><Crest crest={club.crest} size={48} /><div><h2>{club.name}</h2><div className="muted">{world.config.competitions[club.divisionId]?.name} · {club.city}</div></div></div>
              <div><strong>Treinador:</strong> {manager || 'Treinador'} ({nationName(nat)}) · <strong>Dificuldade:</strong> {difficulty}</div>
              <div><strong>Modo financeiro:</strong> {FINANCE_MODES[mode].name}</div>
              <div><strong>Caixa inicial:</strong> {fmtMoney(fin.initialBalance + fin.injection, world.config.currency)} {fin.injection > 0 && <span className="muted">(inclui aporte de {fmtMoney(fin.injection)})</span>}</div>
              <div><strong>Expectativa da diretoria:</strong> {expectation(world, club)}</div>
              <button className="btn go lg" onClick={() => void start()} disabled={!!s.busy}><Icon name="play" />Iniciar carreira</button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function expectation(world: World, club: Club): string {
  const peers = Object.values(world.clubs).filter((x) => x.divisionId === club.divisionId).sort((a, b) => b.level - a.level);
  const rank = peers.findIndex((x) => x.id === club.id) + 1;
  const t = world.config.competitions[club.divisionId];
  if (t.tier === 1) {
    if (rank <= 2) return `brigar pelo título (${rank}º maior nível da liga)`;
    if (rank <= 6) return 'vaga continental (top 6)';
    if (rank <= peers.length * 0.6) return 'terminar na metade de cima';
    return 'evitar o rebaixamento';
  }
  return rank <= (t.promote ?? 0) + 1 ? 'conquistar o acesso' : 'campanha segura, sem riscos de queda';
}

function ClubPreview({ world, club }: { world: World; club: Club }) {
  const players = club.playerIds.map((id) => world.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  return (
    <Panel title={<span className="row"><Crest crest={club.crest} size={26} /><h3>{club.name}</h3></span>} right={<Lvl v={club.level} tip={levelLabel(club.level)} />}>
      <div className="grid g2 small">
        <div><span className="muted">Estádio:</span> {club.stadium.name} ({totalCapacity(club.stadium).toLocaleString('pt-BR')})</div>
        <div><span className="muted">Torcida:</span> {club.fans.toLocaleString('pt-BR')}</div>
        <div><span className="muted">Técnico atual:</span> {club.coach.name}</div>
        <div><span className="muted">Presidente:</span> {club.board.president}</div>
        <div><span className="muted">Caixa:</span> <Money v={club.balance} cur={world.config.currency} /></div>
        <div><span className="muted">Nível:</span> {levelLabel(club.level)}</div>
      </div>
      <div className="hr" />
      <h4>Destaques do elenco</h4>
      <div className="stack" style={{ gap: 4, marginTop: 6 }}>
        {players.slice(0, 7).map((p) => (
          <div key={p.id} className="row tight" style={{ justifyContent: 'space-between' }}>
            <span>{p.name} <span className="muted small">{p.pos} · {world.config.startYear - p.birthYear} anos</span></span>
            <Lvl v={ovrToLevel(p.ovr)} size="sm" />
          </div>
        ))}
      </div>
      <div className="hr" />
      <div className="small muted">Rivais: {club.rivals.length ? club.rivals.map((r) => world.clubs[r]?.name).join(', ') : '—'}</div>
    </Panel>
  );
}
