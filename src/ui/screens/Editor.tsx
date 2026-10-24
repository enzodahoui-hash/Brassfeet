import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { Career, Club, CompTemplate, CrestDesign, Foot, Player, Pos, Tiebreak, World } from '../../engine/types';
import { store, useGame, tick } from '../store';
import { PageHead, Panel, Table, Tabs, Field, NumInput, Money, Lvl, Confirm, Empty, PosB, clickable } from '../components/common';
import { Crest } from '../components/graphics';
import { Icon } from '../components/Icon';
import { Creator } from './Creator';
import {
  batchCreate, createClub, deleteClub, deletePlayer, duplicatePlayer, duplicateUniverse, editorCreatePlayer, editorMovePlayer, exportUniverseText, generateYouth, isCareer,
  recalcValues, redistributePlayers, searchPlayers, setFinances, universeStats, updateClub, updateCompetition, updatePlayer, validateCompetition, worldFromCareer, type PlayerFilter, type PlayerPatch,
} from '../../engine/editor/editor';
import { ATTRS, ATTR_GROUPS, POSITIONS, POS_NAME, ovrToLevel } from '../../engine/players/attributes';
import { TRAITS } from '../../engine/players/traits';
import { stylesFor } from '../../engine/players/styles';
import { NATIONS } from '../../engine/data/nations';
import { TIEBREAK_NAMES } from '../../engine/competitions/table';
import { totalCapacity } from '../../engine/stadium/stadium';
import { parseUniverseText } from '../../engine/save/storage';
import { downloadText, slug } from '../helpers';

type W = World | Career;
type Mut = (fn: (w: W) => string | null | void, ok?: string) => void;
type TabId = 'jogadores' | 'clubes' | 'competicoes' | 'regras' | 'ferramentas' | 'universos' | 'criador';

// confirmação de edição de carreira: pedida uma vez por sessão
let careerAck = false;

const seasonOf = (w: W) => (isCareer(w) ? w.season : w.config.startYear);
const nations = () => Object.values(NATIONS).sort((a, b) => a.name.localeCompare(b.name));
const leagues = (w: W) => Object.values(w.config.competitions).filter((t) => t.kind === 'league').sort((a, b) => (a.country ?? '').localeCompare(b.country ?? '') || (a.tier ?? 0) - (b.tier ?? 0));

