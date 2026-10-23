import { useMemo, useState } from 'react';
import type { Negotiation as Nego, Pos } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Tabs, Table, PName, PosB, LevelPair, Money, ClubName, Modal, Field, NumInput } from '../components/common';
import { Icon } from '../components/Icon';
import { cancelNegotiation, marketSearch, offerContract, respondOffer, startNegotiation, submitBid, windowOpen, nextWindowText, askingPrice, playerMarketStatus } from '../../engine/market/transfers';
import { POSITIONS, POS_NAME } from '../../engine/players/attributes';
import { fmtShort } from '../../engine/core/date';
import { roundMoney } from '../../engine/players/value';
import { potRange } from '../helpers';

type Tab = 'search' | 'shortlist' | 'free' | 'negos' | 'offers' | 'loans';

export function Market() {
  const s = useGame();
  const c = useCareer();
  const [tab, setTab] = useState<Tab>((s.route.tab as Tab) ?? 'search');
  const [f, setF] = useState({ q: '', pos: '' as Pos | '', minAge: 16, maxAge: 40, minLvl: 0, maxLvl: 25, maxValue: 0, country: '', listed: false });
  const [nego, setNego] = useState<{ pid: string; loan: boolean } | null>(null);
  const club = c.clubs[c.userClubId];
  const open = windowOpen(c);
  const results = useMemo(() => (tab === 'search' || tab === 'free' ? marketSearch(c, { ...f, maxValue: f.maxValue || undefined, free: tab === 'free', country: f.country || undefined }, 250) : []), [c, f, tab, s.version]);
  const offers = c.offers.filter((o) => o.toClubId === c.userClubId).slice().reverse();
  const negos = c.negotiations.slice().reverse();
  const cols = [
    { key: 'n', label: 'Jogador', render: (p: (typeof results)[number]) => <PName p={p} />, sort: (p: (typeof results)[number]) => p.name },
    { key: 'pos', label: 'Pos', render: (p: (typeof results)[number]) => <PosB pos={p.pos} /> },
    { key: 'age', label: 'Id', render: (p: (typeof results)[number]) => c.season - p.birthYear, sort: (p: (typeof results)[number]) => c.season - p.birthYear, cls: 'n' },
    { key: 'l', label: 'Nível', render: (p: (typeof results)[number]) => <LevelPair p={p} est={potRange(c, p)} />, sort: (p: (typeof results)[number]) => p.ovr },
    { key: 'cl', label: 'Clube', render: (p: (typeof results)[number]) => (p.clubId ? <ClubName id={p.clubId} short /> : <span className="chip good">Livre</span>) },
    { key: 'v', label: 'Valor', render: (p: (typeof results)[number]) => <Money v={p.value} />, sort: (p: (typeof results)[number]) => p.value, cls: 'n' },
    { key: 'w', label: 'Salário', render: (p: (typeof results)[number]) => <Money v={p.contract?.wage ?? 0} />, sort: (p: (typeof results)[number]) => p.contract?.wage ?? 0, cls: 'n' },
    { key: 'ct', label: 'Contrato', render: (p: (typeof results)[number]) => p.contract?.endYear ?? '—', cls: 'n' },
    { key: 'st', label: 'Situação', render: (p: (typeof results)[number]) => <span className="small">{playerMarketStatus(c, p)}</span> },
    { key: 'act', label: '', render: (p: (typeof results)[number]) => <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); setNego({ pid: p.id, loan: false }); }} disabled={!!p.loan}>{p.clubId ? 'Proposta' : 'Contratar'}</button> },
  ];
  return (
    <div className="page">
      <PageHead title="Mercado de transferências" sub={<span>{open ? <span className="chip good">Janela aberta</span> : <span className="chip warn">Janela fechada · {nextWindowText(c)}</span>} · Orçamento <Money v={club.transferBudget} /> · Saldo <Money v={club.balance} color /> {club.embargo && <span className="chip bad">Bloqueio de contratações</span>}</span>} />
      <Tabs tabs={[
        { id: 'search', label: 'Pesquisar' }, { id: 'shortlist', label: `Observados (${c.shortlist.length})` }, { id: 'free', label: 'Jogadores livres' },
        { id: 'negos', label: `Negociações (${negos.filter((n) => n.stage === 'club' || n.stage === 'player').length})` }, { id: 'offers', label: `Propostas recebidas (${offers.filter((o) => o.status === 'pending').length})` }, { id: 'loans', label: 'Empréstimos' },
      ]} value={tab} onChange={setTab} />
      {(tab === 'search' || tab === 'free') && (
        <Panel flush>
          <div className="row" style={{ padding: 12 }}>
            <input type="search" placeholder="Nome ou clube" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <select value={f.pos} onChange={(e) => setF({ ...f, pos: e.target.value as Pos | '' })}><option value="">Todas as posições</option>{POSITIONS.map((p) => <option key={p} value={p}>{POS_NAME[p]}</option>)}</select>
            <label className="inline">Idade <NumInput value={f.minAge} width={56} onChange={(v) => setF({ ...f, minAge: v })} />–<NumInput value={f.maxAge} width={56} onChange={(v) => setF({ ...f, maxAge: v })} /></label>
            <label className="inline">Nível <NumInput value={f.minLvl} width={52} min={0} max={25} onChange={(v) => setF({ ...f, minLvl: v })} />–<NumInput value={f.maxLvl} width={52} min={0} max={25} onChange={(v) => setF({ ...f, maxLvl: v })} /></label>
            <label className="inline">Valor máx. <NumInput value={f.maxValue} width={120} step={500000} onChange={(v) => setF({ ...f, maxValue: v })} /></label>
            {tab === 'search' && <select value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}><option value="">Todos os países</option>{c.config.countries.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</select>}
            {tab === 'search' && <label className="inline"><input type="checkbox" checked={f.listed} onChange={(e) => setF({ ...f, listed: e.target.checked })} />Só à venda</label>}
          </div>
          <Table rows={results} rowKey={(p) => p.id} cols={cols} onRow={(p) => store.go({ name: 'player', id: p.id })} maxRows={150} />
        </Panel>
      )}
      {tab === 'shortlist' && (
        <Panel flush>
          <Table rows={c.shortlist.map((id) => c.players[id]).filter(Boolean)} rowKey={(p) => p.id} cols={cols} onRow={(p) => store.go({ name: 'player', id: p.id })} empty="Use o botão Observar na ficha de um jogador para acompanhá-lo aqui." />
        </Panel>
      )}
      {tab === 'negos' && (
        <Panel flush>
          <Table rows={negos} rowKey={(n) => n.id} cols={[
            { key: 'p', label: 'Jogador', render: (n) => (c.players[n.playerId] ? <PName p={c.players[n.playerId]} /> : '—') },
            { key: 'c', label: 'Clube vendedor', render: (n) => (n.sellerId ? <ClubName id={n.sellerId} /> : 'Livre') },
            { key: 't', label: 'Tipo', render: (n) => (n.loan ? 'Empréstimo' : 'Compra') },
            { key: 's', label: 'Etapa', render: (n) => <span className={`chip ${n.stage === 'done' ? 'good' : n.stage === 'failed' ? 'bad' : 'info'}`}>{{ club: 'Proposta ao clube', player: 'Contrato com o jogador', done: 'Concluída', failed: 'Encerrada' }[n.stage]}</span> },
            { key: 'f', label: 'Valor', render: (n) => <Money v={n.fee} />, cls: 'n' },
            { key: 'a', label: '', render: (n) => (n.stage === 'club' || n.stage === 'player') && <button className="btn sm" onClick={() => setNego({ pid: n.playerId, loan: n.loan })}>Continuar</button> },
          ]} empty="Nenhuma negociação." />
        </Panel>
      )}
      {tab === 'offers' && (
        <Panel flush>
          <Table rows={offers} rowKey={(o) => o.id} cols={[
            { key: 'd', label: 'Data', render: (o) => fmtShort(o.day) },
            { key: 'p', label: 'Jogador', render: (o) => (c.players[o.playerId] ? <PName p={c.players[o.playerId]} /> : '—') },
            { key: 'c', label: 'Interessado', render: (o) => <ClubName id={o.fromClubId} /> },
            { key: 'f', label: 'Oferta', render: (o) => <Money v={o.fee} />, cls: 'n' },
            { key: 'v', label: 'Valor de mercado', render: (o) => <Money v={c.players[o.playerId]?.value ?? 0} />, cls: 'n' },
            { key: 's', label: 'Status', render: (o) => <span className="chip">{o.status === 'pending' ? `até ${fmtShort(o.expires)}` : { accepted: 'aceita', rejected: 'recusada', expired: 'expirada', completed: 'concluída' }[o.status]}</span> },
            { key: 'a', label: '', render: (o) => o.status === 'pending' && (
              <span className="row tight">
                <button className="btn sm go" onClick={() => store.act((cc) => { store.toast(respondOffer(cc, o.id, 'accept')); })}>Aceitar</button>
                <button className="btn sm" onClick={() => store.act((cc) => { store.toast(respondOffer(cc, o.id, 'counter', roundMoney(o.fee * 1.25))); })}>Pedir +25%</button>
                <button className="btn sm danger" onClick={() => store.act((cc) => { store.toast(respondOffer(cc, o.id, 'reject')); })}>Recusar</button>
              </span>
            ) },
          ]} empty="Nenhuma proposta recebida. Coloque jogadores à venda na ficha deles para atrair interessados." />
        </Panel>
      )}
      {tab === 'loans' && (
        <div className="grid g2">
          <Panel title="Disponíveis para empréstimo (outros clubes)" flush>
            <Table rows={Object.values(c.players).filter((p) => p.loanListed && p.clubId !== c.userClubId).slice(0, 80)} rowKey={(p) => p.id} cols={[
              cols[0], cols[1], cols[3], cols[4],
              { key: 'a', label: '', render: (p) => <button className="btn sm" onClick={() => setNego({ pid: p.id, loan: true })}>Pedir</button> },
            ]} empty="Nenhum jogador listado para empréstimo. Você também pode pedir qualquer jogador emprestado pela ficha dele." />
          </Panel>
          <Panel title="Meus jogadores emprestados" flush>
            <Table rows={Object.values(c.players).filter((p) => p.loan?.fromClubId === c.userClubId)} rowKey={(p) => p.id} cols={[
              cols[0], { key: 'to', label: 'Clube', render: (p) => <ClubName id={p.loan!.toClubId} short /> },
              { key: 'j', label: 'J', render: (p) => p.loan!.apps, cls: 'n' }, { key: 'g', label: 'G', render: (p) => p.loan!.goals, cls: 'n' },
              { key: 'm', label: 'Min', render: (p) => p.loan!.minutes, cls: 'n' }, { key: 'n', label: 'Nota', render: (p) => (p.loan!.apps ? (p.loan!.ratingSum / p.loan!.apps).toFixed(2) : '—'), cls: 'n' },
              { key: 'r', label: 'Retorno', render: (p) => fmtShort(p.loan!.until) },
            ]} empty="Nenhum jogador emprestado. Empreste pela ficha do jogador." />
          </Panel>
        </div>
      )}
      {nego && <Negotiation pid={nego.pid} loan={nego.loan} onClose={() => setNego(null)} />}
    </div>
  );
}

