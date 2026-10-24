import { useMemo, useState } from 'react';
import type { Lineup, Player, Tactics as T } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { PageHead, Panel, PosB, Lvl, Cond, PName, Menu } from '../components/common';
import { AutoSubsPanel } from './SubsPanel';
import { MiniShirt } from '../components/graphics';
import { FORMATION_NAMES, autoLineup, presetLineup, LINEUP_PRESETS, slotRating, slotsOf, validateLineup, availabilityNote } from '../../engine/clubs/lineup';
import { ovrToLevel, positionFit } from '../../engine/players/attributes';
import { currentCollection } from '../../engine/kits/commerce';
import { strengthSummary } from '../../engine/clubs/strength';
import { nextClubFixture } from '../../engine/career/index';
import { Icon } from '../components/Icon';

const OPT = {
  mentality: [[-2, 'Muito defensiva'], [-1, 'Defensiva'], [0, 'Equilibrada'], [1, 'Ofensiva'], [2, 'Muito ofensiva']],
  pressing: [[0, 'Baixa'], [1, 'Média'], [2, 'Alta']],
  line: [[0, 'Recuada'], [1, 'Normal'], [2, 'Alta']],
  tempo: [[0, 'Lenta'], [1, 'Normal'], [2, 'Rápida']],
  width: [[0, 'Estreita'], [1, 'Normal'], [2, 'Aberta']],
} as const;

const HELP: Record<string, string> = {
  mentality: 'Ofensiva cria mais chances e deixa a defesa mais exposta.',
  pressing: 'Pressão alta recupera mais bolas, mas cansa e abre espaços atrás.',
  line: 'Linha alta gera impedimentos, mas sofre com atacantes rápidos.',
  tempo: 'Construção rápida finaliza mais e com menos qualidade; lenta valoriza a posse.',
  width: 'Aberta favorece cruzamentos e pontas; estreita, o jogo por dentro.',
  passing: 'Passes curtos valorizam a posse; diretos favorecem velocidade e pivôs.',
  counter: 'Contra-ataque rende mais contra times ofensivos e reduz a posse.',
  marking: 'Individual anula dribladores, com mais faltas e desgaste.',
  setPieces: 'Segundo pau favorece times altos; primeiro pau, os rápidos.',
};

