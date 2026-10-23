import { useState } from 'react';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Table, Money, Bar } from '../components/common';
import { StadiumView } from '../components/graphics';
import { ProjectsPanel } from './Infra';
import { OPTIONS, STADIUM_WORKS, availableCapacity, averageAttendance, stadiumMonthlyCost, stadiumQuality, totalCapacity, workQuote } from '../../engine/stadium/stadium';
import { startProject } from '../../engine/infra/infra';
import { fmtDay } from '../../engine/core/date';

export function StadiumPage() {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const st = club.stadium;
  const [opt, setOpt] = useState<keyof typeof OPTIONS>('standard');
  const [sector, setSector] = useState(st.sectors[0].id);
  const [financed, setFinanced] = useState(false);
  const [name, setName] = useState(st.name);
  const gates = club.ledger.filter((e) => e.cat === 'bilheteria' || e.cat === 'camarotes' || e.cat === 'produtos').slice(-30);
  const perMatch = gates.length ? gates.reduce((s, e) => s + e.amount, 0) / Math.max(1, new Set(gates.map((e) => e.key.split('|')[1])).size) : 0;
  const cap = totalCapacity(st);
  const avg = averageAttendance(club);
  return (
    <div className="page">
      <PageHead title={st.name} sub={`Capacidade ${cap.toLocaleString('pt-BR')} · disponível ${availableCapacity(st).toLocaleString('pt-BR')} · ${club.city}`}
        actions={<><input type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Nome do estádio" /><button className="btn" disabled={!name.trim() || name === st.name} onClick={() => store.act((cc) => { const s = cc.clubs[cc.userClubId].stadium; s.history.push({ day: cc.day, desc: `Estádio renomeado de "${s.name}" para "${name.trim()}"`, cost: 0 }); s.name = name.trim(); }, 'Estádio renomeado.')}>Renomear</button></>} />
      <div className="grid g-main">
        <div className="stack">
          <Panel><StadiumView st={st} colors={club.colors} /></Panel>
          <Panel title="Setores" flush>
            <Table rows={st.sectors} rowKey={(s) => s.id} cols={[
              { key: 'n', label: 'Setor', render: (s) => s.name }, { key: 'c', label: 'Capacidade', render: (s) => s.capacity.toLocaleString('pt-BR'), cls: 'n' },
              { key: 't', label: 'Anéis', render: (s) => s.tiers, cls: 'n' }, { key: 'v', label: 'Coberto', render: (s) => (s.covered ? 'Sim' : 'Não') },
              { key: 'a', label: 'Assentos', render: (s) => `${s.seatLevel}/10` }, { key: 'x', label: 'Interditados', render: (s) => (s.closed ? <span className="neg">{s.closed.toLocaleString('pt-BR')}</span> : '—'), cls: 'n' },
            ]} />
          </Panel>
          <Panel title="Obras disponíveis" right={<>
            <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Setor">{st.sectors.map((s) => <option key={s.id} value={s.id}>Setor {s.name}</option>)}</select>
            <select value={opt} onChange={(e) => setOpt(e.target.value as keyof typeof OPTIONS)} aria-label="Opção">{(Object.keys(OPTIONS) as (keyof typeof OPTIONS)[]).map((k) => <option key={k} value={k}>{OPTIONS[k].label}</option>)}</select>
            {c.finance.financing && <label className="inline small"><input type="checkbox" checked={financed} onChange={(e) => setFinanced(e.target.checked)} />Financiar</label>}
          </>} flush>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Obra</th><th>Atual</th><th className="n">Custo</th><th className="n">Prazo</th><th className="n">Manutenção</th><th /></tr></thead>
                <tbody>
                  {STADIUM_WORKS.map((w) => {
                    const q = workQuote(club, w.id, opt, w.sector ? sector : undefined);
                    return (
                      <tr key={w.id}>
                        <td><strong>{w.label}</strong>{w.sector && <span className="muted small"> · setor {st.sectors.find((s) => s.id === sector)?.name}</span>}<div className="tiny muted">{w.desc} Efeito: {w.effect}.{q.closed ? ` Interdita ${q.closed.toLocaleString('pt-BR')} lugares durante a obra.` : ''}{q.seats ? ` +${q.seats.toLocaleString('pt-BR')} lugares.` : ''}</div></td>
                        <td className="small">{w.id === 'cover' ? (q.from ? 'coberto' : 'descoberto') : `${q.from}`}</td>
                        <td className="n"><Money v={q.cost} /></td>
                        <td className="n small">{q.days} dias</td>
                        <td className="n small">+<Money v={q.maint} /></td>
                        <td>{q.blocked ? <span className="small muted">{q.blocked}</span> : <button className="btn sm primary" onClick={() => store.act((cc) => startProject(cc, { kind: 'stadium', target: w.id, option: opt, sectorId: w.sector ? sector : undefined, financed }), 'Obra iniciada.')}>Iniciar</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          <ProjectsPanel kind="stadium" />
        </div>
        <div className="stack">
          <Panel title="Indicadores">
            <div className="grid g2 small">
              <div><div className="muted">Público médio</div><div className="strong">{avg.toLocaleString('pt-BR')}</div></div>
              <div><div className="muted">Ocupação média</div><div className="strong">{cap ? Math.round((avg / cap) * 100) : 0}%</div></div>
              <div><div className="muted">Receita por jogo</div><div className="strong"><Money v={perMatch} /></div></div>
              <div><div className="muted">Custo mensal</div><div className="strong"><Money v={stadiumMonthlyCost(club)} /></div></div>
              <div><div className="muted">Qualidade geral</div><div className="strong">{Math.round(stadiumQuality(st) * 100)}%</div></div>
              <div><div className="muted">Ingresso médio</div><div className="strong">{st.ticketPrice} {c.config.currency}</div></div>
              <div><div className="muted">Camarotes</div><div className="strong">{st.boxes}</div></div>
              <div><div className="muted">Área VIP</div><div className="strong">{st.vip}/10</div></div>
            </div>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => store.go({ name: 'finance' })}>Ajustar preço do ingresso em Finanças</button>
          </Panel>
          <Panel title="Gramado e campo">
            <div className="stack small" style={{ gap: 6 }}>
              <div>Estado do gramado: <strong>{Math.round(st.pitch.condition)}%</strong><Bar v={st.pitch.condition} color={st.pitch.condition > 70 ? 'var(--win)' : st.pitch.condition > 45 ? 'var(--draw)' : 'var(--loss)'} /></div>
              {([['quality', 'Qualidade do gramado'], ['drainage', 'Drenagem'], ['irrigation', 'Irrigação'], ['lighting', 'Iluminação'], ['maintenance', 'Manutenção'], ['trainingPitch', 'Campo anexo']] as const).map(([k, l]) => <div key={k} className="row" style={{ justifyContent: 'space-between' }}><span>{l}</span><strong>{st.pitch[k]}/10</strong></div>)}
              <div className="tiny muted">Gramado ruim reduz a qualidade do jogo e eleva o risco de lesões; cada jogo em casa desgasta o campo, recuperado diariamente pela manutenção e irrigação.</div>
            </div>
          </Panel>
          <Panel title="Estrutura">
            <div className="stack small" style={{ gap: 4 }}>
              {([['shops', 'Lojas oficiais'], ['restaurants', 'Restaurantes'], ['parking', 'Estacionamento'], ['screens', 'Painéis eletrônicos'], ['accessibility', 'Acessibilidade'], ['security', 'Segurança'], ['press', 'Imprensa']] as const).map(([k, l]) => <div key={k} className="row" style={{ justifyContent: 'space-between' }}><span>{l}</span><strong>{st[k]}/10</strong></div>)}
            </div>
          </Panel>
          <Panel title="Histórico de reformas">
            {st.history.length ? st.history.slice().reverse().map((h, i) => <div key={i} className="small">{fmtDay(h.day)} — {h.desc}</div>) : <div className="small muted">Nenhuma reforma registrada.</div>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