function ClubSelect({ w, value, onChange, allowNone, label = 'Clube' }: { w: W; value: string; onChange: (v: string) => void; allowNone?: string; label?: string }) {
  const groups = useMemo(() => leagues(w).map((l) => ({ l, clubs: Object.values(w.clubs).filter((c) => c.divisionId === l.id).sort((a, b) => a.name.localeCompare(b.name)) })), [w, w.clubs]);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {allowNone !== undefined && <option value="">{allowNone}</option>}
      {groups.map(({ l, clubs }) => clubs.length > 0 && <optgroup key={l.id} label={l.name}>{clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}
    </select>
  );
}

// ───────────────────────── jogadores ─────────────────────────

function PlayerEditor({ w, p, mut, onClose }: { w: W; p: Player; mut: Mut; onClose: () => void }) {
  const season = seasonOf(w);
  const init = useMemo(() => ({
    firstName: p.firstName, lastName: p.lastName, name: p.name, nat: p.nat, age: season - p.birthYear, pos: p.pos, foot: p.foot, height: p.height, weight: p.weight,
    level: Math.round(ovrToLevel(p.ovr) * 10) / 10, potentialLevel: Math.round(ovrToLevel(p.pot) * 10) / 10, value: p.value, wage: p.contract?.wage ?? 0, contractEnd: p.contract?.endYear ?? season,
    morale: Math.round(p.morale), condition: Math.round(p.condition), style: p.style, traits: p.traits.slice(), attrs: p.attrs.map((v) => Math.round(v)), alt: p.alt.slice(),
  }), [p, season]);
  const [d, setD] = useState(init);
  const [move, setMove] = useState(p.clubId ?? '');
  const [del, setDel] = useState(false);
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));
  const save = () => {
    const patch: PlayerPatch = {
      firstName: d.firstName, lastName: d.lastName, name: d.name.trim() || `${d.firstName} ${d.lastName}`, nat: d.nat, birthYear: season - d.age, pos: d.pos, foot: d.foot, alt: d.alt,
      height: d.height, weight: d.weight, morale: d.morale, condition: d.condition, style: d.style, traits: d.traits,
    };
    const changed: Record<number, number> = {};
    d.attrs.forEach((v, i) => { if (v !== init.attrs[i]) changed[i] = v; });
    if (Object.keys(changed).length) patch.attrs = changed;
    if (d.level !== init.level) patch.level = d.level;
    if (d.potentialLevel !== init.potentialLevel) patch.potentialLevel = d.potentialLevel;
    if (d.value !== init.value) patch.value = d.value;
    if (p.contract) {
      if (d.wage !== init.wage) patch.wage = d.wage;
      if (d.contractEnd !== init.contractEnd) patch.contractEnd = d.contractEnd;
    }
    mut((x) => updatePlayer(x, p.id, patch), `${patch.name} atualizado.`);
  };
  return (
    <Panel title={<h3>Editar: {p.name}</h3>} right={<button className="icon-btn" onClick={onClose} aria-label="Fechar editor"><Icon name="close" /></button>}>
      <div className="grid g3">
        <Field label="Nome"><input type="text" value={d.firstName} onChange={(e) => set({ firstName: e.target.value })} /></Field>
        <Field label="Sobrenome"><input type="text" value={d.lastName} onChange={(e) => set({ lastName: e.target.value })} /></Field>
        <Field label="Nome de exibição"><input type="text" aria-label="Nome de exibição do jogador" value={d.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Idade"><NumInput value={d.age} min={14} max={45} onChange={(v) => set({ age: v })} /></Field>
        <Field label="Nacionalidade"><select value={d.nat} onChange={(e) => set({ nat: e.target.value })}>{nations().map((n) => <option key={n.code} value={n.code}>{n.name}</option>)}</select></Field>
        <Field label="Posição"><select value={d.pos} onChange={(e) => set({ pos: e.target.value as Pos })}>{POSITIONS.map((x) => <option key={x} value={x}>{POS_NAME[x]}</option>)}</select></Field>
        <Field label="Pé"><select value={d.foot} onChange={(e) => set({ foot: e.target.value as Foot })}><option value="D">Direito</option><option value="E">Esquerdo</option><option value="A">Ambidestro</option></select></Field>
        <Field label="Altura"><NumInput value={d.height} min={150} max={215} onChange={(v) => set({ height: v })} /></Field>
        <Field label="Peso"><NumInput value={d.weight} min={45} max={120} onChange={(v) => set({ weight: v })} /></Field>
        <Field label={`Nível (0–25) · atual ${init.level}`}><NumInput value={d.level} min={0} max={25} step={0.5} onChange={(v) => set({ level: Math.max(0, Math.min(25, v)) })} /></Field>
        <Field label="Potencial (0–25)"><NumInput value={d.potentialLevel} min={0} max={25} step={0.5} onChange={(v) => set({ potentialLevel: Math.max(0, Math.min(25, v)) })} /></Field>
        <Field label="Valor de mercado"><NumInput value={d.value} min={0} step={10000} width={130} onChange={(v) => set({ value: Math.max(0, v) })} /></Field>
        {p.contract && <Field label="Salário anual"><NumInput value={d.wage} min={0} step={1000} width={130} onChange={(v) => set({ wage: Math.max(0, v) })} /></Field>}
        {p.contract && <Field label="Contrato até"><NumInput value={d.contractEnd} min={season} max={season + 8} onChange={(v) => set({ contractEnd: v })} /></Field>}
        <Field label="Moral"><NumInput value={d.morale} min={0} max={100} onChange={(v) => set({ morale: v })} /></Field>
        <Field label="Condição física"><NumInput value={d.condition} min={0} max={100} onChange={(v) => set({ condition: v })} /></Field>
        <Field label="Estilo"><select value={d.style ?? ''} onChange={(e) => set({ style: e.target.value || null })}><option value="">Nenhum</option>{stylesFor(d.pos).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      </div>
      <div className="small muted" style={{ margin: '10px 0 4px' }}>Posições secundárias</div>
      <div className="row">{POSITIONS.filter((x) => x !== d.pos).map((x) => <label key={x} className="inline small"><input type="checkbox" checked={d.alt.includes(x)} onChange={(e) => set({ alt: e.target.checked ? [...d.alt, x] : d.alt.filter((y) => y !== x) })} />{x}</label>)}</div>
      <div className="small muted" style={{ margin: '10px 0 4px' }}>Traços (até 4)</div>
      <div className="row">{TRAITS.map((t) => <label key={t.id} className="inline small" title={`${t.upside} / ${t.downside}`}><input type="checkbox" checked={d.traits.includes(t.id)} disabled={!d.traits.includes(t.id) && d.traits.length >= 4} onChange={(e) => set({ traits: e.target.checked ? [...d.traits, t.id] : d.traits.filter((y) => y !== t.id) })} />{t.name}</label>)}</div>
      <details style={{ marginTop: 10 }}>
        <summary className="small">Atributos individuais (1–100)</summary>
        {(['tec', 'fis', 'men', 'gol'] as const).map((g) => (
          <div key={g} style={{ marginTop: 8 }}>
            <h4>{ATTR_GROUPS[g]}</h4>
            <div className="attrs">
              {ATTRS.map((a, i) => a.group !== g ? null : (
                <div key={a.key} className="attr"><span>{a.name}</span><span /><NumInput value={d.attrs[i]} min={1} max={100} width={64} onChange={(v) => { const at = d.attrs.slice(); at[i] = Math.max(1, Math.min(100, v)); set({ attrs: at }); }} /></div>
              ))}
            </div>
          </div>
        ))}
        <div className="tiny muted">Alterar o nível escala todos os atributos; editar atributos recalcula o nível. Nível 25 é mantido enquanto você não o reduzir.</div>
      </details>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={save}>Salvar alterações</button>
        <button className="btn" onClick={() => setD(init)}>Desfazer</button>
        <button className="btn" onClick={() => mut((x) => { const c = duplicatePlayer(x, p.id); return c ? null : 'Falha ao duplicar.'; }, 'Jogador duplicado.')}><Icon name="copy" />Duplicar</button>
        <button className="btn danger" onClick={() => setDel(true)}><Icon name="trash" />Excluir</button>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <ClubSelect w={w} value={move} onChange={setMove} allowNone="Sem clube (agente livre)" label="Transferir para" />
        <button className="btn" onClick={() => mut((x) => editorMovePlayer(x, p.id, move || null, 'senior'), 'Jogador movido.')}>Mover para o profissional</button>
        {move && <button className="btn" onClick={() => mut((x) => editorMovePlayer(x, p.id, move, 'youth'), 'Jogador movido para a base.')}>Mover para a base</button>}
      </div>
      {del && <Confirm title={`Excluir ${p.name}?`} danger confirmLabel="Excluir" text="O jogador será removido permanentemente deste universo." onNo={() => setDel(false)} onYes={() => { setDel(false); mut((x) => deletePlayer(x, p.id), 'Jogador excluído.'); onClose(); }} />}
    </Panel>
  );
}

function PlayersTab({ w, mut }: { w: W; mut: Mut }) {
  const [f, setF] = useState<PlayerFilter>({ q: '', pos: '' });
  const [sel, setSel] = useState<string | null>(null);
  const [nw, setNw] = useState({ pos: 'ST' as Pos, nat: 'BRA', age: 21, level: 12, potential: 16, clubId: '', name: '' });
  useGame();
  const rows = useMemo(() => searchPlayers(w, f, 300), [w, f, store.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const season = seasonOf(w);
  const p = sel ? w.players[sel] : null;
  return (
    <div className="grid g-main">
      <div className="stack">
        <Panel>
          <div className="row">
            <input type="search" placeholder="Buscar jogador" aria-label="Buscar jogador" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <ClubSelect w={w} value={f.clubId ?? ''} onChange={(v) => setF({ ...f, clubId: v || undefined })} allowNone="Todos os clubes" />
            <select value={f.pos ?? ''} onChange={(e) => setF({ ...f, pos: e.target.value as Pos | '' })} aria-label="Posição"><option value="">Todas as posições</option>{POSITIONS.map((x) => <option key={x} value={x}>{POS_NAME[x]}</option>)}</select>
            <label className="inline small">Nível <NumInput value={f.minLevel ?? 0} min={0} max={25} width={56} onChange={(v) => setF({ ...f, minLevel: v || undefined })} /> a <NumInput value={f.maxLevel ?? 25} min={0} max={25} width={56} onChange={(v) => setF({ ...f, maxLevel: v === 25 ? undefined : v })} /></label>
            <label className="inline small"><input type="checkbox" checked={!!f.free} onChange={(e) => setF({ ...f, free: e.target.checked || undefined })} />Só sem clube</label>
          </div>
        </Panel>
        <Panel flush>
          <Table rows={rows} rowKey={(r) => r.id} onRow={(r) => setSel(r.id)} rowCls={(r) => (r.id === sel ? 'sel' : '')} maxRows={150} cols={[
            { key: 'n', label: 'Jogador', render: (r) => <span><strong>{r.name}</strong>{r.origin === 'creator' && <span className="chip star" style={{ marginLeft: 4 }}>CC</span>}</span>, sort: (r) => r.name },
            { key: 'p', label: 'Pos', render: (r) => <PosB pos={r.pos} />, sort: (r) => r.pos },
            { key: 'i', label: 'Idade', render: (r) => season - r.birthYear, sort: (r) => r.birthYear, cls: 'n' },
            { key: 'c', label: 'Clube', render: (r) => <span className="small">{r.clubId ? w.clubs[r.clubId]?.name : 'Sem clube'}{r.squad === 'youth' ? ' (base)' : ''}</span> },
            { key: 'l', label: 'Nível', render: (r) => <Lvl v={ovrToLevel(r.ovr)} size="sm" />, sort: (r) => r.ovr, cls: 'n' },
            { key: 'pt', label: 'Pot', render: (r) => Math.round(ovrToLevel(r.pot)), sort: (r) => r.pot, cls: 'n' },
            { key: 'v', label: 'Valor', render: (r) => <Money v={r.value} />, sort: (r) => r.value, cls: 'n' },
          ]} empty="Nenhum jogador encontrado." />
        </Panel>
      </div>
      <div className="stack">
        {p ? <PlayerEditor key={p.id + store.version} w={w} p={p} mut={mut} onClose={() => setSel(null)} /> : (
          <Panel title="Novo jogador">
            <div className="grid g2">
              <Field label="Nome (opcional)"><input type="text" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} /></Field>
              <Field label="Posição"><select value={nw.pos} onChange={(e) => setNw({ ...nw, pos: e.target.value as Pos })}>{POSITIONS.map((x) => <option key={x} value={x}>{POS_NAME[x]}</option>)}</select></Field>
              <Field label="Nacionalidade"><select value={nw.nat} onChange={(e) => setNw({ ...nw, nat: e.target.value })}>{nations().map((n) => <option key={n.code} value={n.code}>{n.name}</option>)}</select></Field>
              <Field label="Idade"><NumInput value={nw.age} min={15} max={40} onChange={(v) => setNw({ ...nw, age: v })} /></Field>
              <Field label="Nível"><NumInput value={nw.level} min={0} max={25} onChange={(v) => setNw({ ...nw, level: v })} /></Field>
              <Field label="Potencial"><NumInput value={nw.potential} min={0} max={25} onChange={(v) => setNw({ ...nw, potential: v })} /></Field>
            </div>
            <div className="row" style={{ marginTop: 8 }}><ClubSelect w={w} value={nw.clubId} onChange={(v) => setNw({ ...nw, clubId: v })} allowNone="Sem clube" /></div>
            <button className="btn primary" style={{ marginTop: 10 }} onClick={() => mut((x) => { const np = editorCreatePlayer(x, { ...nw, name: nw.name.trim() || undefined, clubId: nw.clubId || null }); setSel(np.id); }, 'Jogador criado.')}><Icon name="plus" />Criar jogador</button>
            <p className="tiny muted">Selecione um jogador na lista para editar. Para uma criação detalhada, use a aba Criador de Craques.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── clubes ─────────────────────────

const SHAPES: CrestDesign['shape'][] = ['shield', 'round', 'diamond', 'classic', 'square'];
const PATTERNS: CrestDesign['pattern'][] = ['plain', 'stripes', 'halves', 'sash', 'chevron', 'quarters', 'band'];
const SYMBOLS: CrestDesign['symbol'][] = ['none', 'star', 'ball', 'crown', 'bird', 'lion', 'tower', 'wave', 'bolt', 'cross'];
const SHAPE_PT: Record<string, string> = { shield: 'Escudo', round: 'Redondo', diamond: 'Losango', classic: 'Clássico', square: 'Quadrado' };
const PATTERN_PT: Record<string, string> = { plain: 'Liso', stripes: 'Listras', halves: 'Metades', sash: 'Faixa diagonal', chevron: 'Divisa', quarters: 'Quartos', band: 'Faixa' };
const SYMBOL_PT: Record<string, string> = { none: 'Nenhum', star: 'Estrela', ball: 'Bola', crown: 'Coroa', bird: 'Ave', lion: 'Leão', tower: 'Torre', wave: 'Onda', bolt: 'Raio', cross: 'Cruz' };

function ClubEditor({ w, club, mut }: { w: W; club: Club; mut: Mut }) {
  const init = useMemo(() => ({
    name: club.name, short: club.short, city: club.city, state: club.state ?? '', level: club.level, reputation: club.reputation, fans: club.fans, divisionId: club.divisionId,
    colors: club.colors.slice() as [string, string, string], crest: { ...club.crest }, coach: club.coach.name, stadiumName: club.stadium.name, capacity: totalCapacity(club.stadium),
    balance: club.balance, revenueBase: club.revenueBase, transferBudget: club.transferBudget, wageBudget: club.wageBudget,
  }), [club]);
  const [d, setD] = useState(init);
  const [del, setDel] = useState(false);
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));
  const setCrest = (patch: Partial<CrestDesign>) => setD((x) => ({ ...x, crest: { ...x.crest, ...patch } }));
  const save = () => mut((x) => {
    const err = updateClub(x, club.id, {
      name: d.name, short: d.short, city: d.city, state: d.state || undefined, level: d.level, reputation: d.reputation, fans: d.fans, colors: d.colors, crest: d.crest,
      coach: { ...club.coach, name: d.coach }, stadiumName: d.stadiumName, capacity: d.capacity !== init.capacity ? d.capacity : undefined, divisionId: d.divisionId,
    });
    if (err) return err;
    setFinances(x, club.id, { balance: d.balance, revenueBase: d.revenueBase, transferBudget: d.transferBudget, wageBudget: d.wageBudget });
    return null;
  }, `${d.name} atualizado.${isCareer(w) && d.divisionId !== init.divisionId ? ' A mudança de divisão vale a partir da próxima temporada.' : ''}`);
  return (
    <Panel title={<div className="row tight"><Crest crest={d.crest} size={40} /><h3>{club.name}</h3></div>}>
      <div className="grid g3">
        <Field label="Nome"><input type="text" value={d.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Sigla (2–4)"><input type="text" value={d.short} maxLength={4} onChange={(e) => set({ short: e.target.value.toUpperCase() })} /></Field>
        <Field label="Cidade"><input type="text" value={d.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="Estado"><input type="text" value={d.state} maxLength={3} onChange={(e) => set({ state: e.target.value.toUpperCase() })} /></Field>
        <Field label="Nível do clube (0–25)"><NumInput value={d.level} min={0} max={25} step={0.5} onChange={(v) => set({ level: v })} /></Field>
        <Field label="Reputação (0–100)"><NumInput value={d.reputation} min={0} max={100} onChange={(v) => set({ reputation: v })} /></Field>
        <Field label="Torcedores"><NumInput value={d.fans} min={0} step={1000} width={120} onChange={(v) => set({ fans: v })} /></Field>
        <Field label="Divisão"><select value={d.divisionId} onChange={(e) => set({ divisionId: e.target.value })}>{leagues(w).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
        <Field label="Treinador"><input type="text" value={d.coach} onChange={(e) => set({ coach: e.target.value })} /></Field>
        <Field label="Estádio"><input type="text" value={d.stadiumName} onChange={(e) => set({ stadiumName: e.target.value })} /></Field>
        <Field label="Capacidade"><NumInput value={d.capacity} min={1000} max={120000} step={500} width={110} onChange={(v) => set({ capacity: v })} /></Field>
      </div>
      <h4 style={{ marginTop: 12 }}>Finanças</h4>
      <div className="grid g4">
        <Field label="Saldo"><NumInput value={d.balance} step={100000} width={130} onChange={(v) => set({ balance: v })} /></Field>
        <Field label="Receita base anual"><NumInput value={d.revenueBase} min={0} step={100000} width={130} onChange={(v) => set({ revenueBase: v })} /></Field>
        <Field label="Verba de transferências"><NumInput value={d.transferBudget} min={0} step={100000} width={130} onChange={(v) => set({ transferBudget: v })} /></Field>
        <Field label="Orçamento salarial"><NumInput value={d.wageBudget} min={0} step={100000} width={130} onChange={(v) => set({ wageBudget: v })} /></Field>
      </div>
      <h4 style={{ marginTop: 12 }}>Cores e escudo</h4>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grid g3" style={{ flex: 1 }}>
          {(['Cor principal', 'Cor secundária', 'Cor de detalhe'] as const).map((l, i) => (
            <Field key={l} label={l}><input type="color" value={d.colors[i]} onChange={(e) => { const cs = d.colors.slice() as [string, string, string]; cs[i] = e.target.value; set({ colors: cs }); setCrest({ [`c${i + 1}`]: e.target.value } as Partial<CrestDesign>); }} /></Field>
          ))}
          <Field label="Formato"><select value={d.crest.shape} onChange={(e) => setCrest({ shape: e.target.value as CrestDesign['shape'] })}>{SHAPES.map((x) => <option key={x} value={x}>{SHAPE_PT[x]}</option>)}</select></Field>
          <Field label="Padrão"><select value={d.crest.pattern} onChange={(e) => setCrest({ pattern: e.target.value as CrestDesign['pattern'] })}>{PATTERNS.map((x) => <option key={x} value={x}>{PATTERN_PT[x]}</option>)}</select></Field>
          <Field label="Símbolo"><select value={d.crest.symbol} onChange={(e) => setCrest({ symbol: e.target.value as CrestDesign['symbol'] })}>{SYMBOLS.map((x) => <option key={x} value={x}>{SYMBOL_PT[x]}</option>)}</select></Field>
          <Field label="Iniciais"><input type="text" value={d.crest.initials} maxLength={4} onChange={(e) => setCrest({ initials: e.target.value.toUpperCase() })} /></Field>
          <Field label="Estrelas"><NumInput value={d.crest.stars} min={0} max={5} onChange={(v) => setCrest({ stars: Math.max(0, Math.min(5, v)) })} /></Field>
        </div>
        <Crest crest={d.crest} size={110} />
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={save}>Salvar clube</button>
        <button className="btn" onClick={() => setD(init)}>Desfazer</button>
        <button className="btn" onClick={() => mut((x) => { generateYouth(x, club.id, 5); }, '5 jovens gerados para a base.')}>Gerar 5 jovens</button>
        <button className="btn danger" onClick={() => setDel(true)}><Icon name="trash" />Excluir clube</button>
      </div>
      {del && <Confirm title={`Excluir ${club.name}?`} danger confirmLabel="Excluir" text="Os jogadores do clube ficarão sem clube. Ajuste a quantidade de clubes da divisão depois." onNo={() => setDel(false)} onYes={() => { setDel(false); mut((x) => deleteClub(x, club.id), 'Clube excluído.'); }} />}
    </Panel>
  );
}

function ClubsTab({ w, mut }: { w: W; mut: Mut }) {
  useGame();
  const ls = leagues(w);
  const [div, setDiv] = useState(ls[0]?.id ?? '');
  const [sel, setSel] = useState<string | null>(null);
  const [nc, setNc] = useState({ name: '', short: '', city: '', level: 8, capacity: 15000, fans: 50000, colors: ['#1d6b3a', '#ffffff', '#111111'] as [string, string, string] });
  const clubs = Object.values(w.clubs).filter((c) => c.divisionId === div).sort((a, b) => b.level - a.level);
  const club = sel ? w.clubs[sel] : null;
  const tpl = w.config.competitions[div];
  return (
    <div className="grid g-main">
      <div className="stack">
        <Panel title="Clubes" right={<select value={div} onChange={(e) => { setDiv(e.target.value); setSel(null); }} aria-label="Divisão">{ls.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>} flush>
          <Table rows={clubs} rowKey={(c) => c.id} onRow={(c) => setSel(c.id)} rowCls={(c) => (c.id === sel ? 'sel' : '')} cols={[
            { key: 'n', label: 'Clube', render: (c) => <span className="row tight"><Crest crest={c.crest} size={20} />{c.name}</span>, sort: (c) => c.name },
            { key: 'l', label: 'Nível', render: (c) => <Lvl v={c.level} size="sm" />, sort: (c) => c.level, cls: 'n' },
            { key: 'j', label: 'Elenco', render: (c) => c.playerIds.length, sort: (c) => c.playerIds.length, cls: 'n' },
            { key: 'cap', label: 'Estádio', render: (c) => totalCapacity(c.stadium).toLocaleString('pt-BR'), cls: 'n' },
            { key: 'b', label: 'Saldo', render: (c) => <Money v={c.balance} />, sort: (c) => c.balance, cls: 'n' },
          ]} />
          {tpl && <div className="tiny muted" style={{ padding: 8 }}>{clubs.length} clubes · formato prevê {tpl.numClubs}.{clubs.length !== tpl.numClubs ? ' Ajuste a divisão de algum clube para equilibrar.' : ''}</div>}
        </Panel>
      </div>
      <div className="stack">
        {club ? <ClubEditor key={club.id + store.version} w={w} club={club} mut={mut} /> : <Empty>Selecione um clube para editar.</Empty>}
        <Panel title="Novo clube nesta divisão">
          <div className="grid g3">
            <Field label="Nome"><input type="text" aria-label="Nome do novo clube" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></Field>
            <Field label="Sigla"><input type="text" value={nc.short} maxLength={4} onChange={(e) => setNc({ ...nc, short: e.target.value.toUpperCase() })} /></Field>
            <Field label="Cidade"><input type="text" value={nc.city} onChange={(e) => setNc({ ...nc, city: e.target.value })} /></Field>
            <Field label="Nível"><NumInput value={nc.level} min={0} max={25} onChange={(v) => setNc({ ...nc, level: v })} /></Field>
            <Field label="Capacidade"><NumInput value={nc.capacity} min={1000} max={120000} step={500} onChange={(v) => setNc({ ...nc, capacity: v })} /></Field>
            <Field label="Cor"><input type="color" value={nc.colors[0]} onChange={(e) => setNc({ ...nc, colors: [e.target.value, nc.colors[1], nc.colors[2]] })} /></Field>
          </div>
          <button className="btn primary" style={{ marginTop: 8 }} disabled={!nc.name.trim() || nc.short.length < 2} onClick={() => mut((x) => {
            const r = createClub(x, { ...nc, country: tpl?.country ?? 'BRA', divisionId: div, city: nc.city || nc.name });
            if (typeof r === 'string') return r;
            setSel(r.id);
            return null;
          }, 'Clube criado com elenco e finanças gerados.')}><Icon name="plus" />Criar clube</button>
        </Panel>
      </div>
    </div>
  );
}

// ───────────────────────── competições ─────────────────────────

const KIND_PT: Record<string, string> = { league: 'Ligas', cup: 'Copas nacionais', state: 'Estaduais', super: 'Supercopas', continental: 'Continentais' };
const ALL_TB: Tiebreak[] = ['points', 'wins', 'gd', 'gf', 'h2h', 'awayGoals', 'fewestRed', 'lots'];

function CompEditor({ w, t, mut }: { w: W; t: CompTemplate; mut: Mut }) {
  const [d, setD] = useState<CompTemplate>(() => structuredClone(t));
  const set = (patch: Partial<CompTemplate>) => setD((x) => ({ ...x, ...patch }));
  const v = validateCompetition(w, d);
  const moveTb = (i: number, dir: -1 | 1) => {
    const tb = d.tiebreakers.slice();
    const j = i + dir;
    if (j < 0 || j >= tb.length) return;
    [tb[i], tb[j]] = [tb[j], tb[i]];
    set({ tiebreakers: tb });
  };
  const save = () => mut((x) => {
    const r = updateCompetition(x, t.id, d);
    if (r.errors.length) return r.errors.join(' ');
    if (r.deferred) store.toast('Mudanças de formato valem a partir da próxima temporada; a edição em andamento não é alterada.', 'warn');
    return null;
  }, 'Regulamento salvo.');
  return (
    <Panel title={t.name}>
      <div className="grid g3">
        <Field label="Nome"><input type="text" value={d.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Abreviação"><input type="text" value={d.short} maxLength={8} onChange={(e) => set({ short: e.target.value })} /></Field>
        <Field label="Ativa"><label className="inline"><input type="checkbox" checked={d.enabled} onChange={(e) => set({ enabled: e.target.checked })} />{d.enabled ? 'Sim' : 'Não'}</label></Field>
        {(d.kind === 'league' || d.kind === 'state') && <Field label="Clubes"><NumInput value={d.numClubs} min={2} max={40} onChange={(n) => set({ numClubs: n })} /></Field>}
        {(d.kind === 'league' || d.groups) && <Field label="Turnos"><select value={d.turns} onChange={(e) => set({ turns: Number(e.target.value) as 1 | 2 })}><option value={1}>Turno único</option><option value={2}>Ida e volta</option></select></Field>}
        <Field label="Pontos V/E/D"><span className="row tight"><NumInput value={d.points.win} min={1} max={5} width={50} onChange={(n) => set({ points: { ...d.points, win: n } })} /><NumInput value={d.points.draw} min={0} max={3} width={50} onChange={(n) => set({ points: { ...d.points, draw: n } })} /><NumInput value={d.points.loss} min={0} max={1} width={50} onChange={(n) => set({ points: { ...d.points, loss: n } })} /></span></Field>
        {d.kind === 'league' && <Field label="Promovidos"><NumInput value={d.promote ?? 0} min={0} max={8} onChange={(n) => set({ promote: n })} /></Field>}
        {d.kind === 'league' && <Field label="Rebaixados"><NumInput value={d.relegate ?? 0} min={0} max={8} onChange={(n) => set({ relegate: n })} /></Field>}
        <Field label="Importância (1–5)"><NumInput value={d.importance} min={1} max={5} onChange={(n) => set({ importance: n })} /></Field>
        <Field label="Coeficiente (0,5–2)"><NumInput value={d.coefficient} min={0.5} max={2} step={0.1} onChange={(n) => set({ coefficient: n })} /></Field>
        <Field label="Início (MM-DD)"><input type="text" value={d.dates.start} pattern="\d\d-\d\d" maxLength={5} onChange={(e) => set({ dates: { ...d.dates, start: e.target.value } })} /></Field>
        <Field label="Término (MM-DD)"><input type="text" value={d.dates.end} pattern="\d\d-\d\d" maxLength={5} onChange={(e) => set({ dates: { ...d.dates, end: e.target.value } })} /></Field>
      </div>
      {d.kind !== 'league' && (
        <>
          <h4 style={{ marginTop: 12 }}>Mata-mata</h4>
          <div className="grid g3">
            <Field label="Jogos por fase"><select value={d.ko.legs} onChange={(e) => set({ ko: { ...d.ko, legs: Number(e.target.value) as 1 | 2 } })}><option value={1}>Jogo único</option><option value={2}>Ida e volta</option></select></Field>
            <Field label="Final"><select value={d.ko.finalLegs} onChange={(e) => set({ ko: { ...d.ko, finalLegs: Number(e.target.value) as 1 | 2 } })}><option value={1}>Jogo único</option><option value={2}>Ida e volta</option></select></Field>
            <label className="inline small"><input type="checkbox" checked={d.ko.awayGoals} onChange={(e) => set({ ko: { ...d.ko, awayGoals: e.target.checked } })} />Gol fora desempata</label>
            <label className="inline small"><input type="checkbox" checked={d.ko.extraTime} onChange={(e) => set({ ko: { ...d.ko, extraTime: e.target.checked } })} />Prorrogação</label>
            <label className="inline small"><input type="checkbox" checked={d.ko.penalties} onChange={(e) => set({ ko: { ...d.ko, penalties: e.target.checked } })} />Pênaltis</label>
            <label className="inline small"><input type="checkbox" checked={d.ko.neutralFinal} onChange={(e) => set({ ko: { ...d.ko, neutralFinal: e.target.checked } })} />Final em campo neutro</label>
          </div>
        </>
      )}
      {d.groups && (
        <>
          <h4 style={{ marginTop: 12 }}>Fase de grupos</h4>
          <div className="grid g3">
            <Field label="Grupos"><NumInput value={d.groups.count} min={1} max={16} onChange={(n) => set({ groups: { ...d.groups!, count: n } })} /></Field>
            <Field label="Clubes por grupo"><NumInput value={d.groups.size} min={3} max={6} onChange={(n) => set({ groups: { ...d.groups!, size: n } })} /></Field>
            <Field label="Classificados por grupo"><NumInput value={d.groups.advance} min={1} max={4} onChange={(n) => set({ groups: { ...d.groups!, advance: n } })} /></Field>
          </div>
        </>
      )}
      <h4 style={{ marginTop: 12 }}>Critérios de desempate (em ordem)</h4>
      <div className="stack" style={{ gap: 4 }}>
        {d.tiebreakers.map((tb, i) => (
          <div key={tb} className="row tight small">
            <span style={{ width: 22 }}>{i + 1}.</span><span style={{ minWidth: 180 }}>{TIEBREAK_NAMES[tb]}</span>
            <button className="btn sm" onClick={() => moveTb(i, -1)} disabled={i === 0} aria-label="Subir">▲</button>
            <button className="btn sm" onClick={() => moveTb(i, 1)} disabled={i === d.tiebreakers.length - 1} aria-label="Descer">▼</button>
            <button className="btn sm ghost" onClick={() => set({ tiebreakers: d.tiebreakers.filter((x) => x !== tb) })} aria-label="Remover critério">✕</button>
          </div>
        ))}
        <select value="" onChange={(e) => e.target.value && set({ tiebreakers: [...d.tiebreakers, e.target.value as Tiebreak] })} aria-label="Adicionar critério"><option value="">+ adicionar critério</option>{ALL_TB.filter((x) => !d.tiebreakers.includes(x)).map((x) => <option key={x} value={x}>{TIEBREAK_NAMES[x]}</option>)}</select>
      </div>
      <h4 style={{ marginTop: 12 }}>Premiação</h4>
      <div className="grid g3">
        <Field label="Participação"><NumInput value={d.prize.participation} min={0} step={10000} width={130} onChange={(n) => set({ prize: { ...d.prize, participation: n } })} /></Field>
        <Field label="Por vitória"><NumInput value={d.prize.win} min={0} step={10000} width={130} onChange={(n) => set({ prize: { ...d.prize, win: n } })} /></Field>
        <Field label="Campeão"><NumInput value={d.prize.champion} min={0} step={100000} width={130} onChange={(n) => set({ prize: { ...d.prize, champion: n } })} /></Field>
      </div>
      {(v.errors.length > 0 || v.warnings.length > 0) && (
        <div className="stack" style={{ gap: 3, marginTop: 10 }}>
          {v.errors.map((e, i) => <div key={i} className="small neg">✕ {e}</div>)}
          {v.warnings.map((e, i) => <div key={i} className="small warn">⚠ {e}</div>)}
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={v.errors.length > 0} onClick={save}>Salvar regulamento</button>
        <button className="btn" onClick={() => setD(structuredClone(t))}>Desfazer</button>
      </div>
    </Panel>
  );
}

function CompsTab({ w, mut }: { w: W; mut: Mut }) {
  useGame();
  const all = Object.values(w.config.competitions);
  const [sel, setSel] = useState(all[0]?.id ?? '');
  const t = w.config.competitions[sel];
  return (
    <div className="grid g-main">
      <Panel title="Competições" flush>
        <div style={{ maxHeight: 640, overflow: 'auto' }}>
          {(['league', 'cup', 'state', 'super', 'continental'] as const).map((k) => (
            <div key={k}>
              <div className="nav-group" style={{ padding: '8px 12px 2px' }}>{KIND_PT[k]}</div>
              {all.filter((x) => x.kind === k).map((x) => (
                <div key={x.id} className={`small link ${x.id === sel ? 'strong' : ''}`} style={{ padding: '3px 12px', cursor: 'pointer', opacity: x.enabled ? 1 : 0.55 }} {...clickable(() => setSel(x.id))}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: x.color, marginRight: 6 }} />{x.name}{!x.enabled && ' (inativa)'}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>
      {t ? <CompEditor key={t.id + store.version} w={w} t={t} mut={mut} /> : <Empty>Selecione uma competição.</Empty>}
    </div>
  );
}

// ───────────────────────── prêmios e regras ─────────────────────────

const WEIGHT_PT: Record<string, string> = { performance: 'Desempenho (nota média)', goals: 'Gols / jogos sem sofrer gols', assists: 'Assistências', titles: 'Títulos', regularity: 'Regularidade', bigGames: 'Jogos grandes', competitionLevel: 'Nível das competições', teamImportance: 'Importância no time', continental: 'Competições continentais' };

function RulesTab({ w, mut }: { w: W; mut: Mut }) {
  useGame();
  const [a, setA] = useState(() => structuredClone(w.config.awards));
  const [pg, setPg] = useState(() => structuredClone(w.config.progression));
  const [home, setHome] = useState(w.config.homeAdvantage);
  const career = isCareer(w);
  return (
    <div className="grid g2">
      <Panel title="Premiações">
        <div className="grid g2">
          <label className="inline"><input type="checkbox" checked={a.enabled} onChange={(e) => setA({ ...a, enabled: e.target.checked })} />Premiações ativas</label>
          <Field label="Nome do prêmio principal"><input type="text" value={a.ballonName} onChange={(e) => setA({ ...a, ballonName: e.target.value })} /></Field>
          <Field label="Dia da cerimônia (25–31 out.)"><NumInput value={a.ballonDay} min={25} max={31} onChange={(v) => setA({ ...a, ballonDay: Math.max(25, Math.min(31, v)) })} /></Field>
          <Field label="Gala da temporada (MM-DD)"><input type="text" value={a.galaDate} maxLength={5} onChange={(e) => setA({ ...a, galaDate: e.target.value })} /></Field>
          <Field label="Indicados"><NumInput value={a.nominees} min={5} max={50} onChange={(v) => setA({ ...a, nominees: v })} /></Field>
          <Field label="Finalistas"><NumInput value={a.finalists} min={2} max={10} onChange={(v) => setA({ ...a, finalists: v })} /></Field>
          <Field label="Jogos mínimos"><NumInput value={a.minApps} min={1} max={60} onChange={(v) => setA({ ...a, minApps: v })} /></Field>
          <Field label="Votantes simulados"><NumInput value={a.voters} min={10} max={500} onChange={(v) => setA({ ...a, voters: v })} /></Field>
          <Field label="Idade máx. melhor jovem"><NumInput value={a.youngAge} min={18} max={25} onChange={(v) => setA({ ...a, youngAge: v })} /></Field>
          <Field label="Idade máx. revelação"><NumInput value={a.revelationAge} min={17} max={25} onChange={(v) => setA({ ...a, revelationAge: v })} /></Field>
          <Field label="Empate na artilharia"><select value={a.scorerTieRule} onChange={(e) => setA({ ...a, scorerTieRule: e.target.value as typeof a.scorerTieRule })}><option value="all">Todos recebem a estrela</option><option value="fewerApps">Menos jogos desempata</option><option value="moreAssists">Mais assistências desempata</option></select></Field>
        </div>
        <h4 style={{ marginTop: 12 }}>Pesos dos critérios</h4>
        {(Object.keys(a.weights) as (keyof typeof a.weights)[]).map((k) => (
          <div key={k} className="attr"><span>{WEIGHT_PT[k] ?? k}</span><span className="v">{a.weights[k].toFixed(1)}</span><input type="range" min={0} max={3} step={0.1} value={a.weights[k]} aria-label={WEIGHT_PT[k]} onChange={(e) => setA({ ...a, weights: { ...a.weights, [k]: Number(e.target.value) } })} /></div>
        ))}
        <h4 style={{ marginTop: 12 }}>Nomes dos prêmios</h4>
        <div className="grid g2">
          {Object.entries(a.names).map(([k, n]) => <Field key={k} label={k}><input type="text" value={n} onChange={(e) => setA({ ...a, names: { ...a.names, [k]: e.target.value } })} /></Field>)}
        </div>
        <button className="btn primary" style={{ marginTop: 10 }} onClick={() => mut((x) => { x.config.awards = structuredClone(a); }, 'Configuração de prêmios salva.')}>Salvar prêmios</button>
        {career && <p className="tiny muted">Edições já realizadas não são recalculadas; as novas regras valem para as próximas cerimônias.</p>}
      </Panel>
      <div className="stack">
        <Panel title="Evolução e regras gerais">
          <div className="grid g2">
            <Field label="Ritmo de evolução (×)"><NumInput value={pg.growthRate} min={0.2} max={3} step={0.1} onChange={(v) => setPg({ ...pg, growthRate: v })} /></Field>
            <Field label="Idade de início do declínio"><NumInput value={pg.declineAge} min={26} max={36} onChange={(v) => setPg({ ...pg, declineAge: v })} /></Field>
            <Field label="Ritmo de declínio (×)"><NumInput value={pg.declineRate} min={0} max={3} step={0.1} onChange={(v) => setPg({ ...pg, declineRate: v })} /></Field>
            <Field label="Ajuste da idade de aposentadoria"><NumInput value={pg.retirementAgeShift} min={-4} max={6} onChange={(v) => setPg({ ...pg, retirementAgeShift: v })} /></Field>
            <Field label="Revelações da base"><select value={pg.youthIntake} onChange={(e) => setPg({ ...pg, youthIntake: e.target.value as typeof pg.youthIntake })}><option value="annual">Anual</option><option value="semiannual">Semestral</option><option value="off">Desativadas</option></select></Field>
            <Field label="Vantagem de jogar em casa (×)"><NumInput value={home} min={1} max={1.3} step={0.01} onChange={setHome} /></Field>
          </div>
          <button className="btn primary" style={{ marginTop: 10 }} onClick={() => mut((x) => { x.config.progression = structuredClone(pg); x.config.homeAdvantage = home; }, 'Regras salvas.')}>Salvar regras</button>
        </Panel>
        <Panel title="Países">
          {w.config.countries.map((c) => (
            <label key={c.code} className="inline small" style={{ marginRight: 12 }}>
              <input type="checkbox" checked={c.enabled} disabled={career} onChange={(e) => mut((x) => { const cc = x.config.countries.find((y) => y.code === c.code)!; cc.enabled = e.target.checked; for (const id of cc.leagues) if (x.config.competitions[id]) x.config.competitions[id].enabled = e.target.checked; }, 'Países atualizados.')} />
              {c.name}
            </label>
          ))}
          {career && <p className="tiny muted">Ativar ou desativar países altera a estrutura do universo e só é possível em universos personalizados (fora de uma carreira).</p>}
        </Panel>
      </div>
    </div>
  );
}

// ───────────────────────── ferramentas ─────────────────────────

function ToolsTab({ w, mut }: { w: W; mut: Mut }) {
  useGame();
  const [b, setB] = useState({ count: 10, pos: '' as Pos | '', nat: 'BRA', minAge: 18, maxAge: 28, minLevel: 6, maxLevel: 14, clubId: '', youth: false });
  const [yc, setYc] = useState({ clubId: Object.keys(w.clubs)[0] ?? '', count: 6 });
  const [factor, setFactor] = useState(1);
  const [vdiv, setVdiv] = useState('');
  const [rdiv, setRdiv] = useState('');
  const st = universeStats(w);
  return (
    <div className="grid g2">
      <Panel title="Criação em lote">
        <div className="grid g3">
          <Field label="Quantidade"><NumInput value={b.count} min={1} max={200} onChange={(v) => setB({ ...b, count: v })} /></Field>
          <Field label="Posição"><select value={b.pos} onChange={(e) => setB({ ...b, pos: e.target.value as Pos | '' })}><option value="">Variadas</option>{POSITIONS.map((x) => <option key={x} value={x}>{POS_NAME[x]}</option>)}</select></Field>
          <Field label="Nacionalidade"><select value={b.nat} onChange={(e) => setB({ ...b, nat: e.target.value })}>{nations().map((n) => <option key={n.code} value={n.code}>{n.name}</option>)}</select></Field>
          <Field label="Idade mín."><NumInput value={b.minAge} min={15} max={40} onChange={(v) => setB({ ...b, minAge: v })} /></Field>
          <Field label="Idade máx."><NumInput value={b.maxAge} min={15} max={40} onChange={(v) => setB({ ...b, maxAge: Math.max(b.minAge, v) })} /></Field>
          <Field label="Nível mín."><NumInput value={b.minLevel} min={0} max={25} onChange={(v) => setB({ ...b, minLevel: v })} /></Field>
          <Field label="Nível máx."><NumInput value={b.maxLevel} min={0} max={25} onChange={(v) => setB({ ...b, maxLevel: Math.max(b.minLevel, v) })} /></Field>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <ClubSelect w={w} value={b.clubId} onChange={(v) => setB({ ...b, clubId: v })} allowNone="Agentes livres" />
          {b.clubId && <label className="inline small"><input type="checkbox" checked={b.youth} onChange={(e) => setB({ ...b, youth: e.target.checked })} />Na base</label>}
        </div>
        <button className="btn primary" style={{ marginTop: 8 }} onClick={() => mut((x) => { batchCreate(x, { ...b, clubId: b.clubId || null }); }, `${b.count} jogadores criados.`)}>Criar em lote</button>
      </Panel>
      <Panel title="Gerador de jovens">
        <div className="row">
          <ClubSelect w={w} value={yc.clubId} onChange={(v) => setYc({ ...yc, clubId: v })} />
          <NumInput value={yc.count} min={1} max={30} onChange={(v) => setYc({ ...yc, count: v })} />
          <button className="btn primary" onClick={() => mut((x) => { generateYouth(x, yc.clubId, yc.count); }, `${yc.count} jovens gerados.`)}>Gerar</button>
        </div>
        <p className="tiny muted">Jovens de 15 a 17 anos, com nível compatível com o clube e potencial incerto.</p>
      </Panel>
      <Panel title="Editor de valores">
        <div className="row">
          <select value={vdiv} onChange={(e) => setVdiv(e.target.value)} aria-label="Escopo"><option value="">Todo o universo</option>{leagues(w).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <label className="inline small">Fator <NumInput value={factor} min={0.1} max={5} step={0.1} onChange={setFactor} /></label>
          <button className="btn primary" onClick={() => mut((x) => { const n = recalcValues(x, factor, vdiv ? (p) => !!p.clubId && x.clubs[p.clubId]?.divisionId === vdiv : undefined); store.toast(`${n} valores recalculados.`); })}>Recalcular valores</button>
        </div>
        <p className="tiny muted">Recalcula o valor de mercado pela fórmula do jogo (nível, idade, potencial, contrato) e aplica o fator.</p>
      </Panel>
      <Panel title="Redistribuição de jogadores">
        <div className="row">
          <select value={rdiv} onChange={(e) => setRdiv(e.target.value)} aria-label="Divisão para redistribuir"><option value="">Todas as divisões</option>{leagues(w).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <button className="btn primary" onClick={() => mut((x) => { const n = redistributePlayers(x, rdiv || undefined); store.toast(n ? `${n} jogadores movidos ou criados.` : 'Todos os elencos já estão equilibrados.'); })}>Equilibrar elencos</button>
        </div>
        <p className="tiny muted">Deixa todos os elencos com 20 a 34 profissionais. O elenco do seu clube nunca é alterado.</p>
      </Panel>
      <Panel title="Estatísticas do universo">
        <div className="grid g3 small">
          <div><div className="muted">Clubes</div><strong>{st.clubs}</strong></div>
          <div><div className="muted">Jogadores</div><strong>{st.players.toLocaleString('pt-BR')}</strong></div>
          <div><div className="muted">Sem clube</div><strong>{st.free}</strong></div>
          <div><div className="muted">Países ativos</div><strong>{st.countries}</strong></div>
          <div><div className="muted">Competições</div><strong>{st.competitions}</strong></div>
          <div><div className="muted">Nível 23+</div><strong>{st.elite}</strong></div>
        </div>
      </Panel>
    </div>
  );
}

// ───────────────────────── universos ─────────────────────────

function UniversesTab({ w, standalone, dirty, onSaved }: { w: W | null; standalone: boolean; dirty: boolean; onSaved: () => void }) {
  const s = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(w && !isCareer(w) ? w.meta.name : '');
  const [restore, setRestore] = useState(false);
  const [delU, setDelU] = useState<string | null>(null);
  const open = (nw: World) => {
    s.editorWorld = nw;
    setName(nw.meta.name);
    s.bump();
  };
  const fromDefault = async () => {
    s.busy = 'Gerando universo…';
    s.bump();
    await tick();
    const nw = duplicateUniverse(s.defaultWorld(), 'Meu universo');
    nw.meta.description = 'Universo personalizado criado a partir do padrão.';
    s.busy = null;
    open(nw);
  };
  const save = async (target: World) => {
    try {
      await s.sm.saveUniverse(target);
      await s.refreshLists();
      s.toast(`Universo "${target.meta.name}" salvo.`);
      onSaved();
    } catch (e) {
      s.toast((e as Error).message, 'err');
    }
  };
  const importFile = async (f: File) => {
    try {
      const nw = parseUniverseText(await f.text());
      nw.meta = { ...nw.meta, custom: true };
      open(nw);
      s.toast(`Universo "${nw.meta.name}" importado. Salve para mantê-lo neste navegador.`);
    } catch (e) {
      s.toast((e as Error).message, 'err');
    }
  };
  const load = async (id: string) => {
    try {
      open(await s.sm.loadUniverse(id));
    } catch (e) {
      s.toast((e as Error).message, 'err');
    }
  };
  if (!standalone && w && isCareer(w)) {
    return (
      <Panel title="Universo desta carreira">
        <p className="small">O universo da carreira pode ser extraído (sem o progresso da carreira) para servir de base a novas carreiras ou ser compartilhado como arquivo.</p>
        <div className="row">
          <input type="text" placeholder="Nome do novo universo" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do universo" />
          <button className="btn primary" disabled={!name.trim()} onClick={() => void save(worldFromCareer(w, name.trim()))}><Icon name="save" />Salvar como universo</button>
          <button className="btn" disabled={!name.trim()} onClick={() => void downloadText(`universo-${slug(name)}.json`, exportUniverseText(worldFromCareer(w, name.trim()))).then((r) => s.toast(r.msg, r.ok ? 'ok' : 'warn'))}><Icon name="download" />Exportar arquivo</button>
        </div>
      </Panel>
    );
  }
  return (
    <div className="grid g2">
      <Panel title={w ? `Universo aberto: ${w.meta.name}` : 'Nenhum universo aberto'}>
        {w && !isCareer(w) ? (
          <>
            <div className="grid g2">
              <Field label="Nome"><input type="text" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do universo" /></Field>
              <Field label="Descrição"><input type="text" value={w.meta.description} onChange={(e) => { w.meta.description = e.target.value; s.bump(); }} /></Field>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" disabled={!name.trim()} onClick={() => { w.meta.name = name.trim(); void save(w); }}><Icon name="save" />Salvar universo{dirty ? ' *' : ''}</button>
              <button className="btn" onClick={() => { const cp = duplicateUniverse(w, `${w.meta.name} (cópia)`); void save(cp).then(() => open(cp)); }}><Icon name="copy" />Duplicar</button>
              <button className="btn" onClick={() => void downloadText(`universo-${slug(w.meta.name)}.json`, exportUniverseText(w)).then((r) => s.toast(r.msg, r.ok ? 'ok' : 'warn'))}><Icon name="download" />Exportar</button>
              <button className="btn danger" onClick={() => setRestore(true)}>Restaurar padrão</button>
              <button className="btn ghost" onClick={() => { s.editorWorld = null; s.bump(); }}>Fechar</button>
            </div>
            {dirty && <p className="small warn">Há alterações não salvas.</p>}
          </>
        ) : (
          <div className="stack">
            <button className="btn primary" onClick={() => void fromDefault()}><Icon name="plus" />Novo universo a partir do padrão</button>
            <p className="tiny muted">O universo padrão nunca é alterado: o editor sempre trabalha numa cópia.</p>
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" />Importar arquivo</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
        </div>
      </Panel>
      <Panel title="Universos salvos" flush>
        <Table rows={s.universes} rowKey={(u) => u.id} cols={[
          { key: 'n', label: 'Nome', render: (u) => <span><strong>{u.name}</strong><div className="tiny muted">{u.description}</div></span> },
          { key: 'c', label: 'Clubes', render: (u) => u.clubs, cls: 'n' },
          { key: 'p', label: 'Jogadores', render: (u) => u.players.toLocaleString('pt-BR'), cls: 'n' },
          { key: 'u', label: 'Atualizado', render: (u) => <span className="small">{new Date(u.updated).toLocaleString('pt-BR')}</span> },
          { key: 'a', label: '', render: (u) => <span className="row tight"><button className="btn sm" onClick={() => void load(u.id)}>Abrir</button><button className="btn sm danger" onClick={() => setDelU(u.id)} aria-label="Excluir universo"><Icon name="trash" /></button></span> },
        ]} empty="Nenhum universo personalizado salvo." />
      </Panel>
      {restore && w && !isCareer(w) && <Confirm title="Restaurar o universo padrão?" danger confirmLabel="Restaurar" text={`Todo o conteúdo de "${w.meta.name}" será substituído pelo universo padrão (o nome e o identificador são mantidos). Salve depois para gravar.`} onNo={() => setRestore(false)} onYes={() => { setRestore(false); const nw = duplicateUniverse(s.defaultWorld(), w.meta.name); nw.meta = { ...w.meta }; open(nw); onSaved(); s.toast('Universo restaurado ao padrão. Salve para confirmar.', 'warn'); }} />}
      {delU && <Confirm title="Excluir universo?" danger confirmLabel="Excluir" text="O universo salvo será apagado deste navegador. Carreiras criadas a partir dele não são afetadas." onNo={() => setDelU(null)} onYes={() => { const id = delU; setDelU(null); void s.sm.deleteUniverse(id).then(() => s.refreshLists()).then(() => s.toast('Universo excluído.')); }} />}
    </div>
  );
}

// ───────────────────────── tela principal ─────────────────────────

export function Editor({ standalone = false }: { standalone?: boolean }) {
  const s = useGame();
  const w: W | null = standalone ? s.editorWorld : s.career;
  const [tab, setTab] = useState<TabId>(standalone && !s.editorWorld ? 'universos' : 'jogadores');
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<null | (() => void)>(null);
  const career = !!w && isCareer(w);

  const mut: Mut = (fn, ok) => {
    if (!w) return;
    const run = () => {
      try {
        const r = fn(w);
        if (typeof r === 'string' && r) {
          s.toast(r, 'err');
          return;
        }
        if (ok) s.toast(ok);
        if (!career) setDirty(true);
      } catch (e) {
        s.toast((e as Error).message, 'err');
      }
      s.bump();
    };
    if (career && !careerAck) setPending(() => run);
    else run();
  };

  const tabs: { id: TabId; label: ReactNode }[] = [
    { id: 'jogadores', label: 'Jogadores' }, { id: 'clubes', label: 'Clubes' }, { id: 'competicoes', label: 'Competições' }, { id: 'regras', label: 'Prêmios e regras' },
    { id: 'ferramentas', label: 'Ferramentas' }, { id: 'universos', label: 'Universos' }, ...(standalone ? [{ id: 'criador' as TabId, label: 'Criador de Craques' }] : []),
  ];
  const current = !w && tab !== 'universos' ? 'universos' : tab;
  return (
    <div className="page">
      <PageHead title="Editor do Universo" sub={career ? `Editando a carreira "${(w as Career).saveName}". As alterações afetam o jogo em andamento.` : w ? `Universo personalizado: ${w.meta.name} · separado de todas as carreiras` : 'Crie ou abra um universo personalizado para editar.'}
        actions={!career && w ? <span className={`chip ${dirty ? 'warn' : 'good'}`}>{dirty ? 'Alterações não salvas' : 'Salvo'}</span> : career ? <button className="btn" onClick={() => s.go({ name: 'creator' })}><Icon name="wand" />Criador de Craques</button> : undefined} />
      {career && <div className="chip warn" style={{ marginBottom: 10 }}>Modo carreira: mudanças de formato valem a partir da próxima temporada. Você confirma antes da primeira alteração.</div>}
      <Tabs tabs={tabs} value={current} onChange={setTab} />
      <div style={{ height: 10 }} />
      {w && current === 'jogadores' && <PlayersTab w={w} mut={mut} />}
      {w && current === 'clubes' && <ClubsTab w={w} mut={mut} />}
      {w && current === 'competicoes' && <CompsTab w={w} mut={mut} />}
      {w && current === 'regras' && <RulesTab key={w.meta.id} w={w} mut={mut} />}
      {w && current === 'ferramentas' && <ToolsTab w={w} mut={mut} />}
      {current === 'universos' && <UniversesTab key={w?.meta.id ?? 'none'} w={w} standalone={standalone} dirty={dirty} onSaved={() => setDirty(false)} />}
      {w && current === 'criador' && !career && <Creator world={w as World} onDone={() => setDirty(true)} />}
      {pending && <Confirm title="Editar a carreira em andamento?" confirmLabel="Sim, editar" text="O Editor altera diretamente o universo desta carreira (jogadores, clubes e regras). Recomendamos salvar antes. Esta confirmação vale até você fechar o jogo." onNo={() => setPending(null)} onYes={() => { careerAck = true; const f = pending; setPending(null); f(); }} />}
    </div>
  );
}
