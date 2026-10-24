import { useMemo, useState } from 'react';
import type { Career, Player, StatLine } from '../../engine/types';
import { store } from '../store';
import { Panel, Table, Tabs, Modal, PosB, PName, Cond, Lvl, Empty, type Col } from '../components/common';
import { ATTRS, ATTR_GROUPS, POS_LINE, ovrToLevel } from '../../engine/players/attributes';
import { avgRating, conversion, passPct, per90, savePct, statRows, sumRows, type StatRow } from '../../engine/players/stats';

// ───────────────────────── recortes de período ─────────────────────────

export type Period = 'current' | 'previous' | 'all' | `s${number}`;
export type Scope = 'club' | 'all';

export function periodLabel(c: Career, period: Period, scope: Scope): string {
  const club = c.clubs[c.userClubId].name;
  const when = period === 'current' ? `Temporada atual (${c.season})` : period === 'previous' ? `Temporada anterior (${c.season - 1})` : period === 'all' ? 'Todas as temporadas da carreira' : `Temporada ${period.slice(1)}`;
  return `${when} · ${scope === 'club' ? `apenas pelo ${club}` : 'todos os clubes (carreira completa)'}`;
}

export function inPeriod(c: Career, r: StatRow, period: Period): boolean {
  if (period === 'current') return r.season === c.season;
  if (period === 'previous') return r.season === c.season - 1;
  if (period === 'all') return true;
  return r.season === Number(period.slice(1));
}

/** Partidas oficiais do clube do usuário consideradas no recorte (jogos já disputados). */
export function matchesInPeriod(c: Career, period: Period, compTpl: string): number {
  let n = 0;
  for (const f of Object.values(c.fixtures)) {
    if (f.status !== 'played' || (f.home !== c.userClubId && f.away !== c.userClubId)) continue;
    const comp = c.competitions[f.compId];
    if (!comp) continue;
    const fake = { season: comp.season } as StatRow;
    if (!inPeriod(c, fake, period)) continue;
    if (compTpl && comp.templateId !== compTpl) continue;
    n++;
  }
  return n;
}

export interface Agg {
  p: Player;
  s: StatLine;
  rows: StatRow[];
}

export function aggregate(c: Career, p: Player, period: Period, scope: Scope, compTpl = ''): Agg {
  const rows = statRows(c, p).filter((r) => inPeriod(c, r, period) && (scope === 'all' || r.clubId === c.userClubId) && (!compTpl || r.tpl === compTpl));
  return { p, s: sumRows(rows), rows };
}

// ───────────────────────── blocos por posição ─────────────────────────

const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);
const pct = (v: number | null) => (v == null ? '—' : `${v.toFixed(0)}%`);

