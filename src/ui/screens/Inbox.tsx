import { useState } from 'react';
import type { NewsItem } from '../../engine/types';
import { store, useCareer, useGame } from '../store';
import { Panel, PageHead, Tabs } from '../components/common';
import { Icon } from '../components/Icon';
import { fmtShort } from '../../engine/core/date';
import { resolveDecision, pendingDecisions } from '../../engine/career/decisions';

const ICONS: Record<string, string> = { transfer: 'transfer', injury: 'injury', trophy: 'trophy', board: 'board', youth: 'youth', money: 'money', award: 'award', match: 'ball', star: 'star', retire: 'retire', stadium: 'stadium', kit: 'shirt', continental: 'continental', warning: 'warn', calendar: 'calendar', staff: 'staff' };
const COLORS: Record<string, string> = { injury: 'var(--loss)', trophy: 'var(--gold)', award: 'var(--gold)', star: 'var(--gold)', warning: 'var(--draw)', money: 'var(--win)', continental: '#ff6b6b', transfer: 'var(--info)' };

export function NewsList({ items }: { items: NewsItem[] }) {
  if (!items.length) return <div className="empty">Sem notícias.</div>;
  return (
    <div className="news">
      {items.map((n) => (
        <div key={n.id} className={`news-item ${n.important ? 'imp' : ''} ${n.link ? 'link' : ''}`} onClick={() => store.openNews(n)}>
          <div className="ic" style={{ color: COLORS[n.icon] ?? 'var(--text-2)' }}><Icon name={ICONS[n.icon] ?? 'news'} /></div>
          <div>
            <div className="t">{n.title}</div>
            <div className="b">{n.body}</div>
          </div>
          <div className="d">{fmtShort(n.day)}</div>
        </div>
      ))}
    </div>
  );
}

export function Inbox() {
  useGame();
  const c = useCareer();
  const [tab, setTab] = useState<'club' | 'all' | 'decisions'>(pendingDecisions(c).length ? 'decisions' : 'club');
  const decisions = c.inbox;
  const items = tab === 'club' ? c.news.filter((n) => n.clubIds.includes(c.userClubId) || n.important) : c.news;
  return (
    <div className="page">
      <PageHead title="Notícias e decisões" sub="Tudo aqui é gerado pelos acontecimentos da simulação." />
      <Tabs tabs={[{ id: 'decisions', label: `Decisões (${pendingDecisions(c).length})` }, { id: 'club', label: 'Meu clube' }, { id: 'all', label: 'Todo o universo' }]} value={tab} onChange={setTab} />
      {tab === 'decisions' ? (
        <div className="stack">
          {decisions.length === 0 && <div className="empty">Nenhuma decisão no momento.</div>}
          {decisions.map((d) => (
            <Panel key={d.id} title={d.title} right={<span className="small muted">{fmtShort(d.day)}</span>}>
              <p style={{ marginTop: 0 }}>{d.text}</p>
              {d.resolved ? (
                <div className="chip">Decidido: {d.options.find((o) => d.resolved?.startsWith(o.id))?.label ?? d.resolved}</div>
              ) : (
                <div className="row">
                  {d.options.map((o) => (
                    <button key={o.id} className="btn" onClick={() => store.act((cc) => { store.toast(resolveDecision(cc, d.id, o.id)); })}>{o.label}{o.hint && <span className="muted small"> ({o.hint})</span>}</button>
                  ))}
                  {d.playerId && c.players[d.playerId] && <button className="btn ghost" onClick={() => store.go({ name: 'player', id: d.playerId })}>Ver jogador</button>}
                  {d.expires && <span className="small muted">Prazo: {fmtShort(d.expires)}</span>}
                </div>
              )}
            </Panel>
          ))}
        </div>
      ) : (
        <Panel flush><NewsList items={items.slice(0, 200)} /></Panel>
      )}
    </div>
  );
}
