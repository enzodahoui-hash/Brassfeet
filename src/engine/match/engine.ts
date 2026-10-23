// Motor de partidas próprio. Cada minuto é simulado com probabilidades derivadas de atributos, táticas,
// condição física, moral, entrosamento e fator casa. Os dois times usam exatamente a mesma lógica.
// A semente registrada no jogo + as intervenções (substituições/táticas) reproduzem o mesmo resultado.

import type { CardEv, GoalEv, MatchEvent, MatchStats, Player, Pos, SubLog, SubPlan, SubRegulation, SubRule, Tactics } from '../types';
import { Rng, clamp, hashString } from '../core/rng';
import { A, POS_LINE } from '../players/attributes';
import { slotRating } from '../clubs/lineup';
import { traitEffects, type TraitEffects } from '../players/traits';
import { styleMatch } from '../players/styles';
import { DEFAULT_REG, ROLE_DEMAND, ROLE_NAME, defaultSubPlan, roleGoal } from './subs';

export interface SideInput {
  clubId: string;
  name: string;
  short: string;
  starters: Player[];
  slots: Pos[];
  bench: Player[];
  tactics: Tactics;
  cohesion: number;
  homeFactor: number;
  autoSubs: boolean; // legado: equivale a plano diferente de "manual"
  analysis?: number; // 0..1 bônus de análise de desempenho
  plan?: SubPlan; // substituições automáticas (clube do usuário); IA usa o modo inteligente
  reg?: SubRegulation; // regulamento de substituições da competição
  confirm?: boolean; // partida ao vivo: sugestões aguardam confirmação do usuário
}

export interface MatchInput {
  seed: number;
  home: SideInput;
  away: SideInput;
  neutral: boolean;
  importance: number;
  bigGame: boolean;
  derby: boolean;
  needWinner: boolean;
  aggregate?: [number, number];
  awayPrev?: [number, number];
  awayGoals?: boolean;
  extraTime: boolean;
  penalties: boolean;
  pitch: number; // 0..1
  detail: boolean;
}

interface PS {
  p: Player;
  slot: Pos;
  side: 0 | 1;
  on: boolean;
  started: boolean;
  inMin: number;
  outMin: number | null;
  cond: number;
  yellow: number;
  red: boolean;
  injured: boolean;
  goals: number;
  assists: number;
  shots: number;
  sot: number;
  saves: number;
  tackles: number;
  keyPasses: number;
  fouls: number;
  errors: number;
  conceded: number;
  rating: number;
  interceptions: number;
  clearances: number;
  blocks: number;
  fouled: number;
  offsides: number;
  errGoal: number;
  penScored: number;
  penMissed: number;
  penSaved: number;
  xg: number;
  concOn: number;
  possAcc: number;
  dayForm: number;
  te: TraitEffects;
  sm: ReturnType<typeof styleMatch>;
}

interface Str {
  atk: number;
  mid: number;
  def: number;
  gk: number;
  pace: number;
  aerial: number;
  dribble: number;
  passing: number;
}

interface TS {
  side: 0 | 1;
  input: SideInput;
  ps: PS[];
  tactics: Tactics;
  subs: number;
  windows: number;
  str: Str;
  dirty: boolean;
  poss: number;
  shots: number;
  sot: number;
  corners: number;
  fouls: number;
  saves: number;
  offsides: number;
  yellows: number;
  reds: number;
  xg: number;
  bigChances: number;
  recoveries: number;
  aiAdjusted: number;
  windowsUsed: number;
  lastWindowTick: number;
  fired: Set<string>;
  cooldown: Record<string, number>;
  pending: SubSuggestion | null;
  offDone: boolean;
  protDone: boolean;
  reorg: Pos | null;
}

export interface SubSuggestion {
  outId: string;
  inId: string;
  slot: Pos;
  reason: string;
  kind: 'injury' | 'rule' | 'fatigue' | 'yellow' | 'offense' | 'protect' | 'reorg';
  ruleId?: string;
  urgent?: boolean;
}

export interface SubsInfo {
  made: number;
  max: number;
  windowsUsed: number;
  windows: number;
  interval: boolean;
  windowOpen: boolean; // há uma interrupção em andamento (trocas extras no mesmo minuto não gastam nova oportunidade)
}

export interface PlayerLine {
  pid: string;
  side: 0 | 1;
  started: boolean;
  minutes: number;
  goals: number;
  assists: number;
  rating: number;
  yellow: number;
  red: boolean;
  shots: number;
  saves: number;
  conceded: number;
  cleanSheet: boolean;
  condAfter: number;
  injured: boolean;
  slot: Pos;
  sot: number;
  xg: number;
  keyPasses: number;
  passes: number;
  passesOk: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  blocks: number;
  fouls: number;
  fouled: number;
  offsides: number;
  errGoal: number;
  penScored: number;
  penMissed: number;
  penSaved: number;
  concededOn: number;
}

export interface MatchOutcome {
  hg: number;
  ag: number;
  et: boolean;
  pens?: [number, number];
  goals: GoalEv[];
  cards: CardEv[];
  stats: MatchStats;
  events: MatchEvent[];
  report: string[];
  motm: string;
  lines: PlayerLine[];
  subs: SubLog[];
  injuries: { pid: string; club: string; min: number }[];
  lineups: [string[], string[]];
  interventions: number;
}

const WA: Record<Pos, number> = { ST: 1, RW: 0.9, LW: 0.9, AM: 0.85, RM: 0.6, LM: 0.6, CM: 0.4, DM: 0.15, RB: 0.25, LB: 0.25, CB: 0.05, GK: 0 };
const WM: Record<Pos, number> = { CM: 1, DM: 0.9, AM: 0.9, RM: 0.7, LM: 0.7, RW: 0.35, LW: 0.35, ST: 0.2, RB: 0.3, LB: 0.3, CB: 0.15, GK: 0.05 };
const WD: Record<Pos, number> = { CB: 1, RB: 0.8, LB: 0.8, DM: 0.75, CM: 0.35, RM: 0.3, LM: 0.3, AM: 0.1, RW: 0.1, LW: 0.1, ST: 0.05, GK: 0 };
const REF_A = 4.6, REF_M = 4.7, REF_D = 5.0;

const PASS_W: Record<Pos, number> = { GK: 0.45, CB: 1.05, RB: 1.0, LB: 1.0, DM: 1.3, CM: 1.25, AM: 1.05, RM: 0.95, LM: 0.95, RW: 0.75, LW: 0.75, ST: 0.55 };

const pick = <T,>(rng: Rng, arr: T[]) => arr[Math.floor(rng.next() * arr.length)];
const lastName = (p: Player) => p.name;

export class MatchSim {
  readonly input: MatchInput;
  rng: Rng;
  minute = 0;
  added1 = 0;
  added2 = 0;
  phase: 'pre' | 'h1' | 'ht' | 'h2' | 'et1' | 'et2' | 'pens' | 'done' = 'pre';
  score: [number, number] = [0, 0];
  etScore: [number, number] = [0, 0];
  pens?: [number, number];
  teams: [TS, TS];
  events: MatchEvent[] = [];
  goals: GoalEv[] = [];
  cards: CardEv[] = [];
  subsLog: SubLog[] = [];
  tick = 0; // passos de jogo (identifica cada interrupção de forma única)
  atInterval = false; // intervalo, antes da prorrogação ou intervalo da prorrogação
  injuries: { pid: string; club: string; min: number }[] = [];
  interventions = 0;
  momentum = 0; // >0 mandante pressiona
  wentToET = false;

  constructor(input: MatchInput) {
    this.input = input;
    this.rng = new Rng(input.seed);
    this.teams = [this.makeTeam(0, input.home), this.makeTeam(1, input.away)];
    this.added1 = this.rng.int(0, 3);
    this.added2 = this.rng.int(2, 6);
  }

