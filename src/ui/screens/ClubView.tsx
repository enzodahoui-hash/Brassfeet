import { useState } from 'react';
import type { Player } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Table, Money, Lvl, PName, PosB, Tabs, Empty, ClubName } from '../components/common';
import { Crest, StadiumView } from '../components/graphics';
import { Negotiation } from './Market';
import { strengthSummary } from '../../engine/clubs/strength';
import { ovrToLevel } from '../../engine/players/attributes';
import { totalCapacity } from '../../engine/stadium/stadium';
import { nationName } from '../../engine/data/nations';
import { potRange } from '../helpers';
import { compFixtures } from '../../engine/competitions/manager';
import { fmtShort } from '../../engine/core/date';

export function ClubView({ id }: { id: string }) {
  useGame();
  const c = useCareer();
  const club = c.clubs[id];
  const [tab, setTab] = useState<'elenco' | 'base' | 'jogos' | 'historia' | 'estadio'>('elenco');
  const [nego, setNego] = useState<{ pid: string; loan: boolean } | null>(null);
  if (!club) return <div className="page"><Empty>Clube não encontrado.</Empty></div>;
  if (id === c.userClubId) {
    store.go({ name: 'home' }, true);
    return null;
  }
  const st = strengthSummary(c, club);
  const players = club.playerIds.map((x) => c.players[x]).filter(Boolean);
  const youth = club.youthIds.map((x) => c.players[x]).filter(Boolean);
  const season = c.season;
  const comps = Object.values(c.competitions).filter((x) => x.season === season && x.participants.includes(id));
  const fixtures = comps.flatMap((x) => compFixtures(c, x)).filter((f) => f.home === id || f.away === id).sort((a, b) => a.day - b.day);
  const cols = [
    { key: 'sh', label: 'Nº', render: (p: Player) => p.shirt, sort: (p: Player) => p.shirt, cls: 'n' },
    { key: 'n', label: 'Jogador', render: (p: Player) => <PName p={p} />, sort: (p: Player) => p.name },
    { key: 'p', label: 'Pos', render: (p: Player) => <PosB pos={p.pos} />, sort: (p: Player) => p.pos },
    { key: 'i', label: 'Id', render: (p: Player) => season - p.birthYear, sort: (p: Player) => p.birthYear, cls: 'n' },
    { key: 'na', label: 'País', render: (p: Player) => <span className="small">{nationName(p.nat)}</span> },
    { key: 'l', label: 'Nível', render: (p: Player) => <Lvl v={ovrToLevel(p.ovr)} size="sm" />, sort: (p: Player) => p.ovr, cls: 'n' },
    { key: 'pt', label: 'Pot. est.', render: (p: Player) => { const r = potRange(c, p); return <span className="small">{r.low}–{r.high}</span>; }, tip: 'Estimativa dos seus olheiros' },
    { key: 'v', label: 'Valor', render: (p: Player) => <Money v={p.value} />, sort: (p: Player) => p.value, cls: 'n' },
    { key: 'ct', label: 'Contrato', render: (p: Player) => p.contract?.endYear ?? '—', sort: (p: Player) => p.contract?.endYear ?? 0, cls: 'n' },
    { key: 'a', label: '', render: (p: Player) => <span className="row tight"><button className="btn sm" onClick={(e) => { e.stopPropagation(); setNego({ pid: p.id, loan: false }); }}>Comprar</button><button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); setNego({ pid: p.id, loan: true }); }}>Emprestar</button></span> },
  ];
  return (
    <div className="page">
      <PageHead back title={<span className="row tight"><Crest crest={club.crest} size={44} />{club.name}</span>} sub={`${club.city}${club.state ? ` (${club.state})` : ''} · ${nationName(club.country)} · ${c.config.competitions[club.divisionId]?.name ?? ''} · técnico ${club.coach.name}`} />
      <Panel flush>
        <div className="kpis">
          <div className="kpi"><div className="k">Nível do clube</div><div className="v"><Lvl v={st.clubLevel} /></div><div className="d">estrutura e reputação</div></div>
          <div className="kpi"><div className="k">Qualidade do elenco</div><div className="v"><Lvl v={st.squad} /></div><div className="d">melhores 18 jogadores</div></div>
          <div className="kpi"><div className="k">Força atual</div><div className="v"><Lvl v={st.current} /></div><div className="d">time provável, forma e lesões</div></div>
          <div className="kpi"><div className="k">Torcida</div><div className="v">{(club.fans / 1000).toFixed(0)} mil</div></div>
          <div className="kpi"><div className="k">Estádio</div><div className="v">{(totalCapacity(club.stadium) / 1000).toFixed(1)} mil</div><div className="d">{club.stadium.name}</div></div>
          <div className="kpi"><div className="k">Títulos</div><div className="v">{club.titles.length}</div></div>
        </div>
      </Panel>
      <div style={{ height: 12 }} />
      <Tabs tabs={[{ id: 'elenco', label: `Elenco (${players.length})` }, { id: 'base', label: `Base (${youth.length})` }, { id: 'jogos', label: 'Jogos da temporada' }, { id: 'historia', label: 'Títulos e campanhas' }, { id: 'estadio', label: 'Estádio' }]} value={tab} onChange={setTab} />
      <div style={{ height: 10 }} />
      {tab === 'elenco' && <Panel flush><Table rows={players} rowKey={(p) => p.id} onRow={(p) => store.go({ name: 'player', id: p.id })} cols={cols} initialSort={{ key: 'l', dir: -1 }} /></Panel>}
      {tab === 'base' && <Panel flush><Table rows={youth} rowKey={(p) => p.id} onRow={(p) => store.go({ name: 'player', id: p.id })} cols={cols.filter((x) => x.key !== 'a' && x.key !== 'v')} empty="Sem jogadores na base." /></Panel>}
      {tab === 'jogos' && (
        <Panel flush>
          <Table rows={fixtures} rowKey={(f) => f.id} onRow={(f) => f.status === 'played' && store.go({ name: 'match', id: f.id })} cols={[
            { key: 'd', label: 'Data', render: (f) => fmtShort(f.day) },
            { key: 'c', label: 'Competição', render: (f) => <span className="small">{c.competitions[f.compId]?.name}</span> },
            { key: 'h', label: 'Mandante', render: (f) => <ClubName id={f.home} short /> },
            { key: 's', label: 'Placar', render: (f) => (f.result ? `${f.result.hg} × ${f.result.ag}${f.result.pens ? ` (${f.result.pens[0]}–${f.result.pens[1]} pên.)` : ''}` : '—'), cls: 'c' },
            { key: 'a', label: 'Visitante', render: (f) => <ClubName id={f.away} short /> },
          ]} empty="Nenhum jogo nesta temporada." />
        </Panel>
      )}
      {tab === 'historia' && (
        <div className="grid g2">
          <Panel title="Títulos">{club.titles.length ? club.titles.slice().reverse().map((t, i) => <div key={i} className="small">{t.season} — <strong>{t.compName}</strong></div>) : <Empty>Nenhum título registrado no universo.</Empty>}</Panel>
          <Panel title="Campanhas" flush>
            <Table rows={club.seasons.slice().reverse()} rowKey={(r) => `${r.season}|${r.compId}`} cols={[
              { key: 's', label: 'Temp.', render: (r) => r.season }, { key: 'c', label: 'Competição', render: (r) => <span className="small">{r.compName}</span> },
              { key: 'p', label: 'Pos', render: (r) => `${r.position}º`, cls: 'n' }, { key: 'pt', label: 'Pts', render: (r) => r.points, cls: 'n' },
            ]} empty="Sem campanhas concluídas." />
          </Panel>
        </div>
      )}
      {tab === 'estadio' && <Panel><StadiumView st={club.stadium} colors={club.colors} /></Panel>}
      {nego && <Negotiation pid={nego.pid} loan={nego.loan} onClose={() => setNego(null)} />}
    </div>
  );
}
