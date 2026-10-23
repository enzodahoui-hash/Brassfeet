import { useMemo, useState } from 'react';
import type { KitDesign, KitPattern } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, Tabs, Field, NumInput, Money, Bars, Table } from '../components/common';
import { Shirt } from '../components/graphics';
import { BRANDS, KIT_PATTERNS, SPONSORS, scoreKit, seasonTrend, fanPreference, referenceKitPrice, collectionProfit } from '../../engine/kits/kits';
import { currentCollection, extraMarketing, launchCollection, previousDesigns, restock, setDiscount, updateDesign } from '../../engine/kits/commerce';
import { fmtDay } from '../../engine/core/date';

type Kind = 'home' | 'away' | 'third' | 'gk';

export function Kits() {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const k = currentCollection(c);
  const [kind, setKind] = useState<Kind>('home');
  const [back, setBack] = useState(false);
  const [draft, setDraft] = useState<KitDesign>(k[kind]);
  const [view, setView] = useState<'design' | 'launch' | 'sales' | 'past'>(k.launched ? 'sales' : 'design');
  const prev = previousDesigns(c, k.season);
  const sc = useMemo(() => scoreKit(draft, club, k.season, kind, prev), [draft, club, k.season, kind, prev]);
  const star = club.playerIds.map((id) => c.players[id]).sort((a, b) => b.reputation - a.reputation)[0];
  const trend = seasonTrend(k.season);
  const pref = fanPreference(club);
  const pickKind = (x: Kind) => {
    setKind(x);
    setDraft(k[x]);
  };
  const set = (patch: Partial<KitDesign>) => setDraft((d) => ({ ...d, ...patch }));
  const saveDesign = () => store.act((cc) => updateDesign(cc, k.id, kind, draft), 'Uniforme salvo na coleção.');
  return (
    <div className="page">
      <PageHead title="Uniformes" sub={`${k.name} · temporada ${k.season} · ${k.launched ? `lançada em ${fmtDay(k.launchDay!)}` : 'rascunho'}`} />
      <Tabs tabs={[{ id: 'design', label: 'Editor' }, { id: 'launch', label: 'Lançamento' }, { id: 'sales', label: 'Vendas' }, { id: 'past', label: `Coleções anteriores (${club.kits.filter((x) => x.season < c.season).length})` }]} value={view} onChange={setView} />
      {view === 'design' && (
        <div className="grid g-main">
          <div className="stack">
            <Panel title="Pré-visualização" right={<>
              {(['home', 'away', 'third', 'gk'] as Kind[]).map((x) => <button key={x} className={`btn sm ${kind === x ? 'primary' : ''}`} onClick={() => pickKind(x)}>{{ home: 'Principal', away: 'Reserva', third: 'Terceiro', gk: 'Goleiro' }[x]}</button>)}
              <button className="btn sm" onClick={() => setBack(!back)}>{back ? 'Ver frente' : 'Ver costas'}</button>
            </>}>
              <div className="kit-stage">
                <Shirt design={draft} size={260} back={back} name={star?.name.split(' ').slice(-1)[0]} number={star?.shirt} crest={club.crest} />
              </div>
            </Panel>
            <Panel title={`Avaliação do design: ${sc.total}/100`} right={<span className="chip info">Aceitação estimada {sc.acceptance}%</span>}>
              <div className="grid g4 small">
                {Object.entries({ Harmonia: sc.parts.harmony, Contraste: sc.parts.contrast, Identidade: sc.parts.identity, Legibilidade: sc.parts.legibility, Originalidade: sc.parts.originality, Torcida: sc.parts.fans, Tendência: sc.parts.trend }).map(([l, v]) => (
                  <div key={l}><div className="muted">{l}</div><div className="strong" style={{ color: v >= 75 ? 'var(--win)' : v >= 55 ? 'var(--draw)' : 'var(--loss)' }}>{v}</div></div>
                ))}
              </div>
              <div className="stack" style={{ marginTop: 8, gap: 4 }}>
                {sc.suggestions.map((s, i) => <div key={i} className="small">• {s}</div>)}
                {!sc.suggestions.length && <div className="small pos">Design equilibrado: sem sugestões.</div>}
                <div className="tiny muted">Nota reproduzível calculada a partir das cores, contraste, padrão, identidade do clube, preferência da torcida (gosta de "{KIT_PATTERNS.find((p) => p.id === pref.pattern)?.name}") e tendência da temporada ("{trend.name}"). As sugestões são opcionais.</div>
              </div>
            </Panel>
          </div>
          <Panel title="Editor" right={<button className="btn primary" onClick={saveDesign} disabled={k.launched}>{k.launched ? 'Coleção já lançada' : 'Salvar na coleção'}</button>}>
            <div className="stack">
              <div className="row">
                <Field label="Principal"><input type="color" value={draft.primary} onChange={(e) => set({ primary: e.target.value })} /></Field>
                <Field label="Secundária"><input type="color" value={draft.secondary} onChange={(e) => set({ secondary: e.target.value })} /></Field>
                <Field label="Detalhes"><input type="color" value={draft.detail} onChange={(e) => set({ detail: e.target.value })} /></Field>
                <Field label="Número"><input type="color" value={draft.numberColor} onChange={(e) => set({ numberColor: e.target.value })} /></Field>
                <button className="btn sm" onClick={() => set({ primary: club.colors[0], secondary: club.colors[1], detail: club.colors[2] })}>Cores do clube</button>
              </div>
              <Field label="Padrão">
                <div className="row tight">{KIT_PATTERNS.map((p) => <button key={p.id} className={`btn sm ${draft.pattern === p.id ? 'primary' : ''}`} onClick={() => set({ pattern: p.id as KitPattern })}>{p.name}</button>)}</div>
              </Field>
              <div className="row">
                <Field label="Gola"><select value={draft.collar} onChange={(e) => set({ collar: e.target.value as KitDesign['collar'] })}><option value="round">Redonda</option><option value="v">Em V</option><option value="polo">Polo</option><option value="crew">Careca</option></select></Field>
                <Field label="Mangas"><select value={draft.sleeves} onChange={(e) => set({ sleeves: e.target.value as KitDesign['sleeves'] })}><option value="short">Curtas</option><option value="long">Longas</option></select></Field>
                <Field label="Cor das mangas"><select value={draft.sleeveColor} onChange={(e) => set({ sleeveColor: e.target.value as KitDesign['sleeveColor'] })}><option value="primary">Principal</option><option value="secondary">Secundária</option><option value="detail">Detalhes</option></select></Field>
                <label className="inline"><input type="checkbox" checked={draft.cuffs} onChange={(e) => set({ cuffs: e.target.checked })} />Punhos</label>
              </div>
              <Field label="Elemento decorativo"><select value={draft.decoration} onChange={(e) => set({ decoration: e.target.value as KitDesign['decoration'] })}><option value="none">Nenhum</option><option value="shoulder">Listras nos ombros</option><option value="sidepanels">Painéis laterais</option><option value="chestband">Faixa no peito</option><option value="pinline">Friso</option></select></Field>
              <div className="row">
                <Field label="Patrocínio (fictício)"><select value={draft.sponsor} onChange={(e) => set({ sponsor: e.target.value })}><option value="">Sem patrocínio</option>{SPONSORS.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
                <Field label="Marca esportiva (fictícia)"><select value={draft.brand} onChange={(e) => set({ brand: e.target.value })}>{BRANDS.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
              </div>
            </div>
          </Panel>
        </div>
      )}
      {view === 'launch' && <Launch />}
      {view === 'sales' && <Sales />}
      {view === 'past' && (
        <div className="grid g3">
          {club.kits.filter((x) => x.season < c.season).sort((a, b) => b.season - a.season).map((x) => (
            <Panel key={x.id} title={`${x.name} (${x.season})`}>
              <div className="row" style={{ justifyContent: 'center' }}><Shirt design={x.home} size={110} /><Shirt design={x.away} size={110} /></div>
              <div className="small">Vendidas: {x.sold.toLocaleString('pt-BR')} · receita <Money v={x.revenue} /> · lucro <Money v={collectionProfit(x)} color /> · nota {x.designScore}</div>
            </Panel>
          ))}
          {!club.kits.some((x) => x.season < c.season) && <div className="empty">As coleções de temporadas passadas aparecerão aqui.</div>}
        </div>
      )}
    </div>
  );
}

function Launch() {
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const k = currentCollection(c);
  const [name, setName] = useState(k.name);
  const [price, setPrice] = useState(Math.round(referenceKitPrice(club)));
  const [units, setUnits] = useState(Math.round(Math.max(2000, club.fans * 0.004) / 100) * 100);
  const [mkt, setMkt] = useState(Math.round(club.fans * 0.02));
  const [cost, setCost] = useState(14);
  if (k.launched) return <div className="empty">A coleção {k.season} já foi lançada. Acompanhe na aba Vendas.</div>;
  const total = units * cost + mkt;
  return (
    <div className="grid g2">
      <Panel title="1. Revise o design">
        <div className="row" style={{ justifyContent: 'center' }}><Shirt design={k.home} size={150} crest={club.crest} /><Shirt design={k.away} size={150} crest={club.crest} /><Shirt design={k.third} size={150} crest={club.crest} /></div>
        <div className="small center">Nota do design principal: <strong>{k.designScore}</strong> · aceitação estimada <strong>{k.acceptance}%</strong></div>
      </Panel>
      <Panel title="2. Preço, produção e divulgação">
        <div className="stack">
          <Field label="Nome da coleção"><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={`Preço de venda (referência ${Math.round(referenceKitPrice(club))})`}><NumInput value={price} min={10} onChange={setPrice} /></Field>
          <Field label="Quantidade inicial produzida"><NumInput value={units} min={100} step={500} width={140} onChange={setUnits} /></Field>
          <Field label="Custo unitário de produção"><select value={cost} onChange={(e) => setCost(Number(e.target.value))}><option value={10}>10 — econômico</option><option value={14}>14 — padrão</option><option value={20}>20 — premium</option></select></Field>
          <Field label="Investimento em marketing"><NumInput value={mkt} min={0} step={10000} width={140} onChange={setMkt} /></Field>
          <div className="small">Custo total do lançamento: <strong><Money v={total} /></strong> (produção <Money v={units * cost} /> + marketing <Money v={mkt} />). Saldo: <Money v={club.balance} color /></div>
          <button className="btn go" onClick={() => store.act((cc) => launchCollection(cc, k.id, { price, units, marketing: mkt, unitCost: cost, name }), 'Coleção lançada!')}>3. Confirmar lançamento</button>
          <div className="tiny muted">As vendas acontecem semanalmente e dependem do design, da torcida, do desempenho do time, dos craques do elenco, do preço e do marketing. Sucesso não é garantido.</div>
        </div>
      </Panel>
    </div>
  );
}

function Sales() {
  const c = useCareer();
  const k = currentCollection(c);
  const club = c.clubs[c.userClubId];
  const [units, setUnits] = useState(5000);
  const [mkt, setMkt] = useState(100000);
  if (!k.launched) return <div className="empty">Lance a coleção para acompanhar as vendas.</div>;
  return (
    <div className="grid g-main">
      <div className="stack">
        <Panel flush>
          <div className="kpis">
            <div className="kpi"><div className="k">Unidades vendidas</div><div className="v">{k.sold.toLocaleString('pt-BR')}</div></div>
            <div className="kpi"><div className="k">Estoque</div><div className="v">{k.stock.toLocaleString('pt-BR')}</div><div className="d">{k.restockPending ? `+${k.restockPending.units} chegando ${fmtDay(k.restockPending.arrives)}` : k.status}</div></div>
            <div className="kpi"><div className="k">Vendas perdidas</div><div className="v">{k.lostSales.toLocaleString('pt-BR')}</div></div>
            <div className="kpi"><div className="k">Receita bruta</div><div className="v"><Money v={k.revenue} /></div></div>
            <div className="kpi"><div className="k">Custos (produção + marketing)</div><div className="v"><Money v={k.productionCost + k.marketing} /></div></div>
            <div className="kpi"><div className="k">Lucro comercial</div><div className="v"><Money v={collectionProfit(k)} color /></div></div>
          </div>
        </Panel>
        <Panel title="Vendas semanais">
          <Bars data={k.weeklySales.slice(-26).map((v, i) => ({ label: `${i + 1}`, v }))} height={130} />
        </Panel>
      </div>
      <div className="stack">
        <Panel title="Ações comerciais">
          <div className="stack">
            <div className="row"><NumInput value={units} step={500} width={110} onChange={setUnits} /><button className="btn" onClick={() => store.act((cc) => restock(cc, k.id, units), 'Reposição encomendada (14 dias).')}>Repor estoque</button></div>
            <div className="row"><NumInput value={mkt} step={10000} width={110} onChange={setMkt} /><button className="btn" onClick={() => store.act((cc) => extraMarketing(cc, k.id, mkt), 'Campanha contratada.')}>Campanha extra</button></div>
            <Field label={`Desconto: ${Math.round(k.discount * 100)}%${k.discount >= 0.3 ? ' (liquidação)' : ''}`}><input type="range" min={0} max={0.6} step={0.05} value={k.discount} onChange={(e) => store.act((cc) => setDiscount(cc, k.id, Number(e.target.value)))} /></Field>
            <div className="tiny muted">Receita bruta = unidades × preço com desconto. Lucro = receita − produção − marketing. O lançamento já debitou a produção inicial.</div>
          </div>
        </Panel>
        <Panel title="Coleção" flush>
          <Table rows={[k]} rowKey={(x) => x.id} cols={[{ key: 'p', label: 'Preço', render: (x) => <Money v={x.price} /> }, { key: 'a', label: 'Aceitação', render: (x) => `${x.acceptance}%` }, { key: 'd', label: 'Nota', render: (x) => x.designScore }, { key: 's', label: 'Situação', render: (x) => x.status }]} />
        </Panel>
        <div className="tiny muted">Fãs: {club.fans.toLocaleString('pt-BR')} · humor da torcida {Math.round(club.fanMood)}%</div>
      </div>
    </div>
  );
}