  private makeTeam(side: 0 | 1, s: SideInput): TS {
    const mk = (p: Player, slot: Pos, on: boolean): PS => {
      const te = traitEffects(p.traits);
      const sd = 0.05 * (1 - p.attrs[A.cns] / 160) * (1 - te.consistency * 2.5);
      let df = this.rng.normal(0, Math.max(0.012, sd));
      if (this.input.bigGame) df += te.bigGame;
      return {
        p, slot, side, on, started: on, inMin: on ? 0 : -1, outMin: null, cond: p.condition, yellow: 0, red: false, injured: false,
        goals: 0, assists: 0, shots: 0, sot: 0, saves: 0, tackles: 0, keyPasses: 0, fouls: 0, errors: 0, conceded: 0, rating: 6.2,
        interceptions: 0, clearances: 0, blocks: 0, fouled: 0, offsides: 0, errGoal: 0, penScored: 0, penMissed: 0, penSaved: 0, xg: 0, concOn: 0, possAcc: 0,
        dayForm: clamp(df, -0.12, 0.14), te, sm: styleMatch(p.style),
      };
    };
    const ps = s.starters.map((p, i) => mk(p, s.slots[i], true)).concat(s.bench.map((p) => mk(p, p.pos, false)));
    const t: TS = {
      side, input: s, ps, tactics: { ...s.tactics }, subs: 0, windows: 0, str: { atk: 1, mid: 1, def: 1, gk: 1, pace: 60, aerial: 60, dribble: 60, passing: 60 }, dirty: true,
      poss: 0, shots: 0, sot: 0, corners: 0, fouls: 0, saves: 0, offsides: 0, yellows: 0, reds: 0, xg: 0, bigChances: 0, recoveries: 0, aiAdjusted: 0,
      windowsUsed: 0, lastWindowTick: -1, fired: new Set(), cooldown: {}, pending: null, offDone: false, protDone: false, reorg: null,
    };
    return t;
  }

  on(t: TS): PS[] {
    return t.ps.filter((x) => x.on);
  }

  private eff(x: PS): number {
    const p = x.p;
    const base = slotRating(p, x.slot);
    const condF = 0.72 + 0.28 * (x.cond / 100);
    const moraleF = 0.94 + 0.12 * (p.morale / 100);
    const sharpF = 0.96 + 0.04 * (p.sharpness / 100);
    let pressure = 0;
    const diff = this.score[x.side] - this.score[1 - x.side];
    if (diff < 0 && this.minute > 60) pressure = x.te.pressure;
    return base * condF * moraleF * sharpF * (1 + x.dayForm + pressure);
  }

  private recompute(t: TS): void {
    const opp = this.teams[1 - t.side];
    let a = 0, m = 0, d = 0, gk = 0, pace = 0, aer = 0, dri = 0, pas = 0, n = 0;
    let gkFound = false;
    const on = this.on(t);
    for (const x of on) {
      const e = this.eff(x);
      a += WA[x.slot] * e;
      m += WM[x.slot] * e;
      d += WD[x.slot] * e;
      if (x.slot === 'GK') {
        gk = e;
        gkFound = true;
      } else {
        pace += (x.p.attrs[A.pac] + x.p.attrs[A.acc]) / 2;
        aer += (x.p.attrs[A.hea] + x.p.attrs[A.jum]) / 2 + (x.p.height - 180) * 0.4;
        dri += x.p.attrs[A.dri];
        pas += x.p.attrs[A.pas];
        n++;
      }
    }
    if (!gkFound) gk = 25;
    const tc = t.tactics;
    const cohesion = 0.96 + 0.08 * (t.input.cohesion / 100);
    const cap = on.find((x) => x.p.id === tc.captain);
    const capF = cap ? 1 + (cap.p.attrs[A.lea] - 50) / 2500 + cap.te.teamMorale * 0.2 : 1;
    const home = t.input.homeFactor;
    const ment = tc.mentality;
    const pressC = tc.pressing - 1;
    t.str = {
      atk: (a / REF_A) * cohesion * capF * home * (1 + 0.07 * ment) * (1 - 0.04 * (opp.tactics.pressing - 1)),
      mid: (m / REF_M) * cohesion * capF * home * (1 + 0.03 * pressC),
      def: (d / REF_D) * cohesion * capF * (1 + (home - 1) * 0.5) * (1 - 0.045 * ment),
      gk,
      pace: n ? pace / n : 50,
      aerial: n ? aer / n : 50,
      dribble: n ? dri / n : 50,
      passing: n ? pas / n : 50,
    };
    t.dirty = false;
  }

  private ensure(): void {
    for (const t of this.teams) if (t.dirty) this.recompute(t);
  }

  private ev(side: 0 | 1 | -1, type: string, text: string, pid?: string, big = false, pid2?: string): void {
    const min = this.displayMinute();
    if (!this.input.detail && !big && !['goal', 'card', 'sub', 'injury', 'pen', 'ht', 'ft', 'kick'].includes(type)) return;
    this.events.push({ min, side, type, text, pid, pid2, big });
  }

  displayMinute(): number {
    return this.minute;
  }

  /** Texto do momento da troca ("aos 67 minutos" ou "no intervalo"). */
  whenTxt(): string {
    return this.atInterval ? 'no intervalo' : `aos ${this.minute} minutos`;
  }

  /** Minuto de jogo para decisões: acréscimos do 1º tempo contam como 45 (não como 46, 47...). */
  gameMinute(): number {
    if (this.phase === 'h1') return Math.min(45, this.minute);
    if (this.atInterval) return this.minute + 1; // no intervalo vale o minuto seguinte (46 = "no intervalo")
    return this.minute;
  }

  get finished(): boolean {
    return this.phase === 'done';
  }

  /** Posse estimada de cada lado no minuto atual. */
  private possShare(t: TS, o: TS): number {
    const k = 2.2;
    let sh = Math.pow(t.str.mid, k) / (Math.pow(t.str.mid, k) + Math.pow(o.str.mid, k));
    const tc = t.tactics;
    sh += tc.passing === 'short' ? 0.035 * (t.str.passing / 70) : tc.passing === 'direct' ? -0.04 : 0;
    sh += (1 - tc.tempo) * 0.025;
    sh += (tc.pressing - 1) * 0.02;
    sh -= tc.counter ? 0.03 : 0;
    sh -= (o.tactics.pressing - 1) * 0.015;
    sh += tc.mentality * 0.012;
    return clamp(sh, 0.22, 0.78);
  }

  start(): void {
    if (this.phase !== 'pre') return;
    this.phase = 'h1';
    this.ensure();
    const [h, a] = this.teams;
    this.ev(-1, 'kick', `Rola a bola! ${h.input.name} x ${a.input.name}.`, undefined, true);
  }

  /** Avança um minuto de jogo. */
  step(): void {
    if (this.phase === 'pre') this.start();
    if (this.phase === 'done') return;
    if (this.phase === 'ht') {
      this.phase = 'h2';
      this.minute = 45;
      this.ev(-1, 'kick', 'Começa o segundo tempo.', undefined, true);
    }
    this.atInterval = false;
    this.tick++;
    this.minute++;
    this.ensure();
    this.playMinute();
    // controle de períodos
    if (this.phase === 'h1' && this.minute >= 45 + this.added1) {
      this.phase = 'ht';
      this.minute = 45;
      this.ev(-1, 'ht', `Intervalo: ${this.teams[0].input.short} ${this.score[0]} x ${this.score[1]} ${this.teams[1].input.short}.`, undefined, true);
      this.atInterval = true;
      for (const t of this.teams) {
        for (const x of this.on(t)) x.cond = Math.min(100, x.cond + 3);
        this.aiHalftime(t);
        this.autoManage(t);
      }
    } else if (this.phase === 'h2' && this.minute >= 90 + this.added2) {
      this.endRegulation();
    } else if (this.phase === 'et1' && this.minute >= 105) {
      this.phase = 'et2';
      this.ev(-1, 'ht', 'Fim do primeiro tempo da prorrogação.', undefined, true);
      this.atInterval = true;
      for (const t of this.teams) this.autoManage(t);
    } else if (this.phase === 'et2' && this.minute >= 120) {
      this.endExtraTime();
    }
  }

  runToEnd(): void {
    let guard = 0;
    while (this.phase !== 'done' && guard++ < 400) this.step();
  }

  private totals(): { h: number; a: number; hAway: number; aAway: number } {
    const agg = this.input.aggregate ?? [0, 0];
    const prev = this.input.awayPrev ?? [0, 0];
    return { h: agg[0] + this.score[0], a: agg[1] + this.score[1], hAway: prev[0], aAway: prev[1] + this.score[1] };
  }

  private decided(): boolean {
    if (!this.input.needWinner) return true;
    const t = this.totals();
    if (t.h !== t.a) return true;
    if (this.input.awayGoals && this.input.aggregate) return t.hAway !== t.aAway;
    return false;
  }

  private endRegulation(): void {
    if (this.decided()) return this.finish();
    if (this.input.extraTime) {
      this.phase = 'et1';
      this.wentToET = true;
      this.minute = 90;
      this.ev(-1, 'kick', 'Empate no agregado: vamos para a prorrogação!', undefined, true);
      this.atInterval = true;
      for (const t of this.teams) {
        for (const x of this.on(t)) x.cond = Math.min(100, x.cond + 2);
        this.autoManage(t);
      }
      return;
    }
    this.shootout();
  }

  private endExtraTime(): void {
    if (this.decided()) return this.finish();
    this.shootout();
  }

