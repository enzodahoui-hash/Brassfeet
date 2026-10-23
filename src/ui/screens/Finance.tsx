import { useMemo, useState } from 'react';
import type { LedgerCategory } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Tabs, Table, Money, Bars, Field, NumInput, money } from '../components/common';
import { EXPENSE_CATS, INCOME_CATS, sumBy } from '../../engine/finance/ledger';
import { FINANCE_MODES, injectCapital, takeBankLoan } from '../../engine/finance/economy';
import { dayOf, fmtDay, monthName } from '../../engine/core/date';
import { wageBill } from '../../engine/universe/world';
import { facilitiesMonthlyCost, youthMonthlyCost } from '../../engine/infra/infra';
import { computeAttendance, referenceTicket, stadiumMonthlyCost } from '../../engine/stadium/stadium';
import { nextClubFixture } from '../../engine/career/index';

type Tab = 'sum' | 'ledger' | 'invest' | 'credit' | 'tickets';

export function Finance() {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const [tab, setTab] = useState<Tab>('sum');
  const yStart = dayOf(c.season, 1, 1);
  const season = sumBy(club, yStart, yStart + 366);
  const monthly = useMemo(() => {
    const out: { label: string; v: number; v2: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const a = dayOf(c.season, m, 1);
      const b = m === 12 ? dayOf(c.season, 12, 31) : dayOf(c.season, m + 1, 1) - 1;
      const s = sumBy(club, a, b);
      out.push({ label: monthName(m).slice(0, 3), v: s.totalIn, v2: s.totalOut });
    }
    return out;
  }, [club, c.season, club.ledger.length]);
  const cur = c.config.currency;
  return (
    <div className="page">
      <PageHead title="Finanças" sub={<span>Modo financeiro: <strong>{FINANCE_MODES[c.finance.mode].name}</strong>{c.finance.unlimited ? ' (recursos ilimitados)' : ''} · valores do universo do jogo, não balanços oficiais</span>} />
      <Panel flush>
        <div className="kpis">
          <div className="kpi"><div className="k">Saldo</div><div className="v"><Money v={club.balance} color /></div></div>
          <div className="kpi"><div className="k">Receitas {c.season}</div><div className="v pos">{money(season.totalIn, cur)}</div></div>
          <div className="kpi"><div className="k">Despesas {c.season}</div><div className="v neg">{money(season.totalOut, cur)}</div></div>
          <div className="kpi"><div className="k">Resultado</div><div className="v"><Money v={season.totalIn - season.totalOut} color /></div></div>
          <div className="kpi"><div className="k">Orçamento transferências</div><div className="v"><Money v={club.transferBudget} /></div></div>
          <div className="kpi"><div className="k">Folha anual / limite</div><div className="v"><Money v={wageBill(c, club)} /></div><div className="d">limite <Money v={club.wageBudget} /></div></div>
        </div>
      </Panel>
      <div style={{ height: 12 }} />
      <Tabs tabs={[{ id: 'sum', label: 'Resumo' }, { id: 'ledger', label: 'Lançamentos' }, { id: 'invest', label: 'Investimentos e retorno' }, { id: 'credit', label: 'Crédito e aportes' }, { id: 'tickets', label: 'Ingressos' }]} value={tab} onChange={setTab} />
      {tab === 'sum' && (
        <div className="grid g-main">
          <Panel title={`Fluxo de caixa mensal ${c.season}`} right={<span className="small"><span className="swatch" style={{ background: 'var(--pitch)', width: 10, height: 10 }} /> receitas <span className="swatch" style={{ background: 'var(--loss)', width: 10, height: 10 }} /> despesas</span>}>
            <Bars data={monthly} height={150} fmt={(v) => money(v, cur)} />
          </Panel>
          <Panel title="Próximos compromissos (mensais)">
            <div className="stack small" style={{ gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>Folha de jogadores (≈ mês)</span><Money v={-wageBill(c, club) / 12} /></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>Manutenção do estádio</span><Money v={-stadiumMonthlyCost(club)} /></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>Manutenção das instalações</span><Money v={-facilitiesMonthlyCost(club)} /></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>Operação da base</span><Money v={-youthMonthlyCost(club)} /></div>
              {club.installments.map((i) => <div key={i.id} className="row" style={{ justifyContent: 'space-between' }}><span>{i.desc} ({i.remaining}x)</span><Money v={-i.amountPerMonth} /></div>)}
              {club.loans.map((l) => <div key={l.id} className="row" style={{ justifyContent: 'space-between' }}><span>Empréstimo bancário ({l.remaining}x)</span><Money v={-l.monthly} /></div>)}
            </div>
          </Panel>
          <Panel title={`Receitas por categoria (${c.season})`} flush>
            <CatTable data={season.income} cats={INCOME_CATS} />
          </Panel>
          <Panel title={`Despesas por categoria (${c.season})`} flush>
            <CatTable data={season.expense} cats={EXPENSE_CATS} neg />
          </Panel>
        </div>
      )}
      {tab === 'ledger' && <Ledger />}
      {tab === 'invest' && <Investments />}
      {tab === 'credit' && <Credit />}
      {tab === 'tickets' && <Tickets />}
    </div>
  );
}

function CatTable({ data, cats, neg }: { data: Record<string, number>; cats: LedgerCategory[]; neg?: boolean }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  const rows = cats.filter((k) => data[k]).sort((a, b) => data[b] - data[a]);
  return (
    <Table rows={rows} rowKey={(k) => k} cols={[
      { key: 'k', label: 'Categoria', render: (k) => <span style={{ textTransform: 'capitalize' }}>{k}</span> },
      { key: 'v', label: 'Valor', render: (k) => <Money v={neg ? -data[k] : data[k]} color />, cls: 'n' },
      { key: 'p', label: '%', render: (k) => `${Math.round((data[k] / Math.max(1, total)) * 100)}%`, cls: 'n' },
    ]} empty="Sem lançamentos nesta temporada." />
  );
}

function Ledger() {
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const [cat, setCat] = useState('');
  const [type, setType] = useState<'' | 'in' | 'out'>('');
  const [period, setPeriod] = useState<'season' | '30' | '90' | 'all'>('season');
  const from = period === 'season' ? dayOf(c.season, 1, 1) : period === 'all' ? 0 : c.day - Number(period);
  const rows = club.ledger.filter((e) => e.day >= from && (!cat || e.cat === cat) && (!type || (type === 'in' ? e.amount > 0 : e.amount < 0))).slice().reverse();
  const total = rows.reduce((s, e) => s + e.amount, 0);
  return (
    <Panel flush>
      <div className="row" style={{ padding: 12 }}>
        <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}><option value="season">Temporada atual</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="all">Tudo</option></select>
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="">Receitas e despesas</option><option value="in">Só receitas</option><option value="out">Só despesas</option></select>
        <select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas as categorias</option>{[...INCOME_CATS, ...EXPENSE_CATS].map((k) => <option key={k} value={k}>{k}</option>)}</select>
        <span className="small">Total filtrado: <Money v={total} color /></span>
      </div>
      <Table rows={rows} rowKey={(e) => e.id} maxRows={400} cols={[
        { key: 'd', label: 'Data', render: (e) => fmtDay(e.day), sort: (e) => e.day },
        { key: 'c', label: 'Categoria', render: (e) => <span className="chip">{e.cat}</span> },
        { key: 'x', label: 'Descrição', render: (e) => <span className="small">{e.desc}</span> },
        { key: 'v', label: 'Valor', render: (e) => <Money v={e.amount} color />, sort: (e) => e.amount, cls: 'n' },
      ]} empty="Nenhum lançamento com esses filtros." />
    </Panel>
  );
}

function Investments() {
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const inv = club.totalInvested;
  const done = club.projects.filter((p) => p.status === 'done');
  const before = (day: number, cats: LedgerCategory[]) => {
    const a = sumBy(club, day - 120, day - 1);
    const b = sumBy(club, day + 1, Math.min(c.day, day + 120));
    const span = Math.max(1, Math.min(120, c.day - day));
    const sum = (x: Record<string, number>) => cats.reduce((s, k) => s + (x[k] ?? 0), 0);
    return { before: sum(a.income) / 4, after: (sum(b.income) / span) * 30 };
  };
  return (
    <div className="grid g2">
      <Panel title="Investimentos acumulados">
        <div className="stack small" style={{ gap: 4 }}>
          {[['youth', 'Base (estrutura juvenil)'], ['training', 'Centro de treinamento'], ['stadium', 'Estádio'], ['kits', 'Uniformes (produção e marketing)'], ['staff', 'Comissão técnica (luvas e cursos)']].map(([k, l]) => (
            <div key={k} className="row" style={{ justifyContent: 'space-between' }}><span>{l}</span><strong><Money v={inv[k] ?? 0} /></strong></div>
          ))}
          <div className="hr" />
          <div className="row" style={{ justifyContent: 'space-between' }}><span>Obras em andamento</span><strong>{club.projects.filter((p) => p.status === 'building').length}</strong></div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span>Manutenção mensal (estádio + instalações)</span><strong><Money v={stadiumMonthlyCost(club) + facilitiesMonthlyCost(club)} /></strong></div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span>Receita de camisas (todas as coleções)</span><strong><Money v={club.kits.reduce((s, k) => s + k.revenue, 0)} /></strong></div>
        </div>
      </Panel>
      <Panel title="Antes e depois das obras do estádio" flush>
        <Table rows={done.filter((p) => p.kind === 'stadium')} rowKey={(p) => p.id} cols={[
          { key: 'n', label: 'Obra', render: (p) => <span className="small">{p.label}</span> },
          { key: 'd', label: 'Concluída', render: (p) => fmtDay(p.end) },
          { key: 'b', label: 'Receita de jogo/mês antes', render: (p) => <Money v={before(p.end, ['bilheteria', 'camarotes', 'produtos']).before} />, cls: 'n' },
          { key: 'a', label: 'Depois (estimativa)', render: (p) => <Money v={before(p.end, ['bilheteria', 'camarotes', 'produtos']).after} />, cls: 'n' },
        ]} empty="Nenhuma obra de estádio concluída ainda." />
        <p className="tiny muted" style={{ padding: '0 12px 10px' }}>Comparação com lançamentos efetivamente registrados (120 dias antes e depois). Outros fatores — calendário, adversários, desempenho — também influenciam; trate como estimativa, não como efeito exclusivo da obra.</p>
      </Panel>
    </div>
  );
}

function Credit() {
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const [amount, setAmount] = useState(Math.round(club.revenueBase * 0.2));
  const [months, setMonths] = useState(24);
  const [inj, setInj] = useState(10_000_000);
  return (
    <div className="grid g2">
      <Panel title="Empréstimo bancário">
        {c.finance.financing ? (
          <div className="stack">
            <Field label="Valor"><NumInput value={amount} step={500000} width={160} onChange={setAmount} /></Field>
            <Field label="Parcelas (meses)"><select value={months} onChange={(e) => setMonths(Number(e.target.value))}>{[12, 24, 36, 48].map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
            <button className="btn primary" onClick={() => store.act((cc) => takeBankLoan(cc, amount, months), 'Empréstimo contratado.')}>Contratar empréstimo</button>
            <div className="tiny muted">Juros de 1,2% ao mês (2% com saldo negativo). Limite de crédito proporcional às receitas recorrentes do clube.</div>
          </div>
        ) : <div className="small muted">Empréstimos desativados na configuração financeira desta carreira.</div>}
      </Panel>
      <Panel title="Aportes extraordinários">
        {c.finance.allowInjections ? (
          <div className="stack">
            <Field label="Valor do aporte"><NumInput value={inj} step={1000000} width={160} onChange={setInj} /></Field>
            <button className="btn primary" onClick={() => store.act((cc) => injectCapital(cc, inj, 'Aporte extraordinário do investidor'), 'Aporte registrado.')}>Registrar aporte</button>
            <div className="tiny muted">Aportes aparecem na categoria "aporte", separados da receita operacional.</div>
          </div>
        ) : <div className="small muted">Aportes não estão habilitados nesta carreira (escolha os modos Investidor ou Casual ao criar a carreira).</div>}
      </Panel>
    </div>
  );
}

function Tickets() {
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const next = nextClubFixture(c, club.id, c.day);
  const homeNext = next && next.home === club.id ? next : null;
  const att = homeNext ? computeAttendance(c, homeNext, c.competitions[homeNext.compId]) : null;
  return (
    <Panel title="Preço do ingresso">
      <div className="stack">
        <Field label={`Preço médio: ${club.stadium.ticketPrice} ${c.config.currency} (referência do mercado: ${referenceTicket(club)})`}>
          <input type="range" min={Math.max(2, Math.round(referenceTicket(club) * 0.3))} max={Math.round(referenceTicket(club) * 3)} value={club.stadium.ticketPrice} onChange={(e) => store.act((cc) => { cc.clubs[cc.userClubId].stadium.ticketPrice = Number(e.target.value); })} />
        </Field>
        {att ? (
          <div className="small">Próximo jogo em casa ({c.clubs[homeNext!.away].name}, {fmtDay(homeNext!.day)}): demanda estimada {att.demand.toLocaleString('pt-BR')}, público {att.attendance.toLocaleString('pt-BR')} ({Math.round(att.occupancy * 100)}% de ocupação), bilheteria <Money v={att.gate} />, camarotes <Money v={att.boxes} />, consumo <Money v={att.concessions} />.</div>
        ) : <div className="small muted">Sem jogo em casa próximo para estimar o público.</div>}
        <div className="tiny muted">A demanda depende da torcida, importância do jogo, adversário, momento do time, posição na tabela, preço e qualidade do estádio. Ingressos caros reduzem o público.</div>
      </div>
    </Panel>
  );
}
