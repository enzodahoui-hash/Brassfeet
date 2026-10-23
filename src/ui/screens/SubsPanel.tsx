import { useState } from 'react';
import type { Player, Pos, SubPlan, SubRule } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { Panel, Modal, Field, NumInput, PosB, Confirm } from '../components/common';
import { Icon } from '../components/Icon';
import { DEFAULT_REG, ROLE_NAME, SUB_MODES, defaultSubPlan, newRule, ruleProblems } from '../../engine/match/subs';
import { POSITIONS, POS_NAME, ovrToLevel } from '../../engine/players/attributes';

const SCORE_PT = { any: 'Qualquer placar', winning: 'Vencendo', drawing: 'Empatando', losing: 'Perdendo' } as const;

/** Exemplos prontos (o usuário ajusta depois). */
const EXAMPLES: { label: string; make: (n: number) => SubRule }[] = [
  { label: 'Ponta titular sai aos 65 minutos', make: (n) => ({ ...newRule(n), label: 'Ponta aos 65', outPos: 'RW', minFrom: 65, minTo: 70 }) },
  { label: 'Atacante sai com menos de 45% de condição', make: (n) => ({ ...newRule(n), label: 'Atacante cansado', outPos: 'ST', minFrom: null, condBelow: 45 }) },
  { label: 'Volante cansado por outro volante', make: (n) => ({ ...newRule(n), label: 'Volante cansado', outPos: 'DM', inPos: 'DM', minFrom: 55, condBelow: 60 }) },
  { label: 'Atacante extra aos 75 quando perdendo', make: (n) => ({ ...newRule(n), label: 'Atacante extra', outPos: 'DM', inPos: 'ST', minFrom: 75, score: 'losing', preserveRole: false, extraAttacker: true }) },
  { label: 'Zagueiro amarelado com risco de expulsão', make: (n) => ({ ...newRule(n), label: 'Zagueiro amarelado', outPos: 'CB', minFrom: 50, yellowRisk: true }) },
];

function planOf(cc: ReturnType<typeof useCareer>): SubPlan {
  const club = cc.clubs[cc.userClubId];
  return (club.subPlan ??= defaultSubPlan());
}

