import { useState } from 'react';
import type { Pos, YouthPlan } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Tabs, Table, PName, PosB, Lvl, Money, Morale, Cond, Modal } from '../components/common';
import { Icon } from '../components/Icon';
import { YOUTH_PLANS, acceptCandidate, developmentStatus, dismissCandidate, potentialEstimate, promote, promotionForecast, setMentoring, setPlan, talentTier, youthOfClub } from '../../engine/youth/academy';
import { clubEffects } from '../../engine/infra/infra';
import { POSITIONS, POS_NAME, ovrToLevel } from '../../engine/players/attributes';
import { nationName } from '../../engine/data/nations';
import { fmtShort } from '../../engine/core/date';

type Tab = 'squad' | 'intake' | 'loans' | 'report';

export function Youth() {
  const s = useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const [tab, setTab] = useState<Tab>((s.route.tab as Tab) ?? (c.intakeCandidates.length ? 'intake' : 'squad'));
  const [sel, setSel] = useState<string | null>(null);
  const fx = clubEffects(c, club);
  const youth = youthOfClub(c, club);
  const cands = c.intakeCandidates.map((id) => c.players[id]).filter(Boolean);
  const loaned = Object.values(c.players).filter((p) => p.loan?.fromClubId === club.id && p.loan.fromSquad === 'youth');
  const mentoringUsed = youth.filter((p) => p.youth?.mentoring).length;
  const cols = [
    { key: 'n', label: 'Jogador', render: (p: (typeof youth)[number]) => <PName p={p} />, sort: (p: (typeof youth)[number]) => p.name },
    { key: 'pos', label: 'Pos', render: (p: (typeof youth)[number]) => <span className="row tight"><PosB pos={p.pos} />{p.alt.slice(0, 2).map((a) => <span key={a} className="tiny muted">{a}</span>)}</span> },
    { key: 'age', label: 'Id', render: (p: (typeof youth)[number]) => c.season - p.birthYear, sort: (p: (typeof youth)[number]) => p.birthYear, cls: 'n' },
    { key: 'nat', label: 'Nac', render: (p: (typeof youth)[number]) => <span className="small">{nationName(p.nat)}</span> },
    { key: 'l', label: 'Nível', render: (p: (typeof youth)[number]) => <Lvl v={ovrToLevel(p.ovr)} size="sm" />, sort: (p: (typeof youth)[number]) => p.ovr, cls: 'c' },
    { key: 'pe', label: 'Pot. estimado', render: (p: (typeof youth)[number]) => { const e = potentialEstimate(c, p); return <span className="small">{e.low}–{e.high}</span>; }, sort: (p: (typeof youth)[number]) => potentialEstimate(c, p).mid, cls: 'c' },
    { key: 'tier', label: 'Talento', render: (p: (typeof youth)[number]) => { const t = talentTier(potentialEstimate(c, p).mid); return <span className={`chip ${t.tone === 'star' ? 'star' : t.tone === 'great' ? 'good' : t.tone === 'good' ? 'info' : ''}`}>{t.label}</span>; } },
    { key: 'v', label: 'Valor', render: (p: (typeof youth)[number]) => <Money v={p.value} />, sort: (p: (typeof youth)[number]) => p.value, cls: 'n' },
    { key: 'm', label: 'Moral', render: (p: (typeof youth)[number]) => <Morale v={p.morale} /> },
    { key: 'cd', label: 'Cond', render: (p: (typeof youth)[number]) => <Cond v={p.condition} /> },
    { key: 'ev', label: 'Evolução', render: (p: (typeof youth)[number]) => <span className={`small ${(p.youth?.recentGain ?? 0) > 0.2 ? 'pos' : ''}`}>{developmentStatus(c, p)}</span> },
    { key: 'pl', label: 'Plano', render: (p: (typeof youth)[number]) => <span className="small">{YOUTH_PLANS[p.youth?.plan ?? 'balanced'].name}{p.youth?.mentoring ? ' + mentor' : ''}</span> },
    { key: 't', label: 'No clube', render: (p: (typeof youth)[number]) => <span className="small">{Math.max(0, Math.round((c.day - (p.youth?.joined ?? p.joined)) / 30))} meses</span> },
    { key: 'pf', label: 'Previsão', render: (p: (typeof youth)[number]) => <span className="small">{promotionForecast(c, p)}</span> },
  ];
  const selected = sel ? c.players[sel] : null;
  return (
    <div className="page">
      <PageHead title="Base" sub={`${youth.length}/${fx.youthCapacity} vagas nos alojamentos · qualidade de formação ${Math.round(fx.youthDev * 100)}% · precisão das avaliações ${Math.round(fx.youthAccuracy * 100)}% · acompanhamento individual ${mentoringUsed}/${1 + Math.floor(club.facilities.y_monitoring / 2)}`}
        actions={<button className="btn" onClick={() => store.go({ name: 'infra' })}><Icon name="building" />Estrutura da base</button>} />
      <Tabs tabs={[{ id: 'squad', label: `Elenco da base (${youth.length})` }, { id: 'intake', label: `Novos talentos (${cands.length})` }, { id: 'loans', label: `Emprestados (${loaned.length})` }, { id: 'report', label: 'Recrutamento' }]} value={tab} onChange={setTab} />
      {tab === 'squad' && (
        <Panel flush>
          <Table rows={youth} rowKey={(p) => p.id} cols={cols} onRow={(p) => setSel(p.id)} initialSort={{ key: 'pe', dir: -1 }} empty="Nenhum jovem na base. Aguarde a próxima peneira ou contrate jovens." />
        </Panel>
      )}
      {tab === 'intake' && (
        <Panel title="Relatório da peneira" flush>
          <Table rows={cands} rowKey={(p) => p.id} cols={[
            ...cols.slice(0, 7),
            { key: 'a', label: '', render: (p) => (
              <span className="row tight">
                <button className="btn sm go" onClick={(e) => { e.stopPropagation(); store.act((cc) => acceptCandidate(cc, p.id), `${p.name} entrou na base.`); }}>Aceitar</button>
                <button className="btn sm" onClick={(e) => { e.stopPropagation(); setSel(p.id); }}>Avaliar</button>
                <button className="btn sm danger" onClick={(e) => { e.stopPropagation(); store.act((cc) => dismissCandidate(cc, p.id)); }}>Dispensar</button>
              </span>
            ) },
          ]} empty="Nenhum candidato aguardando. As peneiras acontecem nas datas configuradas no universo (padrão: 20 de janeiro)." />
          <p className="tiny muted" style={{ padding: '0 12px 10px' }}>Candidatos não avaliados em 30 dias são dispensados automaticamente. Olheiros e treinadores da base melhoram a precisão das estimativas.</p>
        </Panel>
      )}
      {tab === 'loans' && (
        <Panel flush>
          <Table rows={loaned} rowKey={(p) => p.id} cols={[
            cols[0], { key: 'c', label: 'Clube', render: (p) => c.clubs[p.loan!.toClubId]?.name },
            { key: 'j', label: 'Jogos', render: (p) => p.loan!.apps, cls: 'n' }, { key: 'm', label: 'Min', render: (p) => p.loan!.minutes, cls: 'n' },
            { key: 'g', label: 'Gols', render: (p) => p.loan!.goals, cls: 'n' }, { key: 'n', label: 'Nota', render: (p) => (p.loan!.apps ? (p.loan!.ratingSum / p.loan!.apps).toFixed(2) : '—'), cls: 'n' },
            { key: 'r', label: 'Retorno', render: (p) => fmtShort(p.loan!.until) },
          ]} empty="Nenhum jovem emprestado." />
        </Panel>
      )}
      {tab === 'report' && (
        <div className="grid g2">
          <Panel title="Região de recrutamento">
            <div className="stack">
              {([['local', 'Local', 'Menor custo; jovens da região, menos variedade.'], ['nacional', 'Nacional', 'Equilíbrio entre custo e alcance.'], ['continental', 'Continental', 'Mais estrangeiros e chance de talentos raros.']] as const).map(([id, t, d]) => {
                const on = id === 'continental' ? c.flags.recruitContinental : id === 'local' ? c.flags.recruitLocal : !c.flags.recruitContinental && !c.flags.recruitLocal;
                return <button key={id} className={`choice ${on ? 'on' : ''}`} onClick={() => store.act((cc) => { cc.flags.recruitContinental = id === 'continental'; cc.flags.recruitLocal = id === 'local'; })}><span className="t">{t}</span><span className="small muted">{d}</span></button>;
              })}
            </div>
          </Panel>
          <Panel title="Fatores das revelações">
            <div className="small stack" style={{ gap: 6 }}>
              <div>Reputação do clube: <strong>{Math.round(club.reputation)}</strong></div>
              <div>Qualidade das peneiras (estrutura, treinadores e olheiros): <strong>{Math.round(fx.intakeQuality * 100)}%</strong></div>
              <div>Olheiros: <strong>{Math.round(fx.scouting * 100)}%</strong></div>
              <div>Frequência: <strong>{c.config.progression.youthIntake === 'annual' ? 'anual' : c.config.progression.youthIntake === 'semiannual' ? 'semestral' : 'desligada'}</strong> ({c.config.progression.intakeDates.join(', ')})</div>
              <div className="muted">A base produz resultados variados: jovens que não evoluem, bons profissionais, reservas úteis e raras promessas excepcionais.</div>
            </div>
          </Panel>
        </div>
      )}
      {selected && <YouthModal pid={selected.id} onClose={() => setSel(null)} />}
    </div>
  );
}

