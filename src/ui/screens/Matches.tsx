import { useState } from 'react';
import type { Fixture } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Tabs, Table, ClubName, Form, PosB, Lvl, Stars, Empty } from '../components/common';
import { Crest } from '../components/graphics';
import { Icon } from '../components/Icon';
import { clubFixtures, fixturesOn } from '../../engine/career/index';
import { fmtDay, monthName, weekdayName, ymd, dayOf } from '../../engine/core/date';
import { compKey, leagueTable, roundName } from '../../engine/competitions/manager';

export function Matches() {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const [tab, setTab] = useState<'mine' | 'day' | 'cal'>('mine');
  const [day, setDay] = useState(c.day);
  const mine = clubFixtures(c, club.id).filter((f) => c.competitions[f.compId]?.season === c.season || f.day >= c.day - 400);
  return (
    <div className="page">
      <PageHead title="Partidas" sub={`Temporada ${c.season}`} />
      <Tabs tabs={[{ id: 'mine', label: 'Meus jogos' }, { id: 'day', label: 'Resultados por dia' }, { id: 'cal', label: 'Calendário' }]} value={tab} onChange={setTab} />
      {tab === 'mine' && (
        <Panel flush>
          <Table rows={mine} rowKey={(f) => f.id} onRow={(f) => f.status === 'played' && store.go({ name: 'match', id: f.id })} rowCls={(f) => (f.day === c.day ? 'me' : '')} cols={[
            { key: 'd', label: 'Data', render: (f) => <span className="nowrap">{weekdayName(f.day)} {fmtDay(f.day)}{f.day !== f.origDay && <span className="chip warn" data-tip={`Remarcado de ${fmtDay(f.origDay)}`}>remarcado</span>}</span> },
            { key: 'c', label: 'Competição', render: (f) => <span className="small">{c.competitions[f.compId]?.name}</span> },
            { key: 'r', label: 'Fase', render: (f) => <span className="small muted">{roundName(c, f)}</span> },
            { key: 'l', label: 'Local', render: (f) => (f.neutral ? 'Neutro' : f.home === club.id ? 'Casa' : 'Fora') },
            { key: 'o', label: 'Adversário', render: (f) => <ClubName id={f.home === club.id ? f.away : f.home} /> },
            { key: 's', label: 'Placar', render: (f) => <Score f={f} me={club.id} />, cls: 'c' },
          ]} />
        </Panel>
      )}
      {tab === 'day' && <DayResults day={day} setDay={setDay} />}
      {tab === 'cal' && <Calendar mine={mine} />}
    </div>
  );
}

function Score({ f, me }: { f: Fixture; me?: string }) {
  if (f.status !== 'played' || !f.result) return <span className="muted">—</span>;
  const r = f.result;
  let cls = '';
  if (me) {
    const ug = f.home === me ? r.hg : r.ag, og = f.home === me ? r.ag : r.hg;
    const w = ug > og || (ug === og && r.pens && (f.home === me ? r.pens[0] > r.pens[1] : r.pens[1] > r.pens[0]));
    cls = w ? 'pos' : ug === og && !r.pens ? 'warn' : 'neg';
  }
  return <span className={`strong ${cls}`}>{r.hg} – {r.ag}{r.et ? ' (prorr.)' : ''}{r.pens ? ` (${r.pens[0]}–${r.pens[1]} pên.)` : ''}</span>;
}

