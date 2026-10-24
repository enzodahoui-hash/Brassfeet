import { useMemo, useState } from 'react';
import type { AwardCandidate, AwardResult } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Table, Tabs, Empty, ClubName, clickable } from '../components/common';
import { Face } from '../components/graphics';
import { Icon } from '../components/Icon';
import { awardName, ballonDay, candidateScore, galaDay } from '../../engine/awards/awards';
import { fmtDay } from '../../engine/core/date';
import { nationName } from '../../engine/data/nations';
import { POS_SHORT, ovrToLevel } from '../../engine/players/attributes';

const CRIT: Record<string, string> = {
  performance: 'Desempenho', goals: 'Gols / defesa', assists: 'Assistências', titles: 'Títulos', regularity: 'Regularidade',
  bigGames: 'Jogos grandes', competitionLevel: 'Nível das competições', teamImportance: 'Importância no time', continental: 'Continental',
};

function playerLink(id: string | null) {
  if (!id) return undefined;
  return () => { if (store.career?.players[id]) store.go({ name: 'player', id }); };
}

function CandidateTable({ rows, votes }: { rows: AwardCandidate[]; votes?: boolean }) {
  return (
    <Table rows={rows} rowKey={(r) => r.playerId} onRow={(r) => playerLink(r.playerId)?.()} cols={[
      { key: 'r', label: '#', render: (r) => r.rank ?? rows.indexOf(r) + 1, cls: 'n' },
      { key: 'n', label: 'Jogador', render: (r) => <span><strong>{r.name}</strong> <span className="muted small">{POS_SHORT[r.pos]} · {nationName(r.nat)}</span></span> },
      { key: 'c', label: 'Clube', render: (r) => <span className="small">{r.clubName}</span> },
      { key: 'l', label: 'Nível', render: (r) => r.level, cls: 'n' },
      { key: 'j', label: 'J', render: (r) => r.stats.apps, cls: 'n', tip: 'Jogos no período' },
      { key: 'g', label: 'G', render: (r) => r.stats.goals, cls: 'n' },
      { key: 'a', label: 'A', render: (r) => r.stats.assists, cls: 'n' },
      { key: 'm', label: 'Média', render: (r) => r.stats.avg.toFixed(2), cls: 'n' },
      { key: 's', label: 'Índice', render: (r) => r.score.toFixed(1), cls: 'n', tip: 'Índice ponderado pelos critérios configurados no editor' },
      ...(votes ? [{ key: 'v', label: 'Votos', render: (r: AwardCandidate) => <strong>{r.votes ?? 0}</strong>, cls: 'n' }, { key: 'f', label: '1º lugar', render: (r: AwardCandidate) => r.firstPlaces ?? 0, cls: 'n' }] : []),
    ]} />
  );
}

function Breakdown({ cd }: { cd: AwardCandidate }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      {Object.entries(cd.breakdown).map(([k, v]) => (
        <div key={k} className="attr"><span>{CRIT[k] ?? k}</span><span className="v">{Math.round(v)}</span><div className="bar"><i style={{ width: `${Math.min(100, v)}%` }} /></div></div>
      ))}
      {cd.stats.titles.length > 0 && <div className="small muted">Títulos no período: {cd.stats.titles.join(', ')}</div>}
    </div>
  );
}

