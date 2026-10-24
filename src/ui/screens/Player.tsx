import { useMemo, useState } from 'react';
import type { Player, StaffRole } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { Panel, PageHead, Lvl, PosB, Stars, Money, Morale, Cond, Bar, Modal, Confirm, Field, NumInput, ClubName, Table, Empty, StarIcon, levelColor, Menu, clickable, type MenuItem } from '../components/common';
import { Avatar, Face, commonsPage } from '../components/graphics';
import { Icon } from '../components/Icon';
import { ATTRS, ATTR_GROUPS, POS_NAME, ovrToLevel, playerLevel, playerLevelLabel, levelLabel } from '../../engine/players/attributes';
import { TRAIT_MAP } from '../../engine/players/traits';
import { STYLE_MAP } from '../../engine/players/styles';
import { nationName } from '../../engine/data/nations';
import { seasonTotals } from './Squad';
import { askingPrice, loanOut, loanTargets, releasePlayer, renewContract, renewalDemand, playerMarketStatus } from '../../engine/market/transfers';
import { payTribute, planFarewell, setFutureRole, toggleListed } from '../../engine/players/actions';
import { STAFF_ROLES } from '../../engine/infra/infra';
import { promote } from '../../engine/youth/academy';
import { awardsOfPlayer } from '../../engine/awards/awards';
import { currentCollection } from '../../engine/kits/commerce';
import { Negotiation } from './Market';
import { careerTotals } from '../../engine/players/retirement';
import { potRange } from '../helpers';
import { PlayerStatsPanel } from './StatsViews';

