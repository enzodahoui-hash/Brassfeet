import { useState } from 'react';
import type { Player } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { Table, PageHead, Tabs, PName, PosB, LevelPair, Cond, Morale, Money, Panel, type Col } from '../components/common';
import { POS_LINE, ovrToLevel } from '../../engine/players/attributes';
import { wageBill } from '../../engine/universe/world';
import { strengthSummary } from '../../engine/clubs/strength';
import { availabilityNote } from '../../engine/clubs/lineup';
import { Icon } from '../components/Icon';
import { SquadStats } from './StatsViews';

const ROLE: Record<string, string> = { key: 'Peça-chave', first: 'Titular', rotation: 'Rotação', backup: 'Reserva', prospect: 'Promessa' };

export function seasonTotals(p: Player, season: number) {
  let apps = 0, goals = 0, assists = 0, rs = 0, mins = 0;
  for (const [k, s] of Object.entries(p.stats)) {
    if (!k.startsWith(`${season}|`)) continue;
    apps += s.apps;
    goals += s.goals;
    assists += s.assists;
    rs += s.ratingSum;
    mins += s.minutes;
  }
  return { apps, goals, assists, avg: apps ? rs / apps : 0, mins };
}

export function squadCols(season: number, extra: Col<Player>[] = []): Col<Player>[] {
  return [
    { key: 'sh', label: 'Nº', render: (p) => p.shirt, sort: (p) => p.shirt, cls: 'n' },
    { key: 'nm', label: 'Jogador', render: (p) => <PName p={p} />, sort: (p) => p.name },
    { key: 'pos', label: 'Pos', render: (p) => <PosB pos={p.pos} />, sort: (p) => ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST'].indexOf(p.pos) },
    { key: 'age', label: 'Id', render: (p) => season - p.birthYear, sort: (p) => season - p.birthYear, cls: 'n' },
    { key: 'lvl', label: 'Nível/Pot', render: (p) => <LevelPair p={p} />, sort: (p) => p.ovr },
    { key: 'cond', label: 'Cond', render: (p) => <Cond v={p.condition} />, sort: (p) => p.condition },
    { key: 'mor', label: 'Moral', render: (p) => <Morale v={p.morale} />, sort: (p) => p.morale },
    ...extra,
  ];
}

export function Squad() {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const [tab, setTab] = useState<'all' | 'G' | 'D' | 'M' | 'A' | 'loaned'>('all');
  const [view, setView] = useState<'squad' | 'stats'>('squad');
  const players = club.playerIds.map((id) => c.players[id]).filter(Boolean);
  const loaned = Object.values(c.players).filter((p) => p.loan?.fromClubId === club.id);
  const list = tab === 'loaned' ? loaned : tab === 'all' ? players : players.filter((p) => POS_LINE[p.pos] === tab);
  const str = strengthSummary(c, club);
  const avgAge = players.reduce((s, p) => s + c.season - p.birthYear, 0) / Math.max(1, players.length);
  const cols = squadCols(c.season, [
    { key: 'val', label: 'Valor', render: (p) => <Money v={p.value} />, sort: (p) => p.value, cls: 'n' },
    { key: 'wage', label: 'Salário/ano', render: (p) => <Money v={p.contract?.wage ?? 0} />, sort: (p) => p.contract?.wage ?? 0, cls: 'n' },
    { key: 'ct', label: 'Contrato', render: (p) => <span className={p.contract && p.contract.endYear <= c.season ? 'warn strong' : ''}>{p.contract?.endYear ?? '—'}</span>, sort: (p) => p.contract?.endYear ?? 0, cls: 'n' },
    { key: 'role', label: 'Papel', render: (p) => <span className="small">{ROLE[p.contract?.role ?? 'rotation']}</span> },
    { key: 'j', label: 'J', render: (p) => seasonTotals(p, c.season).apps, sort: (p) => seasonTotals(p, c.season).apps, cls: 'n' },
    { key: 'g', label: 'G', render: (p) => seasonTotals(p, c.season).goals, sort: (p) => seasonTotals(p, c.season).goals, cls: 'n' },
    { key: 'a', label: 'A', render: (p) => seasonTotals(p, c.season).assists, sort: (p) => seasonTotals(p, c.season).assists, cls: 'n' },
    { key: 'nt', label: 'Nota', render: (p) => { const t = seasonTotals(p, c.season); return t.apps ? t.avg.toFixed(2) : '—'; }, sort: (p) => seasonTotals(p, c.season).avg, cls: 'n' },
    { key: 'st', label: 'Situação', render: (p) => {
      const note = availabilityNote(p) ?? Object.entries(p.susp).filter(([, v]) => v > 0).map(([k, v]) => `Suspenso ${v}j (${c.competitions[k]?.name.replace(/ \d+$/, '') ?? k})`)[0];
      return <span className="row tight">{note && <span className="chip bad">{note}</span>}{p.listed && <span className="chip warn">À venda</span>}{p.loanListed && <span className="chip info">Empréstimo</span>}{p.loan && <span className="chip info">Emprestado: {c.clubs[p.loan.toClubId]?.short}</span>}{p.happiness && <span className="chip warn" data-tip={p.happiness}>Insatisfeito</span>}</span>;
    } },
  ]);
  return (
    <div className="page">
      <PageHead title="Elenco profissional" sub={`${players.length} jogadores · média de idade ${avgAge.toFixed(1)} · ${loaned.length} emprestados`} actions={<><button className="btn" onClick={() => store.go({ name: 'tactics' })}><Icon name="tactics" />Escalação</button><button className="btn" onClick={() => store.go({ name: 'market' })}><Icon name="market" />Mercado</button></>} />
      <Tabs tabs={[{ id: 'squad', label: 'Elenco' }, { id: 'stats', label: 'Estatísticas do Elenco' }]} value={view} onChange={setView} />
      <div style={{ height: 10 }} />
      {view === 'stats' ? <SquadStats c={c} players={[...players, ...loaned]} /> : <>
      <Panel flush>
        <div className="kpis">
          <div className="kpi"><div className="k">Nível do clube</div><div className="v">{str.clubLevel.toFixed(1)}</div><div className="d">Reputação e estrutura</div></div>
          <div className="kpi"><div className="k">Qualidade do elenco</div><div className="v">{str.squad.toFixed(1)}</div><div className="d">Melhor onze possível</div></div>
          <div className="kpi"><div className="k">Força atual</div><div className="v">{str.current.toFixed(1)}</div><div className="d">Escalação, forma, moral e entrosamento</div></div>
          <div className="kpi"><div className="k">Entrosamento</div><div className="v">{Math.round(club.cohesion)}%</div><div className="d">Cresce mantendo a base</div></div>
          <div className="kpi"><div className="k">Folha salarial</div><div className="v"><Money v={wageBill(c, club)} /></div><div className="d">Limite <Money v={club.wageBudget} /></div></div>
        </div>
        <div style={{ padding: '10px 12px 0' }}>
          <Tabs tabs={[{ id: 'all', label: 'Todos' }, { id: 'G', label: 'Goleiros' }, { id: 'D', label: 'Defensores' }, { id: 'M', label: 'Meio-campo' }, { id: 'A', label: 'Ataque' }, { id: 'loaned', label: `Emprestados (${loaned.length})` }]} value={tab} onChange={setTab} />
        </div>
        <Table rows={list} cols={cols} rowKey={(p) => p.id} onRow={(p) => store.go({ name: 'player', id: p.id })} initialSort={{ key: 'pos', dir: 1 }} />
      </Panel>
      </>}
      <p className="tiny muted">A nota de 0 a 25 é calculada pelos atributos da posição e ajustada levemente pela forma recente. O potencial (contorno tracejado) é a margem de evolução, independente do nível atual. Média geral do elenco: {(players.reduce((s, p) => s + ovrToLevel(p.ovr), 0) / Math.max(1, players.length)).toFixed(1)}.</p>
    </div>
  );
}