function Ceremony({ a }: { a: AwardResult }) {
  const c = useCareer();
  const appearanceOf = (id: string | null) => (id ? c.players[id]?.appearance ?? c.retired[id]?.appearance : undefined);
  const photo = a.winnerId ? c.players[a.winnerId]?.photo : undefined;
  const top3 = a.candidates.slice(0, 3);
  const winner = a.candidates[0];
  const app = appearanceOf(a.winnerId);
  const prev = Object.values(c.awards).filter((x) => x.awardId === a.awardId && x.scope === a.scope && x.edition < a.edition).sort((x, y) => y.edition - x.edition).slice(0, 5);
  return (
    <div className="page">
      <PageHead back title={a.name} sub={`${a.edition} · ${fmtDay(a.day)}${a.windowLabel ? ` · ${a.windowLabel}` : ''}`} />
      <div className="ceremony">
        <svg className="trophy-ico" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v2H8v-2h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z" /></svg>
        <div className="award-name">{a.name}</div>
        <div className="edition">Edição {a.edition}</div>
        {a.coach ? (
          <div className="winner"><div className="wn">{a.coach.name}</div><div>{a.coach.clubName}{a.coach.isUser && <span className="chip good" style={{ marginLeft: 6 }}>você</span>}</div><div className="small muted">Índice de superação {a.coach.score}</div></div>
        ) : a.team ? (
          <div className="winner"><div className="wn">Time ideal</div></div>
        ) : (
          <div className="winner">
            {app && <Face a={app} photo={photo} size={96} />}
            <div className="wn link" {...clickable(playerLink(a.winnerId))}>{a.winnerName}</div>
            <div>{a.winnerClubName}{a.winnerNat ? ` · ${nationName(a.winnerNat)}` : ''}</div>
          </div>
        )}
        {a.headlines.slice(1).map((h, i) => <div key={i} className="small" style={{ color: '#d8c78f' }}>{h}</div>)}
        {top3.length >= 3 && a.awardId === 'ballon' && (
          <div className="podium">
            {[top3[1], top3[0], top3[2]].map((cd, i) => (
              <div key={cd.playerId} className={`step p${[2, 1, 3][i]}`}>
                <div style={{ font: '800 26px var(--f-display)', color: 'var(--gold)' }}>{[2, 1, 3][i]}º</div>
                <div className="strong link" {...clickable(playerLink(cd.playerId))}>{cd.name}</div>
                <div className="tiny muted">{cd.clubName}</div>
                <div className="small">{cd.votes ?? 0} pts</div>
              </div>
            ))}
          </div>
        )}
        <div className="tiny muted" style={{ marginTop: 14 }}>Votação e escolha simuladas a partir das estatísticas do universo do jogo.</div>
      </div>
      <div style={{ height: 12 }} />
      {a.team && (
        <Panel title="Seleção da temporada" flush>
          <Table rows={a.team} rowKey={(t) => t.playerId} onRow={(t) => playerLink(t.playerId)?.()} cols={[
            { key: 'p', label: 'Pos', render: (t) => t.pos }, { key: 'n', label: 'Jogador', render: (t) => <strong>{t.name}</strong> }, { key: 'c', label: 'Clube', render: (t) => t.clubName },
          ]} />
        </Panel>
      )}
      {a.candidates.length > 0 && (
        <div className="grid g-main">
          <Panel title={a.awardId === 'ballon' ? 'Classificação final da votação' : 'Candidatos'} flush><CandidateTable rows={a.candidates} votes={a.awardId === 'ballon'} /></Panel>
          <div className="stack">
            {winner && <Panel title={`Por que ${winner.name}?`}><Breakdown cd={winner} /></Panel>}
            {prev.length > 0 && (
              <Panel title="Edições anteriores">
                {prev.map((p) => <div key={p.key} className="small link" style={{ cursor: 'pointer' }} {...clickable(() => store.go({ name: 'awards', id: p.key }))}>{p.edition} — {p.winnerName} ({p.winnerClubName ?? '—'})</div>)}
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Race() {
  const c = useCareer();
  const cfg = c.config.awards;
  const rows = useMemo(() => {
    const out: AwardCandidate[] = [];
    for (const p of Object.values(c.players)) {
      if (p.squad !== 'senior' || !p.win || p.win.apps < Math.max(3, Math.round(cfg.minApps / 3))) continue;
      const { score, breakdown } = candidateScore(c, p, p.win);
      out.push({ playerId: p.id, name: p.name, clubId: p.clubId ?? '', clubName: p.clubId ? c.clubs[p.clubId]?.name ?? '' : 'Sem clube', nat: p.nat, pos: p.pos, level: Math.round(ovrToLevel(p.ovr)), score, breakdown, stats: { apps: p.win.apps, goals: p.win.goals, assists: p.win.assists, avg: p.win.apps ? Math.round((p.win.ratingSum / p.win.apps) * 100) / 100 : 0, titles: p.win.titleNames.slice(), contGoals: p.win.contGoals, motm: p.win.motm } });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 20).map((x, i) => ({ ...x, rank: i + 1 }));
  }, [c, c.day]);
  const [sel, setSel] = useState<string | null>(null);
  const cd = rows.find((r) => r.playerId === sel) ?? rows[0];
  return (
    <div className="grid g-main">
      <Panel title={`Corrida pela ${cfg.ballonName}`} flush>
        {rows.length ? <Table rows={rows} rowKey={(r) => r.playerId} onRow={(r) => setSel(r.playerId)} rowCls={(r) => (r.playerId === cd?.playerId ? 'sel' : '')} cols={[
          { key: 'r', label: '#', render: (r) => r.rank, cls: 'n' },
          { key: 'n', label: 'Jogador', render: (r) => <span><strong>{r.name}</strong> <span className="muted small">{POS_SHORT[r.pos]}</span></span> },
          { key: 'c', label: 'Clube', render: (r) => (r.clubId ? <ClubName id={r.clubId} short /> : '—') },
          { key: 'j', label: 'J', render: (r) => r.stats.apps, cls: 'n' }, { key: 'g', label: 'G', render: (r) => r.stats.goals, cls: 'n' }, { key: 'a', label: 'A', render: (r) => r.stats.assists, cls: 'n' },
          { key: 'm', label: 'Média', render: (r) => r.stats.avg.toFixed(2), cls: 'n' }, { key: 's', label: 'Índice', render: (r) => r.score.toFixed(1), cls: 'n' },
        ]} /> : <Empty>A janela de avaliação ainda não tem jogos suficientes.</Empty>}
        <div className="tiny muted" style={{ padding: 8 }}>Prévia calculada com as estatísticas reais da janela atual; a lista oficial exige pelo menos {cfg.minApps} jogos.</div>
      </Panel>
      <div className="stack">
        {cd && <Panel title={cd.name}><Breakdown cd={cd} /><button className="btn sm" style={{ marginTop: 8 }} onClick={() => store.go({ name: 'player', id: cd.playerId })}>Ver perfil</button></Panel>}
      </div>
    </div>
  );
}

export function Awards({ id }: { id?: string }) {
  useGame();
  const c = useCareer();
  const [tab, setTab] = useState<'cerimonias' | 'corrida' | 'historico'>('cerimonias');
  const a = id ? c.awards[id] : undefined;
  if (a) return <Ceremony a={a} />;
  const all = Object.values(c.awards).sort((x, y) => y.day - x.day);
  const ballons = all.filter((x) => x.awardId === 'ballon');
  const cfg = c.config.awards;
  const year = c.season;
  const nextBallon = ballonDay(c, c.awards[`ballon|${year}`] ? year + 1 : year);
  const nextGala = galaDay(c, c.awards[`player|${year}`] ? year + 1 : year);
  const mine = all.filter((x) => (x.winnerClubId === c.userClubId));
  return (
    <div className="page">
      <PageHead title="Prêmios" sub={cfg.enabled ? `${cfg.ballonName}: ${fmtDay(nextBallon)} · Gala da temporada: ${fmtDay(nextGala)}` : 'Premiações desativadas no editor do universo'} />
      <Tabs tabs={[{ id: 'cerimonias', label: 'Cerimônias' }, { id: 'corrida', label: 'Corrida atual' }, { id: 'historico', label: 'Galeria' }]} value={tab} onChange={setTab} />
      <div style={{ height: 10 }} />
      {tab === 'cerimonias' && (
        <Panel flush>
          <Table rows={all} rowKey={(x) => x.key} onRow={(x) => store.go({ name: 'awards', id: x.key })} cols={[
            { key: 'd', label: 'Data', render: (x) => fmtDay(x.day), sort: (x) => x.day },
            { key: 'n', label: 'Prêmio', render: (x) => <span><Icon name="award" className="star-ico" /> {x.name}</span>, sort: (x) => x.name },
            { key: 'e', label: 'Edição', render: (x) => x.edition, cls: 'n' },
            { key: 'w', label: 'Vencedor', render: (x) => <strong>{x.winnerName}</strong> },
            { key: 'c', label: 'Clube', render: (x) => (x.winnerClubId ? <ClubName id={x.winnerClubId} short /> : <span className="small">{x.winnerClubName ?? '—'}</span>) },
          ]} empty={`Nenhuma cerimônia realizada ainda. A primeira ${cfg.ballonName} acontece em ${fmtDay(nextBallon)}.`} />
        </Panel>
      )}
      {tab === 'corrida' && <Race />}
      {tab === 'historico' && (
        <div className="grid g2">
          <Panel title={`Vencedores da ${cfg.ballonName}`}>
            {ballons.length ? ballons.map((b) => <div key={b.key} className="small link" style={{ cursor: 'pointer' }} {...clickable(() => store.go({ name: 'awards', id: b.key }))}>{b.edition} — <strong>{b.winnerName}</strong> ({b.winnerClubName})</div>) : <Empty>Nenhuma edição ainda.</Empty>}
          </Panel>
          <Panel title="Prêmios do seu clube">
            {mine.length ? mine.map((b) => <div key={b.key} className="small link" style={{ cursor: 'pointer' }} {...clickable(() => store.go({ name: 'awards', id: b.key }))}>{b.edition} — {b.name}: <strong>{b.winnerName}</strong></div>) : <Empty>Nenhum prêmio individual para o clube ainda.</Empty>}
          </Panel>
          <Panel title="Prêmios configurados">
            <div className="small stack" style={{ gap: 3 }}>
              <div>{cfg.ballonName} — {cfg.nominees} indicados, {cfg.finalists} finalistas, {cfg.voters} votantes simulados</div>
              {['player', 'young', 'gk', 'def', 'mid', 'fwd', 'topscorer', 'revelation', 'team', 'coach', 'leagueBest', 'contBest', 'finalBest'].map((k) => <div key={k}>{awardName(c, k)}</div>)}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