  private shootout(): void {
    this.phase = 'pens';
    this.ev(-1, 'pen', 'Decisão por pênaltis!', undefined, true);
    const takers = this.teams.map((t) => {
      const on = this.on(t).filter((x) => x.slot !== 'GK' || this.on(t).length <= 5);
      const pref = on.find((x) => x.p.id === t.tactics.penaltyTaker);
      const rest = on.filter((x) => x !== pref).sort((a, b) => b.p.attrs[A.fin] + b.p.attrs[A.com] - (a.p.attrs[A.fin] + a.p.attrs[A.com]));
      return (pref ? [pref] : []).concat(rest);
    });
    const gks = this.teams.map((t) => this.on(t).find((x) => x.slot === 'GK'));
    const score: [number, number] = [0, 0];
    const taken: [number, number] = [0, 0];
    const kick = (side: 0 | 1): void => {
      const list = takers[side];
      const x = list[taken[side] % Math.max(1, list.length)];
      taken[side]++;
      const gk = gks[1 - side];
      const gkv = gk ? (gk.p.attrs[A.ref] + gk.p.attrs[A.one]) / 2 : 30;
      const p = clamp(0.76 + (x.p.attrs[A.fin] + x.p.attrs[A.com] - 130) / 600 - (gkv - 60) / 500 - (x.cond < 50 ? 0.04 : 0), 0.5, 0.93);
      const ok = this.rng.chance(p);
      if (ok) score[side]++;
      this.ev(side, 'pen', `${lastName(x.p)} ${ok ? 'converte' : pick(this.rng, ['para nas mãos do goleiro', 'manda para fora', 'acerta a trave'])} (${score[0]} x ${score[1]}).`, x.p.id, true);
    };
    const over = () => score[0] + (5 - taken[0]) < score[1] || score[1] + (5 - taken[1]) < score[0];
    for (let r = 0; r < 5; r++) {
      kick(0);
      if (over()) break;
      kick(1);
      if (over()) break;
    }
    let guard = 0;
    while (score[0] === score[1] && guard++ < 30) {
      kick(0);
      kick(1);
    }
    this.pens = score;
    this.finish();
  }

  private finish(): void {
    this.phase = 'done';
    const [h, a] = this.teams;
    let txt = `Fim de jogo: ${h.input.name} ${this.score[0]} x ${this.score[1]} ${a.input.name}`;
    if (this.pens) txt += ` (pênaltis ${this.pens[0]} x ${this.pens[1]})`;
    this.ev(-1, 'ft', txt + '.', undefined, true);
  }

  // ───────────────────────── núcleo de cada minuto ─────────────────────────

  private playMinute(): void {
    const rng = this.rng;
    const [h, a] = this.teams;
    // desgaste
    for (const t of this.teams) {
      const tc = t.tactics;
      const load = 1 + 0.3 * (tc.pressing - 1) + 0.1 * (tc.tempo - 1) + (tc.marking === 'man' ? 0.08 : 0) + (1 - this.input.pitch) * 0.15;
      for (const x of this.on(t)) {
        const drop = 0.54 * (1.25 - x.p.attrs[A.sta] / 100) * load * (x.slot === 'GK' ? 0.35 : 1);
        x.cond = Math.max(5, x.cond - drop);
      }
      if (this.minute % 5 === 0) t.dirty = true;
    }
    this.ensure();
    const shH = this.possShare(h, a);
    const shA = 1 - shH;
    if (rng.next() < shH) h.poss++;
    else a.poss++;
    for (const x of this.on(h)) x.possAcc += shH;
    for (const x of this.on(a)) x.possAcc += shA;

    for (const [t, o, sh] of [[h, a, shH], [a, h, shA]] as [TS, TS, number][]) {
      this.attackPhase(t, o, sh);
      this.foulPhase(t, o);
      this.injuryPhase(t);
    }
    // substituições automáticas (regras, cansaço e contexto)
    for (const t of this.teams) {
      this.aiMentality(t);
      this.autoManage(t);
    }
  }

  private attackPhase(t: TS, o: TS, share: number): void {
    const rng = this.rng;
    const tc = t.tactics;
    const q = t.str.atk / Math.max(1, o.str.def);
    let late = 1;
    const diff = this.score[t.side] - this.score[o.side];
    if (this.minute >= 75 && diff < 0) late = 1.25 + (t.ps.some((x) => x.on && x.te.pressure > 0) ? 0.05 : 0);
    if (this.minute >= 80 && diff > 0) late = 0.85;
    const mentF = 1 + 0.06 * tc.mentality;
    const tempoF = 1 + 0.08 * (tc.tempo - 1);
    const men = this.on(t).length;
    const menO = this.on(o).length;
    const redF = Math.pow(men / 11, 1.6) * Math.pow(11 / Math.max(7, menO), 0.6);
    const possF = Math.pow(share / 0.5, 0.35);
    const pShot = 0.123 * Math.pow(q, 1.25) * possF * mentF * tempoF * late * redF;
    // impedimentos
    if (rng.chance(0.022 * (1 + 0.6 * (o.tactics.line - 1)) * possF)) {
      t.offsides++;
      const att = this.weightedOn(t, (x) => WA[x.slot] * (1 + x.sm.run));
      if (att) {
        att.offsides++;
        this.ev(t.side, 'offside', `${lastName(att.p)} pego em impedimento.`, att.p.id);
      }
    }
    // desconcentração defensiva do adversário gera chance clara
    let lapse = 0;
    for (const x of this.on(o)) if (POS_LINE[x.slot] === 'D' || x.slot === 'DM') lapse += x.te.lapses + (x.p.attrs[A.con] < 40 ? 0.15 : 0);
    if (lapse > 0 && rng.chance(0.0016 * lapse)) {
      const culprit = this.weightedOn(o, (x) => (POS_LINE[x.slot] === 'D' ? 1 + x.te.lapses : 0));
      if (culprit) {
        culprit.errors++;
        this.ev(o.side, 'error', `Falha de ${lastName(culprit.p)}! A bola sobra para o ${t.input.short}.`, culprit.p.id);
      }
      this.shot(t, o, 'big', culprit ?? undefined);
      return;
    }
    if (!rng.chance(pShot)) {
      // recuperação de bola pela pressão
      if (rng.chance(0.15 * (1 + (o.tactics.pressing - 1) * 0.4))) {
        const rec = this.weightedOn(o, (x) => (WD[x.slot] + WM[x.slot] * 0.5) * (x.p.attrs[A.tac] + x.p.attrs[A.psn]));
        if (rec) {
          // quem lê o jogo intercepta; quem chega no corpo a corpo desarma
          if (rng.chance((rec.p.attrs[A.psn] / Math.max(1, rec.p.attrs[A.psn] + rec.p.attrs[A.tac])) * 0.9)) rec.interceptions++;
          else rec.tackles++;
          o.recoveries++;
        }
      }
      if (rng.chance(0.032 * Math.min(1.6, q))) {
        t.corners++;
        this.ev(t.side, 'corner', `Escanteio para o ${t.input.short}.`);
        this.corner(t, o);
      }
      return;
    }
    // tipo de chance
    const dist = { big: 0.15, normal: 0.5, long: 0.25, header: 0.1 };
    if (tc.width === 2) { dist.header += 0.05 * (t.str.aerial / 65); dist.normal -= 0.05; }
    if (tc.width === 0) { dist.header -= 0.04; dist.big += 0.02; dist.normal += 0.02; }
    if (tc.passing === 'direct') { dist.big += 0.03 * (t.str.pace / 70); dist.long += 0.03; dist.normal -= 0.06; }
    if (tc.passing === 'short') { dist.normal += 0.05; dist.long -= 0.05; }
    if (tc.tempo === 2) { dist.long += 0.04; dist.big -= 0.01; dist.normal -= 0.03; }
    if (tc.tempo === 0) { dist.big += 0.02; dist.long -= 0.03; dist.normal += 0.01; }
    if (tc.counter && o.tactics.mentality > 0) { dist.big += 0.04; dist.normal -= 0.04; }
    if (o.tactics.line === 2) dist.big += 0.035 * (t.str.pace / 70);
    if (o.tactics.line === 0) { dist.long += 0.05; dist.big -= 0.03; dist.normal -= 0.02; }
    if (o.tactics.pressing === 2) dist.big += 0.02;
    if (o.tactics.marking === 'man' && t.str.dribble > 68) dist.big -= 0.02;
    if (o.tactics.marking === 'zonal') dist.header -= 0.01;
    const kind = rng.weighted(['big', 'normal', 'long', 'header'] as const, (k) => Math.max(0.01, dist[k]));
    this.shot(t, o, kind);
  }

  private weightedOn(t: TS, w: (x: PS) => number): PS | null {
    const on = this.on(t);
    if (!on.length) return null;
    return this.rng.weighted(on, w);
  }

