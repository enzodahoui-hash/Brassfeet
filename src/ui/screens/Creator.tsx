import { useMemo, useState } from 'react';
import type { Foot, Pos, SquadRole, World } from '../../engine/types';
import { store, useGame } from '../store';
import { PageHead, Panel, Field, NumInput, Money, Lvl, Confirm, Tabs } from '../components/common';
import { Avatar } from '../components/graphics';
import { PRESETS, attrsForSpec, defaultSpec, insertCreated, previewCreated, type CreatorSpec, type Placement } from '../../engine/players/creator';
import { ATTRS, ATTR_GROUPS, POSITIONS, POS_NAME } from '../../engine/players/attributes';
import { TRAITS } from '../../engine/players/traits';
import { stylesFor } from '../../engine/players/styles';
import { NATIONS } from '../../engine/data/nations';
import { isCareer } from '../../engine/editor/editor';

const ROLES: { id: SquadRole; label: string }[] = [
  { id: 'key', label: 'Jogador-chave' }, { id: 'first', label: 'Titular' }, { id: 'rotation', label: 'Rotação' }, { id: 'backup', label: 'Reserva' }, { id: 'prospect', label: 'Promessa' },
];

/** Criador de Craques: funciona na carreira ativa ou num universo do editor. */
export function Creator({ world: given, onDone }: { world?: World; onDone?: () => void }) {
  const s = useGame();
  const world: World = given ?? s.career!;
  const inCareer = isCareer(world);
  const userClubId = inCareer ? world.userClubId : undefined;
  const [spec, setSpec] = useState<CreatorSpec>(() => defaultSpec(world, userClubId));
  const [tab, setTab] = useState<'id' | 'attrs' | 'perfil' | 'destino'>('id');
  const [confirm, setConfirm] = useState(false);
  const [clubQuery, setClubQuery] = useState('');
  const set = (patch: Partial<CreatorSpec>) => setSpec((x) => ({ ...x, ...patch }));
  const pv = useMemo(() => previewCreated(world, spec), [world, spec]);
  const attrs = pv.player.attrs;
  const styles = stylesFor(spec.pos);
  const clubs = useMemo(() => Object.values(world.clubs).filter((c) => !clubQuery || c.name.toLowerCase().includes(clubQuery.toLowerCase())).sort((a, b) => b.level - a.level).slice(0, 60), [world, clubQuery]);
  const nameOk = spec.name.trim().length >= 2;

  const applyPreset = (id: string) => {
    const pr = PRESETS.find((p) => p.id === id)!;
    setSpec((x) => {
      const patch = pr.apply(x);
      const next = { ...x, ...patch, attrs: undefined };
      if (next.placement === 'userYouth' && next.age > 19) next.placement = 'userPro';
      if (!inCareer && (next.placement === 'userPro' || next.placement === 'userYouth')) next.placement = next.clubId ? 'otherClub' : 'free';
      return next;
    });
  };
  const setAttr = (i: number, v: number) => {
    const base = spec.attrs?.length ? spec.attrs.slice() : attrsForSpec(spec);
    base[i] = Math.max(1, Math.min(100, Math.round(v)));
    set({ attrs: base });
  };
  const toggleTrait = (id: string) => {
    const has = spec.traits.includes(id);
    if (!has && spec.traits.length >= 4) {
      store.toast('Máximo de 4 traços de personalidade.', 'warn');
      return;
    }
    const conflict = TRAITS.find((t) => t.id === id)?.conflicts?.find((c) => spec.traits.includes(c));
    if (!has && conflict) {
      store.toast(`Incompatível com "${TRAITS.find((t) => t.id === conflict)?.name}".`, 'warn');
      return;
    }
    set({ traits: has ? spec.traits.filter((t) => t !== id) : [...spec.traits, id] });
  };
  const doInsert = () => {
    setConfirm(false);
    if (inCareer) {
      const p = store.act((c) => insertCreated(c, spec), (r) => `${r.name} foi inserido no universo da carreira.`);
      if (p) store.go({ name: 'player', id: p.id });
    } else {
      const p = insertCreated(world, spec);
      store.toast(`${p.name} foi adicionado ao universo "${world.meta.name}".`);
      store.bump();
      onDone?.();
    }
  };

  return (
    <div className="page">
      {!given && <PageHead title="Criador de Craques" sub="Crie jogadores com identidade, atributos, personalidade e história. Tudo fica registrado como criação manual (edição livre)." />}
      <div className="grid g-main">
        <div className="stack">
          <Panel title="Ponto de partida">
            <div className="grid g3">
              {PRESETS.map((p) => (
                <button key={p.id} className="choice" onClick={() => applyPreset(p.id)}><span className="t">{p.name}</span><span className="small muted">{p.desc}</span></button>
              ))}
            </div>
          </Panel>
          <Tabs tabs={[{ id: 'id', label: 'Identidade' }, { id: 'attrs', label: 'Nível e atributos' }, { id: 'perfil', label: 'Personalidade e estilo' }, { id: 'destino', label: 'Destino e contrato' }]} value={tab} onChange={setTab} />
          {tab === 'id' && (
            <Panel>
              <div className="grid g3">
                <Field label="Nome"><input type="text" value={spec.firstName} maxLength={24} onChange={(e) => set({ firstName: e.target.value, name: `${e.target.value} ${spec.lastName}`.trim() })} /></Field>
                <Field label="Sobrenome"><input type="text" value={spec.lastName} maxLength={24} onChange={(e) => set({ lastName: e.target.value, name: `${spec.firstName} ${e.target.value}`.trim() })} /></Field>
                <Field label="Nome na camisa / exibição"><input type="text" aria-label="Nome de exibição" value={spec.name} maxLength={30} onChange={(e) => set({ name: e.target.value })} /></Field>
                <Field label="Idade"><NumInput value={spec.age} min={15} max={42} onChange={(v) => set({ age: Math.max(15, Math.min(42, v)), attrs: undefined })} /></Field>
                <Field label="Nacionalidade"><select value={spec.nat} onChange={(e) => set({ nat: e.target.value })}>{Object.values(NATIONS).sort((a, b) => a.name.localeCompare(b.name)).map((n) => <option key={n.code} value={n.code}>{n.name}</option>)}</select></Field>
                <Field label="Pé preferido"><select value={spec.foot} onChange={(e) => set({ foot: e.target.value as Foot })}><option value="D">Direito</option><option value="E">Esquerdo</option><option value="A">Ambidestro</option></select></Field>
                <Field label="Posição principal"><select value={spec.pos} onChange={(e) => { const pos = e.target.value as Pos; set({ pos, alt: spec.alt.filter((x) => x !== pos), style: stylesFor(pos)[0]?.id ?? null, attrs: undefined }); }}>{POSITIONS.map((p) => <option key={p} value={p}>{POS_NAME[p]}</option>)}</select></Field>
                <Field label="Altura (cm)"><NumInput value={spec.height} min={155} max={210} onChange={(v) => set({ height: v })} /></Field>
                <Field label="Peso (kg)"><NumInput value={spec.weight} min={50} max={110} onChange={(v) => set({ weight: v })} /></Field>
              </div>
              <div className="small muted" style={{ margin: '10px 0 4px' }}>Posições secundárias</div>
              <div className="row">
                {POSITIONS.filter((p) => p !== spec.pos).map((p) => (
                  <label key={p} className="inline small"><input type="checkbox" checked={spec.alt.includes(p)} onChange={(e) => set({ alt: e.target.checked ? [...spec.alt, p] : spec.alt.filter((x) => x !== p) })} />{p}</label>
                ))}
              </div>
              <div className="small muted" style={{ margin: '12px 0 4px' }}>Aparência</div>
              <div className="row">
                {([['skin', 'Pele', 6], ['hair', 'Cabelo', 8], ['hairColor', 'Cor do cabelo', 6], ['beard', 'Barba', 5], ['face', 'Rosto', 4]] as const).map(([k, l, n]) => (
                  <Field key={k} label={l}><select value={spec.appearance[k]} onChange={(e) => set({ appearance: { ...spec.appearance, [k]: Number(e.target.value) } })}>{Array.from({ length: n }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></Field>
                ))}
              </div>
              <div className="small muted" style={{ margin: '12px 0 4px' }}>História</div>
              <div className="grid g2">
                <Field label="Clube formador"><input type="text" value={spec.formativeClub ?? ''} maxLength={40} onChange={(e) => set({ formativeClub: e.target.value || undefined })} /></Field>
                <Field label="Rótulo de promessa"><input type="text" value={spec.promise ?? ''} maxLength={40} onChange={(e) => set({ promise: e.target.value || undefined })} /></Field>
                <Field label="Expectativas da torcida"><input type="text" value={spec.expectations ?? ''} maxLength={80} onChange={(e) => set({ expectations: e.target.value || undefined })} /></Field>
                <Field label="Experiência (0–100)"><NumInput value={spec.experience} min={0} max={100} onChange={(v) => set({ experience: v })} /></Field>
              </div>
              <Field label="Biografia"><textarea rows={3} value={spec.backstory ?? ''} maxLength={400} onChange={(e) => set({ backstory: e.target.value || undefined })} /></Field>
            </Panel>
          )}
          {tab === 'attrs' && (
            <Panel title="Nível (0–25) e atributos (1–100)" right={spec.attrs?.length ? <button className="btn sm" onClick={() => set({ attrs: undefined })}>Gerar a partir do nível</button> : undefined}>
              <div className="grid g2">
                <Field label={`Nível desejado: ${spec.level}`}><input type="range" min={0} max={25} value={spec.level} onChange={(e) => set({ level: Number(e.target.value), attrs: undefined, potential: Math.max(spec.potential, Number(e.target.value)) })} aria-label="Nível" /></Field>
                <Field label={`Potencial: ${spec.potential}`}><input type="range" min={0} max={25} value={spec.potential} onChange={(e) => set({ potential: Number(e.target.value) })} aria-label="Potencial" /></Field>
              </div>
              <p className="small muted">Mover o nível gera atributos coerentes com a posição e o estilo. Editar um atributo passa para o modo manual: o nível passa a ser calculado pelos próprios atributos.</p>
              {(['tec', 'fis', 'men', 'gol'] as const).map((g) => (
                <div key={g} style={{ marginBottom: 10 }}>
                  <h4>{ATTR_GROUPS[g]}</h4>
                  <div className="attrs">
                    {ATTRS.map((a, i) => a.group !== g ? null : (
                      <div key={a.key} className="attr"><span>{a.name}</span><span className="v">{attrs[i]}</span><input type="range" min={1} max={100} value={attrs[i]} aria-label={a.name} onChange={(e) => setAttr(i, Number(e.target.value))} /></div>
                    ))}
                  </div>
                </div>
              ))}
            </Panel>
          )}
          {tab === 'perfil' && (
            <>
              <Panel title="Estilo de jogo">
                <div className="grid g3">
                  {styles.map((st) => <button key={st.id} className={`choice ${spec.style === st.id ? 'on' : ''}`} onClick={() => set({ style: st.id, attrs: undefined })}><span className="t">{st.name}</span><span className="small muted">{st.desc}</span></button>)}
                  <button className={`choice ${!spec.style ? 'on' : ''}`} onClick={() => set({ style: null, attrs: undefined })}><span className="t">Sem estilo definido</span><span className="small muted">Avaliado apenas pelos atributos.</span></button>
                </div>
              </Panel>
              <div style={{ height: 10 }} />
              <Panel title={`Personalidade (${spec.traits.length}/4)`}>
                <div className="grid g2">
                  {TRAITS.map((t) => (
                    <button key={t.id} className={`choice ${spec.traits.includes(t.id) ? 'on' : ''}`} onClick={() => toggleTrait(t.id)}>
                      <span className="t">{t.name}</span>
                      <span className="small">{t.desc}</span>
                      <span className="small pos">+ {t.upside}</span>
                      <span className="small neg">− {t.downside}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            </>
          )}
          {tab === 'destino' && (
            <Panel title="Destino">
              <div className="row" style={{ marginBottom: 10 }}>
                {([...(inCareer ? [['userPro', 'Meu elenco profissional'], ['userYouth', 'Minha base']] : []), ['otherClub', 'Outro clube'], ['free', 'Sem clube (agente livre)']] as [Placement, string][]).map(([id, l]) => (
                  <label key={id} className="inline"><input type="radio" name="placement" checked={spec.placement === id} onChange={() => set({ placement: id, clubId: id === 'otherClub' ? spec.clubId && spec.clubId !== userClubId ? spec.clubId : clubs[0]?.id : userClubId })} />{l}</label>
                ))}
              </div>
              {spec.placement === 'otherClub' && (
                <div className="row">
                  <input type="search" placeholder="Buscar clube" value={clubQuery} onChange={(e) => setClubQuery(e.target.value)} aria-label="Buscar clube" />
                  <select value={spec.clubId ?? ''} onChange={(e) => set({ clubId: e.target.value })} aria-label="Clube de destino">{clubs.map((c) => <option key={c.id} value={c.id}>{c.name} (nível {Math.round(c.level)})</option>)}</select>
                </div>
              )}
              {spec.placement === 'userYouth' && spec.age > 19 && <div className="small warn">Jogadores da base devem ter até 19 anos.</div>}
              {spec.placement !== 'free' && (
                <div className="grid g3" style={{ marginTop: 10 }}>
                  <Field label="Anos de contrato"><NumInput value={spec.contractYears} min={1} max={6} onChange={(v) => set({ contractYears: Math.max(1, Math.min(6, v)) })} /></Field>
                  <Field label="Papel no elenco"><select value={spec.role ?? 'rotation'} onChange={(e) => set({ role: e.target.value as SquadRole })}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field>
                  <Field label="Número da camisa (0 = automático)"><NumInput value={spec.shirt ?? 0} min={0} max={99} onChange={(v) => set({ shirt: v || undefined })} /></Field>
                  <Field label="Salário anual (vazio = automático)"><input type="number" min={0} value={spec.wage ?? ''} onChange={(e) => set({ wage: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} /></Field>
                  <Field label="Valor de mercado (vazio = automático)"><input type="number" min={0} value={spec.value ?? ''} onChange={(e) => set({ value: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} /></Field>
                </div>
              )}
            </Panel>
          )}
        </div>
        <div className="stack">
          <Panel title="Prévia">
            <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
              <Avatar a={spec.appearance} size={84} />
              <div>
                <div className="strong" style={{ font: '700 22px var(--f-display)', textTransform: 'uppercase' }}>{spec.name || '—'}</div>
                <div className="small muted">{POS_NAME[spec.pos]} · {spec.age} anos · {NATIONS[spec.nat]?.name}</div>
                <div className="row tight" style={{ marginTop: 6 }}><Lvl v={pv.level} size="lg" tip={`Nível ${pv.levelExact.toFixed(1)}`} /><span className="small muted">potencial</span><Lvl v={pv.potentialLevel} pot /></div>
              </div>
            </div>
            {pv.warnings.length > 0 && <div className="stack" style={{ gap: 4, marginTop: 10 }}>{pv.warnings.map((w, i) => <div key={i} className="small warn">⚠ {w}</div>)}</div>}
          </Panel>
          {pv.finance && (
            <Panel title={`Impacto financeiro — ${pv.finance.club}`}>
              <div className="small stack" style={{ gap: 3 }}>
                <div>Valor de mercado: <strong><Money v={pv.finance.value} /></strong></div>
                <div>Salário anual: <strong><Money v={pv.finance.wage} /></strong></div>
                <div>Folha: <Money v={pv.finance.wageBillBefore} /> → <strong><Money v={pv.finance.wageBillAfter} /></strong></div>
                <div>Orçamento salarial: <Money v={pv.finance.budget} />{pv.finance.wageBillAfter > pv.finance.budget && <span className="neg"> (acima do limite)</span>}</div>
                <div className="tiny muted">Criado sem custo de transferência; o salário entra na folha a partir da inserção.</div>
              </div>
            </Panel>
          )}
          <Panel title="Comparação com jogadores semelhantes">
            {pv.comparisons.map((x) => <div key={x.id} className="small row" style={{ justifyContent: 'space-between' }}><span>{x.name} <span className="muted">· {x.club} · {x.age}a</span></span><span><Lvl v={x.level} size="sm" /> <Money v={x.value} /></span></div>)}
          </Panel>
          <button className="btn primary lg" disabled={!nameOk || (spec.placement === 'userYouth' && spec.age > 19) || (spec.placement === 'otherClub' && !spec.clubId)} onClick={() => setConfirm(true)}>Inserir no universo</button>
        </div>
      </div>
      {confirm && <Confirm title="Inserir jogador?" confirmLabel="Inserir" text={<>{spec.name} (nível {pv.level}, potencial {pv.potentialLevel}) será adicionado {inCareer ? 'à carreira atual' : `ao universo "${world.meta.name}"`}{spec.placement === 'free' ? ' como agente livre' : ''}. Ele ficará marcado como criação manual (CC).{pv.level >= 25 ? ' Nível 25 é preservado: o jogo não reduz atributos de forma silenciosa.' : ''}</>} onNo={() => setConfirm(false)} onYes={doInsert} />}
    </div>
  );
}
