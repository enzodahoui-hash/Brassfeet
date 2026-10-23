import { useEffect, useRef, useState } from 'react';
import type { Tactics } from '../../engine/types';
import { useCareer, useGame } from '../store';
import { Panel, PosB, Cond, Lvl, Modal } from '../components/common';
import { Crest } from '../components/graphics';
import { Icon } from '../components/Icon';
import { ovrToLevel } from '../../engine/players/attributes';

type LiveTab = 'lances' | 'stats' | 'tatica' | 'trocas' | 'campo';
const LIVE_TABS: [LiveTab, string][] = [['lances', 'Lances'], ['stats', 'Estatísticas'], ['tatica', 'Tática'], ['trocas', 'Trocas'], ['campo', 'Em campo']];

/** Partida ao vivo: cronômetro, eventos, estatísticas, substituições e mudanças táticas. */
export function Live() {
  const s = useGame();
  const c = useCareer();
  const l = s.live;
  const [subOpen, setSubOpen] = useState(false);
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<LiveTab>('lances');
  const [flash, setFlash] = useState(0);
  const seenSubs = useRef(0);
  const goals = useRef(-1);

  // gol: o placar pisca e, no celular, o aparelho vibra
  const total = l ? l.sim.score[0] + l.sim.score[1] : 0;
  useEffect(() => {
    if (goals.current >= 0 && total > goals.current) {
      setFlash((x) => x + 1);
      try { navigator.vibrate?.([60, 40, 120]); } catch { /* sem suporte */ }
    }
    goals.current = total;
  }, [total]);

  // mantém a tela acesa enquanto a partida corre (celular)
  const running = !!l?.running && !l?.sim.finished;
  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let off = false;
    (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      .request('screen').then((x) => { if (off) void x.release(); else lock = x; }).catch(() => undefined);
    return () => { off = true; void lock?.release().catch(() => undefined); };
  }, [running]);

  useEffect(() => {
    if (!l || !l.running || l.sim.finished) return;
    const ms = [700, 260, 90, 25][Math.min(3, l.speed)];
    const t = setInterval(() => {
      l.sim.step();
      setTick((x) => x + 1);
      // sugestão aguardando confirmação: pausa o jogo
      if (l.sim.pendingFor(l.userSide)) {
        l.running = false;
        s.bump();
      }
      if (l.sim.finished) {
        l.running = false;
        s.finishLive();
      }
    }, ms);
    return () => clearInterval(t);
  }, [l, l?.running, l?.speed, s]);

  // avisa as trocas automáticas do seu time, com o motivo (o contador é atualizado antes do aviso)
  useEffect(() => {
    if (!l) return;
    const mine = l.sim.subsLog.filter((x) => x.club === c.userClubId);
    if (mine.length <= seenSubs.current) return;
    const fresh = mine.slice(seenSubs.current);
    seenSubs.current = mine.length;
    const msgs = fresh.filter((x) => x.auto && x.reason && l.speed < 3).map((x) => `Substituição automática: ${x.reason}`);
    if (msgs.length) setTimeout(() => msgs.forEach((m) => s.toast(m, 'ok')), 0);
  });

  if (!l) return <div className="page"><div className="empty">Nenhuma partida em andamento.</div></div>;
  const sim = l.sim;
  const f = c.fixtures[l.fixtureId];
  const home = c.clubs[f.home];
  const away = c.clubs[f.away];
  const st = sim.liveStats();
  const me = sim.teams[l.userSide];
  const events = sim.events.slice().reverse();
  const done = sim.finished;
  const phaseLabel = { pre: 'Pré-jogo', h1: '1º tempo', ht: 'Intervalo', h2: '2º tempo', et1: 'Prorrogação', et2: 'Prorrogação', pens: 'Pênaltis', done: 'Encerrado' }[sim.phase];
  const info = sim.subsInfo(l.userSide);
  const pending = sim.pendingFor(l.userSide);
  const fit = sim.fitness(l.userSide);
  const mySubs = sim.subsLog.filter((x) => x.club === me.input.clubId);
  const sugg = done ? [] : sim.suggestions(l.userSide);
  const setT = (patch: Partial<Tactics>) => {
    sim.setTactics(l.userSide, patch);
    setTick((x) => x + 1);
  };

  return (
    <div className="page live-page">
      <Panel flush className="live-head">
        <div key={flash} className={`scoreboard ${flash ? 'flash' : ''}`}>
          <div className="team"><Crest crest={home.crest} size={50} /><div className="tname"><span className="hide-mobile">{home.name}</span><span className="only-m">{home.short}</span></div></div>
          <div>
            <div className="score">{sim.score[0]} – {sim.score[1]}</div>
            <div className="clock">{done ? 'FIM' : `${sim.minute}' · ${phaseLabel}`}{sim.pens ? ` · pên. ${sim.pens[0]}–${sim.pens[1]}` : ''}</div>
          </div>
          <div className="team away"><Crest crest={away.crest} size={50} /><div className="tname"><span className="hide-mobile">{away.name}</span><span className="only-m">{away.short}</span></div></div>
        </div>
        <div className="row live-controls" style={{ padding: 10, justifyContent: 'center' }}>
          {!done && <button className="btn" onClick={() => { l.running = !l.running; s.bump(); }}><Icon name={l.running ? 'pause' : 'play'} />{l.running ? 'Pausar' : 'Continuar'}</button>}
          {!done && [1, 2, 3].map((sp) => <button key={sp} className={`btn sm ${l.speed === sp ? 'primary' : ''}`} onClick={() => { l.speed = sp; s.bump(); }}>{sp === 1 ? '1×' : sp === 2 ? '3×' : '8×'}</button>)}
          {!done && <button className="btn wide" onClick={() => { l.running = false; setSubOpen(true); s.bump(); }}><Icon name="sub" /><span className="hide-mobile">Substituição ({info.max - info.made} restantes)</span><span className="only-m">Substituição ({info.max - info.made})</span></button>}
          {!done && <button className="btn ghost wide" onClick={() => { sim.setConfirm(l.userSide, false); sim.runToEnd(); l.running = false; s.finishLive(); }}>Simular até o fim</button>}
          {done && <button className="btn go wide" onClick={() => s.closeLive()}>Ver relatório da partida</button>}
        </div>
        {l.changes.length > 0 && <div className="small warn" style={{ padding: '0 12px 10px' }}>Ajustes automáticos antes do jogo: {l.changes.join('; ')}</div>}
      </Panel>
      <div className="hide-mobile" style={{ height: 12 }} />
      <div className="live-tabs" role="tablist" aria-label="Seções da partida">
        {LIVE_TABS.filter(([k]) => !(done && k === 'tatica')).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}{k === 'trocas' && sugg.length > 0 && <span className="dot" />}
          </button>
        ))}
      </div>
      <div className="grid g-main live-body">
        <Panel title="Lance a lance" flush className={`live-sec ${tab === 'lances' ? 'on' : ''}`}>
          <div className="feed">
            {events.map((e, i) => (
              <div key={i} className={`feed-row ${e.type === 'goal' ? 'goal' : e.type === 'card' && e.big ? 'red' : e.big ? 'big' : ''}`}>
                <span className="m">{e.min}'</span>
                <span>{e.side >= 0 && <Crest crest={(e.side === 0 ? home : away).crest} size={16} />}</span>
                <span>{e.text}</span>
              </div>
            ))}
            {!events.length && <div className="empty">A partida vai começar.</div>}
          </div>
        </Panel>
        <div className="stack">
          <Panel title="Estatísticas" className={`live-sec ${tab === 'stats' ? 'on' : ''}`}>
            <div className="stack" style={{ gap: 7 }}>
              {([['Posse', st.poss[0], st.poss[1], '%'], ['Finalizações', st.shots[0], st.shots[1]], ['No alvo', st.sot[0], st.sot[1]], ['Escanteios', st.corners[0], st.corners[1]], ['Faltas', st.fouls[0], st.fouls[1]], ['Cartões', st.yellows[0] + st.reds[0], st.yellows[1] + st.reds[1]]] as [string, number, number, string?][]).map(([lab, a, b, suf]) => (
                <div key={lab} className="statline"><span className="val">{a}{suf ?? ''}</span><span className="lab">{lab}</span><span className="val right">{b}{suf ?? ''}</span><div className="duo"><i style={{ width: `${(a / Math.max(0.01, a + b)) * 100}%` }} /><i style={{ width: `${(b / Math.max(0.01, a + b)) * 100}%` }} /></div></div>
              ))}
            </div>
          </Panel>
          {!done && (
            <Panel title="Ajuste tático" className={`live-sec ${tab === 'tatica' ? 'on' : ''}`}>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row tight"><span className="small muted">Mentalidade</span>{([[-2, 'Retranca'], [-1, 'Defensiva'], [0, 'Equilibrada'], [1, 'Ofensiva'], [2, 'Tudo ao ataque']] as const).map(([v, t]) => <button key={v} className={`btn sm ${me.tactics.mentality === v ? 'primary' : ''}`} onClick={() => setT({ mentality: v })}>{t}</button>)}</div>
                <div className="row tight"><span className="small muted">Pressão</span>{([[0, 'Baixa'], [1, 'Média'], [2, 'Alta']] as const).map(([v, t]) => <button key={v} className={`btn sm ${me.tactics.pressing === v ? 'primary' : ''}`} onClick={() => setT({ pressing: v })}>{t}</button>)}</div>
                <div className="row tight"><span className="small muted">Linha</span>{([[0, 'Recuada'], [1, 'Normal'], [2, 'Alta']] as const).map(([v, t]) => <button key={v} className={`btn sm ${me.tactics.line === v ? 'primary' : ''}`} onClick={() => setT({ line: v })}>{t}</button>)}</div>
                <div className="row tight"><span className="small muted">Ritmo</span>{([[0, 'Lento'], [1, 'Normal'], [2, 'Rápido']] as const).map(([v, t]) => <button key={v} className={`btn sm ${me.tactics.tempo === v ? 'primary' : ''}`} onClick={() => setT({ tempo: v })}>{t}</button>)}</div>
              </div>
            </Panel>
          )}
          <Panel title="Substituições" className={`live-sec ${tab === 'trocas' ? 'on' : ''}`}>
            <div className="grid g3 keep3 small" style={{ marginBottom: 8 }}>
              <div><div className="muted">Feitas</div><strong>{info.made}</strong></div>
              <div><div className="muted">Restantes</div><strong>{info.max - info.made}</strong></div>
              <div><div className="muted">Oportunidades</div><strong data-tip="Interrupções no tempo de jogo; o intervalo não conta">{Math.max(0, info.windows - info.windowsUsed)} de {info.windows}</strong></div>
            </div>
            {info.interval && <div className="tiny muted">Intervalo: trocas agora não gastam oportunidade.</div>}
            {info.windowOpen && !info.interval && <div className="tiny muted">Interrupção em andamento: outra troca neste minuto não gasta nova oportunidade.</div>}
            {mySubs.map((x, i) => (
              <div key={i} className="small" style={{ marginTop: 4 }}>
                <span className="mono">{x.min}'</span> {c.players[x.out]?.name} → <strong>{c.players[x.in]?.name}</strong>{x.auto && <span className="chip" style={{ marginLeft: 4 }}>auto</span>}
                {x.reason && <div className="tiny muted">{x.reason}</div>}
              </div>
            ))}
            {!done && sugg.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="tiny muted">Sugestões automáticas</div>
                {sugg.map((g) => (
                  <div key={g.outId} className="row small" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 6 }}>
                    <span style={{ minWidth: 0 }}>{g.reason}</span>
                    <button className="btn sm" onClick={() => { const err = sim.substitute(l.userSide, g.outId, g.inId); if (err) s.toast(err, 'err'); s.bump(); }}>Aplicar</button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel title={`Em campo — ${c.clubs[me.input.clubId].short}`} className={`live-sec ${tab === 'campo' ? 'on' : ''}`}>
            {fit.map((x) => {
              const ps = me.ps.find((y) => y.p.id === x.pid)!;
              return (
                <div key={x.pid} className="row small fit-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <span className="row tight" style={{ flexWrap: 'nowrap', minWidth: 0 }}><PosB pos={x.slot} />{x.name}{ps.goals > 0 && <Icon name="ball" className="star-ico" />}{x.yellow && <span className="swatch" style={{ width: 8, height: 11, background: 'var(--draw)' }} />}{x.injured && <span className="neg">lesionado</span>}{x.slot !== 'GK' && x.cond < x.threshold && <span className="chip warn">cansado</span>}</span>
                  <span className="row tight" style={{ flexWrap: 'nowrap' }}><span className="mono tiny">{x.cond}%</span><Cond v={x.cond} /></span>
                </div>
              );
            })}
          </Panel>
        </div>
      </div>
      {subOpen && <SubModal onClose={() => { setSubOpen(false); if (!l.sim.finished) { l.running = true; s.bump(); } }} />}
      {pending && !done && <SuggestionModal onDone={() => { if (!l.sim.finished) l.running = true; s.bump(); }} />}
    </div>
  );
}

