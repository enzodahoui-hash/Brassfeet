import { useState } from 'react';
import { store, useCareer, useGame } from '../store';
import { Modal, ClubName, Lvl } from '../components/common';
import { Crest } from '../components/graphics';
import { Icon } from '../components/Icon';
import { roundName } from '../../engine/competitions/manager';
import { repairLineup, validateLineup } from '../../engine/clubs/lineup';
import { fmtLong } from '../../engine/core/date';
import { acceptJob, jobOffers } from '../../engine/career/season';
import { levelLabel } from '../../engine/players/attributes';

export function PreMatch({ id }: { id: string }) {
  const s = useGame();
  const c = useCareer();
  const f = c.fixtures[id];
  if (!f) return null;
  const comp = c.competitions[f.compId];
  const user = c.clubs[c.userClubId];
  const oppId = f.home === user.id ? f.away : f.home;
  const opp = c.clubs[oppId];
  const lineupIssues = user.lineup ? validateLineup(c, user, user.lineup, user.tactics.formation, f.compId) : [{ level: 'error' as const, text: 'Nenhuma escalação definida: será usada a escalação automática.' }];
  const errors = lineupIssues.filter((i) => i.level === 'error');
  const preview = errors.length ? repairLineup(c, user, user.lineup, user.tactics.formation, f.compId).changed : [];
  const home = c.clubs[f.home];
  const away = c.clubs[f.away];
  return (
    <Modal title="Dia de jogo" onClose={() => { s.pendingMatch = null; s.bump(); }}>
      <div className="stack">
        <div className="muted small">{comp.name} · {roundName(c, f)} · {fmtLong(f.day)}{f.neutral ? ' · campo neutro' : ` · ${home.stadium.name}`}</div>
        <div className="row" style={{ justifyContent: 'space-around', gap: 20 }}>
          <div className="stack" style={{ alignItems: 'center' }}><Crest crest={home.crest} size={64} /><strong>{home.name}</strong><Lvl v={home.level} tip={levelLabel(home.level)} /></div>
          <div style={{ font: '700 28px var(--f-display)' }}>×</div>
          <div className="stack" style={{ alignItems: 'center' }}><Crest crest={away.crest} size={64} /><strong>{away.name}</strong><Lvl v={away.level} tip={levelLabel(away.level)} /></div>
        </div>
        {f.derby && <div className="chip warn">Clássico! Estádio cheio e jogo mais nervoso.</div>}
        {errors.length > 0 && (
          <div className="panel" style={{ padding: 10 }}>
            <strong className="warn">Ajustes automáticos na escalação:</strong>
            <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{errors.map((e, i) => <li key={i}>{e.text}</li>)}{preview.map((p, i) => <li key={`p${i}`} className="muted">{p}</li>)}</ul>
          </div>
        )}
        <div className="small muted">Adversário: {opp.name} ({c.config.competitions[opp.divisionId]?.name}), forma recente e elenco na página do clube.</div>
        <div className="grid g3">
          <button className="choice" onClick={() => s.playQuick()}><span className="t"><Icon name="ff" /> Resultado rápido</span><span className="small muted">Simulação instantânea com relatório completo.</span></button>
          <button className="choice" onClick={() => s.startLive('live')}><span className="t"><Icon name="play" /> Ao vivo</span><span className="small muted">Minuto a minuto, com substituições e mudanças táticas.</span></button>
          <button className="choice" onClick={() => s.startLive('detailed')}><span className="t"><Icon name="news" /> Relato detalhado</span><span className="small muted">Comentários textuais de todos os lances.</span></button>
        </div>
        <div className="row"><button className="btn" onClick={() => { s.pendingMatch = null; s.go({ name: 'tactics' }); }}><Icon name="tactics" />Ajustar escalação antes</button><button className="btn ghost" onClick={() => { s.pendingMatch = null; s.go({ name: 'clubview', id: oppId }); }}>Analisar adversário</button></div>
      </div>
    </Modal>
  );
}