  private shot(t: TS, o: TS, kind: 'big' | 'normal' | 'long' | 'header' | 'fk' | 'pen' | 'corner', err?: PS): void {
    const rng = this.rng;
    const shooter = kind === 'pen' || kind === 'fk'
      ? this.setPieceTaker(t, kind)
      : this.weightedOn(t, (x) => {
          if (x.slot === 'GK') return 0;
          const base = WA[x.slot] + (kind === 'header' || kind === 'corner' ? (x.p.attrs[A.hea] / 100) * 0.6 + x.sm.header : 0);
          const fin = kind === 'long' ? (x.p.attrs[A.fin] + x.p.attrs[A.pas]) / 2 : x.p.attrs[A.fin];
          return base * Math.pow(fin / 60, 2) * (1 + x.sm.shot + x.te.shooting);
        });
    if (!shooter) return;
    let assister: PS | null = null;
    if (kind !== 'pen' && kind !== 'fk' && rng.chance(kind === 'long' ? 0.45 : 0.78)) {
      assister = this.weightedOn(t, (x) => {
        if (x === shooter || x.slot === 'GK') return 0;
        const cross = kind === 'header' || kind === 'corner' ? x.p.attrs[A.cro] / 60 * (t.tactics.width === 2 ? 1.3 : 1) * (1 + x.sm.cross) : 0;
        return (WM[x.slot] + WA[x.slot] * 0.5) * Math.pow((x.p.attrs[A.pas] + x.p.attrs[A.vis]) / 120, 2) * (1 + x.sm.pass + x.te.passing) + cross;
      });
    }
    const xgBase = { big: 0.33, normal: 0.085, long: 0.035, header: 0.11, fk: 0.065, pen: 0.76, corner: 0.07 }[kind];
    const fin = kind === 'header' || kind === 'corner' ? (shooter.p.attrs[A.hea] * 0.7 + shooter.p.attrs[A.jum] * 0.3) : kind === 'fk' ? (shooter.p.attrs[A.fin] + shooter.p.attrs[A.cro] + shooter.p.attrs[A.com]) / 3 : shooter.p.attrs[A.fin];
    const condF = 0.85 + 0.15 * (shooter.cond / 100);
    const finF = (1 + (fin - 65) * 0.012 + (kind === 'big' || kind === 'pen' ? (shooter.p.attrs[A.com] - 60) * 0.005 : 0)) * condF * (1 + shooter.dayForm);
    const gk = this.on(o).find((x) => x.slot === 'GK');
    const gkv = gk ? this.eff(gk) : 25;
    const gkF = clamp(1 - (gkv - 65) * 0.012, 0.55, 1.45);
    let pGoal = clamp(xgBase * finF * gkF, 0.005, 0.95);
    if (kind === 'corner' && t.tactics.setPieces === 'far' && t.str.aerial > o.str.aerial) pGoal *= 1.15;
    if (kind === 'corner' && t.tactics.setPieces === 'near' && t.str.pace > o.str.pace) pGoal *= 1.1;
    if (kind === 'corner' && t.tactics.setPieces === 'short') pGoal *= 0.85;
    t.shots++;
    shooter.shots++;
    shooter.xg += xgBase;
    t.xg += xgBase;
    if (assister) assister.keyPasses++;
    if (kind === 'big') t.bigChances++;
    const r = rng.next();
    const pSave = kind === 'pen' ? 0.17 : clamp(0.21 + (gkv - 60) * 0.003, 0.13, 0.33);
    const name = lastName(shooter.p);
    if (r < pGoal) {
      t.sot++;
      shooter.sot++;
      // revisão de vídeo: gol anulado
      if (kind !== 'pen' && rng.chance(0.035)) {
        this.goals.push({ min: this.minute, pid: shooter.p.id, aid: assister?.p.id, club: t.input.clubId, type: 'open', disallowed: true, et: this.wentToET });
        this.ev(t.side, 'var', `Gol de ${name} anulado após revisão: impedimento milimétrico.`, shooter.p.id, true);
        return;
      }
      this.score[t.side]++;
      shooter.goals++;
      if (kind === 'pen') shooter.penScored++;
      if (assister) assister.assists++;
      if (err) err.errGoal++;
      for (const x of this.on(o)) {
        x.concOn++;
        if (x.slot === 'GK' || POS_LINE[x.slot] === 'D') x.conceded++;
      }
      const type: GoalEv['type'] = kind === 'pen' ? 'pen' : kind === 'fk' ? 'fk' : kind === 'header' || kind === 'corner' ? 'header' : 'open';
      this.goals.push({ min: this.minute, pid: shooter.p.id, aid: assister?.p.id, club: t.input.clubId, type, et: this.phase === 'et1' || this.phase === 'et2' });
      if (this.phase === 'et1' || this.phase === 'et2') this.etScore[t.side]++;
      const how = kind === 'pen' ? 'de pênalti' : kind === 'fk' ? 'em cobrança de falta' : kind === 'header' || kind === 'corner' ? 'de cabeça' : kind === 'long' ? 'de fora da área' : pick(rng, ['com categoria', 'de primeira', 'na saída do goleiro', 'no ângulo', 'rasteiro, no canto']);
      const ass = assister ? `, assistência de ${lastName(assister.p)}` : '';
      this.ev(t.side, 'goal', `GOL do ${t.input.short}! ${name} marca ${how}${ass}. ${this.teams[0].input.short} ${this.score[0]} x ${this.score[1]} ${this.teams[1].input.short}`, shooter.p.id, true, assister?.p.id);
      t.dirty = true;
      o.dirty = true;
      void err;
      return;
    }
    if (r < pGoal + pSave) {
      t.sot++;
      shooter.sot++;
      o.saves++;
      if (gk) gk.saves++;
      if (kind === 'big' && gk) gk.rating += 0.2;
      if (kind === 'pen') {
        shooter.penMissed++;
        if (gk) gk.penSaved++;
      }
      const gname = gk ? lastName(gk.p) : 'a defesa';
      this.ev(t.side, kind === 'big' ? 'bigsave' : 'save', kind === 'pen' ? `${gname} defende o pênalti de ${name}!` : `${name} finaliza e ${gname} ${pick(rng, ['defende firme', 'espalma para escanteio', 'faz grande defesa', 'segura com segurança'])}.`, shooter.p.id, kind === 'pen' || kind === 'big');
      if (rng.chance(0.3)) {
        t.corners++;
        this.corner(t, o);
      }
      return;
    }
    if (r < pGoal + pSave + 0.22) {
      const blk = this.weightedOn(o, (x) => WD[x.slot] * x.p.attrs[A.psn]);
      if (blk) blk.blocks++;
      this.ev(t.side, 'block', `Chute de ${name} bloqueado${blk ? ` por ${lastName(blk.p)}` : ''}.`, shooter.p.id);
      if (rng.chance(0.35)) {
        t.corners++;
        this.corner(t, o);
      }
      return;
    }
    if (kind === 'pen') {
      shooter.penMissed++;
      this.ev(t.side, 'pen', `${name} desperdiça o pênalti!`, shooter.p.id, true);
    }
    else this.ev(t.side, 'miss', `${name} ${pick(rng, ['finaliza para fora', 'manda por cima do gol', 'tira tinta da trave', 'chuta sem direção'])}.`, shooter.p.id, kind === 'big');
  }

  private corner(t: TS, o: TS): void {
    const sp = t.tactics.setPieces;
    const pHead = sp === 'short' ? 0.1 : 0.17 * (t.str.aerial / Math.max(30, o.str.aerial));
    if (this.rng.chance(pHead)) this.shot(t, o, 'corner');
    else {
      // a defesa afasta o perigo
      const clr = this.weightedOn(o, (x) => (x.slot === 'GK' ? 0 : WD[x.slot] * (x.p.attrs[A.hea] + x.p.attrs[A.jum])));
      if (clr) clr.clearances++;
    }
  }

  private setPieceTaker(t: TS, kind: 'pen' | 'fk'): PS | null {
    const on = this.on(t).filter((x) => x.slot !== 'GK');
    const id = kind === 'pen' ? t.tactics.penaltyTaker : t.tactics.freeKickTaker;
    const pref = on.find((x) => x.p.id === id);
    if (pref) return pref;
    if (!on.length) return null;
    return on.reduce((b, x) => (kind === 'pen' ? x.p.attrs[A.fin] + x.p.attrs[A.com] > b.p.attrs[A.fin] + b.p.attrs[A.com] : x.p.attrs[A.fin] + x.p.attrs[A.cro] > b.p.attrs[A.fin] + b.p.attrs[A.cro]) ? x : b);
  }