/** Fluxo de negociação em duas etapas: clube vendedor e depois o contrato com o jogador. */
export function Negotiation({ pid, loan, onClose }: { pid: string; loan: boolean; onClose: () => void }) {
  useGame();
  const c = useCareer();
  const p = c.players[pid];
  const [state] = useState(() => startNegotiation(c, pid, loan));
  const n: Nego | undefined = state.nego ? c.negotiations.find((x) => x.id === state.nego!.id) : undefined;
  const [fee, setFee] = useState(n?.askingPrice ?? 0);
  const [inst, setInst] = useState(1);
  const [wagePct, setWagePct] = useState(1);
  const [wage, setWage] = useState(n?.wageDemand ?? 0);
  const [years, setYears] = useState(n?.yearsDemand ?? 3);
  const [clause, setClause] = useState(0);
  const [log, setLog] = useState<string[]>(n?.log ?? []);
  if (!p) return null;
  if (state.error || !n) {
    return <Modal title={`Negociar ${p.name}`} size="narrow" onClose={onClose}><p>{state.error}</p></Modal>;
  }
  const seller = n.sellerId ? c.clubs[n.sellerId] : null;
  const push = (m: string) => setLog((l) => [...l, m]);
  return (
    <Modal title={<span className="row"><Icon name="transfer" /><h2>{loan ? 'Empréstimo' : 'Contratação'}: {p.name}</h2></span>} onClose={onClose} footer={<>{(n.stage === 'club' || n.stage === 'player') && <button className="btn danger" onClick={() => { cancelNegotiation(c, n.id); store.bump(); onClose(); }}>Desistir</button>}<button className="btn" onClick={onClose}>Fechar</button></>}>
      <div className="grid g2">
        <div className="stack">
          <div className="small muted">{seller ? <>Clube: <strong>{seller.name}</strong> · preço pedido <Money v={n.askingPrice} /> {seller && !loan && <>· (referência {Math.round((n.askingPrice / Math.max(1, askingPrice(c, p))) * 100)}%)</>}</> : 'Jogador livre: negocie direto o contrato.'}</div>
          {n.stage === 'club' && (
            <>
              <Field label={loan ? 'Taxa de empréstimo' : 'Valor da proposta'}><NumInput value={fee} step={50000} width={170} onChange={setFee} /></Field>
              {!loan && <Field label="Parcelamento"><select value={inst} onChange={(e) => setInst(Number(e.target.value))}>{[1, 2, 3, 4, 6, 12].map((x) => <option key={x} value={x}>{x === 1 ? 'À vista' : `${x}x mensais`}</option>)}</select></Field>}
              {loan && <Field label={`Você paga ${Math.round(wagePct * 100)}% do salário`}><input type="range" min={0.3} max={1} step={0.1} value={wagePct} onChange={(e) => setWagePct(Number(e.target.value))} /></Field>}
              {p.contract?.releaseClause && !loan && <div className="small muted">Cláusula de rescisão: <Money v={p.contract.releaseClause} /> (pagando esse valor o clube não pode recusar).</div>}
              <button className="btn primary" onClick={() => { const r = submitBid(c, n.id, fee, inst, wagePct); push(r.message); if (r.counter) setFee(r.counter); setWage(n.wageDemand); setYears(n.yearsDemand); store.bump(); }}>Enviar proposta</button>
            </>
          )}
          {n.stage === 'player' && (
            <>
              <div className="small">Pedido do jogador: <Money v={n.wageDemand} /> por ano · {n.yearsDemand} ano(s)</div>
              {!loan && <Field label="Salário anual"><NumInput value={wage} step={10000} width={170} onChange={setWage} /></Field>}
              {!loan && <Field label="Anos de contrato"><NumInput value={years} min={1} max={5} onChange={(v) => setYears(Math.max(1, Math.min(5, v)))} /></Field>}
              {!loan && <Field label="Cláusula de rescisão (opcional)"><NumInput value={clause} step={500000} width={170} onChange={setClause} /></Field>}
              <button className="btn primary" onClick={() => { const r = offerContract(c, n.id, wage, years, clause || undefined); push(r.message); if (r.wage) setWage(r.wage); if (r.years) setYears(r.years); store.bump(); }}>{loan ? 'Confirmar empréstimo' : 'Oferecer contrato'}</button>
            </>
          )}
          {n.stage === 'done' && <div className="chip good">Negócio concluído!</div>}
          {n.stage === 'failed' && <div className="chip bad">Negociação encerrada.</div>}
        </div>
        <div>
          <h4>Histórico da negociação</h4>
          <div className="stack" style={{ gap: 4, marginTop: 6 }}>{log.map((m, i) => <div key={i} className="small">• {m}</div>)}</div>
        </div>
      </div>
    </Modal>
  );
}