/** Estatísticas exibidas conforme a posição (apenas o que o simulador registra). */
export function statBlocks(s: StatLine, pos: Player['pos'], injuries?: number): { title: string; items: [string, string][] }[] {
  const line = POS_LINE[pos];
  const general: [string, string][] = [
    ['Jogos', `${s.apps}`], ['Titular', `${s.starts}`], ['Entrou', `${s.apps - s.starts}`], ['Minutos', `${s.minutes}`],
    ['Gols', `${s.goals}`], ['Assistências', `${s.assists}`], ['Nota média', s.apps ? f2(avgRating(s)) : '—'], ['Melhor em campo', `${s.motm}`],
    ['Amarelos', `${s.yellow}`], ['Vermelhos', `${s.red}`], ['Lesões', injuries == null ? '—' : `${injuries}`], ['Jogos perdidos (lesão)', `${s.missed}`],
  ];
  const attack: [string, string][] = [
    ['Finalizações', `${s.shots}`], ['No alvo', `${s.sot}`], ['Conversão', s.shots >= 5 ? pct(conversion(s)) : '—'], ['Gols esperados (xG)', f1(s.xg)],
    ['Gols por jogo', s.apps ? f2(s.goals / s.apps) : '—'], ['Assist. por jogo', s.apps ? f2(s.assists / s.apps) : '—'], ['Participações em gols', `${s.goals + s.assists}`], ['Pênaltis (gols/perdidos)', `${s.penScored}/${s.penMissed}`],
  ];
  const mid: [string, string][] = [
    ['Passes certos', `${s.passesOk}/${s.passes}`], ['Acerto de passe', s.passes ? pct(passPct(s)) : '—'], ['Chances criadas', `${s.keyPasses}`], ['Desarmes', `${s.tackles}`], ['Interceptações', `${s.interceptions}`], ['Faltas sofridas', `${s.fouled}`],
  ];
  const def: [string, string][] = [
    ['Sem sofrer gols (em campo)', `${s.cleanSheets}`], ['Desarmes', `${s.tackles}`], ['Interceptações', `${s.interceptions}`], ['Cortes', `${s.clearances}`], ['Bloqueios', `${s.blocks}`], ['Erros que viraram gol', `${s.errGoal}`], ['Faltas cometidas', `${s.fouls}`],
  ];
  const gk: [string, string][] = [
    ['Gols sofridos', `${s.conceded}`], ['Sem sofrer gols', `${s.cleanSheets}`], ['Defesas', `${s.saves}`], ['Defesas (%)', s.saves + s.conceded >= 10 ? pct(savePct(s)) : '—'], ['Pênaltis defendidos', `${s.penSaved}`], ['Gols sofridos por jogo', s.apps ? f2(s.conceded / s.apps) : '—'],
  ];
  const out = [{ title: 'Gerais', items: general }];
  if (line === 'G') out.push({ title: 'Goleiro', items: gk });
  if (line === 'A' || pos === 'AM' || pos === 'RM' || pos === 'LM') out.push({ title: 'Ataque', items: attack });
  if (line === 'M') out.push({ title: 'Meio-campo', items: mid });
  if (line === 'D' || pos === 'DM') out.push({ title: 'Defesa', items: def });
  if (line === 'A') out.push({ title: 'Construção', items: mid.slice(0, 3) });
  return out;
}

