import { useState } from 'react';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Table, Tabs, Empty, ClubName } from '../components/common';
import { POS_SHORT } from '../../engine/players/attributes';
import { nationName } from '../../engine/data/nations';
import { careerTotals } from '../../engine/players/retirement';

export function History() {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const [tab, setTab] = useState<'temporadas' | 'campeoes' | 'clube' | 'treinador' | 'recordes' | 'lendas'>('temporadas');
  const [comp, setComp] = useState('');
  const templates = Object.values(c.config.competitions).filter((t) => (c.champions[t.id]?.length ?? 0) > 0).sort((a, b) => a.name.localeCompare(b.name));
  const sel = comp || templates[0]?.id || '';
  const retired = Object.values(c.retired).sort((a, b) => b.peakLevel - a.peakLevel || b.goals - a.goals);
  // artilheiros históricos entre os jogadores em atividade
  const active = Object.values(c.players).map((p) => ({ p, t: careerTotals(p) })).filter((x) => x.t.goals > 0).sort((a, b) => b.t.goals - a.t.goals).slice(0, 25);
  return (
    <div className="page">
      <PageHead title="Histórico" sub={`${c.seasonHistory.length} temporada(s) concluída(s) · ${Object.keys(c.retired).length} aposentado(s)`} />
      <Tabs tabs={[{ id: 'temporadas', label: 'Temporadas' }, { id: 'campeoes', label: 'Campeões' }, { id: 'clube', label: 'Seu clube' }, { id: 'treinador', label: 'Sua carreira' }, { id: 'recordes', label: 'Conquistas e recordes' }, { id: 'lendas', label: 'Lendas aposentadas' }]} value={tab} onChange={setTab} />
      <div style={{ height: 10 }} />
      {tab === 'temporadas' && (c.seasonHistory.length ? (
        <div className="stack">
          {c.seasonHistory.slice().reverse().map((s) => (
            <Panel key={s.season} title={`Temporada ${s.season}`} right={<span className="small">{s.userClubName}{s.userPosition ? ` · ${s.userPosition}º ${s.userDivision ?? ''}` : ''}</span>}>
              <div className="grid g2 small">
                <div>
                  <div className="muted">Campeões</div>
                  {s.champions.slice(0, 18).map((ch) => <div key={ch.compTemplateId}>{ch.compName}: <strong>{ch.clubName}</strong></div>)}
                  {s.champions.length > 18 && <div className="muted">+{s.champions.length - 18} competições</div>}
                </div>
                <div>
                  <div className="muted">Artilheiros</div>
                  {s.topScorers.slice(0, 10).map((t, i) => <div key={i}>{t.compName}: {t.name} ({t.goals})</div>)}
                  {s.boardVerdict && <div style={{ marginTop: 8 }}><span className="muted">Diretoria:</span> {s.boardVerdict}</div>}
                  {(s.promoted.length > 0 || s.relegated.length > 0) && <div style={{ marginTop: 8 }}><span className="muted">Acessos:</span> {s.promoted.length} · <span className="muted">Rebaixamentos:</span> {s.relegated.length}</div>}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : <Empty>Nenhuma temporada concluída ainda. O resumo aparece aqui ao fim de cada temporada.</Empty>)}
      {tab === 'campeoes' && (templates.length ? (
        <Panel title="Galeria de campeões" right={<select value={sel} onChange={(e) => setComp(e.target.value)} aria-label="Competição">{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>} flush>
          <Table rows={(c.champions[sel] ?? []).slice().reverse()} rowKey={(r) => `${r.season}`} cols={[
            { key: 's', label: 'Temporada', render: (r) => r.season },
            { key: 'c', label: 'Campeão', render: (r) => (c.clubs[r.clubId] ? <ClubName id={r.clubId} /> : r.clubName) },
            { key: 'v', label: 'Vice', render: (r) => <span className="small">{r.runnerUpName ?? '—'}</span> },
          ]} />
        </Panel>
      ) : <Empty>Os campeões aparecem aqui assim que as primeiras competições terminarem.</Empty>)}
      {tab === 'clube' && (
        <div className="grid g2">
          <Panel title={`Títulos do ${club.name}`}>
            {club.titles.length ? club.titles.slice().reverse().map((t, i) => <div key={i} className="small">{t.season} — <strong>{t.compName}</strong></div>) : <Empty>Nenhum título registrado.</Empty>}
          </Panel>
          <Panel title="Campanhas" flush>
            <Table rows={club.seasons.slice().reverse()} rowKey={(r) => `${r.season}|${r.compId}`} cols={[
              { key: 's', label: 'Temp.', render: (r) => r.season }, { key: 'c', label: 'Competição', render: (r) => <span className="small">{r.compName}</span> },
              { key: 'p', label: 'Pos', render: (r) => `${r.position}º`, cls: 'n' }, { key: 'pt', label: 'Pts', render: (r) => r.points, cls: 'n' },
              { key: 'r', label: 'V-E-D', render: (r) => `${r.w}-${r.d}-${r.l}`, cls: 'n' }, { key: 'g', label: 'Gols', render: (r) => `${r.gf}:${r.ga}`, cls: 'n' },
            ]} empty="Nenhuma campanha concluída." />
          </Panel>
          <Panel title="Linha do tempo">
            {club.events.length ? club.events.slice(-30).reverse().map((e, i) => <div key={i} className="small">{e.text}</div>) : <Empty>Sem eventos.</Empty>}
          </Panel>
        </div>
      )}
      {tab === 'treinador' && (
        <div className="grid g2">
          <Panel title={c.manager.name}>
            <div className="small stack" style={{ gap: 4 }}>
              <div>Nacionalidade: {nationName(c.manager.nat)}</div>
              <div>Reputação: <strong>{Math.round(c.manager.reputation)}</strong>/100</div>
              <div>Demissões: {c.manager.fired}</div>
            </div>
          </Panel>
          <Panel title="Clubes treinados">
            {c.manager.history.length ? c.manager.history.slice().reverse().map((h, i) => <div key={i} className="small">{h.season} — {h.clubName}{h.finish ? ` · ${h.finish}` : ''}</div>) : <div className="small">{c.season} — {club.name} (atual)</div>}
          </Panel>
          <Panel title="Troféus do treinador">
            {c.manager.trophies.length ? c.manager.trophies.slice().reverse().map((t, i) => <div key={i} className="small">{t.season} — <strong>{t.compName}</strong></div>) : <Empty>Nenhum troféu ainda.</Empty>}
          </Panel>
        </div>
      )}
      {tab === 'recordes' && (
        <div className="grid g2">
          <Panel title="Recordes do universo">
            {Object.keys(c.records).length ? Object.entries(c.records).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([k, r]) => <div key={k} className="small"><span className="muted">{r.label}:</span> <strong>{r.holder}</strong> — {r.value} ({r.season})</div>) : <Empty>Os recordes são registrados conforme as competições terminam.</Empty>}
          </Panel>
          <Panel title="Maiores artilheiros em atividade" flush>
            <Table rows={active} rowKey={(x) => x.p.id} onRow={(x) => store.go({ name: 'player', id: x.p.id })} cols={[
              { key: 'n', label: 'Jogador', render: (x) => x.p.name }, { key: 'c', label: 'Clube', render: (x) => (x.p.clubId ? <ClubName id={x.p.clubId} short /> : '—') },
              { key: 'j', label: 'Jogos', render: (x) => x.t.apps, cls: 'n' }, { key: 'g', label: 'Gols', render: (x) => <strong>{x.t.goals}</strong>, cls: 'n' },
              { key: 's', label: 'Estrelas', render: (x) => x.p.achievements.filter((a) => a.kind === 'gold_star' || a.kind === 'red_star').length, cls: 'n', tip: 'Estrelas de artilharia (douradas + vermelhas)' },
            ]} />
          </Panel>
        </div>
      )}
      {tab === 'lendas' && (
        <Panel flush>
          <Table rows={retired} rowKey={(r) => r.id} maxRows={150} cols={[
            { key: 'n', label: 'Jogador', render: (r) => <strong>{r.name}</strong>, sort: (r) => r.name },
            { key: 'p', label: 'Pos', render: (r) => POS_SHORT[r.pos] },
            { key: 'na', label: 'País', render: (r) => <span className="small">{nationName(r.nat)}</span> },
            { key: 'a', label: 'Aposentou', render: (r) => `${r.retiredSeason} (${r.retiredSeason - r.birthYear} anos)`, sort: (r) => r.retiredSeason },
            { key: 'c', label: 'Último clube', render: (r) => <span className="small">{r.lastClub}</span> },
            { key: 'pk', label: 'Pico', render: (r) => r.peakLevel, sort: (r) => r.peakLevel, cls: 'n' },
            { key: 'j', label: 'Jogos', render: (r) => r.apps, sort: (r) => r.apps, cls: 'n' },
            { key: 'g', label: 'Gols', render: (r) => r.goals, sort: (r) => r.goals, cls: 'n' },
            { key: 't', label: 'Conquistas', render: (r) => r.achievements.length, sort: (r) => r.achievements.length, cls: 'n' },
            { key: 'f', label: 'Nova função', render: (r) => <span className="small">{r.newRole ?? '—'}</span> },
          ]} empty="Nenhum jogador se aposentou ainda. As aposentadorias acontecem ao fim de cada temporada." />
        </Panel>
      )}
    </div>
  );
}