export function SeasonSummaryModal() {
  const s = useGame();
  const c = useCareer();
  const sum = s.seasonSummary!;
  return (
    <Modal title={`Fim da temporada ${sum.season}`} size="wide" onClose={() => { s.seasonSummary = null; s.bump(); }} footer={<button className="btn primary" onClick={() => { s.seasonSummary = null; s.bump(); }}>Seguir para {sum.season + 1}</button>}>
      <div className="grid g2">
        <div className="stack">
          <h3>{sum.userClubName}</h3>
          <div>{sum.userPosition ? `${sum.userPosition}º lugar na ${sum.userDivision}` : 'Campanha encerrada.'}</div>
          <div className="panel" style={{ padding: 10, whiteSpace: 'pre-line' }}><strong>Avaliação da diretoria</strong>{'\n'}{sum.boardVerdict}</div>
          <h4>Artilheiros</h4>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{sum.topScorers.slice(0, 10).map((t) => <li key={t.compName}>{t.compName}: <strong>{t.name}</strong> ({t.goals})</li>)}</ul>
        </div>
        <div className="stack">
          <h4>Campeões</h4>
          <div className="tbl-wrap" style={{ maxHeight: 280 }}>
            <table className="tbl"><tbody>{sum.champions.map((ch) => <tr key={ch.compTemplateId}><td>{ch.compName}</td><td><ClubName id={ch.clubId} /></td></tr>)}</tbody></table>
          </div>
          <h4>Acesso e rebaixamento</h4>
          <div className="small">Subiram: {sum.promoted.map((p) => c.clubs[p.clubId]?.short).join(', ') || '—'}</div>
          <div className="small">Caíram: {sum.relegated.map((p) => c.clubs[p.clubId]?.short).join(', ') || '—'}</div>
        </div>
      </div>
    </Modal>
  );
}

export function FiredModal() {
  const c = useCareer();
  const offers = jobOffers(c);
  return (
    <Modal title="Você foi demitido" onClose={() => undefined}>
      <div className="stack">
        <p>A diretoria do {c.clubs[c.userClubId].name} decidiu encerrar o seu trabalho. Alguns clubes demonstraram interesse:</p>
        {offers.map((id) => (
          <button key={id} className="choice" onClick={() => store.act((cc) => acceptJob(cc, id), `Bem-vindo ao ${c.clubs[id].name}!`)}>
            <span className="row"><Crest crest={c.clubs[id].crest} size={28} /><span className="t">{c.clubs[id].name}</span><Lvl v={c.clubs[id].level} size="sm" /></span>
            <span className="small muted">{c.config.competitions[c.clubs[id].divisionId]?.name}</span>
          </button>
        ))}
        {!offers.length && <p className="muted">Nenhuma proposta no momento. Volte ao menu e comece uma nova carreira.</p>}
      </div>
    </Modal>
  );
}

const TUTORIAL = [
  ['Bem-vindo ao comando', 'Você é o treinador e gestor do clube. O cabeçalho mostra data, saldo e a confiança da diretoria.'],
  ['Avance o calendário', 'Use "Continuar" (ou a tecla espaço) para ir até o próximo jogo. "Dia" avança um único dia. O jogo para quando há decisões importantes.'],
  ['Monte o time', 'Em Táticas, escolha a formação, clique em dois jogadores para trocá-los e ajuste mentalidade, pressão e linha defensiva. Cada escolha muda a simulação.'],
  ['Gerencie o clube', 'Mercado, Base, Finanças, Infraestrutura, Estádio e Uniformes têm custos e efeitos reais. Tudo fica no mesmo estado da carreira e é salvo automaticamente.'],
  ['Universo vivo', 'Ligas da América do Sul e da Europa, continentais, prêmios como a Bola de Ouro e estrelas de artilharia acontecem com base no que é simulado.'],
];

export function Tutorial() {
  const c = useCareer();
  const [i, setI] = useState(0);
  const done = () => store.act((cc) => { cc.tutorialDone = true; });
  return (
    <Modal title={`${TUTORIAL[i][0]} (${i + 1}/${TUTORIAL.length})`} size="narrow" onClose={done} footer={<><button className="btn ghost" onClick={done}>Pular tutorial</button>{i < TUTORIAL.length - 1 ? <button className="btn primary" onClick={() => setI(i + 1)}>Próximo</button> : <button className="btn go" onClick={done}>Começar</button>}</>}>
      <p style={{ margin: 0 }}>{TUTORIAL[i][1]}</p>
      {i === 0 && <p className="small muted">Objetivo principal: {c.clubs[c.userClubId].board.objectives[0]?.label}.</p>}
    </Modal>
  );
}