export function StatBlocks({ s, pos, injuries }: { s: StatLine; pos: Player['pos']; injuries?: number }) {
  return (
    <div className="stat-blocks">
      {statBlocks(s, pos, injuries).map((b) => (
        <div key={b.title}>
          <h4>{b.title}</h4>
          <div className="kv">{b.items.map(([k, v]) => <div key={k}><span className="muted">{k}</span><strong className="mono">{v}</strong></div>)}</div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── perfil: estatísticas do jogador ─────────────────────────

export function PlayerStatsPanel({ c, p }: { c: Career; p: Player }) {
  const rows = useMemo(() => statRows(c, p), [c, p, store.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const seasons = [...new Set(rows.map((r) => r.season))].sort((a, b) => b - a);
  const [tab, setTab] = useState<'season' | 'comp' | 'seasons' | 'clubs' | 'career'>('season');
  const [season, setSeason] = useState(seasons[0] ?? c.season);
  const sr = rows.filter((r) => r.season === season);
  const inj = (y?: number) => p.injuries.filter((i) => y == null || i.season === y).length;
  const bySeason = seasons.map((y) => ({ y, s: sumRows(rows, (r) => r.season === y), clubs: [...new Set(rows.filter((r) => r.season === y).map((r) => r.club))] }));
  const clubs = [...new Set(rows.map((r) => r.clubId))].map((id) => ({ id, name: rows.find((r) => r.clubId === id)!.club, s: sumRows(rows, (r) => r.clubId === id), seasons: [...new Set(rows.filter((r) => r.clubId === id).map((r) => r.season))] }));
  const total = sumRows(rows);
  const cols = (first: Col<{ k: string; label: string; s: StatLine }>): Col<{ k: string; label: string; s: StatLine }>[] => [
    first,
    { key: 'j', label: 'J', render: (r) => r.s.apps, cls: 'n' }, { key: 't', label: 'Tit', render: (r) => r.s.starts, cls: 'n hide-m' }, { key: 'm', label: 'Min', render: (r) => r.s.minutes, cls: 'n' },
    { key: 'g', label: 'G', render: (r) => r.s.goals, cls: 'n' }, { key: 'a', label: 'A', render: (r) => r.s.assists, cls: 'n' }, { key: 'n', label: 'Nota', render: (r) => (r.s.apps ? avgRating(r.s).toFixed(2) : '—'), cls: 'n' },
    { key: 'cs', label: 'SG', render: (r) => r.s.cleanSheets, cls: 'n hide-m', tip: 'Jogos sem sofrer gol com o jogador em campo (60+ min)' }, { key: 'y', label: 'CA', render: (r) => r.s.yellow, cls: 'n hide-m' }, { key: 'r', label: 'CV', render: (r) => r.s.red, cls: 'n hide-m' },
  ];
  return (
    <Panel title="Estatísticas" right={<span className="tiny muted">Dados das partidas simuladas desde o início da carreira</span>}>
      <Tabs tabs={[{ id: 'season', label: 'Temporada' }, { id: 'comp', label: 'Por competição' }, { id: 'seasons', label: 'Por temporada' }, { id: 'clubs', label: 'Por clube' }, { id: 'career', label: 'Carreira' }]} value={tab} onChange={setTab} />
      {(tab === 'season' || tab === 'comp') && seasons.length > 1 && (
        <div className="row" style={{ margin: '8px 0' }}><select value={season} onChange={(e) => setSeason(Number(e.target.value))} aria-label="Temporada">{seasons.map((y) => <option key={y} value={y}>Temporada {y}</option>)}</select></div>
      )}
      <div style={{ height: 8 }} />
      {!rows.length && <Empty>Ainda sem partidas oficiais registradas.</Empty>}
      {rows.length > 0 && tab === 'season' && <StatBlocks s={sumRows(sr)} pos={p.pos} injuries={inj(season)} />}
      {rows.length > 0 && tab === 'comp' && (
        <Table rows={sr.map((r) => ({ k: `${r.compId}|${r.clubId}`, label: `${r.comp}${new Set(sr.map((x) => x.clubId)).size > 1 ? ` (${r.club})` : ''}`, s: r.s }))} rowKey={(r) => r.k} cols={cols({ key: 'c', label: 'Competição', render: (r) => <span className="small">{r.label}</span> })} />
      )}
      {rows.length > 0 && tab === 'seasons' && (
        <Table rows={bySeason.map((x) => ({ k: `${x.y}`, label: `${x.y} · ${x.clubs.join(' / ')}`, s: x.s }))} rowKey={(r) => r.k} cols={cols({ key: 'c', label: 'Temporada', render: (r) => <span className="small">{r.label}</span> })} />
      )}
      {rows.length > 0 && tab === 'clubs' && (
        <Table rows={clubs.map((x) => ({ k: x.id, label: `${x.name} (${x.seasons.sort().join(', ')})`, s: x.s }))} rowKey={(r) => r.k} cols={cols({ key: 'c', label: 'Clube', render: (r) => <span className="small">{r.label}</span> })} />
      )}
      {rows.length > 0 && tab === 'career' && <StatBlocks s={total} pos={p.pos} injuries={inj()} />}
    </Panel>
  );
}

// ───────────────────────── Estatísticas do Elenco ─────────────────────────

type ColSet = 'gerais' | 'ataque' | 'meio' | 'defesa' | 'goleiros';

export function SquadStats({ c, players }: { c: Career; players: Player[] }) {
  const [period, setPeriod] = useState<Period>('current');
  const [scope, setScope] = useState<Scope>('club');
  const [comp, setComp] = useState('');
  const [q, setQ] = useState('');
  const [line, setLine] = useState('');
  const [set, setSet] = useState<ColSet>('gerais');
  const [sel, setSel] = useState<string[]>([]);
  const [cmp, setCmp] = useState(false);
  const allRows = useMemo(() => players.map((p) => ({ p, rows: statRows(c, p) })), [c, players, store.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const seasons = [...new Set(allRows.flatMap((x) => x.rows.map((r) => r.season)).concat(c.season))].sort((a, b) => b - a);
  const comps = [...new Map(allRows.flatMap((x) => x.rows).filter((r) => inPeriod(c, r, period)).map((r) => [r.tpl, r.comp])).entries()];
  const data: Agg[] = allRows
    .filter(({ p }) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!line || POS_LINE[p.pos] === line))
    .map(({ p, rows }) => {
      const rr = rows.filter((r) => inPeriod(c, r, period) && (scope === 'all' || r.clubId === c.userClubId) && (!comp || r.tpl === comp));
      return { p, s: sumRows(rr), rows: rr };
    });
  const nMatches = matchesInPeriod(c, period, comp);
  const age = (p: Player) => c.season - p.birthYear;
  const base: Col<Agg>[] = [
    { key: 'x', label: '', render: (r) => <input type="checkbox" aria-label={`Selecionar ${r.p.name} para comparar`} checked={sel.includes(r.p.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => setSel(e.target.checked ? [...sel, r.p.id] : sel.filter((x) => x !== r.p.id))} /> },
    { key: 'nm', label: 'Jogador', render: (r) => <PName p={r.p} />, sort: (r) => r.p.name },
    { key: 'pos', label: 'Pos', render: (r) => <PosB pos={r.p.pos} />, sort: (r) => ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST'].indexOf(r.p.pos) },
    { key: 'ov', label: 'Nível', render: (r) => <Lvl v={ovrToLevel(r.p.ovr)} size="sm" />, sort: (r) => r.p.ovr, cls: 'n' },
    { key: 'age', label: 'Id', render: (r) => age(r.p), sort: (r) => age(r.p), cls: 'n hide-m' },
    { key: 'j', label: 'J', render: (r) => r.s.apps, sort: (r) => r.s.apps, cls: 'n', tip: 'Jogos' },
  ];
  const n = (k: string, label: string, v: (s: StatLine) => number, fmt: (v: number, s: StatLine) => string = (x) => `${x}`, tip?: string, hide = false): Col<Agg> => ({ key: k, label, render: (r) => fmt(v(r.s), r.s), sort: (r) => v(r.s), cls: `n${hide ? ' hide-m' : ''}`, tip });
  const sets: Record<ColSet, Col<Agg>[]> = {
    gerais: [
      n('min', 'Min', (s) => s.minutes, undefined, 'Minutos', true), n('st', 'Tit', (s) => s.starts, undefined, 'Titularidades', true), n('sb', 'Ent', (s) => s.apps - s.starts, undefined, 'Entradas como substituto', true),
      n('g', 'G', (s) => s.goals), n('a', 'A', (s) => s.assists), n('nt', 'Nota', (s) => avgRating(s), (v, s) => (s.apps ? v.toFixed(2) : '—')),
      { key: 'cond', label: 'Cond', render: (r) => <Cond v={r.p.condition} />, sort: (r) => r.p.condition, cls: 'hide-m' },
      n('ca', 'CA', (s) => s.yellow, undefined, 'Cartões amarelos', true), n('cv', 'CV', (s) => s.red, undefined, 'Cartões vermelhos', true),
    ],
    ataque: [
      n('g', 'G', (s) => s.goals), n('a', 'A', (s) => s.assists), n('ga', 'G+A', (s) => s.goals + s.assists, undefined, 'Participações em gols'),
      n('sh', 'Fin', (s) => s.shots, undefined, 'Finalizações'), n('sot', 'Alvo', (s) => s.sot, undefined, 'Finalizações no alvo', true), n('cv', 'Conv', (s) => conversion(s) ?? -1, (v) => (v < 0 ? '—' : `${v.toFixed(0)}%`), 'Conversão (mín. 5 finalizações)', true),
      n('xg', 'xG', (s) => s.xg, (v) => v.toFixed(1), 'Gols esperados', true), n('g90', 'G/90', (s) => per90(s.goals, s.minutes), (v) => v.toFixed(2), 'Gols por 90 minutos', true),
    ],
    meio: [
      n('a', 'A', (s) => s.assists), n('kp', 'Chances', (s) => s.keyPasses, undefined, 'Chances criadas'), n('ps', 'Passes', (s) => s.passesOk, (v, s) => `${v}/${s.passes}`, 'Passes certos/tentados', true),
      n('pp', 'Acerto', (s) => passPct(s), (v, s) => (s.passes ? `${v.toFixed(0)}%` : '—'), 'Acerto de passe'), n('tk', 'Des', (s) => s.tackles, undefined, 'Desarmes'), n('int', 'Int', (s) => s.interceptions, undefined, 'Interceptações', true),
    ],
    defesa: [
      n('cs', 'SG', (s) => s.cleanSheets, undefined, 'Jogos sem sofrer gols com o jogador em campo (60+ min)'), n('tk', 'Des', (s) => s.tackles, undefined, 'Desarmes'), n('int', 'Int', (s) => s.interceptions, undefined, 'Interceptações'),
      n('clr', 'Cortes', (s) => s.clearances, undefined, undefined, true), n('blk', 'Bloq', (s) => s.blocks, undefined, 'Bloqueios', true), n('err', 'Erros', (s) => s.errGoal, undefined, 'Erros que resultaram em gol', true), n('fc', 'Faltas', (s) => s.fouls, undefined, 'Faltas cometidas', true),
    ],
    goleiros: [
      n('gs', 'GS', (s) => s.conceded, undefined, 'Gols sofridos'), n('cs', 'SG', (s) => s.cleanSheets, undefined, 'Jogos sem sofrer gols'), n('sv', 'Def', (s) => s.saves, undefined, 'Defesas'),
      n('svp', 'Def%', (s) => savePct(s), (v, s) => (s.saves + s.conceded >= 10 ? `${v.toFixed(0)}%` : '—'), 'Percentual de defesas'), n('ps', 'Pên', (s) => s.penSaved, undefined, 'Pênaltis defendidos', true),
    ],
  };
  const rows = set === 'goleiros' ? data.filter((r) => r.p.pos === 'GK') : data;
  return (
    <Panel title="Estatísticas do Elenco" flush>
      <div className="stack" style={{ padding: '10px 12px', gap: 8 }}>
        <div className="row">
          <select value={period} onChange={(e) => { setPeriod(e.target.value as Period); setComp(''); }} aria-label="Período">
            <option value="current">Temporada atual ({c.season})</option>
            <option value="previous">Temporada anterior ({c.season - 1})</option>
            {seasons.filter((y) => y < c.season - 1).map((y) => <option key={y} value={`s${y}`}>Temporada {y}</option>)}
            <option value="all">Todas as temporadas da carreira</option>
          </select>
          <select value={scope} onChange={(e) => setScope(e.target.value as Scope)} aria-label="Clubes">
            <option value="club">Apenas o clube atual</option>
            <option value="all">Carreira completa (inclui clubes anteriores)</option>
          </select>
          <select value={comp} onChange={(e) => setComp(e.target.value)} aria-label="Competição">
            <option value="">Todas as competições</option>
            {comps.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <input type="search" placeholder="Buscar por nome" aria-label="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={line} onChange={(e) => setLine(e.target.value)} aria-label="Posição">
            <option value="">Todas as posições</option><option value="G">Goleiros</option><option value="D">Defensores</option><option value="M">Meio-campistas</option><option value="A">Atacantes</option>
          </select>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Tabs tabs={[{ id: 'gerais', label: 'Gerais' }, { id: 'ataque', label: 'Ataque' }, { id: 'meio', label: 'Meio-campo' }, { id: 'defesa', label: 'Defesa' }, { id: 'goleiros', label: 'Goleiros' }]} value={set} onChange={setSet} />
          <button className="btn sm" disabled={sel.length < 2} onClick={() => setCmp(true)}>Comparar selecionados ({sel.length})</button>
        </div>
        <div className="small"><strong>Recorte:</strong> {periodLabel(c, period, scope)}{comp ? ` · ${comps.find(([id]) => id === comp)?.[1]}` : ''} · <strong>{nMatches}</strong> partida(s) oficial(is) do {c.clubs[c.userClubId].short} no período</div>
      </div>
      <Table rows={rows} rowKey={(r) => r.p.id} onRow={(r) => store.go({ name: 'player', id: r.p.id })} initialSort={{ key: 'j', dir: -1 }} cols={[...base, ...sets[set]]} empty="Nenhum jogador neste filtro." />
      {cmp && <CompareModal c={c} ids={sel} period={period} scope={scope} comp={comp} onClose={() => setCmp(false)} />}
    </Panel>
  );
}

// ───────────────────────── comparação ─────────────────────────

export function CompareModal({ c, ids, period, scope, comp, onClose }: { c: Career; ids: string[]; period: Period; scope: Scope; comp: string; onClose: () => void }) {
  const ps = ids.map((id) => c.players[id]).filter(Boolean);
  const cur = ps.map((p) => aggregate(c, p, period, scope, comp));
  const career = ps.map((p) => aggregate(c, p, 'all', 'all'));
  const best = (vals: number[], high = true) => { const m = high ? Math.max(...vals) : Math.min(...vals); return (v: number) => (vals.filter((x) => x === m).length < vals.length && v === m ? 'pos strong' : ''); };
  const line = (label: string, get: (a: Agg) => number, fmt: (v: number) => string = (v) => `${v}`, high = true, list = cur) => {
    const vals = list.map(get);
    const cls = best(vals, high);
    return <tr key={label}><td className="small">{label}</td>{vals.map((v, i) => <td key={i} className={`n ${cls(v)}`}>{fmt(v)}</td>)}</tr>;
  };
  const isGk = ps.every((p) => p.pos === 'GK');
  return (
    <Modal title="Comparação de jogadores" size="wide" onClose={onClose}>
      <div className="small muted" style={{ marginBottom: 8 }}>Mesmo recorte para todos: {periodLabel(c, period, scope)}</div>
      <div className="tbl-wrap">
        <table className="tbl flat">
          <thead><tr><th /> {ps.map((p) => <th key={p.id} className="n">{p.name}</th>)}</tr></thead>
          <tbody>
            {line('Nível (0–25)', (a) => ovrToLevel(a.p.ovr), (v) => v.toFixed(1))}
            {line('Idade', (a) => c.season - a.p.birthYear, undefined, false)}
            {line('Condição física', (a) => a.p.condition, (v) => `${Math.round(v)}%`)}
            {line('Jogos', (a) => a.s.apps)}
            {line('Minutos', (a) => a.s.minutes)}
            {line('Gols', (a) => a.s.goals)}
            {line('Assistências', (a) => a.s.assists)}
            {line('Nota média', (a) => avgRating(a.s), (v) => (v ? v.toFixed(2) : '—'))}
            {isGk ? <>
              {line('Gols sofridos', (a) => a.s.conceded, undefined, false)}
              {line('Defesas', (a) => a.s.saves)}
              {line('Sem sofrer gols', (a) => a.s.cleanSheets)}
            </> : <>
              {line('Finalizações no alvo', (a) => a.s.sot)}
              {line('Chances criadas', (a) => a.s.keyPasses)}
              {line('Acerto de passe', (a) => passPct(a.s), (v) => (v ? `${v.toFixed(0)}%` : '—'))}
              {line('Desarmes + interceptações', (a) => a.s.tackles + a.s.interceptions)}
              {line('Sem sofrer gols (em campo)', (a) => a.s.cleanSheets)}
            </>}
            <tr><td colSpan={ps.length + 1} className="tiny muted">Carreira completa (todas as temporadas e clubes)</td></tr>
            {line('Jogos na carreira', (a) => a.s.apps, undefined, true, career)}
            {line('Gols na carreira', (a) => a.s.goals, undefined, true, career)}
            {line('Nota média na carreira', (a) => avgRating(a.s), (v) => (v ? v.toFixed(2) : '—'), true, career)}
            <tr><td colSpan={ps.length + 1} className="tiny muted">Atributos</td></tr>
            {ATTRS.map((at, i) => (isGk ? at.group !== 'tec' || i < 2 : at.group !== 'gol') && line(`${at.name} (${ATTR_GROUPS[at.group]})`, (a) => Math.round(a.p.attrs[i])))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
