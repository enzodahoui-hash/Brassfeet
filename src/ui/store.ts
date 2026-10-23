import { useSyncExternalStore } from 'react';
import type { Career, NewsItem, SeasonSummary, World } from '../engine/types';
import { buildDefaultWorld } from '../engine/universe/world';
import { newCareer, type NewCareerOptions } from '../engine/career/create';
import { advanceDay, userFixtureToday, type AdvanceResult } from '../engine/career/advance';
import { createLiveMatch, finishLiveMatch, playFixture } from '../engine/career/matches';
import { MatchSim, type MatchOutcome } from '../engine/match/engine';
import { SaveManager, idbKV, memoryKV, type KV, type SaveMeta, type UniverseMeta } from '../engine/save/storage';
import { remoteKV } from '../engine/save/remote';
import * as api from './account';
import { pendingDecisions } from '../engine/career/decisions';
import { fmtShort } from '../engine/core/date';

export type ScreenName =
  | 'home' | 'inbox' | 'squad' | 'player' | 'youth' | 'tactics' | 'matches' | 'match' | 'comps' | 'comp' | 'market' | 'finance' | 'infra'
  | 'stadium' | 'kits' | 'staff' | 'awards' | 'history' | 'creator' | 'editor' | 'saves' | 'live' | 'club' | 'clubview';

export interface Route {
  name: ScreenName;
  id?: string;
  tab?: string;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'err' | 'warn';
}

export interface LiveState {
  sim: MatchSim;
  fixtureId: string;
  mode: 'live' | 'detailed';
  speed: number;
  running: boolean;
  userSide: 0 | 1;
  outcome?: MatchOutcome;
  changes: string[];
}

export interface Settings {
  autosaveDays: number;
  stopOnDecisions: boolean;
  userAutoSubs: boolean;
}

const SETTINGS_KEY = 'fmbr-settings';
function loadSettings(): Settings {
  const def: Settings = { autosaveDays: 7, stopOnDecisions: true, userAutoSubs: true };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return def;
  }
}

class GameStore {
  career: Career | null = null;
  route: Route = { name: 'home' };
  stack: Route[] = [];
  version = 0;
  busy: string | null = null;
  toasts: Toast[] = [];
  pendingMatch: string | null = null;
  live: LiveState | null = null;
  lastSaved: number | null = null;
  lastSaveDay = 0;
  saving = false;
  saves: SaveMeta[] = [];
  universes: UniverseMeta[] = [];
  sm: SaveManager;
  storageOk = true;
  menuOpen = false;
  seasonSummary: SeasonSummary | null = null;
  settings: Settings = loadSettings();
  editorWorld: World | null = null;
  /** Conta conectada (null = jogando sem conta, salvando só neste navegador). */
  account: api.Account | null = null;
  /** Servidor de contas disponível (false no arquivo único / hospedagem estática). */
  server: api.Health | null = null;
  accountModal: null | 'login' | 'register' | 'forgot' | 'reset' | 'manage' = null;
  resetToken: string | null = null;
  private localKV: KV;
  private listeners = new Set<() => void>();
  private defaultWorldCache: World | null = null;
  private stopFlag = false;

  constructor() {
    let kv;
    try {
      kv = typeof indexedDB !== 'undefined' ? idbKV() : memoryKV();
    } catch {
      kv = memoryKV();
      this.storageOk = false;
    }
    this.localKV = kv;
    this.sm = new SaveManager(kv);
  }

  // ───── contas ─────
  /** Detecta o servidor, restaura a sessão e trata links de verificação e redefinição de senha. */
  async initAccount(): Promise<void> {
    const params = new URLSearchParams(location.search);
    const reset = params.get('redefinir');
    const verified = params.get('verificado');
    if (reset || verified) history.replaceState(null, '', location.pathname);
    this.server = await api.health();
    if (this.server) {
      const user = await api.me();
      if (user) this.useAccount(user);
    }
    if (reset) {
      this.resetToken = reset;
      this.accountModal = 'reset';
    }
    if (verified === '1') this.toast('E-mail confirmado. Obrigado!');
    if (verified === '0') this.toast('Link de confirmação inválido ou expirado. Peça outro em "Minha conta".', 'warn');
    await this.refreshLists();
  }

  useAccount(user: api.Account | null): void {
    this.account = user;
    this.sm = new SaveManager(user ? remoteKV() : this.localKV);
    this.bump();
  }

  async signOut(): Promise<void> {
    if (this.career) await this.save(false);
    await api.logout().catch(() => undefined);
    this.useAccount(null);
    this.closeCareer();
    this.toast('Você saiu da conta. Os salvamentos da conta continuam guardados no servidor.');
  }