function YouthModal({ pid, onClose }: { pid: string; onClose: () => void }) {
  useGame();
  const c = useCareer();
  const p = c.players[pid];
  if (!p) return null;
  const est = potentialEstimate(c, p);
  const club = c.clubs[c.userClubId];
  const senior = club.playerIds.map((id) => c.players[id]).filter((x) => x.pos === p.pos).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  const isCand = c.intakeCandidates.includes(pid);
  return (
    <Modal title={`${p.name} — ${POS_NAME[p.pos]}, ${c.season - p.birthYear} anos`} onClose={onClose} footer={<><button className="btn" onClick={() => store.go({ name: 'player', id: p.id })}>Ficha completa</button>{!isCand && <button className="btn go" onClick={() => { store.act((cc) => promote(cc, p, 'rotation'), `${p.name} promovido!`); onClose(); }}>Promover ao profissional</button>}</>}>
      <div className="grid g2">
        <div className="stack">
          <h4>Relatório da comissão da base</h4>
          <div>Nível atual <Lvl v={ovrToLevel(p.ovr)} size="sm" /> · potencial estimado <strong>{est.low}–{est.high}</strong> ({talentTier(est.mid).label})</div>
          <div className="small muted">Precisão da avaliação: {Math.round(est.accuracy * 100)}%. A incerteza diminui com melhores treinadores da base e olheiros.</div>
          <div className="small">Status: {developmentStatus(c, p)} · previsão: {promotionForecast(c, p)}</div>
          <h4 style={{ marginTop: 8 }}>Comparação com o profissional ({p.pos})</h4>
          {senior.map((x) => <div key={x.id} className="row" style={{ justifyContent: 'space-between' }}><span className="small">{x.name}</span><Lvl v={ovrToLevel(x.ovr)} size="sm" /></div>)}
        </div>
        {!isCand && (
          <div className="stack">
            <h4>Plano individual</h4>
            {(Object.keys(YOUTH_PLANS) as YouthPlan[]).map((k) => (
              <button key={k} className={`choice ${p.youth?.plan === k ? 'on' : ''}`} onClick={() => store.act((cc) => setPlan(cc, p.id, k, p.youth?.devPos))}><span className="t" style={{ fontSize: 14 }}>{YOUTH_PLANS[k].name}</span><span className="small muted">{YOUTH_PLANS[k].desc}</span></button>
            ))}
            {p.youth?.plan === 'position' && (
              <label className="inline">Posição de desenvolvimento
                <select value={p.youth.devPos ?? p.pos} onChange={(e) => store.act((cc) => setPlan(cc, p.id, 'position', e.target.value as Pos))}>{POSITIONS.map((x) => <option key={x} value={x}>{POS_NAME[x]}</option>)}</select>
              </label>
            )}
            <label className="inline"><input type="checkbox" checked={!!p.youth?.mentoring} onChange={(e) => store.act((cc) => setMentoring(cc, p.id, e.target.checked))} />Acompanhamento individual (mentoria)</label>
          </div>
        )}
      </div>
    </Modal>
  );
}