function SubModal({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const l = s.live!;
  const me = l.sim.teams[l.userSide];
  const [out, setOut] = useState<string | null>(null);
  const [inn, setInn] = useState<string | null>(null);
  const onField = l.sim.on(me);
  const bench = me.ps.filter((x) => !x.on && x.inMin < 0 && !x.red && !x.started);
  const info = l.sim.subsInfo(l.userSide);
  return (
    <Modal title={`Substituição (${info.made}/${info.max} feitas · ${Math.max(0, info.windows - info.windowsUsed)} oportunidades)`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Voltar ao jogo</button><button className="btn primary" disabled={!out || !inn} onClick={() => { const err = l.sim.substitute(l.userSide, out!, inn!); if (err) s.toast(err, 'err'); else { s.toast('Substituição feita.'); setOut(null); setInn(null); } s.bump(); }}>Confirmar troca</button></>}>
      <div className="grid g2">
        <div><h4>Sai</h4>{onField.map((x) => <div key={x.p.id} className={`bench-row ${out === x.p.id ? 'sel' : ''}`} onClick={() => setOut(x.p.id)}><PosB pos={x.slot} /><span className="small">{x.p.name}{x.yellow ? ' (amarelo)' : ''}{x.injured ? ' (lesionado)' : ''}</span><Cond v={x.cond} /><span /></div>)}</div>
        <div><h4>Entra</h4>{bench.map((x) => <div key={x.p.id} className={`bench-row ${inn === x.p.id ? 'sel' : ''}`} onClick={() => setInn(x.p.id)}><PosB pos={x.p.pos} /><span className="small">{x.p.name}</span><Lvl v={ovrToLevel(x.p.ovr)} size="sm" /><span /></div>)}{!bench.length && <div className="small muted">Banco vazio.</div>}</div>
      </div>
    </Modal>
  );
}

/** Sugestão automática aguardando confirmação: executar, trocar o reserva ou cancelar. */
function SuggestionModal({ onDone }: { onDone: () => void }) {
  const s = useGame();
  const l = s.live!;
  const sug = l.sim.pendingFor(l.userSide)!;
  const me = l.sim.teams[l.userSide];
  const bench = me.ps.filter((x) => !x.on && x.inMin < 0 && !x.red && !x.started && !x.injured);
  const [alt, setAlt] = useState(sug.inId);
  const out = me.ps.find((x) => x.p.id === sug.outId);
  return (
    <Modal title={`Sugestão de substituição — ${l.sim.minute}'`} size="narrow" onClose={() => { l.sim.rejectSuggestion(l.userSide); onDone(); }} footer={<>
      <button className="btn" onClick={() => { l.sim.rejectSuggestion(l.userSide); s.toast('Sugestão cancelada.'); onDone(); }}>Cancelar</button>
      <button className="btn primary" onClick={() => { const err = l.sim.acceptSuggestion(l.userSide, alt); if (err) s.toast(err, 'err'); onDone(); }}>Executar</button>
    </>}>
      <p className="small">{sug.reason}</p>
      {out && <div className="small muted">Condição de {out.p.name}: {Math.round(out.cond)}%</div>}
      <label className="field" style={{ marginTop: 8 }}><span>Quem entra</span>
        <select value={alt} onChange={(e) => setAlt(e.target.value)}>
          {bench.map((x) => <option key={x.p.id} value={x.p.id}>{x.p.pos} · {x.p.name} ({Math.round(ovrToLevel(x.p.ovr))}, {Math.round(x.cond)}%)</option>)}
        </select>
      </label>
    </Modal>
  );
}