function DayResults({ day, setDay }: { day: number; setDay: (d: number) => void }) {
  const c = useCareer();
  const [region, setRegion] = useState('');
  const list = fixturesOn(c, day).filter((f) => !region || c.competitions[f.compId]?.region === region || c.config.countries.find((x) => x.code === c.competitions[f.compId]?.region)?.region === region).sort((a, b) => a.compId.localeCompare(b.compId));
  const byComp = new Map<string, Fixture[]>();
  for (const f of list) (byComp.get(f.compId) ?? byComp.set(f.compId, []).get(f.compId)!).push(f);
  return (
    <div className="stack">
      <div className="row">
        <button className="btn" onClick={() => setDay(day - 1)}><Icon name="back" />Dia anterior</button>
        <strong>{weekdayName(day)} {fmtDay(day)}</strong>
        <button className="btn" onClick={() => setDay(day + 1)}>Próximo dia</button>
        <button className="btn ghost" onClick={() => setDay(c.day)}>Hoje</button>
        <select value={region} onChange={(e) => setRegion(e.target.value)}><option value="">Todas as regiões</option><option value="SA">América do Sul</option><option value="EU">Europa</option></select>
      </div>
      {[...byComp.entries()].map(([cid, fs]) => (
        <Panel key={cid} title={c.competitions[cid]?.name} right={<button className="btn sm" onClick={() => store.go({ name: 'comp', id: cid })}>Competição</button>} flush>
          <Table rows={fs} rowKey={(f) => f.id} onRow={(f) => f.status === 'played' && store.go({ name: 'match', id: f.id })} rowCls={(f) => (f.home === c.userClubId || f.away === c.userClubId ? 'me' : '')} cols={[
            { key: 'h', label: 'Mandante', render: (f) => <ClubName id={f.home} />, cls: '' },
            { key: 's', label: '', render: (f) => <Score f={f} />, cls: 'c' },
            { key: 'a', label: 'Visitante', render: (f) => <ClubName id={f.away} /> },
            { key: 'r', label: 'Fase', render: (f) => <span className="small muted">{roundName(c, f)}</span> },
            { key: 'p', label: 'Público', render: (f) => (f.result ? f.result.attendance.toLocaleString('pt-BR') : ''), cls: 'n' },
          ]} />
        </Panel>
      ))}
      {!list.length && <Empty>Nenhuma partida neste dia.</Empty>}
    </div>
  );
}