  private foulPhase(t: TS, o: TS): void {
    // t comete faltas
    const rng = this.rng;
    const pFoul = 0.135 * (1 + 0.25 * (t.tactics.pressing - 1) + (t.tactics.marking === 'man' ? 0.12 : 0) + (o.str.dribble - 60) / 200) * (this.input.derby ? 1.12 : 1);
    if (!rng.chance(pFoul)) return;
    const fouler = this.weightedOn(t, (x) => (x.slot === 'GK' ? 0.05 : (WD[x.slot] + 0.3) * (1 + x.te.cards * 0.5) * (1 + (100 - x.p.attrs[A.tac]) / 200)));
    if (!fouler) return;
    t.fouls++;
    fouler.fouls++;
    const victim = this.weightedOn(o, (x) => (x.slot === 'GK' ? 0 : WA[x.slot] + 0.2 + x.sm.dribble));
    if (victim) victim.fouled++;
    const diff = this.score[t.side] - this.score[o.side];
    let pCard = 0.13 * (1 + fouler.te.cards) * (this.input.derby ? 1.2 : 1) * (this.minute > 75 && diff < 0 ? 1.2 : 1) * (this.input.importance >= 4 ? 1.08 : 1);
    if (fouler.yellow) pCard *= 0.7; // jogador amarelado se cuida
    if (rng.chance(0.0028 * (1 + fouler.te.cards))) {
      this.sendOff(t, fouler, false);
    } else if (rng.chance(pCard)) {
      fouler.yellow++;
      t.yellows++;
      if (fouler.yellow >= 2) this.sendOff(t, fouler, true);
      else {
        this.cards.push({ min: this.minute, pid: fouler.p.id, club: t.input.clubId, red: false });
        this.ev(t.side, 'card', `Cartão amarelo para ${lastName(fouler.p)}${victim ? ` por falta em ${lastName(victim.p)}` : ''}.`, fouler.p.id);
      }
    } else if (victim) this.ev(t.side, 'foul', `Falta de ${lastName(fouler.p)} em ${lastName(victim.p)}.`, fouler.p.id);
    // pênalti ou falta perigosa
    const danger = WA[victim?.slot ?? 'CM'];
    if (rng.chance(0.022 * danger * (o.str.atk / Math.max(1, t.str.def)))) {
      this.ev(o.side, 'pen', `Pênalti para o ${o.input.short}!`, victim?.p.id, true);
      this.shot(o, t, 'pen');
    } else if (rng.chance(0.07 * danger)) {
      this.shot(o, t, 'fk');
    }
  }

  private sendOff(t: TS, x: PS, second: boolean): void {
    x.red = true;
    x.on = false;
    x.outMin = this.minute;
    t.reds++;
    this.cards.push({ min: this.minute, pid: x.p.id, club: t.input.clubId, red: true, second });
    this.ev(t.side, 'card', second ? `Segundo amarelo: ${lastName(x.p)} é expulso!` : `Cartão vermelho direto para ${lastName(x.p)}!`, x.p.id, true);
    t.dirty = true;
    if (x.slot === 'GK') {
      // goleiro expulso: reserva entra se houver substituição, senão um jogador de linha vai ao gol
      const benchGk = t.ps.find((b) => !b.on && !b.started && b.inMin < 0 && b.p.pos === 'GK' && !b.injured);
      if (benchGk && !this.subBlock(t)) {
        const out = this.on(t).filter((y) => y.slot !== 'GK').sort((a, b) => WA[b.slot] - WA[a.slot])[0];
        if (out) this.doSub(t, out, benchGk, 'GK', { auto: true, reason: `Goleiro expulso: ${lastName(benchGk.p)} entra no gol no lugar de ${lastName(out.p)}.` });
      } else {
        const cover = this.on(t).sort((a, b) => b.p.attrs[A.ref] - a.p.attrs[A.ref])[0];
        if (cover) cover.slot = 'GK';
      }
    } else if (POS_LINE[x.slot] === 'D') t.reorg = x.slot;
  }

  private injuryPhase(t: TS): void {
    for (const x of this.on(t)) {
      const p = 0.00012 * (1 + x.te.injury) * (1 + (1 - this.input.pitch)) * (x.cond < 55 ? 1.6 : 1);
      if (this.rng.chance(p)) {
        x.injured = true;
        this.injuries.push({ pid: x.p.id, club: t.input.clubId, min: this.minute });
        this.ev(t.side, 'injury', `${lastName(x.p)} sente uma lesão e pede atendimento.`, x.p.id, true);
        x.cond = Math.min(x.cond, 40);
        t.dirty = true;
        this.autoManage(t);
      }
    }
  }

  // ───────────────────────── substituições ─────────────────────────

  private reg(): { max: number; windows: number } {
    const r = this.teams[0].input.reg ?? DEFAULT_REG;
    const et = this.wentToET || this.phase === 'et1' || this.phase === 'et2';
    return { max: r.max + (et ? r.etExtra : 0), windows: r.windows + (et ? r.etWindows : 0) };
  }

  /** Motivo pelo qual não é possível substituir agora (ou null). O intervalo não consome oportunidade. */
  private subBlock(t: TS): string | null {
    const r = this.reg();
    if (this.phase === 'done' || this.phase === 'pens') return 'A partida já terminou.';
    if (t.subs >= r.max) return `Limite de ${r.max} substituições atingido.`;
    if (!this.atInterval && t.lastWindowTick !== this.tick && t.windowsUsed >= r.windows) return `Sem oportunidades de substituição: as ${r.windows} interrupções permitidas já foram usadas (o intervalo não conta).`;
    return null;
  }

  subsInfo(side: 0 | 1): SubsInfo {
    const t = this.teams[side];
    const r = this.reg();
    return { made: t.subs, max: r.max, windowsUsed: t.windowsUsed, windows: r.windows, interval: this.atInterval || this.phase === 'ht', windowOpen: t.lastWindowTick === this.tick };
  }

  private available(t: TS): PS[] {
    return t.ps.filter((b) => !b.on && b.inMin < 0 && !b.injured && !b.red && !b.started);
  }

  /** Melhor reserva para uma função: filtra elegíveis e escolhe por qualidade na função, condição e contexto. */
  private bestFor(t: TS, slot: Pos, bias: 'none' | 'attack' | 'defend' = 'none', exclude?: Set<string>): PS | null {
    const plan = t.input.plan ?? defaultSubPlan();
    let best: PS | null = null;
    let bestScore = -1;
    for (const b of this.available(t)) {
      if (exclude?.has(b.p.id)) continue;
      if ((slot === 'GK') !== (b.p.pos === 'GK')) continue;
      let sc = slotRating(b.p, slot) * (0.72 + 0.28 * (b.cond / 100));
      if (bias === 'attack') sc *= 1 + (b.p.attrs[A.fin] + b.p.attrs[A.dri] - 110) / 400;
      if (bias === 'defend') sc *= 1 + (b.p.attrs[A.tac] + b.p.attrs[A.mar] - 110) / 400;
      // evita escolher sempre o mesmo reserva: leve rodízio por minutos recentes e variação entre jogos
      const recent = b.p.recentMinutes.slice(-2).reduce((a, x) => a + x, 0);
      sc *= 1 - Math.min(0.03, recent / 6000);
      if (plan.variety) sc *= 1 + ((hashString(b.p.id + this.input.seed) % 1000) / 1000 - 0.5) * 0.04;
      if (sc > bestScore) {
        bestScore = sc;
        best = b;
      }
    }
    return best;
  }

  private doSub(t: TS, out: PS, inn: PS, slot?: Pos, meta: { auto?: boolean; reason?: string } = {}): void {
    if (!this.atInterval && t.lastWindowTick !== this.tick) {
      t.windowsUsed++;
      t.lastWindowTick = this.tick;
    }
    out.on = false;
    out.outMin = this.minute;
    inn.on = true;
    inn.inMin = this.minute;
    inn.slot = slot ?? out.slot;
    t.subs++;
    t.dirty = true;
    this.subsLog.push({ min: this.minute, out: out.p.id, in: inn.p.id, club: t.input.clubId, auto: meta.auto, reason: meta.reason, interval: this.atInterval || undefined });
    const txt = meta.reason ? `Substituição automática: ${meta.reason}` : `Substituição no ${t.input.short}: sai ${lastName(out.p)}, entra ${lastName(inn.p)}.`;
    this.ev(t.side, 'sub', txt, inn.p.id, !!meta.reason, out.p.id);
  }

