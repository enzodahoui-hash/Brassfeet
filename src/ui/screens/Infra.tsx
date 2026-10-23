import { useState } from 'react';
import type { FacilityId } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Table, Money, Bar, Confirm } from '../components/common';
import { FACILITIES, cancelProject, clubEffects, facilityQuote, startProject } from '../../engine/infra/infra';
import { OPTIONS } from '../../engine/stadium/stadium';
import { fmtDay } from '../../engine/core/date';

export function ProjectsPanel({ kind }: { kind: 'facility' | 'stadium' }) {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const [cancel, setCancel] = useState<string | null>(null);
  const list = club.projects.filter((p) => p.kind === kind).slice().reverse();
  return (
    <Panel title="Projetos" flush>
      <Table rows={list} rowKey={(p) => p.id} cols={[
        { key: 'n', label: 'Obra', render: (p) => <span className="small">{p.label}</span> },
        { key: 'o', label: 'Opção', render: (p) => <span className="small">{OPTIONS[p.option].label}</span> },
        { key: 'l', label: 'Nível', render: (p) => `${p.fromLevel} → ${p.toLevel}`, cls: 'c' },
        { key: 'c', label: 'Custo', render: (p) => <Money v={p.cost} />, cls: 'n' },
        { key: 'd', label: 'Conclusão', render: (p) => fmtDay(p.end) },
        { key: 'p', label: 'Andamento', render: (p) => (p.status === 'building' ? <div style={{ width: 90 }}><Bar v={((c.day - p.start) / Math.max(1, p.end - p.start)) * 100} /></div> : <span className={`chip ${p.status === 'done' ? 'good' : 'bad'}`}>{p.status === 'done' ? 'concluída' : 'cancelada'}</span>) },
        { key: 'a', label: '', render: (p) => p.status === 'building' && <button className="btn sm danger" onClick={() => setCancel(p.id)}>Cancelar</button> },
      ]} empty="Nenhuma obra iniciada." />
      {cancel && (() => {
        const p = club.projects.find((x) => x.id === cancel)!;
        const prog = Math.min(1, (c.day - p.start) / Math.max(1, p.end - p.start));
        const refund = Math.round(p.paid * (1 - prog) * 0.5);
        return <Confirm title="Cancelar obra?" danger confirmLabel="Cancelar obra" text={<>A obra está {Math.round(prog * 100)}% concluída. Você recebe de volta <strong><Money v={refund} /></strong> e perde <strong><Money v={p.paid - refund} /></strong> já comprometidos. O nível da instalação não muda.</>} onNo={() => setCancel(null)} onYes={() => { store.act((cc) => cancelProject(cc, cancel).error ?? null, 'Obra cancelada.'); setCancel(null); }} />;
      })()}
    </Panel>
  );
}

export function Infra() {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const [opt, setOpt] = useState<keyof typeof OPTIONS>('standard');
  const [financed, setFinanced] = useState(false);
  const fx = clubEffects(c, club);
  const group = (g: 'tc' | 'youth') => FACILITIES.filter((f) => f.group === g);
  const row = (id: FacilityId) => {
    const def = FACILITIES.find((f) => f.id === id)!;
    const q = facilityQuote(club, id, opt);
    const lvl = club.facilities[id];
    return (
      <tr key={id}>
        <td><strong>{def.name}</strong><div className="tiny muted">{def.effect}</div></td>
        <td style={{ width: 120 }}><div className="row tight"><strong>{lvl}</strong>/10</div><Bar v={lvl * 10} /></td>
        <td className="n"><Money v={q.cost} /></td>
        <td className="n small">{q.days} dias</td>
        <td className="n small">+<Money v={q.maint} />/mês</td>
        <td>{q.blocked ? <span className="small muted">{q.blocked}</span> : <button className="btn sm primary" onClick={() => store.act((cc) => startProject(cc, { kind: 'facility', target: id, option: opt, financed }), 'Obra iniciada.')}>Construir ({q.from}→{q.to})</button>}</td>
      </tr>
    );
  };
  return (
    <div className="page">
      <PageHead title="Infraestrutura" sub="Investimentos de longo prazo: custos saem do caixa e os efeitos são calculados pelo sistema, sempre com limites."
        actions={<>
          <select value={opt} onChange={(e) => setOpt(e.target.value as keyof typeof OPTIONS)}>{(Object.keys(OPTIONS) as (keyof typeof OPTIONS)[]).map((k) => <option key={k} value={k}>{OPTIONS[k].label}</option>)}</select>
          {c.finance.financing && <label className="inline"><input type="checkbox" checked={financed} onChange={(e) => setFinanced(e.target.checked)} />Financiar (30% de entrada + 12 parcelas)</label>}
        </>} />
      <Panel flush>
        <div className="kpis">
          <div className="kpi"><div className="k">Qualidade do treino</div><div className="v">{Math.round(fx.training * 100)}%</div><div className="d">evolução do elenco</div></div>
          <div className="kpi"><div className="k">Formação na base</div><div className="v">{Math.round(fx.youthDev * 100)}%</div><div className="d">evolução dos jovens</div></div>
          <div className="kpi"><div className="k">Recuperação física</div><div className="v">{Math.round(fx.recovery * 100)}%</div></div>
          <div className="kpi"><div className="k">Risco de lesão</div><div className="v">{Math.round(fx.injuryRisk * 100)}%</div><div className="d">100% = referência</div></div>
          <div className="kpi"><div className="k">Entrosamento</div><div className="v">×{fx.cohesion.toFixed(2)}</div><div className="d">análise de desempenho</div></div>
          <div className="kpi"><div className="k">Vagas na base</div><div className="v">{fx.youthCapacity}</div><div className="d">alojamentos</div></div>
        </div>
      </Panel>
      <div style={{ height: 12 }} />
      <p className="small muted">Opção {OPTIONS[opt].label}: custo ×{OPTIONS[opt].cost}, prazo ×{OPTIONS[opt].days}, manutenção ×{OPTIONS[opt].maint}, {OPTIONS[opt].levels} nível(is) por obra. Saldo atual: <Money v={club.balance} color />.</p>
      <div className="grid g2">
        <Panel title="Centro de treinamento" flush>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Instalação</th><th>Nível</th><th className="n">Custo</th><th className="n">Prazo</th><th className="n">Manutenção</th><th /></tr></thead><tbody>{group('tc').map((f) => row(f.id))}</tbody></table></div>
        </Panel>
        <Panel title="Alojamentos e estrutura juvenil" flush>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Instalação</th><th>Nível</th><th className="n">Custo</th><th className="n">Prazo</th><th className="n">Manutenção</th><th /></tr></thead><tbody>{group('youth').map((f) => row(f.id))}</tbody></table></div>
        </Panel>
      </div>
      <div style={{ height: 12 }} />
      <ProjectsPanel kind="facility" />
    </div>
  );
}