function Calendar({ mine }: { mine: Fixture[] }) {
  const c = useCareer();
  const [month, setMonth] = useState(ymd(c.day).m);
  const y = c.season;
  const first = dayOf(y, month, 1);
  const days = new Date(Date.UTC(y, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(y, month - 1, 1)).getUTCDay() + 6) % 7;
  const byDay = new Map(mine.map((f) => [f.day, f]));
  return (
    <Panel title={`${monthName(month)} de ${y}`} right={<><button className="btn sm" disabled={month === 1} onClick={() => setMonth(month - 1)}>‹</button><button className="btn sm" disabled={month === 12} onClick={() => setMonth(month + 1)}>›</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 4 }}>
        {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => <div key={d} className="tiny muted center">{d}</div>)}
        {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = first + i;
          const f = byDay.get(d);
          const today = d === c.day;
          return (
            <div key={d} onClick={() => f?.status === 'played' && store.go({ name: 'match', id: f.id })} style={{ minHeight: 64, padding: 4, borderRadius: 6, border: `1px solid ${today ? 'var(--accent)' : 'var(--line)'}`, background: f ? 'var(--panel-2)' : 'transparent', cursor: f?.status === 'played' ? 'pointer' : undefined }}>
              <div className="tiny muted">{i + 1}</div>
              {f && <div className="tiny"><ClubName id={f.home === c.userClubId ? f.away : f.home} short /> <span className="muted">{f.home === c.userClubId ? '(c)' : '(f)'}</span><div><Score f={f} me={c.userClubId} /></div><div className="muted">{c.competitions[f.compId]?.name.replace(/ \d+$/, '').slice(0, 18)}</div></div>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function MatchReport({ id, tab: initialTab }: { id: string; tab?: string }) {
  useGame();
  const c = useCareer();
  const f = c.fixtures[id];
  const [tab, setTab] = useState<'sum' | 'relato' | 'lineups'>((initialTab as 'relato') ?? 'sum');
  if (!f) return <div className="page"><PageHead back title="Partida não encontrada" /></div>;
  const comp = c.competitions[f.compId];
  const r = f.result;
  const home = c.clubs[f.home];
  const away = c.clubs[f.away];
  if (!r) return <div className="page"><PageHead back title={`${home.name} x ${away.name}`} sub={`${comp.name} · ${fmtDay(f.day)} · ainda não disputada`} /></div>;
  const league = comp.kind === 'league' ? comp : c.competitions[compKey(home.divisionId, c.season)];
  const table = league && league.kind === 'league' ? leagueTable(c, league) : [];
  const pos = (id2: string) => table.findIndex((x) => x.clubId === id2) + 1;
  const stats: [string, number, number, string?][] = [
    ['Posse de bola', r.stats.poss[0], r.stats.poss[1], '%'], ['Finalizações', r.stats.shots[0], r.stats.shots[1]], ['No alvo', r.stats.sot[0], r.stats.sot[1]], ['Gols esperados (xG)', r.stats.xg[0], r.stats.xg[1]],
    ['Escanteios', r.stats.corners[0], r.stats.corners[1]], ['Faltas', r.stats.fouls[0], r.stats.fouls[1]], ['Defesas do goleiro', r.stats.saves[0], r.stats.saves[1]], ['Impedimentos', r.stats.offsides[0], r.stats.offsides[1]],
    ['Cartões amarelos', r.stats.yellows[0], r.stats.yellows[1]], ['Cartões vermelhos', r.stats.reds[0], r.stats.reds[1]],
  ];
  const motm = r.motm ? c.players[r.motm] : null;
  return (
    <div className="page">
      <PageHead back title={`${home.short} ${r.hg} x ${r.ag} ${away.short}`} sub={`${comp.name} · ${roundName(c, f)} · ${fmtDay(f.day)} · ${f.neutral ? 'campo neutro' : home.stadium.name} · ${r.attendance.toLocaleString('pt-BR')} torcedores`} />
      <Panel flush>
        <div className="scoreboard">
          <div className="team"><Crest crest={home.crest} size={54} /><div><div className="tname">{home.name}</div><div className="small muted">{pos(home.id) ? `${pos(home.id)}º na liga` : ''}</div></div></div>
          <div><div className="score">{r.hg} – {r.ag}</div><div className="clock">{r.pens ? `Pênaltis ${r.pens[0]}–${r.pens[1]}` : r.et ? 'Após prorrogação' : 'Encerrado'}</div></div>
          <div className="team away"><Crest crest={away.crest} size={54} /><div><div className="tname">{away.name}</div><div className="small muted">{pos(away.id) ? `${pos(away.id)}º na liga` : ''}</div></div></div>
        </div>
        <div className="grid g2" style={{ padding: 12 }}>
          <div className="stack" style={{ gap: 4 }}>
            {r.goals.filter((g) => g.club === f.home).map((g, i) => <GoalLine key={i} g={g} />)}
          </div>
          <div className="stack right" style={{ gap: 4 }}>
            {r.goals.filter((g) => g.club === f.away).map((g, i) => <GoalLine key={i} g={g} />)}
          </div>
        </div>
      </Panel>
      <div style={{ height: 12 }} />
      <Tabs tabs={[{ id: 'sum', label: 'Estatísticas' }, { id: 'relato', label: 'Relato' }, { id: 'lineups', label: 'Escalações e notas' }]} value={tab} onChange={setTab} />
      {tab === 'sum' && (
        <div className="grid g2">
          <Panel title="Números da partida">
            <div className="stack" style={{ gap: 8 }}>
              {stats.map(([l, a, b, suf]) => (
                <div key={l} className="statline">
                  <span className="val">{a}{suf ?? ''}</span><span className="lab">{l}</span><span className="val right">{b}{suf ?? ''}</span>
                  <div className="duo"><i style={{ width: `${(a / Math.max(0.01, a + b)) * 100}%` }} /><i style={{ width: `${(b / Math.max(0.01, a + b)) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </Panel>
          <div className="stack">
            {motm && <Panel title="Melhor em campo"><div className="row"><strong>{motm.name}</strong><Stars p={motm} /><span className="muted">{r.ratings?.[motm.id]?.toFixed(1)}</span></div></Panel>}
            {r.report && <Panel title="Relatório tático">{r.report.map((l, i) => <div key={i} className="small" style={{ marginBottom: 4 }}>• {l}</div>)}</Panel>}
            <Panel title="Cartões e ocorrências">
              {r.cards.map((cd, i) => <div key={i} className="small">{cd.min}' <span className="swatch" style={{ width: 9, height: 13, background: cd.red ? 'var(--loss)' : 'var(--draw)' }} /> {c.players[cd.pid]?.name ?? '—'} ({c.clubs[cd.club]?.short})</div>)}
              {r.injuries.map((inj, i) => <div key={`i${i}`} className="small neg">{inj.min}' lesão: {c.players[inj.pid]?.name}</div>)}
              {!r.cards.length && !r.injuries.length && <div className="small muted">Sem cartões ou lesões.</div>}
            </Panel>
            {table.length > 0 && (
              <Panel title="Impacto na classificação" flush>
                <div className="tbl-wrap"><table className="tbl"><tbody>{table.slice(0, 20).filter((x) => x.clubId === home.id || x.clubId === away.id).map((x) => <tr key={x.clubId}><td className="n">{pos(x.clubId)}º</td><td><ClubName id={x.clubId} /></td><td className="n">{x.pts} pts</td><td><Form f={x.form} /></td></tr>)}</tbody></table></div>
              </Panel>
            )}
          </div>
        </div>
      )}
      {tab === 'relato' && (
        <Panel flush>
          {r.events?.length ? (
            <div className="feed" style={{ maxHeight: 'none' }}>
              {r.events.map((e, i) => (
                <div key={i} className={`feed-row ${e.type === 'goal' ? 'goal' : e.type === 'card' && e.big ? 'red' : e.big ? 'big' : ''}`}>
                  <span className="m">{e.min}'</span>
                  <span>{e.side >= 0 && <Crest crest={(e.side === 0 ? home : away).crest} size={16} />}</span>
                  <span>{e.text}</span>
                </div>
              ))}
            </div>
          ) : <Empty>O relato completo é registrado apenas nos jogos do seu clube.</Empty>}
        </Panel>
      )}
      {tab === 'lineups' && (
        <div className="grid g2">
          {[0, 1].map((side) => {
            const ids = r.lineups?.[side] ?? [];
            const subs = (r.subs ?? []).filter((s) => s.club === (side === 0 ? f.home : f.away));
            return (
              <Panel key={side} title={(side === 0 ? home : away).name} flush>
                {ids.length ? (
                  <div className="tbl-wrap"><table className="tbl"><tbody>
                    {ids.map((pid) => { const p = c.players[pid]; return p ? <tr key={pid}><td><PosB pos={p.pos} /></td><td>{p.name}<Stars p={p} /></td><td className="n"><Lvl v={r.ratings?.[pid] ?? 6} size="sm" tip="Nota da partida" /></td><td className="n strong">{r.ratings?.[pid]?.toFixed(1)}</td></tr> : null; })}
                    {subs.map((s, i) => <tr key={`s${i}`}><td className="small muted">{s.min}'</td><td className="small">↑ {c.players[s.in]?.name} <span className="muted">↓ {c.players[s.out]?.name}</span></td><td /><td className="n">{r.ratings?.[s.in]?.toFixed(1)}</td></tr>)}
                  </tbody></table></div>
                ) : <Empty>Escalações completas são guardadas apenas nos jogos do seu clube.</Empty>}
              </Panel>
            );
          })}
        </div>
      )}
      <p className="tiny muted">Semente da partida: {f.seed} (o resultado é reproduzível a partir da semente e das intervenções registradas{r.interventions ? `: ${r.interventions}` : ''}).</p>
    </div>
  );
}

function GoalLine({ g }: { g: NonNullable<Fixture['result']>['goals'][number] }) {
  const c = useCareer();
  const p = c.players[g.pid];
  const a = g.aid ? c.players[g.aid] : null;
  return (
    <div className={`small ${g.disallowed ? 'muted' : ''}`} style={{ textDecoration: g.disallowed ? 'line-through' : undefined }}>
      <Icon name="ball" className="star-ico" /> {g.min}' <strong>{p?.name ?? '?'}</strong>{g.type === 'pen' ? ' (pên.)' : g.type === 'fk' ? ' (falta)' : g.type === 'header' ? ' (cabeça)' : ''}{a ? <span className="muted"> · {a.name}</span> : ''}{g.disallowed ? ' — anulado' : ''}
    </div>
  );
}
