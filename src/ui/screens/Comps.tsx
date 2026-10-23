import { useMemo, useState } from 'react';
import type { CompInstance, Stage, StandingRow } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Tabs, Table, ClubName, Form, Empty, Money, Stars } from '../components/common';
import { Crest } from '../components/graphics';
import { compFixtures, groupTable, leagueTable, roundName, tieState } from '../../engine/competitions/manager';
import { computeScorers } from '../../engine/awards/awards';
import { projectedQualification } from '../../engine/competitions/qualification';
import { fmtDay, fmtShort } from '../../engine/core/date';
import { TIEBREAK_NAMES } from '../../engine/competitions/table';
import { Icon } from '../components/Icon';

type Group = 'nat' | 'cups' | 'sa' | 'eu' | 'past';

export function Comps() {
  useGame();
  const c = useCareer();
  const [tab, setTab] = useState<Group>('nat');
  const season = c.season;
  const current = Object.values(c.competitions).filter((x) => x.season === season);
  const isSA = (x: CompInstance) => c.config.countries.find((k) => k.code === x.region)?.region === 'SA';
  const list = tab === 'past' ? Object.values(c.competitions).filter((x) => x.season < season).sort((a, b) => b.season - a.season || a.name.localeCompare(b.name))
    : current.filter((x) => (tab === 'nat' ? x.kind === 'league' : tab === 'cups' ? x.kind === 'cup' || x.kind === 'state' || x.kind === 'super' : tab === 'sa' ? x.kind === 'continental' && x.region === 'SA' : x.kind === 'continental' && x.region === 'EU'));
  const sorted = list.slice().sort((a, b) => {
    const ta = c.config.competitions[a.templateId], tb = c.config.competitions[b.templateId];
    const userA = a.participants.includes(c.userClubId) ? -1 : 0, userB = b.participants.includes(c.userClubId) ? -1 : 0;
    return userA - userB || (isSA(a) === isSA(b) ? 0 : isSA(a) ? -1 : 1) || (ta?.country ?? '').localeCompare(tb?.country ?? '') || (ta?.tier ?? 0) - (tb?.tier ?? 0);
  });
  return (
    <div className="page">
      <PageHead title="Competições" sub="Ligas nacionais, copas, estaduais e competições continentais" />
      <Tabs tabs={[{ id: 'nat', label: 'Ligas nacionais' }, { id: 'cups', label: 'Copas e estaduais' }, { id: 'sa', label: 'Sul-americanas' }, { id: 'eu', label: 'Europeias' }, { id: 'past', label: 'Temporadas anteriores' }]} value={tab} onChange={setTab} />
      <div className="grid g3">
        {sorted.map((comp) => {
          const t = c.config.competitions[comp.templateId];
          const lead = comp.champion ?? (comp.kind === 'league' ? leagueTable(c, comp)[0]?.clubId : undefined);
          return (
            <button key={comp.id} className="choice" onClick={() => store.go({ name: 'comp', id: comp.id })} style={{ borderLeft: `4px solid ${t?.color ?? 'var(--line-2)'}` }}>
              <span className="row" style={{ justifyContent: 'space-between' }}><span className="t">{comp.name}</span>{comp.participants.includes(c.userClubId) && <span className="chip star">Seu clube</span>}</span>
              <span className="small muted">{comp.participants.length} clubes · {comp.status === 'finished' ? 'encerrada' : `fase: ${comp.stages[comp.current]?.name ?? '—'}`}</span>
              {lead && <span className="small">{comp.champion ? 'Campeão' : 'Líder'}: <ClubName id={lead} link={false} /></span>}
            </button>
          );
        })}
      </div>
      {!sorted.length && <Empty>Nenhuma competição nesta categoria.</Empty>}
    </div>
  );
}

