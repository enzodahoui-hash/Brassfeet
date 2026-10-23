import { useEffect } from 'react';
import { useGame, type ScreenName } from './store';
import { Icon, BrandMark } from './components/Icon';
import { Crest } from './components/graphics';
import { Toasts, Money } from './components/common';
import { fmtLong } from '../engine/core/date';
import { userFixtureToday } from '../engine/career/advance';
import { pendingDecisions } from '../engine/career/decisions';
import { StartScreen } from './screens/Start';
import { Home } from './screens/Home';
import { Inbox } from './screens/Inbox';
import { Squad } from './screens/Squad';
import { PlayerPage } from './screens/Player';
import { Youth } from './screens/Youth';
import { Tactics } from './screens/Tactics';
import { Matches, MatchReport } from './screens/Matches';
import { Live } from './screens/Live';
import { Comps, CompPage } from './screens/Comps';
import { Market } from './screens/Market';
import { Finance } from './screens/Finance';
import { Infra } from './screens/Infra';
import { StadiumPage } from './screens/Stadium';
import { Kits } from './screens/Kits';
import { StaffPage } from './screens/Staff';
import { Awards } from './screens/Awards';
import { History } from './screens/History';
import { Creator } from './screens/Creator';
import { Editor } from './screens/Editor';
import { Saves } from './screens/Saves';
import { ClubView } from './screens/ClubView';
import { PreMatch, SeasonSummaryModal, FiredModal, Tutorial } from './screens/Modals';
import { AccountModal } from './screens/Account';

const NAV: { group: string; items: { id: ScreenName; label: string; icon: string }[] }[] = [
  { group: 'Clube', items: [
    { id: 'home', label: 'Visão geral', icon: 'home' }, { id: 'inbox', label: 'Notícias e decisões', icon: 'news' }, { id: 'squad', label: 'Elenco profissional', icon: 'squad' },
    { id: 'youth', label: 'Base', icon: 'youth' }, { id: 'tactics', label: 'Táticas', icon: 'tactics' }, { id: 'matches', label: 'Partidas', icon: 'calendar' }, { id: 'comps', label: 'Competições', icon: 'trophy' },
  ] },
  { group: 'Gestão', items: [
    { id: 'market', label: 'Mercado', icon: 'market' }, { id: 'finance', label: 'Finanças', icon: 'money' }, { id: 'infra', label: 'Infraestrutura', icon: 'building' },
    { id: 'stadium', label: 'Estádio', icon: 'stadium' }, { id: 'kits', label: 'Uniformes', icon: 'shirt' }, { id: 'staff', label: 'Comissão técnica', icon: 'staff' },
  ] },
  { group: 'Universo', items: [
    { id: 'awards', label: 'Prêmios', icon: 'award' }, { id: 'history', label: 'Histórico', icon: 'history' }, { id: 'creator', label: 'Criador de Craques', icon: 'wand' },
    { id: 'editor', label: 'Editor do Universo', icon: 'editor' }, { id: 'saves', label: 'Salvamentos', icon: 'save' },
  ] },
];

function Screen() {
  const s = useGame();
  const r = s.route;
  switch (r.name) {
    case 'home': return <Home />;
    case 'inbox': return <Inbox />;
    case 'squad': return <Squad />;
    case 'player': return <PlayerPage id={r.id!} />;
    case 'youth': return <Youth />;
    case 'tactics': return <Tactics />;
    case 'matches': return <Matches />;
    case 'match': return <MatchReport id={r.id!} tab={r.tab} />;
    case 'live': return <Live />;
    case 'comps': return <Comps />;
    case 'comp': return <CompPage id={r.id!} />;
    case 'market': return <Market />;
    case 'finance': return <Finance />;
    case 'infra': return <Infra />;
    case 'stadium': return <StadiumPage />;
    case 'kits': return <Kits />;
    case 'staff': return <StaffPage />;
    case 'awards': return <Awards id={r.id} />;
    case 'history': return <History />;
    case 'creator': return <Creator />;
    case 'editor': return <Editor />;
    case 'saves': return <Saves />;
    case 'clubview': return <ClubView id={r.id!} />;
    default: return <Home />;
  }
}