export function PlayerPage({ id }: { id: string }) {
  useGame();
  const c = useCareer();
  const p = c.players[id];
  const retired = c.retired[id];
  const [modal, setModal] = useState<null | 'renew' | 'release' | 'loan' | 'compare' | 'offer' | 'loanOffer' | 'role'>(null);
  if (!p) {
    if (retired) return <RetiredView id={id} />;
    return <div className="page"><PageHead title="Jogador não encontrado" back /></div>;
  }
  const own = p.clubId === c.userClubId || p.loan?.fromClubId === c.userClubId;
  const club = p.clubId ? c.clubs[p.clubId] : null;
  const age = c.season - p.birthYear;
  const lvl = playerLevel(p);
  const pot = potRange(c, p);
  const kit = club ? (club.id === c.userClubId ? currentCollection(c).home : club.kits[club.kits.length - 1]?.home) : undefined;
  const totals = careerTotals(p);
  const awards = awardsOfPlayer(c, p.id);
  const titles = p.achievements.filter((a) => a.kind === 'title');
  const groups = p.pos === 'GK' ? ['gol', 'men', 'fis', 'tec'] : ['tec', 'fis', 'men'];
  const shortlisted = c.shortlist.includes(p.id);
  const youthHere = p.squad === 'youth' && p.clubId === c.userClubId;

  return (
    <div className="page">
      <PageHead back title={<span className="row" style={{ gap: 12 }}><Face a={p.appearance} photo={p.photo} kit={kit} size={72} /><span><span className="row tight">{p.name}<Stars p={p} max={12} /></span><span className="small muted" style={{ fontFamily: 'var(--f-body)', fontWeight: 500 }}>{p.firstName} {p.lastName} · Nº {p.shirt || '—'} · ID {p.num}</span></span></span>}
        sub={<span className="row tight"><PosB pos={p.pos} />{p.alt.map((a) => <PosB key={a} pos={a} />)}<span>{POS_NAME[p.pos]}</span>·<span>{age} anos</span>·<span>{nationName(p.nat)}</span>·<span>Pé {p.foot === 'D' ? 'direito' : p.foot === 'E' ? 'esquerdo' : 'ambidestro'}</span>·<span>{p.height} cm, {p.weight} kg</span>·{club ? <ClubName id={club.id} /> : <span className="chip">Sem clube</span>}</span>}
        actions={own ? (
          <>
            {youthHere && <button className="btn go" onClick={() => store.act((cc) => promote(cc, p, 'rotation'), 'Jogador promovido ao profissional.')}><Icon name="youth" />Promover</button>}
            <button className="btn" onClick={() => setModal('compare')}>Comparar</button>
            <Menu label="Mais" items={[
              ...(p.contract && p.clubId === c.userClubId ? [{ label: 'Renovar contrato', onClick: () => setModal('renew') }] : []),
              ...(p.clubId === c.userClubId ? [{ label: p.listed ? 'Tirar da lista de venda' : 'Colocar à venda', onClick: () => store.act((cc) => toggleListed(cc, p.id)) }] : []),
              ...(p.clubId === c.userClubId ? [{ label: 'Emprestar', onClick: () => setModal('loan') }] : []),
              ...(p.clubId === c.userClubId ? [{ label: 'Liberar', onClick: () => setModal('release'), danger: true }] : []),
            ] satisfies MenuItem[]} />
          </>
        ) : (
          <>
            <button className="btn" onClick={() => store.act((cc) => { cc.shortlist = shortlisted ? cc.shortlist.filter((x) => x !== p.id) : [...cc.shortlist, p.id]; })}><Icon name="eye" />{shortlisted ? 'Deixar de observar' : 'Observar'}</button>
            <button className="btn primary" onClick={() => setModal('offer')} disabled={!!p.loan}><Icon name="transfer" />{p.clubId ? 'Fazer proposta' : 'Contratar (livre)'}</button>
            {p.clubId && <button className="btn" onClick={() => setModal('loanOffer')} disabled={!!p.loan}>Pedir emprestado</button>}
            <button className="btn" onClick={() => setModal('compare')}>Comparar</button>
          </>
        )}
      />
      <div className="tiny muted source-note">
        {p.origin === 'real' ? <>Jogador real · elenco de outubro de 2026 (Wikipédia){p.wd && <> · <a href={`https://www.wikidata.org/wiki/${p.wd}`} target="_blank" rel="noreferrer">dados no Wikidata</a></>} · nível, atributos e valores são estimativas do jogo.</> : p.origin === 'creator' ? 'Jogador criado no Criador de Craques.' : p.origin === 'youth' ? 'Revelação da base gerada pelo jogo.' : 'Jogador fictício gerado pelo jogo.'}
        {p.photo && <> · Foto: {p.photo.author}, <a href={commonsPage(p.photo.src)} target="_blank" rel="noreferrer">{p.photo.license} via Wikimedia Commons</a></>}
      </div>
      <div className="grid g-main">
        <div className="stack">
          <Panel title="Atributos" right={<span className="small muted">Escala 1–100 · nível geral considera a posição</span>}>
            {groups.map((g) => (
              <div key={g} style={{ marginBottom: 10 }}>
                <h4 style={{ marginBottom: 6 }}>{ATTR_GROUPS[g]}</h4>
                <div className="attrs">
                  {ATTRS.map((a, i) => a.group === g && (
                    <div key={a.key} className="attr"><span>{a.name}</span><span className="v" style={{ color: levelColor(ovrToLevel(p.attrs[i])) }}>{Math.round(p.attrs[i])}</span><Bar v={p.attrs[i]} color={levelColor(ovrToLevel(p.attrs[i]))} /></div>
                  ))}
                </div>
              </div>
            ))}
          </Panel>
          <Panel title="Conquistas e recordes">
            <div className="grid g2">
              <div>
                <h4>Artilharias</h4>
                {p.achievements.filter((a) => a.kind === 'gold_star' || a.kind === 'red_star').length === 0 && <div className="small muted">Ainda sem artilharias.</div>}
                {p.achievements.filter((a) => a.kind === 'gold_star' || a.kind === 'red_star').sort((a, b) => b.season - a.season).map((a) => (
                  <div key={a.key} className="row tight small"><StarIcon red={a.kind === 'red_star'} tip={a.label} />{a.compName} {a.season} — {a.goals} gols <span className="muted">({a.clubName})</span></div>
                ))}
                <h4 style={{ marginTop: 10 }}>Títulos ({titles.length})</h4>
                {titles.length === 0 && <div className="small muted">Nenhum título ainda.</div>}
                {titles.sort((a, b) => b.season - a.season).map((a) => <div key={a.key} className="small"><Icon name="trophy" className="star-ico" /> {a.label} <span className="muted">({a.clubName})</span></div>)}
              </div>
              <div>
                <h4>Prêmios individuais</h4>
                {awards.length === 0 && <div className="small muted">Nenhum prêmio ainda.</div>}
                {awards.map((a) => <div key={a.key} className="small link" style={{ cursor: 'pointer' }} {...clickable(() => store.go({ name: 'awards', id: a.key }))}><Icon name="award" className="star-ico" /> {a.name} {a.edition}</div>)}
                {p.achievements.filter((a) => a.kind === 'award' && a.awardId === 'team').map((a) => <div key={a.key} className="small"><Icon name="award" className="star-ico" /> {a.label}</div>)}
                <h4 style={{ marginTop: 10 }}>Bola de Ouro e indicações</h4>
                <div className="small">Indicações: <strong>{p.nominations?.nominated ?? 0}</strong> · Finalista: <strong>{p.nominations?.finalist ?? 0}</strong> · Vitórias: <strong>{p.nominations?.won ?? 0}</strong></div>
                <div className="small" style={{ marginTop: 6 }}>Carreira: <strong>{totals.apps}</strong> jogos, <strong>{totals.goals}</strong> gols, <strong>{totals.assists}</strong> assistências (temporadas encerradas)</div>
              </div>
            </div>
          </Panel>
          <Panel title="Histórico de carreira" flush>
            <CareerChart p={p} />
            <Table rows={p.history.slice().reverse()} rowKey={(h) => `${h.season}-${h.clubId}-${h.apps}-${h.loan}`} cols={[
              { key: 's', label: 'Temp.', render: (h) => h.season },
              { key: 'c', label: 'Clube', render: (h) => <span>{h.clubName}{h.loan ? ' (emp.)' : ''}</span> },
              { key: 'j', label: 'J', render: (h) => h.apps, cls: 'n' },
              { key: 'g', label: 'G', render: (h) => h.goals, cls: 'n' },
              { key: 'a', label: 'A', render: (h) => h.assists, cls: 'n' },
              { key: 'n', label: 'Nota', render: (h) => (h.avgRating ? h.avgRating.toFixed(2) : '—'), cls: 'n' },
              { key: 'l', label: 'Nível', render: (h) => <Lvl v={h.level} size="sm" />, cls: 'c' },
              { key: 'v', label: 'Valor', render: (h) => <Money v={h.value} />, cls: 'n' },
            ]} empty="O histórico é registrado ao fim de cada temporada e a cada transferência." />
          </Panel>
          <PlayerStatsPanel c={c} p={p} />
        </div>
        <div className="stack">
          <Panel title="Avaliação">
            <div className="row" style={{ gap: 18 }}>
              <div className="center"><Lvl v={lvl} size="lg" /><div className="tiny muted">Nível atual</div></div>
              <div className="center"><span className="lvl lg pot" style={{ color: levelColor(pot.high) }}>{pot.exact ? pot.low : `${pot.low}–${pot.high}`}</span><div className="tiny muted">{pot.exact ? 'Potencial' : 'Potencial estimado'}</div></div>
              <div className="stack" style={{ gap: 2 }}>
                <strong>{playerLevelLabel(lvl)}</strong>
                <span className="small muted">Nota {p.ovr.toFixed(1)}/100 · forma recente {p.form.length ? (p.form.reduce((s, x) => s + x, 0) / p.form.length).toFixed(2) : '—'}</span>
                <span className="small muted">Reputação {Math.round(p.reputation)}/100 · experiência {Math.round(p.experience)}</span>
              </div>
            </div>
            <div className="hr" />
            <div className="grid g2 small">
              <div><span className="muted">Moral</span><div><Morale v={p.morale} /></div></div>
              <div><span className="muted">Condição</span><div><Cond v={p.condition} /> {Math.round(p.condition)}%</div></div>
              <div><span className="muted">Ritmo de jogo</span><div><Bar v={p.sharpness} /></div></div>
              <div><span className="muted">Situação</span><div>{playerMarketStatus(c, p)}</div></div>
            </div>
            {p.happiness && <div className="chip warn" style={{ marginTop: 8 }}>{p.happiness}</div>}
            {p.injury && <div className="chip bad" style={{ marginTop: 8 }}>{p.injury.name}: {Math.ceil(p.injury.daysLeft)} dias</div>}
          </Panel>
          <Panel title="Personalidade e estilo">
            <div className="stack" style={{ gap: 8 }}>
              {p.style && STYLE_MAP[p.style] && <div><span className="chip info">{STYLE_MAP[p.style].name}</span> <span className="small muted">{STYLE_MAP[p.style].desc}</span></div>}
              {p.traits.map((t) => TRAIT_MAP[t] && (
                <div key={t} className="small"><strong>{TRAIT_MAP[t].name}</strong> — <span className="pos">{TRAIT_MAP[t].upside}</span> <span className="neg">{TRAIT_MAP[t].downside}</span></div>
              ))}
              {!p.traits.length && !p.style && <span className="small muted">Sem traços marcantes.</span>}
              {p.creator && <div className="small muted">Criado no Criador de Craques{p.creator.formativeClub ? ` · formado no ${p.creator.formativeClub}` : ''}{p.creator.promise ? ` · ${p.creator.promise}` : ''}. {p.creator.backstory}</div>}
            </div>
          </Panel>
          <Panel title="Contrato e mercado">
            <div className="grid g2 small">
              <div><span className="muted">Valor de mercado</span><div className="strong"><Money v={p.value} /></div></div>
              <div><span className="muted">Salário anual</span><div className="strong">{p.contract ? <Money v={p.contract.wage} /> : '—'}</div></div>
              <div><span className="muted">Contrato até</span><div className="strong">{p.contract ? `31/12/${p.contract.endYear}` : 'Livre'}</div></div>
              <div><span className="muted">Cláusula de rescisão</span><div className="strong">{p.contract?.releaseClause ? <Money v={p.contract.releaseClause} /> : '—'}</div></div>
              {!own && p.clubId && <div><span className="muted">Preço pedido (estimado)</span><div className="strong"><Money v={askingPrice(c, p)} /></div></div>}
              {p.loan && <div><span className="muted">Empréstimo</span><div className="strong">{c.clubs[p.loan.fromClubId]?.short} → {c.clubs[p.loan.toClubId]?.short}: {p.loan.apps} J, {p.loan.goals} G</div></div>}
            </div>
            {own && p.clubId === c.userClubId && age >= 29 && (
              <div className="stack" style={{ marginTop: 10, gap: 6 }}>
                <div className="row">
                  <button className="btn sm" onClick={() => store.act((cc) => payTribute(cc, p.id), 'Homenagem realizada.')}>Preparar homenagem</button>
                  {age >= 31 && <button className="btn sm" onClick={() => store.act((cc) => planFarewell(cc, p.id, !p.farewell), p.farewell ? 'Despedida cancelada.' : 'Despedida planejada para o fim da temporada.')}>{p.farewell ? 'Cancelar despedida' : 'Planejar despedida'}</button>}
                  <button className="btn sm" onClick={() => setModal('role')}>Função futura no clube</button>
                </div>
                {p.futureRole && <span className="small muted">Função futura avaliada: {STAFF_ROLES.find((r) => r.id === p.futureRole)?.name}</span>}
              </div>
            )}
          </Panel>
          <Panel title="Lesões">
            {p.injuries.length ? p.injuries.slice().reverse().map((i, k) => <div key={k} className="small">{i.season}: {i.name} ({i.days} dias)</div>) : <div className="small muted">Sem histórico de lesões.</div>}
          </Panel>
        </div>
      </div>
      {modal === 'renew' && <RenewModal p={p} onClose={() => setModal(null)} />}
      {modal === 'release' && <Confirm title={`Liberar ${p.name}?`} danger confirmLabel="Rescindir contrato" text={`A rescisão custa metade dos salários restantes do contrato. O jogador fica livre no mercado.`} onNo={() => setModal(null)} onYes={() => { store.act((cc) => releasePlayer(cc, p.id), 'Contrato rescindido.'); setModal(null); }} />}
      {modal === 'loan' && <LoanModal p={p} onClose={() => setModal(null)} />}
      {modal === 'compare' && <CompareModal p={p} onClose={() => setModal(null)} />}
      {(modal === 'offer' || modal === 'loanOffer') && <Negotiation pid={p.id} loan={modal === 'loanOffer'} onClose={() => setModal(null)} />}
      {modal === 'role' && (
        <Modal title="Função futura no clube" size="narrow" onClose={() => setModal(null)}>
          <div className="stack">
            <p className="small muted">Indicar uma função aumenta a chance de o atleta aceitar trabalhar no clube ao se aposentar. Não é garantido.</p>
            {STAFF_ROLES.filter((r) => ['coach', 'youthCoach', 'fitness', 'gkCoach', 'scout'].includes(r.id)).map((r) => (
              <button key={r.id} className={`choice ${p.futureRole === r.id ? 'on' : ''}`} onClick={() => { store.act((cc) => setFutureRole(cc, p.id, r.id as StaffRole)); setModal(null); }}><span className="t">{r.name}</span><span className="small muted">{r.desc}</span></button>
            ))}
          </div>
        </Modal>
      )}
      <p className="tiny muted">Nível do clube atual: {club ? `${club.level.toFixed(1)} (${levelLabel(club.level)})` : '—'}.</p>
    </div>
  );
}