  /** Executa (ou, ao vivo com confirmação, sugere) uma troca automática. */
  private exec(t: TS, sug: SubSuggestion): boolean {
    if (this.subBlock(t)) return false;
    const out = t.ps.find((x) => x.p.id === sug.outId && x.on);
    const inn = t.ps.find((x) => x.p.id === sug.inId);
    if (!out || !inn) return false;
    if (t.input.confirm && !sug.urgent) {
      if (!t.pending) {
        t.pending = sug;
        this.ev(t.side, 'suggest', `Sugestão: ${sug.reason}`, inn.p.id, true, out.p.id);
      }
      return false;
    }
    this.doSub(t, out, inn, sug.slot, { auto: true, reason: sug.reason });
    if (sug.ruleId) t.fired.add(sug.ruleId);
    if (sug.kind === 'offense') t.offDone = true;
    if (sug.kind === 'protect') t.protDone = true;
    if (sug.kind === 'reorg') t.reorg = null;
    return true;
  }

  private threshold(t: TS, x: PS, plan: SubPlan): number {
    let thr = plan.posFatigue[x.slot] ?? plan.fatigue;
    thr += ROLE_DEMAND[x.slot] * 0.6;
    thr += (t.tactics.pressing - 1) * 3 + (t.tactics.tempo - 1) * 2;
    if (x.te.injury > 0.3) thr += 4; // propenso a lesões
    const recent = x.p.recentMinutes.slice(-2).reduce((a, m) => a + m, 0);
    if (recent > 170) thr += 3; // histórico recente de fadiga
    return thr;
  }

  private ruleMatches(t: TS, r: SubRule): SubSuggestion | null {
    if (!r.enabled || t.fired.has(r.id)) return null;
    const m = this.gameMinute();
    const from = r.minFrom ?? (r.condBelow == null && !r.yellowRisk ? 60 : null);
    if (from != null && m < from) return null;
    if (r.minTo != null && m > r.minTo) return null;
    const diff = this.score[t.side] - this.score[1 - t.side];
    if (r.score === 'winning' && diff <= 0) return null;
    if (r.score === 'drawing' && diff !== 0) return null;
    if (r.score === 'losing' && diff >= 0) return null;
    const on = this.on(t);
    const outs = r.outPid ? on.filter((x) => x.p.id === r.outPid) : on.filter((x) => x.slot === r.outPos);
    const out = outs.filter((x) => !t.cooldown[x.p.id] || t.cooldown[x.p.id] < this.tick).sort((a, b) => a.cond - b.cond)[0];
    if (!out) return null;
    if (r.condBelow != null && out.cond >= r.condBelow) return null;
    if (r.yellowRisk && !(out.yellow > 0 && (out.fouls >= 2 || out.te.cards > 0.2 || POS_LINE[out.slot] === 'D'))) return null;
    const slot: Pos = r.extraAttacker ? (r.inPos ?? 'ST') : r.preserveRole ? out.slot : (r.inPos ?? out.slot);
    const inn = r.inPid ? this.available(t).find((b) => b.p.id === r.inPid) ?? null : this.bestFor(t, r.inPos ?? slot, r.extraAttacker ? 'attack' : 'none');
    if (!inn) return null;
    if (r.minOvrDiff != null && slotRating(inn.p, slot) - slotRating(out.p, slot) < r.minOvrDiff) return null;
    const why = [r.condBelow != null ? `${Math.round(out.cond)}% de condição física` : '', r.yellowRisk ? 'risco de segundo amarelo' : '', r.score !== 'any' ? { winning: 'vencendo', drawing: 'empatando', losing: 'perdendo' }[r.score] : ''].filter(Boolean).join(', ');
    const what = r.extraAttacker ? 'como atacante extra' : `para ${r.preserveRole ? 'manter' : 'assumir'} a função de ${ROLE_NAME[slot]}`;
    return { outId: out.p.id, inId: inn.p.id, slot, kind: 'rule', ruleId: r.id, reason: `regra "${r.label}": ${lastName(out.p)} sai ${this.whenTxt()}${why ? ` (${why})` : ''}. ${lastName(inn.p)} entra ${what}.` };
  }

  /** Avaliação periódica: lesões, regras do usuário, cansaço e contexto do placar. */
  private autoManage(t: TS): void {
    if (this.phase === 'done' || this.phase === 'pens' || this.phase === 'pre') return;
    const plan = t.input.plan ?? (t.input.autoSubs ? defaultSubPlan('smart') : defaultSubPlan('manual'));
    const live = !!t.input.confirm;
    if (t.pending) return; // aguardando a decisão do usuário
    // 1) lesionados: prioridade máxima (no modo manual ao vivo vira sugestão para o usuário decidir)
    for (const x of this.on(t).filter((y) => y.injured)) {
      if (this.subBlock(t)) break;
      const inn = this.bestFor(t, x.slot);
      if (!inn) break;
      const sug: SubSuggestion = { outId: x.p.id, inId: inn.p.id, slot: x.slot, kind: 'injury', urgent: !(plan.mode === 'manual' && live), reason: `${lastName(x.p)} se lesionou ${this.whenTxt()}. ${lastName(inn.p)} entra na função de ${ROLE_NAME[x.slot]}.` };
      if (plan.mode === 'manual' && live) {
        t.pending = sug;
        this.ev(t.side, 'suggest', `Sugestão: ${sug.reason}`, inn.p.id, true, x.p.id);
        return;
      }
      this.exec(t, sug);
    }
    if (plan.mode === 'manual') return;
    // 2) regras personalizadas, por prioridade
    if (plan.mode === 'rules' || plan.mode === 'smart') {
      for (const r of plan.rules.slice().sort((a, b) => a.priority - b.priority)) {
        if (this.subBlock(t) || t.pending) return;
        const sug = this.ruleMatches(t, r);
        if (sug) this.exec(t, sug);
      }
    }
    if (plan.mode === 'rules') return;
    // 3) cansaço e contexto (avaliados a cada dois minutos e nos intervalos)
    if (!this.atInterval && (this.phase === 'h1' || this.tick % 2 !== 0)) return;
    const reg = this.reg();
    const m = this.gameMinute();
    const diff = this.score[t.side] - this.score[1 - t.side];
    const endMin = this.wentToET ? 120 : 90;
    const rem = Math.max(0, endMin - m);
    const smart = plan.mode === 'smart';
    // reorganização após expulsão de um defensor
    if (smart && t.reorg && rem >= 12) {
      const att = this.on(t).filter((x) => x.slot !== 'GK').sort((a, b) => WA[b.slot] - WA[a.slot])[0];
      const inn = this.bestFor(t, t.reorg, 'defend');
      if (att && inn && WA[att.slot] >= 0.6) this.exec(t, { outId: att.p.id, inId: inn.p.id, slot: t.reorg, kind: 'reorg', reason: `após a expulsão, ${lastName(att.p)} sai ${this.whenTxt()} e ${lastName(inn.p)} recompõe a defesa como ${ROLE_NAME[t.reorg]}.` });
      else t.reorg = null;
    }
    const cands: { x: PS; sev: number; kind: SubSuggestion['kind'] }[] = [];
    for (const x of this.on(t)) {
      if (x.slot === 'GK' || x.injured || (t.cooldown[x.p.id] ?? -1) >= this.tick) continue;
      const thr = this.threshold(t, x, plan);
      const rate = 0.54 * (1.25 - x.p.attrs[A.sta] / 100) * (1 + 0.3 * (t.tactics.pressing - 1));
      const projected = x.cond - rate * rem;
      if (x.cond < thr) cands.push({ x, sev: thr - x.cond + 4, kind: 'fatigue' });
      else if (m >= 60 && projected < thr - 12) cands.push({ x, sev: (thr - 12 - projected) / 2, kind: 'fatigue' });
      // risco de expulsão (modo inteligente): só vale a pena se ainda houver tempo de jogo
      else if (smart && m >= 50 && rem >= 10 && x.yellow > 0 && (POS_LINE[x.slot] === 'D' || x.slot === 'DM') && (x.fouls >= 2 || x.te.cards > 0.2)) cands.push({ x, sev: 6 + x.fouls, kind: 'yellow' });
    }
    cands.sort((a, b) => b.sev - a.sev);
    const subsLeft = reg.max - t.subs;
    const winLeft = reg.windows - t.windowsUsed;
    let maxNow = this.atInterval ? 3 : winLeft <= 1 ? subsLeft : 2;
    const used = new Set<string>();
    for (const c of cands) {
      if (maxNow <= 0 || this.subBlock(t) || t.pending) break;
      const left = reg.max - t.subs;
      if (left <= 1 && m < 80 && c.sev < 10) break; // guarda a última troca para emergências
      const bias = smart && diff > 0 && m >= 70 ? 'defend' : smart && diff < 0 && m >= 65 ? 'attack' : 'none';
      const inn = this.bestFor(t, c.x.slot, bias, used);
      if (!inn) continue;
      const effOut = slotRating(c.x.p, c.x.slot) * (0.72 + 0.28 * (c.x.cond / 100));
      const effIn = slotRating(inn.p, c.x.slot) * (0.72 + 0.28 * (inn.cond / 100));
      // não troca sem vantagem: o reserva precisa render pelo menos o mesmo, salvo cansaço extremo
      if (effIn < effOut * (c.sev >= 12 ? 0.85 : 0.97)) {
        t.cooldown[c.x.p.id] = this.tick + 8;
        continue;
      }
      used.add(inn.p.id);
      const reason = c.kind === 'yellow'
        ? `${lastName(c.x.p)} sai ${this.whenTxt()}: tem cartão amarelo e ${c.x.fouls} faltas, com risco de expulsão. ${lastName(inn.p)} entra para manter a função de ${ROLE_NAME[c.x.slot]}.`
        : `${lastName(c.x.p)} sai ${this.whenTxt()} com ${Math.round(c.x.cond)}% de condição física. ${lastName(inn.p)} entra para manter a função de ${ROLE_NAME[c.x.slot]} e ${roleGoal(c.x.slot)}.`;
      if (this.exec(t, { outId: c.x.p.id, inId: inn.p.id, slot: c.x.slot, kind: c.kind, reason })) maxNow--;
    }
    if (!smart || this.subBlock(t) || t.pending) return;
    // perdendo no fim: atacante extra no lugar de um volante/defensor
    if (diff < 0 && m >= 70 && !t.offDone && reg.max - t.subs >= 1) {
      // sai primeiro um volante/meia de contenção; zagueiro só no fim e se houver três
      const pref: Pos[] = ['DM', 'CM', ...(m >= 82 ? (['RB', 'LB'] as Pos[]) : []), ...(m >= 85 && this.on(t).filter((x) => x.slot === 'CB').length >= 3 ? (['CB'] as Pos[]) : [])];
      const out = this.on(t).filter((x) => pref.includes(x.slot) && !x.injured).sort((a, b) => pref.indexOf(a.slot) - pref.indexOf(b.slot) || a.cond - b.cond)[0];
      const slot: Pos = out && ['RB', 'LB', 'CB'].includes(out.slot) ? 'ST' : 'AM';
      const inn = out ? this.bestFor(t, slot, 'attack') : null;
      if (out && inn && slotRating(inn.p, slot) >= slotRating(out.p, slot) * 1.02) {
        this.exec(t, { outId: out.p.id, inId: inn.p.id, slot, kind: 'offense', reason: `time perdendo ${this.whenTxt()}: ${lastName(out.p)} sai e ${lastName(inn.p)} entra como ${ROLE_NAME[slot]} para aumentar a presença ofensiva.` });
      } else if (m >= 86) t.offDone = true;
    }
    // vencendo no fim: equilíbrio defensivo no lugar de um atacante desgastado
    if (diff > 0 && m >= 75 && !t.protDone && reg.max - t.subs >= 2) {
      const out = this.on(t).filter((x) => ['AM', 'RW', 'LW', 'ST'].includes(x.slot) && x.cond < this.threshold(t, x, plan) + 12).sort((a, b) => a.cond - b.cond)[0];
      const inn = out ? this.bestFor(t, 'DM', 'defend') : null;
      if (out && inn && out.slot !== 'ST') {
        this.exec(t, { outId: out.p.id, inId: inn.p.id, slot: 'DM', kind: 'protect', reason: `vencendo ${this.whenTxt()}, ${lastName(out.p)} (${Math.round(out.cond)}% de condição) sai e ${lastName(inn.p)} entra como volante para dar equilíbrio defensivo.` });
      } else t.protDone = true;
    }
  }