export function AutoSubsPanel({ compId }: { compId?: string }) {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const plan = club.subPlan ?? defaultSubPlan();
  const [edit, setEdit] = useState<SubRule | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [showPos, setShowPos] = useState(false);
  const squad = club.playerIds.map((id) => c.players[id]).filter(Boolean).sort((a, b) => POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos));
  const reg = (compId ? c.config.competitions[c.competitions[compId]?.templateId]?.subs : undefined) ?? DEFAULT_REG;
  const upd = (fn: (p: SubPlan) => void, msg?: string) => store.act((cc) => { fn(planOf(cc)); }, msg);
  const sorted = plan.rules.slice().sort((a, b) => a.priority - b.priority);
  const move = (id: string, dir: -1 | 1) => upd((p) => {
    const list = p.rules.slice().sort((a, b) => a.priority - b.priority);
    const i = list.findIndex((r) => r.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((r, k) => (r.priority = k + 1));
    p.rules = list;
  });
  const nameOf = (id?: string | null) => (id ? c.players[id]?.name ?? 'jogador fora do elenco' : null);
  const describe = (r: SubRule) => {
    const out = nameOf(r.outPid) ?? (r.outPos ? `quem estiver como ${ROLE_NAME[r.outPos]}` : '?');
    const inn = nameOf(r.inPid) ?? (r.extraAttacker ? `melhor atacante do banco` : r.inPos ? `melhor reserva para ${ROLE_NAME[r.inPos]}` : 'melhor reserva para a função');
    const when = [r.minFrom != null ? `a partir dos ${r.minFrom}'` : '', r.minTo != null ? `até os ${r.minTo}'` : '', r.condBelow != null ? `condição abaixo de ${r.condBelow}%` : '', r.yellowRisk ? 'amarelado com risco de expulsão' : '', r.score !== 'any' ? SCORE_PT[r.score].toLowerCase() : ''].filter(Boolean).join(', ');
    return `Sai ${out}; entra ${inn}${when ? ` — ${when}` : ''}.`;
  };
  return (
    <Panel title="Substituições Automáticas" right={<span className="tiny muted">Regulamento: {reg.max} trocas em {reg.windows} oportunidades (+{reg.etExtra} e +{reg.etWindows} na prorrogação; o intervalo não conta)</span>}>
      <div className="grid g2" role="radiogroup" aria-label="Modo de substituições">
        {SUB_MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={plan.mode === m.id} className={`choice ${plan.mode === m.id ? 'on' : ''}`} onClick={() => upd((p) => { p.mode = m.id; }, `Modo de substituições: ${m.name}.`)}>
            <span className="t">{m.name}</span><span className="small muted">{m.desc}</span>
          </button>
        ))}
      </div>
      {(plan.mode === 'fitness' || plan.mode === 'smart') && (
        <div className="stack" style={{ marginTop: 12, gap: 8 }}>
          <Field label={`Limite geral de condição física: ${plan.fatigue}%`}>
            <input type="range" min={30} max={85} value={plan.fatigue} aria-label="Limite geral de condição física" onChange={(e) => upd((p) => { p.fatigue = Number(e.target.value); })} />
          </Field>
          <div className="tiny muted">O limite é ajustado pela exigência de cada função (pontas e laterais cansam antes de zagueiros), pela pressão e ritmo da tática, pelos minutos restantes, pelo histórico recente de cansaço e pelo risco de lesão. Só há troca se o reserva render pelo menos o mesmo.</div>
          <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setShowPos(!showPos)}>{showPos ? 'Ocultar' : 'Definir'} limites por posição</button>
          {showPos && (
            <div className="grid g4">
              {POSITIONS.filter((p) => p !== 'GK').map((pos) => (
                <label key={pos} className="field"><span>{POS_NAME[pos]}</span>
                  <select value={plan.posFatigue[pos] ?? ''} onChange={(e) => upd((p) => { if (e.target.value) p.posFatigue[pos] = Number(e.target.value); else delete p.posFatigue[pos]; })}>
                    <option value="">Geral ({plan.fatigue}%)</option>
                    {[35, 40, 45, 50, 55, 60, 65, 70, 75, 80].map((v) => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
          <label className="inline"><input type="checkbox" checked={plan.variety} onChange={(e) => upd((p) => { p.variety = e.target.checked; })} />Substituições automáticas por cansaço e contexto <span className="tiny muted">— alterna entre reservas equivalentes de uma partida para outra, sempre escolhendo por posição, condição, nível e tática</span></label>
        </div>
      )}
      {plan.mode !== 'manual' && (
        <label className="inline" style={{ marginTop: 8 }}><input type="checkbox" checked={plan.confirm} onChange={(e) => upd((p) => { p.confirm = e.target.checked; })} />Pedir confirmação na partida ao vivo antes de cada troca automática <span className="tiny muted">(lesões são resolvidas na hora)</span></label>
      )}
      {(plan.mode === 'rules' || plan.mode === 'smart') && (
        <div style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h4>Regras personalizadas ({plan.rules.length})</h4>
            <div className="row tight">
              <button className="btn sm primary" onClick={() => setEdit(newRule(plan.rules.length + 1))}><Icon name="plus" />Nova regra</button>
              <select value="" aria-label="Adicionar regra de exemplo" onChange={(e) => { const ex = EXAMPLES[Number(e.target.value)]; if (ex) upd((p) => { p.rules.push(ex.make(p.rules.length + 1)); }, 'Regra de exemplo adicionada.'); }}>
                <option value="">+ exemplo pronto</option>
                {EXAMPLES.map((ex, i) => <option key={i} value={i}>{ex.label}</option>)}
              </select>
            </div>
          </div>
          {sorted.length === 0 ? <div className="small muted">Nenhuma regra cadastrada. As regras valem por jogador ou por posição: uma regra por posição continua valendo mesmo que o titular mude.</div> : (
            <div className="stack" style={{ gap: 6 }}>
              {sorted.map((r, i) => {
                const probs = ruleProblems(r);
                return (
                  <div key={r.id} className="rule-row" style={{ opacity: r.enabled ? 1 : 0.55 }}>
                    <span className="mono small" style={{ width: 22 }}>{i + 1}.</span>
                    <label className="inline" title="Ativar ou desativar"><input type="checkbox" checked={r.enabled} aria-label={`Ativar ${r.label}`} onChange={(e) => upd((p) => { const x = p.rules.find((y) => y.id === r.id); if (x) x.enabled = e.target.checked; })} /></label>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="strong small">{r.label}</div>
                      <div className="tiny muted">{describe(r)}</div>
                      {probs.length > 0 && <div className="tiny warn">⚠ {probs.join(' ')}</div>}
                    </div>
                    <div className="row tight">
                      <button className="btn sm" onClick={() => move(r.id, -1)} disabled={i === 0} aria-label="Subir prioridade">▲</button>
                      <button className="btn sm" onClick={() => move(r.id, 1)} disabled={i === sorted.length - 1} aria-label="Descer prioridade">▼</button>
                      <button className="btn sm" onClick={() => setEdit({ ...r })}>Editar</button>
                      <button className="btn sm" onClick={() => upd((p) => { p.rules.push({ ...r, id: newRule(p.rules.length + 1).id, label: `${r.label} (cópia)`, priority: p.rules.length + 1 }); }, 'Regra duplicada.')} aria-label="Duplicar"><Icon name="copy" /></button>
                      <button className="btn sm danger" onClick={() => setDel(r.id)} aria-label="Excluir regra"><Icon name="trash" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {edit && <RuleEditor rule={edit} squad={squad} onClose={() => setEdit(null)} onSave={(r) => { upd((p) => { const i = p.rules.findIndex((x) => x.id === r.id); if (i >= 0) p.rules[i] = r; else p.rules.push(r); }, 'Regra salva.'); setEdit(null); }} />}
      {del && <Confirm title="Excluir regra?" danger confirmLabel="Excluir" text="A regra deixa de valer nas próximas partidas." onNo={() => setDel(null)} onYes={() => { upd((p) => { p.rules = p.rules.filter((x) => x.id !== del); p.rules.sort((a, b) => a.priority - b.priority).forEach((x, k) => (x.priority = k + 1)); }, 'Regra excluída.'); setDel(null); }} />}
    </Panel>
  );
}

function RuleEditor({ rule, squad, onClose, onSave }: { rule: SubRule; squad: Player[]; onClose: () => void; onSave: (r: SubRule) => void }) {
  const [r, setR] = useState<SubRule>(rule);
  const set = (patch: Partial<SubRule>) => setR((x) => ({ ...x, ...patch }));
  const probs = ruleProblems(r);
  const byPlayer = !!r.outPid;
  const numOrNull = (v: string) => (v === '' ? null : Number(v));
  return (
    <Modal title="Regra de substituição" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={probs.length > 0} onClick={() => onSave(r)}>Salvar regra</button></>}>
      <div className="stack" style={{ gap: 10 }}>
        <Field label="Nome da regra"><input type="text" value={r.label} maxLength={40} onChange={(e) => set({ label: e.target.value })} /></Field>
        <div className="row">
          <label className="inline"><input type="radio" checked={!byPlayer} onChange={() => set({ outPid: null, outPos: r.outPos ?? 'ST' })} />Por posição</label>
          <label className="inline"><input type="radio" checked={byPlayer} onChange={() => set({ outPid: squad[0]?.id ?? null, outPos: null })} />Por jogador</label>
        </div>
        <div className="grid g2">
          {byPlayer ? (
            <Field label="Jogador que sai"><select value={r.outPid ?? ''} onChange={(e) => set({ outPid: e.target.value || null })}>{squad.map((p) => <option key={p.id} value={p.id}>{p.pos} · {p.name}</option>)}</select></Field>
          ) : (
            <Field label="Posição/função que sai"><select value={r.outPos ?? ''} onChange={(e) => set({ outPos: (e.target.value || null) as Pos | null })}>{POSITIONS.filter((p) => p !== 'GK').map((p) => <option key={p} value={p}>{POS_NAME[p]}</option>)}</select></Field>
          )}
          <Field label="Jogador que entra">
            <select value={r.inPid ?? ''} onChange={(e) => set({ inPid: e.target.value || null })}>
              <option value="">Melhor reserva disponível</option>
              {squad.map((p) => <option key={p.id} value={p.id}>{p.pos} · {p.name} ({Math.round(ovrToLevel(p.ovr))})</option>)}
            </select>
          </Field>
          <Field label="Do minuto (46 = no intervalo)"><input type="number" min={1} max={120} value={r.minFrom ?? ''} placeholder="—" onChange={(e) => set({ minFrom: numOrNull(e.target.value) })} /></Field>
          <Field label="Até o minuto (opcional)"><input type="number" min={1} max={120} value={r.minTo ?? ''} placeholder="—" onChange={(e) => set({ minTo: numOrNull(e.target.value) })} /></Field>
          <Field label="Condição física abaixo de (%)"><input type="number" min={5} max={99} value={r.condBelow ?? ''} placeholder="—" onChange={(e) => set({ condBelow: numOrNull(e.target.value) })} /></Field>
          <Field label="Diferença mínima de nota (reserva − titular)"><input type="number" min={-30} max={30} value={r.minOvrDiff ?? ''} placeholder="—" onChange={(e) => set({ minOvrDiff: numOrNull(e.target.value) })} /></Field>
          <Field label="Situação do placar"><select value={r.score} onChange={(e) => set({ score: e.target.value as SubRule['score'] })}>{(Object.keys(SCORE_PT) as SubRule['score'][]).map((k) => <option key={k} value={k}>{SCORE_PT[k]}</option>)}</select></Field>
          <Field label="Prioridade"><NumInput value={r.priority} min={1} max={30} onChange={(v) => set({ priority: v })} /></Field>
        </div>
        <label className="inline"><input type="checkbox" checked={r.preserveRole && !r.extraAttacker} onChange={(e) => set({ preserveRole: e.target.checked, extraAttacker: e.target.checked ? false : r.extraAttacker })} />Preservar a função tática de quem sai</label>
        {!r.preserveRole && (
          <Field label="Função de quem entra"><select value={r.inPos ?? ''} onChange={(e) => set({ inPos: (e.target.value || null) as Pos | null })}><option value="">Mesma de quem sai</option>{POSITIONS.filter((p) => p !== 'GK').map((p) => <option key={p} value={p}>{POS_NAME[p]}</option>)}</select></Field>
        )}
        <label className="inline"><input type="checkbox" checked={!!r.extraAttacker} onChange={(e) => set({ extraAttacker: e.target.checked, preserveRole: e.target.checked ? false : r.preserveRole, inPos: e.target.checked ? (r.inPos ?? 'ST') : r.inPos })} />Entrar como atacante extra (muda a estrutura)</label>
        <label className="inline"><input type="checkbox" checked={!!r.yellowRisk} onChange={(e) => set({ yellowRisk: e.target.checked })} />Só se o jogador estiver amarelado com risco de expulsão</label>
        <div className="tiny muted">Exemplo de posição: <PosB pos={(r.outPos ?? 'ST') as Pos} /> {ROLE_NAME[(r.outPos ?? 'ST') as Pos]}. A regra só dispara se houver substituições e oportunidades disponíveis no regulamento da competição.</div>
        {probs.length > 0 && <div className="small warn">⚠ {probs.join(' ')}</div>}
      </div>
    </Modal>
  );
}