function Shell() {
  const s = useGame();
  const c = s.career!;
  const club = c.clubs[c.userClubId];
  const decisions = pendingDecisions(c).length;
  const offers = c.offers.filter((o) => o.status === 'pending').length;
  const todayMatch = userFixtureToday(c);
  const badge: Partial<Record<ScreenName, number>> = { inbox: decisions, market: offers, youth: c.intakeCandidates.length };
  const inLive = s.route.name === 'live';
  const playNow = !!(todayMatch || s.pendingMatch);
  const closeMenu = () => { s.menuOpen = false; s.bump(); };
  const moreBadge = decisions + offers + c.intakeCandidates.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Escape' && s.menuOpen) closeMenu();
      if (e.key === ' ' && !s.live && !s.busy) {
        e.preventDefault();
        void s.advance('next');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  return (
    <div className="app">
      <aside className={`side ${s.menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">{c.config.gameName}</div>
            <div className="brand-sub">Temporada {c.season}</div>
          </div>
          <button className="icon-btn side-close" style={{ display: 'none' }} onClick={closeMenu} aria-label="Fechar menu"><Icon name="close" /></button>
        </div>
        <nav className="nav" aria-label="Menu principal">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items.map((it) => (
                <button key={it.id} className={s.route.name === it.id ? 'on' : ''} onClick={() => s.go({ name: it.id })} disabled={inLive}>
                  <Icon name={it.icon} />
                  {it.label}
                  {(badge[it.id] ?? 0) > 0 && <span className="badge">{badge[it.id]}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="nav-group">Sessão</div>
          <button onClick={() => void s.save(true)} disabled={s.saving || inLive}><Icon name="save" />{s.saving ? 'Salvando…' : 'Salvar agora'}</button>
          {s.installPrompt && <button onClick={() => void s.installApp()}><Icon name="download" />Instalar aplicativo</button>}
          <button onClick={() => s.closeCareer()} disabled={inLive}><Icon name="back" />Menu inicial</button>
        </nav>
      </aside>
      {s.menuOpen && <div className="scrim" onClick={closeMenu} aria-hidden="true" />}
      <header className="top">
        <button className="icon-btn menu-toggle" onClick={() => { s.menuOpen = !s.menuOpen; s.bump(); }} aria-label="Abrir menu" aria-expanded={s.menuOpen}><Icon name="menu" /></button>
        <div className="top-club" onClick={() => s.go({ name: 'home' })} style={{ cursor: 'pointer' }}>
          <Crest crest={club.crest} size={34} />
          <div style={{ minWidth: 0 }}>
            <div className="name">{club.name}</div>
            <div className="div">{c.config.competitions[club.divisionId]?.name} · {fmtLong(c.day)}</div>
          </div>
        </div>
        <div className="top-stats">
          <div className="stat-mini hide-m"><span className="k">Saldo</span><span className="v"><Money v={club.balance} color /></span></div>
          <div className="stat-mini hide-m"><span className="k">Diretoria</span><span className="v" style={{ color: club.board.confidence < 30 ? 'var(--loss)' : club.board.confidence < 55 ? 'var(--draw)' : 'var(--win)' }}>{Math.round(club.board.confidence)}%</span></div>
          {!inLive && (
            <div className="row tight advance-top" style={{ flexWrap: 'nowrap' }}>
              <button className="btn hide-m" onClick={() => void s.advance('day')} disabled={!!s.busy} title="Avançar um dia"><Icon name="day" />Dia</button>
              <button className={`btn ${todayMatch || s.pendingMatch ? 'go' : 'primary'}`} onClick={() => void s.advance('next')} disabled={!!s.busy} title="Avançar até o próximo jogo (atalho: espaço)">
                <Icon name={todayMatch || s.pendingMatch ? 'ball' : 'ff'} />
                {todayMatch || s.pendingMatch ? 'Jogar partida' : 'Continuar'}
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="main">
        <Screen />
      </main>
      {!inLive && (
        <nav className="bottom-nav" aria-label="Atalhos">
          {([['home', 'Início', 'home'], ['squad', 'Elenco', 'squad']] as const).map(([id, label, icon]) => (
            <button key={id} className={s.route.name === id ? 'on' : ''} onClick={() => s.go({ name: id })}><Icon name={icon} />{label}</button>
          ))}
          <button className={`advance ${playNow ? 'go' : ''}`} onClick={() => void s.advance('next')} disabled={!!s.busy} aria-label={playNow ? 'Jogar partida' : 'Continuar'}>
            <Icon name={playNow ? 'ball' : 'ff'} />{playNow ? 'Jogar' : 'Continuar'}
          </button>
          <button className={s.route.name === 'tactics' ? 'on' : ''} onClick={() => s.go({ name: 'tactics' })}><Icon name="tactics" />Táticas</button>
          <button className={s.menuOpen ? 'on' : ''} onClick={() => { s.menuOpen = true; s.bump(); }} aria-label="Mais opções"><Icon name="menu" />Mais{moreBadge > 0 && <span className="badge">{moreBadge}</span>}</button>
        </nav>
      )}
      {s.pendingMatch && !s.live && <PreMatch id={s.pendingMatch} />}
      {s.seasonSummary && <SeasonSummaryModal />}
      {c.firedPending && !s.seasonSummary && <FiredModal />}
      {!c.tutorialDone && !s.pendingMatch && <Tutorial />}
      {s.busy && (
        <div className="progress-overlay"><span className="spinner" />{s.busy}<button className="btn sm ghost" onClick={() => s.stop()}>Parar</button></div>
      )}
    </div>
  );
}

export function App() {
  const s = useGame();
  useEffect(() => {
    void s.initAccount();
  }, [s]);
  return (
    <>
      {s.career ? <Shell /> : <StartScreen />}
      {!s.career && s.busy && <div className="progress-overlay"><span className="spinner" />{s.busy}</div>}
      {s.accountModal && <AccountModal />}
      <Toasts />
    </>
  );
}