  private aiHalftime(t: TS): void {
    if (!t.input.autoSubs || t.input.plan) return;
    const diff = this.score[t.side] - this.score[1 - t.side];
    if (diff <= -2 && t.tactics.mentality < 2) {
      t.tactics = { ...t.tactics, mentality: (t.tactics.mentality + 1) as Tactics['mentality'] };
      t.dirty = true;
      t.aiAdjusted++;
    }
  }

  /** Ajuste de postura da IA conforme o placar (não envolve substituições). */
  private aiMentality(t: TS): void {
    if (t.input.plan || !t.input.autoSubs) return;
    const m = this.minute;
    if (![58, 66, 74, 82].includes(m)) return;
    const diff = this.score[t.side] - this.score[1 - t.side];
    if (m >= 66 && diff < 0 && t.tactics.mentality < 2 && t.aiAdjusted < 2) {
      t.tactics = { ...t.tactics, mentality: (t.tactics.mentality + 1) as Tactics['mentality'] };
      t.aiAdjusted++;
      t.dirty = true;
    } else if (m >= 74 && diff > 0 && t.tactics.mentality > -1 && t.aiAdjusted < 2) {
      t.tactics = { ...t.tactics, mentality: (t.tactics.mentality - 1) as Tactics['mentality'] };
      t.aiAdjusted++;
      t.dirty = true;
    }
  }

  // ───────────────────────── controle do usuário (ao vivo) ─────────────────────────

  substitute(side: 0 | 1, outId: string, inId: string): string | null {
    const t = this.teams[side];
    const block = this.subBlock(t);
    if (block) return block;
    const out = t.ps.find((x) => x.p.id === outId && x.on);
    const inn = t.ps.find((x) => x.p.id === inId && !x.on && x.inMin < 0 && !x.red && !x.started);
    if (!out) return 'Jogador que sai não está em campo.';
    if (!inn) return 'Jogador que entra não está disponível no banco.';
    if (inn.injured) return 'Jogador lesionado.';
    if (t.pending?.outId === outId) t.pending = null;
    this.doSub(t, out, inn);
    this.interventions++;
    return null;
  }

  /** Sugestão aguardando confirmação (partida ao vivo). */
  pendingFor(side: 0 | 1): SubSuggestion | null {
    return this.teams[side].pending;
  }

  /** Confirma a sugestão (opcionalmente trocando o reserva escolhido). */
  acceptSuggestion(side: 0 | 1, altInId?: string): string | null {
    const t = this.teams[side];
    const sug = t.pending;
    if (!sug) return 'Não há sugestão pendente.';
    t.pending = null;
    const block = this.subBlock(t);
    if (block) return block;
    const out = t.ps.find((x) => x.p.id === sug.outId && x.on);
    const inId = altInId ?? sug.inId;
    const inn = t.ps.find((x) => x.p.id === inId && !x.on && x.inMin < 0 && !x.red && !x.injured && !x.started);
    if (!out || !inn) return 'A troca sugerida não é mais possível.';
    const reason = altInId && altInId !== sug.inId ? `${lastName(out.p)} sai ${this.whenTxt()}; ${lastName(inn.p)} entra (escolha do treinador).` : sug.reason;
    this.doSub(t, out, inn, sug.slot, { auto: true, reason });
    if (sug.ruleId) t.fired.add(sug.ruleId);
    if (sug.kind === 'offense') t.offDone = true;
    if (sug.kind === 'protect') t.protDone = true;
    this.interventions++;
    return null;
  }

  /** Recusa a sugestão: o mesmo jogador não é sugerido de novo pelos próximos minutos. */
  rejectSuggestion(side: 0 | 1): void {
    const t = this.teams[side];
    if (!t.pending) return;
    t.cooldown[t.pending.outId] = this.tick + 10;
    if (t.pending.ruleId) t.fired.add(t.pending.ruleId);
    if (t.pending.kind === 'offense') t.offDone = true;
    if (t.pending.kind === 'protect') t.protDone = true;
    t.pending = null;
    this.interventions++;
  }

  /** Desliga a confirmação (por exemplo, ao simular o restante da partida). */
  setConfirm(side: 0 | 1, on: boolean): void {
    this.teams[side].input.confirm = on;
    if (!on) this.teams[side].pending = null;
  }

  /** Sugestões calculadas sem executar nada (painel da partida ao vivo, inclusive no modo manual). */
  suggestions(side: 0 | 1): SubSuggestion[] {
    const t = this.teams[side];
    const plan = { ...(t.input.plan ?? defaultSubPlan()), mode: 'smart' as const };
    const out: SubSuggestion[] = [];
    const used = new Set<string>();
    for (const x of this.on(t).filter((y) => y.slot !== 'GK').sort((a, b) => a.cond - b.cond)) {
      const thr = this.threshold(t, x, plan);
      const reasons: string[] = [];
      if (x.injured) reasons.push('lesionado');
      if (x.cond < thr + 5) reasons.push(`${Math.round(x.cond)}% de condição física`);
      if (x.yellow > 0 && x.fouls >= 2) reasons.push(`amarelado com ${x.fouls} faltas`);
      if (!reasons.length) continue;
      const inn = this.bestFor(t, x.slot, 'none', used);
      if (!inn) continue;
      used.add(inn.p.id);
      out.push({ outId: x.p.id, inId: inn.p.id, slot: x.slot, kind: x.injured ? 'injury' : 'fatigue', reason: `${lastName(x.p)} (${reasons.join(', ')}) por ${lastName(inn.p)}, mantendo a função de ${ROLE_NAME[x.slot]}.` });
      if (out.length >= 3) break;
    }
    return out;
  }