export function Tactics() {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const next = nextClubFixture(c, club.id, c.day);
  const compId = next?.compId;
  const [sel, setSel] = useState<{ kind: 'slot' | 'bench' | 'rest'; idx: number; id: string | null } | null>(null);
  const formation = club.tactics.formation;
  const slots = slotsOf(formation);
  const lineup: Lineup = club.lineup && club.lineup.starters.length === slots.length ? club.lineup : autoLineup(c, club, formation, compId);
  const kit = currentCollection(c).home;
  const issues = validateLineup(c, club, lineup, formation, compId);
  const used = new Set([...lineup.starters.filter(Boolean) as string[], ...lineup.bench]);
  const rest = club.playerIds.map((id) => c.players[id]).filter((p) => p && !used.has(p.id)).sort((a, b) => b.ovr - a.ovr);
  const str = useMemo(() => strengthSummary(c, club), [c, club, lineup, club.tactics]);

  const save = (l: Lineup) => store.act((cc) => { cc.clubs[cc.userClubId].lineup = l; });
  const setT = (patch: Partial<T>) => store.act((cc) => { const cl = cc.clubs[cc.userClubId]; cl.tactics = { ...cl.tactics, ...patch }; });

  const pick = (kind: 'slot' | 'bench' | 'rest', idx: number, id: string | null) => {
    if (!sel) return setSel({ kind, idx, id });
    // troca entre as duas posições selecionadas
    const l: Lineup = { starters: lineup.starters.slice(), bench: lineup.bench.slice() };
    const get = (k: typeof kind, i: number, pid: string | null) => (k === 'slot' ? l.starters[i] : k === 'bench' ? l.bench[i] : pid);
    const set = (k: typeof kind, i: number, v: string | null) => {
      if (k === 'slot') l.starters[i] = v;
      else if (k === 'bench') {
        if (v) l.bench[i] = v;
        else l.bench.splice(i, 1);
      }
    };
    const a = get(sel.kind, sel.idx, sel.id);
    const b = get(kind, idx, id);
    if (sel.kind === 'rest' && kind === 'rest') return setSel({ kind, idx, id });
    set(sel.kind, sel.idx, b);
    set(kind, idx, a);
    l.bench = l.bench.filter((x, i, arr) => x && arr.indexOf(x) === i && !l.starters.includes(x)).slice(0, 9);
    save(l);
    setSel(null);
  };
  const addToBench = (id: string) => {
    if (lineup.bench.length >= 9) return store.toast('O banco já tem 9 jogadores.', 'warn');
    save({ starters: lineup.starters, bench: [...lineup.bench, id] });
  };
  const removeFromBench = (id: string) => save({ starters: lineup.starters, bench: lineup.bench.filter((x) => x !== id) });
  const starters = lineup.starters.map((id) => (id ? c.players[id] : null));
  const onPitch = starters.filter(Boolean) as Player[];

  return (
    <div className="page">
      <PageHead title="Táticas e escalação" sub={next ? `Próximo jogo: ${c.clubs[next.home === club.id ? next.away : next.home].name} (${c.competitions[next.compId]?.name})` : 'Sem próximos jogos'}
        actions={<>
          <select value={formation} onChange={(e) => store.act((cc) => { const cl = cc.clubs[cc.userClubId]; cl.tactics = { ...cl.tactics, formation: e.target.value }; cl.lineup = autoLineup(cc, cl, e.target.value, compId); })}>{FORMATION_NAMES.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          <Menu label="Escalações" icon="wand" items={LINEUP_PRESETS.map((p) => ({
            label: <span style={{ display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'normal', maxWidth: 230 }}><strong>{p.label}</strong><span className="tiny muted">{p.desc}</span></span>,
            onClick: () => { save(presetLineup(c, club, formation, p.id, compId)); store.toast(`Escalação aplicada: ${p.label}.`); },
          }))} />
        </>} />
      <div className="grid g-main">
        <div className="stack">
          <Panel title={`Formação ${formation}`} right={<span className="small muted">Toque em dois jogadores para trocá-los</span>}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
              <div className="pitch" style={{ flex: '1 1 320px' }}>
                <svg className="lines" viewBox="0 0 68 100" preserveAspectRatio="none" aria-hidden>
                  <rect x="1" y="1" width="66" height="98" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".4" />
                  <line x1="1" y1="50" x2="67" y2="50" stroke="rgba(255,255,255,.55)" strokeWidth=".4" />
                  <circle cx="34" cy="50" r="8" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".4" />
                  <rect x="14" y="1" width="40" height="15" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".4" />
                  <rect x="14" y="84" width="40" height="15" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".4" />
                </svg>
                {slots.map((sl, i) => {
                  const p = starters[i];
                  const fit = p ? positionFit(p, sl.pos) : 0;
                  const note = p ? availabilityNote(p, compId) : 'vaga';
                  const isSel = sel?.kind === 'slot' && sel.idx === i;
                  return (
                    <div key={i} className={`slot ${isSel ? 'sel' : ''} ${p ? '' : 'empty'}`} style={{ left: `${sl.x}%`, top: `${4 + (100 - sl.y) * 0.88}%` }} onClick={() => pick('slot', i, p?.id ?? null)} title={p ? `${p.name} · ${sl.pos} · encaixe ${Math.round(fit * 100)}%` : 'Posição vazia'}>
                      <MiniShirt design={sl.pos === 'GK' ? currentCollection(c).gk : kit} number={p?.shirt} size={34} />
                      <span className="nm">{p ? p.name.split(' ').slice(-1)[0] : '—'}</span>
                      <span className="meta"><PosB pos={sl.pos} />{p && <Lvl v={ovrToLevel(slotRating(p, sl.pos))} size="sm" />}{(note || (p && fit < 0.8)) && <span className="warnb" title={note ?? 'Fora de posição'} />}</span>
                    </div>
                  );
                })}
              </div>
              <div className="stack" style={{ flex: '1 1 230px', minWidth: 0 }}>
                <h4>Reservas ({lineup.bench.length}/9)</h4>
                <div className="bench">
                  {lineup.bench.map((id, i) => {
                    const p = c.players[id];
                    if (!p) return null;
                    return (
                      <div key={id} className={`bench-row ${sel?.kind === 'bench' && sel.idx === i ? 'sel' : ''}`} onClick={() => pick('bench', i, id)}>
                        <PosB pos={p.pos} /><span className="small">{p.name}</span><Lvl v={ovrToLevel(p.ovr)} size="sm" /><button className="icon-btn" onClick={(e) => { e.stopPropagation(); removeFromBench(id); }} aria-label="Tirar do banco"><Icon name="close" className="star-ico" /></button>
                      </div>
                    );
                  })}
                </div>
                <h4>Fora da lista</h4>
                <div className="bench" style={{ maxHeight: 320, overflow: 'auto' }}>
                  {rest.map((p) => (
                    <div key={p.id} className={`bench-row ${sel?.kind === 'rest' && sel.id === p.id ? 'sel' : ''}`} onClick={() => pick('rest', -1, p.id)}>
                      <PosB pos={p.pos} /><span className="small">{p.name}{availabilityNote(p, compId) && <span className="neg"> · {availabilityNote(p, compId)}</span>}</span><Cond v={p.condition} /><button className="icon-btn" onClick={(e) => { e.stopPropagation(); addToBench(p.id); }} aria-label="Pôr no banco"><Icon name="plus" className="star-ico" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
          {issues.length > 0 && (
            <Panel title="Avisos da escalação">
              {issues.map((i, k) => <div key={k} className={`small ${i.level === 'error' ? 'neg' : 'warn'}`}>• {i.text}</div>)}
              <div className="tiny muted" style={{ marginTop: 6 }}>Jogadores indisponíveis são substituídos automaticamente na hora do jogo.</div>
            </Panel>
          )}
          <AutoSubsPanel compId={compId} />
        </div>
        <div className="stack">
          <Panel title="Força da equipe">
            <div className="grid g3 small">
              <div><div className="muted">Nível do clube</div><Lvl v={str.clubLevel} /></div>
              <div><div className="muted">Qualidade do elenco</div><Lvl v={str.squad} /></div>
              <div><div className="muted">Força atual</div><Lvl v={str.current} /></div>
            </div>
            <div className="tiny muted" style={{ marginTop: 6 }}>Nível do clube não garante vitórias: a força atual considera escalação, posição, condição, moral e entrosamento ({Math.round(club.cohesion)}%).</div>
          </Panel>
          <Panel title="Instruções táticas">
            <div className="stack" style={{ gap: 10 }}>
              {(Object.keys(OPT) as (keyof typeof OPT)[]).map((k) => (
                <div key={k}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><span className="small strong">{{ mentality: 'Mentalidade', pressing: 'Pressão', line: 'Linha defensiva', tempo: 'Velocidade de construção', width: 'Largura ofensiva' }[k]}</span><span className="tiny muted">{HELP[k]}</span></div>
                  <div className="row tight">{OPT[k].map(([v, l]) => <button key={v} className={`btn sm ${club.tactics[k] === v ? 'primary' : ''}`} onClick={() => setT({ [k]: v } as Partial<T>)}>{l}</button>)}</div>
                </div>
              ))}
              <div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small strong">Estilo de passe</span><span className="tiny muted">{HELP.passing}</span></div>
                <div className="row tight">{([['short', 'Curto'], ['mixed', 'Misto'], ['direct', 'Direto']] as const).map(([v, l]) => <button key={v} className={`btn sm ${club.tactics.passing === v ? 'primary' : ''}`} onClick={() => setT({ passing: v })}>{l}</button>)}</div>
              </div>
              <div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small strong">Marcação</span><span className="tiny muted">{HELP.marking}</span></div>
                <div className="row tight">{([['zonal', 'Por zona'], ['man', 'Individual']] as const).map(([v, l]) => <button key={v} className={`btn sm ${club.tactics.marking === v ? 'primary' : ''}`} onClick={() => setT({ marking: v })}>{l}</button>)}</div>
              </div>
              <div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small strong">Bolas paradas</span><span className="tiny muted">{HELP.setPieces}</span></div>
                <div className="row tight">{([['mixed', 'Variadas'], ['near', 'Primeiro pau'], ['far', 'Segundo pau'], ['short', 'Cobrança curta']] as const).map(([v, l]) => <button key={v} className={`btn sm ${club.tactics.setPieces === v ? 'primary' : ''}`} onClick={() => setT({ setPieces: v })}>{l}</button>)}</div>
              </div>
              <label className="inline"><input type="checkbox" checked={club.tactics.counter} onChange={(e) => setT({ counter: e.target.checked })} />Explorar contra-ataques <span className="tiny muted">— {HELP.counter}</span></label>
            </div>
          </Panel>
          <Panel title="Funções">
            <div className="stack">
              {([['captain', 'Capitão'], ['penaltyTaker', 'Batedor de pênaltis'], ['freeKickTaker', 'Batedor de faltas']] as const).map(([k, l]) => (
                <label key={k} className="field"><span>{l}</span>
                  <select value={club.tactics[k] ?? ''} onChange={(e) => setT({ [k]: e.target.value || null } as Partial<T>)}>
                    <option value="">Automático</option>
                    {onPitch.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </Panel>
          <Panel title="Treinamento semanal">
            <div className="stack">
              <div className="row tight">{([['balanced', 'Equilibrado'], ['technical', 'Técnico'], ['physical', 'Físico'], ['tactical', 'Tático'], ['recovery', 'Recuperação'], ['matchPrep', 'Preparação de jogo']] as const).map(([v, l]) => <button key={v} className={`btn sm ${club.training.focus === v ? 'primary' : ''}`} onClick={() => store.act((cc) => { cc.clubs[cc.userClubId].training.focus = v; })}>{l}</button>)}</div>
              <div className="row tight"><span className="small muted">Intensidade:</span>{([[0, 'Leve'], [1, 'Normal'], [2, 'Intensa']] as const).map(([v, l]) => <button key={v} className={`btn sm ${club.training.intensity === v ? 'go' : ''}`} onClick={() => store.act((cc) => { cc.clubs[cc.userClubId].training.intensity = v; })}>{l}</button>)}</div>
              <div className="tiny muted">Intensa acelera a evolução mas aumenta lesões e reduz a recuperação. Tático melhora o entrosamento; preparação de jogo dá bônus de coesão na partida; recuperação acelera a condição física.</div>
            </div>
          </Panel>
          <Panel title="Titulares">
            {onPitch.map((p) => <div key={p.id} className="row small" style={{ justifyContent: 'space-between' }}><PName p={p} /><Cond v={p.condition} /></div>)}
          </Panel>
        </div>
      </div>
    </div>
  );
}