function CareerChart({ p }: { p: Player }) {
  const pts = p.history.filter((h) => h.level > 0);
  if (pts.length < 2) return null;
  const w = 560, h = 120;
  const minS = pts[0].season, maxS = pts[pts.length - 1].season;
  const x = (s: number) => 30 + ((s - minS) / Math.max(1, maxS - minS)) * (w - 50);
  const y = (l: number) => h - 14 - (l / 25) * (h - 28);
  const maxV = Math.max(...pts.map((q) => q.value), 1);
  const yv = (v: number) => h - 14 - (v / maxV) * (h - 28);
  return (
    <div className="tbl-wrap" style={{ padding: '8px 12px' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }}>
        {[0, 5, 10, 15, 20, 25].map((l) => <g key={l}><line x1="28" x2={w - 10} y1={y(l)} y2={y(l)} stroke="var(--line)" /><text x="4" y={y(l) + 4} fontSize="10" fill="var(--muted)">{l}</text></g>)}
        <polyline points={pts.map((q) => `${x(q.season)},${yv(q.value)}`).join(' ')} fill="none" stroke="var(--info)" strokeWidth="1.5" strokeDasharray="4 3" />
        <polyline points={pts.map((q) => `${x(q.season)},${y(q.level)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.2" />
        {pts.map((q, i) => <circle key={i} cx={x(q.season)} cy={y(q.level)} r="3" fill="var(--accent)"><title>{`${q.season}: nível ${q.level}`}</title></circle>)}
      </svg>
      <div className="tiny muted">Linha dourada: nível (0–25). Tracejada azul: valor de mercado relativo.</div>
    </div>
  );
}

function RenewModal({ p, onClose }: { p: Player; onClose: () => void }) {
  const c = useCareer();
  const d = renewalDemand(c, p);
  const [wage, setWage] = useState(d.wage);
  const [years, setYears] = useState(d.years);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Modal title={`Renovar com ${p.name}`} size="narrow" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Fechar</button><button className="btn primary" onClick={() => { const r = renewContract(c, p.id, wage, years); setMsg(r.message); store.bump(); if (r.status === 'accepted') setTimeout(onClose, 900); }}>Oferecer</button></>}>
      <div className="stack">
        <div className="small muted">Pedido do jogador: <Money v={d.wage} /> por ano, {d.years} ano(s). Salário atual: <Money v={p.contract?.wage ?? 0} />.</div>
        <Field label="Salário anual"><NumInput value={wage} step={10000} width={160} onChange={setWage} /></Field>
        <Field label="Anos de contrato"><NumInput value={years} min={1} max={5} onChange={(v) => setYears(Math.max(1, Math.min(5, v)))} /></Field>
        {msg && <div className="chip info">{msg}</div>}
      </div>
    </Modal>
  );
}

function LoanModal({ p, onClose }: { p: Player; onClose: () => void }) {
  const c = useCareer();
  const targets = loanTargets(c, p);
  const [pct, setPct] = useState(1);
  return (
    <Modal title={`Emprestar ${p.name}`} onClose={onClose}>
      <div className="stack">
        <p className="small muted">Clubes de nível compatível. O tempo de jogo no clube de destino influencia a evolução. Retorno ao fim da temporada.</p>
        <Field label={`Parte do salário paga pelo clube de destino: ${Math.round(pct * 100)}%`}><input type="range" min={0.3} max={1} step={0.1} value={pct} onChange={(e) => setPct(Number(e.target.value))} /></Field>
        <Table rows={targets} rowKey={(r) => r.id} cols={[
          { key: 'c', label: 'Clube', render: (r) => <ClubName id={r.id} link={false} /> },
          { key: 'd', label: 'Divisão', render: (r) => c.config.competitions[r.divisionId]?.short },
          { key: 'l', label: 'Nível', render: (r) => <Lvl v={r.level} size="sm" />, cls: 'c' },
          { key: 'a', label: '', render: (r) => <button className="btn sm primary" onClick={() => { const e = loanOut(c, p.id, r.id, pct); if (e) store.toast(e, 'err'); else { store.toast(`${p.name} emprestado ao ${r.name}.`); onClose(); } store.bump(); }}>Emprestar</button> },
        ]} empty="Nenhum clube interessado no momento." />
      </div>
    </Modal>
  );
}

function CompareModal({ p, onClose }: { p: Player; onClose: () => void }) {
  const c = useCareer();
  const [q, setQ] = useState('');
  const [other, setOther] = useState<string | null>(null);
  const cands = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return Object.values(c.players).filter((x) => x.id !== p.id && (ql ? x.name.toLowerCase().includes(ql) : x.clubId === c.userClubId && x.pos === p.pos)).slice(0, 12);
  }, [q, c, p]);
  const o = other ? c.players[other] : null;
  return (
    <Modal title="Comparar jogadores" size="wide" onClose={onClose}>
      <div className="row"><input type="search" placeholder="Buscar jogador" value={q} onChange={(e) => setQ(e.target.value)} />{cands.map((x) => <button key={x.id} className={`btn sm ${other === x.id ? 'primary' : ''}`} onClick={() => setOther(x.id)}>{x.name}</button>)}</div>
      {o && (
        <div className="tbl-wrap" style={{ marginTop: 12 }}>
          <table className="tbl">
            <thead><tr><th>Atributo</th><th className="n">{p.name}</th><th className="n">{o.name}</th></tr></thead>
            <tbody>
              <tr><td>Nível</td><td className="n"><Lvl v={playerLevel(p)} size="sm" /></td><td className="n"><Lvl v={playerLevel(o)} size="sm" /></td></tr>
              <tr><td>Idade</td><td className="n">{c.season - p.birthYear}</td><td className="n">{c.season - o.birthYear}</td></tr>
              <tr><td>Valor</td><td className="n"><Money v={p.value} /></td><td className="n"><Money v={o.value} /></td></tr>
              {ATTRS.map((a, i) => <tr key={a.key}><td>{a.name}</td><td className="n" style={{ color: Math.round(p.attrs[i]) > Math.round(o.attrs[i]) ? 'var(--win)' : undefined }}>{Math.round(p.attrs[i])}</td><td className="n" style={{ color: Math.round(o.attrs[i]) > Math.round(p.attrs[i]) ? 'var(--win)' : undefined }}>{Math.round(o.attrs[i])}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
      {!o && <Empty>Escolha um jogador para comparar.</Empty>}
      <p className="tiny muted">{seasonTotals(p, c.season).apps} jogos nesta temporada.</p>
    </Modal>
  );
}

function RetiredView({ id }: { id: string }) {
  const c = useCareer();
  const r = c.retired[id];
  return (
    <div className="page">
      <PageHead back title={<span className="row"><Avatar a={r.appearance} size={56} />{r.name} <span className="chip">Aposentado em {r.retiredSeason}</span></span>} sub={`${nationName(r.nat)} · ${POS_NAME[r.pos]} · último clube: ${r.lastClub}${r.newRole ? ` · hoje: ${r.newRole}` : ''}`} />
      <div className="grid g2">
        <Panel title="Números da carreira"><div>{r.apps} jogos · {r.goals} gols · nível máximo {r.peakLevel}</div></Panel>
        <Panel title="Conquistas e recordes">{r.achievements.map((a) => <div key={a.key} className="small">{a.kind === 'gold_star' || a.kind === 'red_star' ? <StarIcon red={a.kind === 'red_star'} tip={a.label} /> : <Icon name="trophy" className="star-ico" />} {a.label}</div>)}</Panel>
      </div>
      <Panel title="Histórico" flush>
        <Table rows={r.history.slice().reverse()} rowKey={(h) => `${h.season}-${h.clubId}-${h.apps}`} cols={[
          { key: 's', label: 'Temp.', render: (h) => h.season }, { key: 'c', label: 'Clube', render: (h) => h.clubName }, { key: 'j', label: 'J', render: (h) => h.apps, cls: 'n' }, { key: 'g', label: 'G', render: (h) => h.goals, cls: 'n' }, { key: 'l', label: 'Nível', render: (h) => <Lvl v={h.level} size="sm" /> },
        ]} />
      </Panel>
    </div>
  );
}