  /** Condição física dos jogadores em campo (para o painel ao vivo). */
  fitness(side: 0 | 1): { pid: string; name: string; slot: Pos; cond: number; threshold: number; yellow: boolean; injured: boolean }[] {
    const t = this.teams[side];
    const plan = t.input.plan ?? defaultSubPlan();
    return this.on(t).map((x) => ({ pid: x.p.id, name: x.p.name, slot: x.slot, cond: Math.round(x.cond), threshold: Math.round(this.threshold(t, x, plan)), yellow: x.yellow > 0, injured: x.injured })).sort((a, b) => a.cond - b.cond);
  }

  setTactics(side: 0 | 1, tactics: Partial<Tactics>): void {
    const t = this.teams[side];
    t.tactics = { ...t.tactics, ...tactics };
    t.dirty = true;
    this.interventions++;
    this.ev(side, 'tactic', `${t.input.short} muda a postura tática.`);
  }

  moveSlot(side: 0 | 1, pid: string, slot: Pos): void {
    const x = this.teams[side].ps.find((y) => y.p.id === pid && y.on);
    if (x) {
      x.slot = slot;
      this.teams[side].dirty = true;
      this.interventions++;
    }
  }

  liveStats(): MatchStats {
    const [h, a] = this.teams;
    const tot = Math.max(1, h.poss + a.poss);
    const ph = Math.round((h.poss / tot) * 100);
    return {
      poss: [ph, 100 - ph], shots: [h.shots, a.shots], sot: [h.sot, a.sot], corners: [h.corners, a.corners], fouls: [h.fouls, a.fouls],
      saves: [h.saves, a.saves], offsides: [h.offsides, a.offsides], yellows: [h.yellows, a.yellows], reds: [h.reds, a.reds],
      xg: [Math.round(h.xg * 100) / 100, Math.round(a.xg * 100) / 100],
    };
  }

  // ───────────────────────── encerramento ─────────────────────────

  outcome(): MatchOutcome {
    if (this.phase !== 'done') this.runToEnd();
    const lines: PlayerLine[] = [];
    const end = this.minute;
    for (const t of this.teams) {
      const o = this.teams[1 - t.side];
      const res = Math.sign(this.score[t.side] - this.score[o.side]);
      for (const x of t.ps) {
        const played = x.started || x.inMin >= 0;
        if (!played) continue;
        const minutes = Math.max(1, (x.outMin ?? end) - Math.max(0, x.inMin));
        const line = POS_LINE[x.slot];
        let r = 6.2 + x.goals * 1.0 + x.assists * 0.6 + x.sot * 0.12 - (x.shots - x.sot) * 0.03 + (x.keyPasses - x.assists) * 0.08 + (x.tackles + x.interceptions) * 0.035 + x.blocks * 0.05 + x.clearances * 0.02;
        if (x.slot === 'GK') r += x.saves * 0.28 - x.conceded * 0.25 + (x.conceded === 0 && minutes >= 60 ? 0.6 : 0);
        else if (line === 'D') r += (x.conceded === 0 && minutes >= 60 ? 0.45 : 0) - x.conceded * 0.15;
        r += res * 0.3 - x.errors * 0.8 - x.yellow * 0.25 - (x.red ? 1.5 : 0);
        r += x.dayForm * 4 + x.rating - 6.2;
        r += this.rng.normal(0, 0.22);
        if (minutes < 30) r = 6.3 + (r - 6.3) * 0.5;
        x.rating = clamp(Math.round(r * 10) / 10, 3, 10);
        // passes: volume proporcional à posse enquanto esteve em campo e à função; acerto pelos atributos e pela pressão
        const pw = PASS_W[x.slot];
        const passes = Math.round(x.possAcc * 0.95 * pw * (0.9 + x.p.attrs[A.pas] / 500));
        const tc = t.tactics;
        const acc = clamp(0.64 + (x.p.attrs[A.pas] - 55) * 0.0042 + (x.p.attrs[A.vis] - 55) * 0.0012 + (x.p.attrs[A.com] - 55) * 0.001 - (o.tactics.pressing - 1) * 0.025 + (tc.passing === 'short' ? 0.035 : tc.passing === 'direct' ? -0.06 : 0) + (x.slot === 'GK' ? -0.08 : 0) + this.rng.normal(0, 0.025), 0.4, 0.96);
        lines.push({
          pid: x.p.id, side: t.side, started: x.started, minutes, goals: x.goals, assists: x.assists, rating: x.rating, yellow: x.yellow, red: x.red, shots: x.shots,
          saves: x.saves, conceded: x.conceded, cleanSheet: x.concOn === 0 && minutes >= 60,
          condAfter: Math.round(x.cond), injured: x.injured, slot: x.slot,
          sot: x.sot, xg: Math.round(x.xg * 100) / 100, keyPasses: x.keyPasses, passes, passesOk: Math.round(passes * acc), tackles: x.tackles, interceptions: x.interceptions,
          clearances: x.clearances, blocks: x.blocks, fouls: x.fouls, fouled: x.fouled, offsides: x.offsides, errGoal: x.errGoal, penScored: x.penScored, penMissed: x.penMissed,
          penSaved: x.penSaved, concededOn: x.concOn,
        });
      }
    }
    const motm = lines.reduce((b, l) => (l.rating > b.rating || (l.rating === b.rating && l.goals > b.goals) ? l : b), lines[0]);
    return {
      hg: this.score[0], ag: this.score[1], et: this.wentToET,
      pens: this.pens, goals: this.goals, cards: this.cards, stats: this.liveStats(), events: this.events, report: this.tacticalReport(), motm: motm?.pid ?? '',
      lines, subs: this.subsLog, injuries: this.injuries, lineups: [this.teams[0].ps.filter((x) => x.started).map((x) => x.p.id), this.teams[1].ps.filter((x) => x.started).map((x) => x.p.id)],
      interventions: this.interventions,
    };
  }

  tacticalReport(): string[] {
    const out: string[] = [];
    const [h, a] = this.teams;
    const st = this.liveStats();
    const names = [h.input.short, a.input.short];
    const midLead = h.str.mid > a.str.mid ? 0 : 1;
    out.push(`Meio-campo: ${names[midLead]} teve mais controle (${st.poss[midLead]}% de posse).`);
    for (const t of this.teams) {
      const o = this.teams[1 - t.side];
      const n = t.input.short;
      if (t.tactics.pressing === 2) {
        const avg = this.on(t).reduce((s, x) => s + x.cond, 0) / Math.max(1, this.on(t).length);
        out.push(`${n}: a pressão alta recuperou ${t.recoveries} bolas, mas o elenco terminou com ${Math.round(avg)}% de condição média.`);
      }
      if (t.tactics.line === 2 && o.bigChances >= 2) out.push(`${n}: a linha defensiva alta cedeu ${o.bigChances} chances claras em profundidade.`);
      if (t.tactics.line === 0 && o.bigChances <= 1) out.push(`${n}: o bloco baixo limitou o adversário a ${o.bigChances} chance${o.bigChances === 1 ? '' : 's'} clara${o.bigChances === 1 ? '' : 's'}.`);
      if (t.tactics.counter && t.bigChances >= 2) out.push(`${n}: os contra-ataques geraram ${t.bigChances} grandes oportunidades.`);
      if (t.tactics.width === 2 && t.corners >= 6) out.push(`${n}: o jogo pelas pontas rendeu ${t.corners} escanteios.`);
      const offPos = this.on(t).filter((x) => x.slot !== x.p.pos && !x.p.alt.includes(x.slot));
      if (offPos.length) out.push(`${n}: ${offPos.map((x) => x.p.name).join(', ')} atuou fora de posição e rendeu menos.`);
      if (t.reds) out.push(`${n}: a expulsão obrigou o time a jogar com um a menos.`);
    }
    out.push(`Finalizações: ${names[0]} ${st.shots[0]} (${st.sot[0]} no alvo, xG ${st.xg[0]}) x ${st.shots[1]} (${st.sot[1]} no alvo, xG ${st.xg[1]}) ${names[1]}.`);
    return out;
  }
}

export function simulateMatch(input: MatchInput): MatchOutcome {
  const sim = new MatchSim(input);
  sim.runToEnd();
  return sim.outcome();
}