  /** Copia os salvamentos deste navegador para a conta (não apaga os locais). */
  async uploadLocalSaves(): Promise<number> {
    if (!this.account) return 0;
    const remote = remoteKV();
    let n = 0;
    for (const store of ['careers', 'universes']) {
      for (const rec of await this.localKV.list(store)) {
        await remote.put(store, rec);
        n++;
      }
    }
    await this.refreshLists();
    return n;
  }

  async localSaveCount(): Promise<number> {
    try {
      return (await this.localKV.list('careers')).length + (await this.localKV.list('universes')).length;
    } catch {
      return 0;
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  bump(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  // ───── navegação ─────
  go(route: Route, replace = false): void {
    if (!replace && (this.route.name !== route.name || this.route.id !== route.id)) this.stack.push(this.route);
    if (this.stack.length > 40) this.stack.shift();
    this.route = route;
    this.menuOpen = false;
    this.bump();
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }
  back(): void {
    const r = this.stack.pop();
    if (r) {
      this.route = r;
      this.bump();
    }
  }
  openNews(n: NewsItem): void {
    if (!n.link) return;
    const map: Record<string, ScreenName> = { club: 'home', comp: 'comp', player: 'player', match: 'match', awards: 'awards', market: 'market', youth: 'youth', finance: 'finance', stadium: 'stadium', infra: 'infra', kits: 'kits', squad: 'squad', editor: 'editor', history: 'history' };
    const name = map[n.link.screen] ?? 'home';
    this.go({ name, id: n.link.id });
  }

  toast(text: string, kind: Toast['kind'] = 'ok'): void {
    const id = Date.now() + Math.random();
    this.toasts.push({ id, text, kind });
    this.bump();
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.bump();
    }, kind === 'err' ? 6500 : 4200);
  }

  saveSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* preferências locais são opcionais */
    }
    this.bump();
  }

  /** Executa uma ação do domínio sobre a carreira e atualiza a tela; erros viram aviso. */
  act<T>(fn: (c: Career) => T, okMsg?: string | ((r: T) => string | null)): T | undefined {
    const c = this.career;
    if (!c) return undefined;
    try {
      const r = fn(c);
      if (typeof r === 'string' && r) this.toast(r, 'err');
      else if (okMsg) {
        const m = typeof okMsg === 'function' ? okMsg(r) : okMsg;
        if (m) this.toast(m);
      }
      this.bump();
      return r;
    } catch (e) {
      this.toast((e as Error).message, 'err');
      return undefined;
    }
  }

  // ───── universo / carreira ─────
  defaultWorld(): World {
    this.defaultWorldCache ??= buildDefaultWorld();
    return this.defaultWorldCache;
  }

  async refreshLists(): Promise<void> {
    try {
      this.saves = await this.sm.listCareers();
      this.universes = await this.sm.listUniverses();
    } catch (e) {
      this.storageOk = false;
      this.toast(`Armazenamento local indisponível: ${(e as Error).message}. O jogo funciona, mas o progresso não será salvo.`, 'warn');
    }
    this.bump();
  }

  async startCareer(world: World, opts: NewCareerOptions): Promise<void> {
    this.busy = 'Montando o universo e o calendário…';
    this.bump();
    await tick();
    try {
      const c = newCareer(world, opts);
      this.career = c;
      this.route = { name: 'home' };
      this.stack = [];
      this.busy = null;
      this.bump();
      await this.save(false);
    } catch (e) {
      this.busy = null;
      this.toast((e as Error).message, 'err');
    }
  }

  async loadCareer(id: string): Promise<void> {
    this.busy = 'Carregando carreira…';
    this.bump();
    await tick();
    try {
      const { career, recovered, migratedFrom } = await this.sm.loadCareer(id);
      this.career = career;
      this.route = { name: 'home' };
      this.stack = [];
      this.lastSaveDay = career.day;
      if (recovered) this.toast('O salvamento principal estava danificado: a cópia de segurança foi restaurada.', 'warn');
      if (migratedFrom) this.toast(`Salvamento atualizado do formato ${migratedFrom} para o atual. Seus dados foram preservados.`, 'warn');
      const uf = userFixtureToday(career);
      this.pendingMatch = uf?.id ?? null;
    } catch (e) {
      this.toast((e as Error).message, 'err');
    }
    this.busy = null;
    this.bump();
  }

  closeCareer(): void {
    this.career = null;
    this.pendingMatch = null;
    this.live = null;
    this.route = { name: 'home' };
    void this.refreshLists();
    this.bump();
  }

  async save(manual = true): Promise<void> {
    const c = this.career;
    if (!c || this.saving) return;
    this.saving = true;
    this.bump();
    await tick();
    try {
      await this.sm.saveCareer(c);
      this.lastSaved = Date.now();
      this.lastSaveDay = c.day;
      if (manual) this.toast('Carreira salva.');
    } catch (e) {
      this.toast(`Falha ao salvar: ${(e as Error).message}. Tente exportar a carreira como arquivo.`, 'err');
    }
    this.saving = false;
    this.bump();
  }

  // ───── avanço do tempo ─────
  stop(): void {
    this.stopFlag = true;
  }

  /** Avança o calendário. O bloqueio impede cliques repetidos de avançar duas vezes. */
  async advance(kind: 'day' | 'next'): Promise<void> {
    const c = this.career;
    if (!c || this.busy || this.live) return;
    if (c.firedPending) {
      this.go({ name: 'home' });
      return;
    }
    const pending = userFixtureToday(c);
    if (pending) {
      this.pendingMatch = pending.id;
      this.bump();
      return;
    }
    this.stopFlag = false;
    this.busy = 'Avançando…';
    this.bump();
    const startDecisions = pendingDecisions(c).length;
    const startOffers = c.offers.filter((o) => o.status === 'pending').length;
    let last: AdvanceResult = { status: 'ok', events: [] };
    const max = kind === 'day' ? 1 : 70;
    for (let i = 0; i < max; i++) {
      last = advanceDay(c);
      this.busy = `Simulando ${fmtShort(c.day)}…`;
      if (i % 2 === 0) {
        this.bump();
        await tick();
      }
      if (last.status !== 'ok' || this.stopFlag) break;
      if (kind === 'next' && this.settings.stopOnDecisions && (pendingDecisions(c).length > startDecisions || c.offers.filter((o) => o.status === 'pending').length > startOffers)) {
        this.toast('Há novidades que pedem sua decisão.', 'warn');
        break;
      }
    }
    this.busy = null;
    await this.handleResult(last);
    this.bump();
    if (c.day - this.lastSaveDay >= this.settings.autosaveDays) await this.save(false);
  }

  private async handleResult(r: AdvanceResult): Promise<void> {
    const c = this.career!;
    if (r.status === 'user_match' && r.fixtureId) this.pendingMatch = r.fixtureId;
    if (r.status === 'season_end') {
      this.seasonSummary = c.seasonHistory[c.seasonHistory.length - 1] ?? null;
      await this.save(false);
    }
    if (r.status === 'fired') {
      this.seasonSummary = c.seasonHistory[c.seasonHistory.length - 1] ?? null;
      await this.save(false);
    }
    if (r.status === 'new_season') {
      this.toast(`Temporada ${c.season} começou!`);
      if (r.fixtureId) this.pendingMatch = r.fixtureId;
    }
  }

  // ───── partida do usuário ─────
  playQuick(): void {
    const c = this.career;
    const id = this.pendingMatch;
    if (!c || !id) return;
    const f = c.fixtures[id];
    playFixture(c, f, true);
    this.pendingMatch = null;
    this.go({ name: 'match', id });
    void this.save(false);
  }

  startLive(mode: 'live' | 'detailed'): void {
    const c = this.career;
    const id = this.pendingMatch;
    if (!c || !id) return;
    const f = c.fixtures[id];
    const { sim, changes } = createLiveMatch(c, f);
    const userSide = f.home === c.userClubId ? 0 : 1;
    this.live = { sim, fixtureId: id, mode, speed: mode === 'detailed' ? 0 : 1, running: mode === 'live', userSide, changes };
    this.pendingMatch = null;
    if (mode === 'detailed') {
      sim.setConfirm(userSide, false);
      sim.runToEnd();
      this.finishLive();
      this.go({ name: 'match', id, tab: 'relato' });
      return;
    }
    this.go({ name: 'live' });
  }

  finishLive(): void {
    const c = this.career;
    const l = this.live;
    if (!c || !l) return;
    const f = c.fixtures[l.fixtureId];
    if (f.status !== 'played') l.outcome = finishLiveMatch(c, f, l.sim);
    this.bump();
    void this.save(false);
  }

  closeLive(): void {
    const id = this.live?.fixtureId;
    this.live = null;
    if (id) this.go({ name: 'match', id }, true);
  }
}

export const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export const store = new GameStore();

/** Assina o estado do jogo: o componente re-renderiza a cada mudança. */
export function useGame(): GameStore {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

export function useCareer(): Career {
  const s = useGame();
  if (!s.career) throw new Error('Nenhuma carreira ativa.');
  return s.career;
}