function StandingsTable({ rows, compId, zones }: { rows: StandingRow[]; compId: string; zones?: (pos: number) => string }) {
  const c = useCareer();
  void compId;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th className="n">#</th><th>Clube</th><th className="n">P</th><th className="n">J</th><th className="n">V</th><th className="n">E</th><th className="n">D</th><th className="n">GP</th><th className="n">GC</th><th className="n">SG</th><th>Últimos</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.clubId} className={`${r.clubId === c.userClubId ? 'me' : ''} ${zones?.(i + 1) ?? ''}`}>
              <td className="n">{i + 1}</td><td><ClubName id={r.clubId} /></td><td className="n strong">{r.pts}</td><td className="n">{r.p}</td><td className="n">{r.w}</td><td className="n">{r.d}</td><td className="n">{r.l}</td><td className="n">{r.gf}</td><td className="n">{r.ga}</td><td className="n">{r.gf - r.ga}</td><td><Form f={r.form} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function leagueZones(c: ReturnType<typeof useCareer>, comp: CompInstance) {
  const t = c.config.competitions[comp.templateId];
  const contA: number[] = [], contB: number[] = [];
  for (const ct of Object.values(c.config.competitions)) {
    if (ct.kind !== 'continental' || !ct.enabled) continue;
    for (const sl of ct.slots ?? []) if (sl.type === 'league' && sl.sourceId === t.id) (ct.importance >= 4 && (ct.id === 'copa_americas' || ct.id === 'champions_euro') ? contA : contB).push(...(sl.positions ?? []));
  }
  const n = comp.participants.length;
  return (pos: number) => (pos <= (t.promote ?? 0) && t.upperId ? 'zone-up' : contA.includes(pos) ? 'zone-cont' : contB.includes(pos) ? 'zone-cont2' : pos > n - (t.relegate ?? 0) && t.lowerId ? 'zone-down' : '');
}

export function CompPage({ id }: { id: string }) {
  useGame();
  const c = useCareer();
  const comp = c.competitions[id];
  const [tab, setTab] = useState<'table' | 'games' | 'bracket' | 'scorers' | 'history' | 'qual' | 'rules'>('table');
  if (!comp) return <div className="page"><PageHead back title="Competição não encontrada" /></div>;
  const t = c.config.competitions[comp.templateId];
  const hasLeague = comp.stages.some((s) => s.type === 'league');
  const hasKO = comp.stages.some((s) => s.type === 'knockout');
  const tabs = [
    ...(hasLeague ? [{ id: 'table' as const, label: comp.kind === 'continental' ? 'Grupos' : 'Classificação' }] : []),
    { id: 'games' as const, label: 'Jogos' },
    ...(hasKO ? [{ id: 'bracket' as const, label: 'Chaveamento' }] : []),
    { id: 'scorers' as const, label: 'Artilharia e assistências' },
    { id: 'history' as const, label: 'Campeões' },
    { id: 'qual' as const, label: comp.kind === 'continental' ? 'Participantes' : 'Classificados' },
    { id: 'rules' as const, label: 'Regulamento' },
  ];
  const active = tabs.some((x) => x.id === tab) ? tab : tabs[0].id;
  return (
    <div className="page">
      <PageHead back title={<span className="row"><span className="swatch" style={{ background: t?.color, width: 14, height: 30 }} />{comp.name}</span>} sub={`${comp.participants.length} clubes · ${fmtDay(comp.startDay)} a ${fmtDay(comp.endDay)} · ${comp.status === 'finished' ? 'encerrada' : comp.stages[comp.current]?.name}`}
        actions={comp.champion && <span className="chip star"><Icon name="trophy" className="star-ico" /> Campeão: {c.clubs[comp.champion]?.name}</span>} />
      <Tabs tabs={tabs} value={active} onChange={setTab} />
      {active === 'table' && <TablesTab comp={comp} />}
      {active === 'games' && <GamesTab comp={comp} />}
      {active === 'bracket' && <BracketTab comp={comp} />}
      {active === 'scorers' && <ScorersTab comp={comp} />}
      {active === 'history' && <HistoryTab templateId={comp.templateId} />}
      {active === 'qual' && <QualTab comp={comp} />}
      {active === 'rules' && (
        <Panel title="Regulamento (configurável no Editor)">
          <div className="grid g2 small">
            <div className="stack" style={{ gap: 4 }}>
              <div>Formato: <strong>{{ league: 'Pontos corridos', knockout: 'Mata-mata', groupsKO: 'Grupos + mata-mata', leaguePlayoff: 'Classificação + mata-mata' }[t.format]}</strong></div>
              <div>Turnos: <strong>{t.turns}</strong> · Pontuação: vitória {t.points.win}, empate {t.points.draw}, derrota {t.points.loss}</div>
              <div>Desempate: {t.tiebreakers.map((x) => TIEBREAK_NAMES[x]).join(' → ')}</div>
              {t.kind === 'league' && <div>Acesso: {t.promote ?? 0} · Rebaixamento: {t.relegate ?? 0}</div>}
              <div>Mata-mata: {t.ko.legs === 2 ? 'ida e volta' : 'jogo único'}{t.ko.twoLegsFrom ? ` (ida e volta a partir de ${t.ko.twoLegsFrom} clubes)` : ''}, final em {t.ko.finalLegs === 2 ? 'dois jogos' : 'jogo único'}{t.ko.neutralFinal ? ' (campo neutro)' : ''} · gols fora {t.ko.awayGoals ? 'valem' : 'não valem'} · {t.ko.extraTime ? 'prorrogação e ' : ''}pênaltis</div>
              <div>Coeficiente competitivo (prêmios individuais): {t.coefficient}</div>
            </div>
            <div className="stack" style={{ gap: 4 }}>
              {t.prize.participation > 0 && <div>Cota de participação: <Money v={t.prize.participation} /></div>}
              {t.prize.win > 0 && <div>Por vitória: <Money v={t.prize.win} /> · por empate: <Money v={t.prize.draw} /></div>}
              {Object.entries(t.prize.byStage).map(([k, v]) => <div key={k}>Fase {k}: <Money v={v} /></div>)}
              {t.prize.champion > 0 && <div>Campeão: <Money v={t.prize.champion} /></div>}
              {t.prize.byPosition.length > 0 && <div>Premiação por posição: de <Money v={t.prize.byPosition[0]} /> (1º) a <Money v={t.prize.byPosition[t.prize.byPosition.length - 1]} /></div>}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function TablesTab({ comp }: { comp: CompInstance }) {
  const c = useCareer();
  const idx = comp.stages.findIndex((s) => s.type === 'league');
  const st = comp.stages[idx];
  if (!st || !st.groups.length || !st.groups[0].length) return <Empty>Os grupos ainda não foram sorteados.</Empty>;
  if (comp.kind === 'league') {
    const zones = leagueZones(c, comp);
    return (
      <Panel flush>
        <StandingsTable rows={leagueTable(c, comp)} compId={comp.id} zones={zones} />
        <div className="row tiny muted" style={{ padding: 10 }}><span className="swatch" style={{ background: 'var(--info)', width: 10, height: 10 }} /> vaga na principal continental <span className="swatch" style={{ background: '#9b7bd8', width: 10, height: 10 }} /> vaga na segunda continental <span className="swatch" style={{ background: 'var(--win)', width: 10, height: 10 }} /> acesso <span className="swatch" style={{ background: 'var(--loss)', width: 10, height: 10 }} /> rebaixamento</div>
      </Panel>
    );
  }
  return (
    <div className="grid g2">
      {st.groups.map((g, gi) => (
        <Panel key={gi} title={st.groups.length > 1 ? `Grupo ${String.fromCharCode(65 + gi)}` : st.name} flush>
          <StandingsTable rows={groupTable(c, comp, idx, gi)} compId={comp.id} zones={(p) => (p <= (st.advance ?? 2) ? 'zone-up' : '')} />
        </Panel>
      ))}
    </div>
  );
}

function GamesTab({ comp }: { comp: CompInstance }) {
  const c = useCareer();
  const all = compFixtures(c, comp).sort((a, b) => a.day - b.day);
  const rounds = useMemo(() => {
    const m = new Map<string, typeof all>();
    for (const f of all) {
      const k = `${f.stageIdx}|${comp.stages[f.stageIdx].type === 'league' ? f.round : `${f.round}`}`;
      (m.get(k) ?? m.set(k, []).get(k)!).push(f);
    }
    return [...m.entries()];
  }, [all, comp]);
  const firstOpen = Math.max(0, rounds.findIndex(([, fs]) => fs.some((f) => f.status === 'scheduled')));
  const [ri, setRi] = useState(firstOpen);
  const cur = rounds[Math.min(ri, rounds.length - 1)];
  if (!cur) return <Empty>Sem jogos ainda.</Empty>;
  const [key, fs] = cur;
  const [si] = key.split('|').map(Number);
  const label = comp.stages[si].type === 'league' ? `${comp.stages[si].name} · ${roundName(c, fs[0]).replace(/^Grupo . · /, '')}` : `${comp.stages[si].roundNames[fs[0].round]}`;
  return (
    <Panel title={label} right={<><button className="btn sm" disabled={ri <= 0} onClick={() => setRi(ri - 1)}>‹ Anterior</button><span className="small muted">{ri + 1}/{rounds.length}</span><button className="btn sm" disabled={ri >= rounds.length - 1} onClick={() => setRi(ri + 1)}>Próxima ›</button></>} flush>
      <Table rows={fs} rowKey={(f) => f.id} onRow={(f) => f.status === 'played' && store.go({ name: 'match', id: f.id })} rowCls={(f) => (f.home === c.userClubId || f.away === c.userClubId ? 'me' : '')} cols={[
        { key: 'd', label: 'Data', render: (f) => <span className="small">{fmtShort(f.day)}{f.day !== f.origDay ? ' *' : ''}</span> },
        { key: 'g', label: '', render: (f) => (f.group !== undefined && comp.stages[f.stageIdx].groups.length > 1 ? <span className="chip">{String.fromCharCode(65 + f.group)}</span> : f.leg ? <span className="tiny muted">{f.leg === 1 ? 'ida' : 'volta'}</span> : null) },
        { key: 'h', label: 'Mandante', render: (f) => <ClubName id={f.home} /> },
        { key: 's', label: 'Placar', render: (f) => (f.result ? <strong>{f.result.hg} – {f.result.ag}{f.result.pens ? ` (${f.result.pens[0]}–${f.result.pens[1]} p)` : ''}</strong> : <span className="muted">×</span>), cls: 'c' },
        { key: 'a', label: 'Visitante', render: (f) => <ClubName id={f.away} /> },
      ]} />
      <div className="tiny muted" style={{ padding: 8 }}>* jogo remarcado por conflito de calendário.</div>
    </Panel>
  );
}

function BracketTab({ comp }: { comp: CompInstance }) {
  const c = useCareer();
  const t = c.config.competitions[comp.templateId];
  const stages = comp.stages.map((s, i) => ({ s, i })).filter(({ s }) => s.type === 'knockout');
  return (
    <div className="stack">
      {stages.map(({ s }) => <Bracket key={s.id} stage={s} awayGoals={t.ko.awayGoals} />)}
    </div>
  );
}

function Bracket({ stage, awayGoals }: { stage: Stage; awayGoals: boolean }) {
  const c = useCareer();
  const rounds = stage.roundNames.map((name, r) => ({ name, ties: stage.ties.filter((t) => t.round === r) }));
  return (
    <Panel title={stage.name}>
      <div className="bracket">
        {rounds.map((rd) => (
          <div key={rd.name} className="bracket-col">
            <h4>{rd.name}</h4>
            {rd.ties.length === 0 && <div className="tie"><div className="tr"><span /> <span className="muted small">A definir</span><span /></div></div>}
            {rd.ties.map((tie) => {
              const st = tieState(c, tie, awayGoals);
              return (
                <div key={tie.id} className="tie">
                  {[tie.a, tie.b].map((cid, k) => (
                    <div key={k} className={`tr ${tie.winner && tie.winner === cid ? 'w' : ''}`}>
                      {cid ? <Crest crest={c.clubs[cid].crest} size={16} /> : <span />}
                      <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cid ? c.clubs[cid].name : 'A definir'}</span>
                      <span className="strong">{tie.fixtureIds.some((id) => c.fixtures[id]?.result) ? (k === 0 ? st.aggA : st.aggB) : ''}</span>
                    </div>
                  ))}
                  {tie.note && <div className="note">{tie.note}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ScorersTab({ comp }: { comp: CompInstance }) {
  const c = useCareer();
  const rows = comp.pruned && comp.topScorers ? comp.topScorers.map((t) => ({ playerId: t.playerId, goals: t.goals, assists: 0, clubId: t.clubId, apps: 0 })) : computeScorers(c, comp);
  const goals = rows.filter((r) => r.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 25);
  const assists = comp.pruned && comp.topAssists ? comp.topAssists.map((t) => ({ playerId: t.playerId, assists: t.assists, clubId: t.clubId })) : rows.filter((r) => r.assists > 0).sort((a, b) => b.assists - a.assists).slice(0, 25);
  const name = (pid: string) => {
    const p = c.players[pid];
    return p ? <span className="pname"><span className="link" onClick={() => store.go({ name: 'player', id: pid })}>{p.name}</span><Stars p={p} /></span> : <span>{c.retired[pid]?.name ?? '—'}</span>;
  };
  return (
    <div className="grid g2">
      <Panel title="Artilharia" flush>
        <Table rows={goals} rowKey={(r) => r.playerId} cols={[
          { key: 'i', label: '#', render: (r) => goals.indexOf(r) + 1, cls: 'n' }, { key: 'n', label: 'Jogador', render: (r) => name(r.playerId) },
          { key: 'c', label: 'Clube', render: (r) => <ClubName id={r.clubId} short /> }, { key: 'g', label: 'Gols', render: (r) => <strong>{r.goals}</strong>, cls: 'n' },
        ]} empty="Nenhum gol ainda." />
        <div className="tiny muted" style={{ padding: 8 }}>{comp.kind === 'league' ? 'O artilheiro ao fim da liga recebe a estrela dourada.' : comp.kind === 'continental' ? 'O artilheiro ao fim da competição recebe a estrela vermelha.' : 'Gols anulados e partidas invalidadas não contam.'}</div>
      </Panel>
      <Panel title="Assistências" flush>
        <Table rows={assists} rowKey={(r) => r.playerId} cols={[
          { key: 'i', label: '#', render: (r) => assists.indexOf(r) + 1, cls: 'n' }, { key: 'n', label: 'Jogador', render: (r) => name(r.playerId) },
          { key: 'c', label: 'Clube', render: (r) => <ClubName id={r.clubId} short /> }, { key: 'a', label: 'Assist.', render: (r) => <strong>{r.assists}</strong>, cls: 'n' },
        ]} empty="Nenhuma assistência ainda." />
      </Panel>
    </div>
  );
}

function HistoryTab({ templateId }: { templateId: string }) {
  const c = useCareer();
  const list = (c.champions[templateId] ?? []).slice().reverse();
  const counts = new Map<string, number>();
  for (const x of c.champions[templateId] ?? []) counts.set(x.clubName, (counts.get(x.clubName) ?? 0) + 1);
  const rec = c.records[`goals|${templateId}`];
  return (
    <div className="grid g2">
      <Panel title="Campeões" flush>
        <Table rows={list} rowKey={(r) => String(r.season)} cols={[
          { key: 's', label: 'Temporada', render: (r) => r.season }, { key: 'c', label: 'Campeão', render: (r) => <ClubName id={r.clubId} /> }, { key: 'v', label: 'Vice', render: (r) => <span className="small muted">{r.runnerUpName ?? '—'}</span> },
        ]} empty="Os campeões serão registrados ao fim de cada edição (temporadas simuladas no universo do jogo)." />
      </Panel>
      <div className="stack">
        <Panel title="Mais títulos">{[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n, k]) => <div key={n} className="row small" style={{ justifyContent: 'space-between' }}><span>{n}</span><strong>{k}</strong></div>)}{!counts.size && <div className="small muted">—</div>}</Panel>
        {rec && <Panel title="Recorde">{rec.label}: <strong>{rec.value}</strong> — {rec.holder} ({rec.season})</Panel>}
      </div>
    </div>
  );
}

function QualTab({ comp }: { comp: CompInstance }) {
  const c = useCareer();
  if (comp.kind === 'continental') {
    return (
      <Panel title="Participantes e critério de classificação" flush>
        <Table rows={comp.qualNotes} rowKey={(r) => r.clubId} cols={[
          { key: 'c', label: 'Clube', render: (r) => <ClubName id={r.clubId} /> },
          { key: 'p', label: 'País', render: (r) => c.config.countries.find((x) => x.code === c.clubs[r.clubId]?.country)?.name },
          { key: 'r', label: 'Critério', render: (r) => <span className="small">{r.reason}</span> },
          { key: 'e', label: 'Situação', render: (r) => <span className="small">{comp.champion === r.clubId ? 'Campeão' : comp.eliminated[r.clubId] ? `Eliminado: ${comp.eliminated[r.clubId]}` : 'Na disputa'}</span> },
        ]} />
      </Panel>
    );
  }
  const proj = c.seasonEnded ? { lists: c.qualification, warnings: c.qualificationWarnings } : projectedQualification(c);
  const t = c.config.competitions[comp.templateId];
  const country = t.country;
  const conts = Object.values(c.config.competitions).filter((x) => x.kind === 'continental');
  return (
    <div className="stack">
      <div className="small muted">{c.seasonEnded ? 'Classificados oficiais para a próxima temporada.' : 'Projeção: se a temporada terminasse hoje (vagas de copa ainda em disputa são redistribuídas provisoriamente).'}</div>
      <div className="grid g2">
        {conts.map((ct) => {
          const rows = (proj.lists[ct.id] ?? []).filter((q) => q.country === country);
          if (!rows.length) return null;
          return (
            <Panel key={ct.id} title={ct.name} flush>
              <Table rows={rows} rowKey={(r) => r.clubId} cols={[{ key: 'c', label: 'Clube', render: (r) => <ClubName id={r.clubId} /> }, { key: 'r', label: 'Critério', render: (r) => <span className="small">{r.reason}</span> }]} />
            </Panel>
          );
        })}
      </div>
      {proj.warnings.length > 0 && <Panel title="Avisos">{proj.warnings.map((w, i) => <div key={i} className="small warn">{w}</div>)}</Panel>}
    </div>
  );
}
