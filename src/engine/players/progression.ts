import type { Career, Club, Player, Pos, YouthPlan } from '../types';
import { Rng, clamp } from '../core/rng';
import { A, ATTRS, ATTR_COUNT, POS_WEIGHTS, type AttrKey, computeOvr, ovrToLevel } from './attributes';
import { traitEffects } from './traits';
import { clubEffects } from '../infra/infra';
import { marketValue } from './value';
import { markRecovering, recovering } from '../career/index';

type Effects = ReturnType<typeof clubEffects>;

const TECH: AttrKey[] = ['fin', 'pas', 'vis', 'dri', 'cro', 'mar', 'tac', 'hea', 'bct', 'psn'];
const PHYS: AttrKey[] = ['pac', 'acc', 'str', 'sta', 'agi', 'jum'];
const MENT: AttrKey[] = ['dec', 'com', 'tea', 'lea', 'con', 'cns'];
const TACT: AttrKey[] = ['psn', 'dec', 'tea', 'con', 'mar'];
const GK: AttrKey[] = ['ref', 'han', 'one', 'aer', 'dis'];

export function ageOf(p: Pick<Player, 'birthYear'>, season: number): number {
  return season - p.birthYear;
}

function ageGrowth(age: number): number {
  if (age <= 17) return 1.3;
  if (age <= 20) return 1.15;
  if (age <= 23) return 0.85;
  if (age <= 26) return 0.45;
  if (age <= 29) return 0.15;
  return 0;
}

/** Pesos de distribuição do ganho semanal conforme posição e foco/plano de treino. */
function focusWeights(p: Player, focus: string, devPos?: Pos): number[] {
  const pw = POS_WEIGHTS[devPos ?? p.pos];
  const w = new Array(ATTR_COUNT).fill(0.15);
  for (const k in pw) w[A[k as AttrKey]] += pw[k as AttrKey]! / 4;
  const boost = (keys: AttrKey[], v: number) => keys.forEach((k) => (w[A[k]] += v));
  if (focus === 'technical') boost(TECH, 1.2);
  else if (focus === 'physical') boost(PHYS, 1.4);
  else if (focus === 'tactical') boost(TACT, 1.3);
  else if (focus === 'proPrep') boost(MENT, 1.2);
  else if (focus === 'position' && devPos) for (const k in POS_WEIGHTS[devPos]) w[A[k as AttrKey]] += 1;
  if (p.pos !== 'GK' && !(devPos === 'GK')) for (const k of GK) w[A[k]] = 0;
  if (p.pos === 'GK') for (const k of ['fin', 'dri', 'cro', 'tac', 'mar', 'hea'] as AttrKey[]) w[A[k]] *= 0.2;
  return w;
}

function distribute(p: Player, gain: number, weights: number[], rng: Rng): void {
  const total = weights.reduce((s, x) => s + x, 0);
  for (let i = 0; i < ATTR_COUNT; i++) {
    if (!weights[i]) continue;
    const share = (weights[i] / total) * ATTR_COUNT;
    const v = p.attrs[i] + gain * share * (0.6 + rng.next() * 0.8);
    p.attrs[i] = clamp(v, 1, 99);
  }
}

/** Declínio físico e técnico com a idade (mental pode continuar subindo até ~32). */
function decline(p: Player, age: number, rate: number, declineAge: number, rng: Rng, physicalCare: number): void {
  if (age < declineAge - 1) return;
  const over = age - declineAge + 1;
  const phys = 0.012 * over * rate * (1.1 - physicalCare * 0.3);
  for (const k of PHYS) p.attrs[A[k]] = clamp(p.attrs[A[k]] - phys * (0.5 + rng.next()), 1, 99);
  if (age >= declineAge + 3) {
    const tech = 0.006 * (over - 2) * rate;
    for (const k of TECH) p.attrs[A[k]] = clamp(p.attrs[A[k]] - tech * rng.next() * 1.5, 1, 99);
    if (p.pos === 'GK') for (const k of ['ref', 'one'] as AttrKey[]) p.attrs[A[k]] = clamp(p.attrs[A[k]] - tech * rng.next(), 1, 99);
  }
  if (age <= 32) for (const k of ['dec', 'com', 'lea'] as AttrKey[]) p.attrs[A[k]] = clamp(p.attrs[A[k]] + 0.01 * rng.next(), 1, 99);
}

export interface WeekContext {
  rng: Rng;
  effects: Map<string, Effects>;
}

export function effectsFor(c: Career, ctx: WeekContext, club: Club | null): Effects | null {
  if (!club) return null;
  let e = ctx.effects.get(club.id);
  if (!e) ctx.effects.set(club.id, (e = clubEffects(c, club)));
  return e;
}

/** Evolução semanal de um jogador. Gradual: o potencial raramente é atingido por completo. */
export function progressPlayer(c: Career, p: Player, ctx: WeekContext): number {
  if (p.injury && p.injury.daysLeft > 0) {
    if (p.injury.daysLeft > 60 && ctx.rng.chance(0.15)) p.attrs[A.pac] = clamp(p.attrs[A.pac] - 0.2, 1, 99);
    return 0;
  }
  const age = ageOf(p, c.season);
  const club = p.clubId ? c.clubs[p.clubId] : null;
  const e = effectsFor(c, ctx, club);
  const te = traitEffects(p.traits);
  const before = p.ovr;
  const prog = c.config.progression;
  const youthPlan: YouthPlan | undefined = p.squad === 'youth' ? p.youth?.plan : undefined;
  const isUser = club?.id === c.userClubId;
  let training = e ? (p.squad === 'youth' ? e.youthDev : e.training) : 0.5;
  if (p.pos === 'GK' && e) training *= 0.9 + e.gk * 0.2;
  const minutes = p.recentMinutes.reduce((s, x) => s + x, 0);
  let minutesF: number;
  if (p.squad === 'youth') minutesF = 0.9 + (e ? e.youthDev * 0.15 : 0) + (p.youth?.mentoring ? 0.06 : 0);
  else minutesF = 0.72 + 0.5 * Math.min(1, minutes / 360);
  if (p.loan) minutesF += 0.05;
  const moraleF = 0.85 + 0.27 * (p.morale / 100);
  const intensity = isUser && club ? [0.85, 1, 1.12][club.training.intensity] : 1;
  const gap = Math.max(0, p.pot - p.ovr);
  const rate = 0.0046 * ageGrowth(age) * training * minutesF * moraleF * intensity * (1 + te.dev) * prog.growthRate * (p.attrs[A.cns] > 70 ? 1.03 : 1);
  const gain = gap * rate;
  const focus = youthPlan ?? (isUser && club ? club.training.focus : 'balanced');
  if (gain > 0.001) distribute(p, gain, focusWeights(p, focus === 'recovery' || focus === 'matchPrep' ? 'balanced' : focus, p.youth?.devPos), ctx.rng);
  decline(p, age, prog.declineRate, prog.declineAge + (p.pos === 'GK' ? 2 : 0), ctx.rng, e ? e.physical : 0);
  // experiência e ritmo
  p.experience = clamp(p.experience + minutes / 900, 0, 100);
  const played = (p.recentMinutes[p.recentMinutes.length - 1] ?? 0) > 0;
  p.sharpness = clamp(p.sharpness + (played ? 6 : -3), 20, 100);
  p.recentMinutes.push(0);
  if (p.recentMinutes.length > 6) p.recentMinutes.shift();
  p.ovr = computeOvr(p);
  // jogadores criados no editor acima do potencial não são reduzidos silenciosamente
  if (p.pot < p.ovr) p.pot = p.ovr;
  if (p.youth) p.youth.recentGain = Math.round((p.youth.recentGain * 0.7 + (p.ovr - before) * 4) * 100) / 100;
  return p.ovr - before;
}

/** Moral semanal: tempo de jogo frente ao papel esperado, ambição, estrutura e situação do clube. */
export function weeklyMorale(c: Career, p: Player, rng: Rng): void {
  if (!p.clubId || p.squad !== 'senior') return;
  const club = c.clubs[p.clubId];
  const te = traitEffects(p.traits);
  const role = p.contract?.role ?? 'rotation';
  const minutes = p.recentMinutes.reduce((s, x) => s + x, 0);
  const expected = { key: 400, first: 300, rotation: 160, backup: 60, prospect: 40 }[role];
  let d = (65 - p.morale) * 0.08;
  if (minutes < expected * 0.5 && !p.injury) {
    d -= role === 'key' || role === 'first' ? 2.2 : 0.8;
    if (te.ambition > 0 || p.traits.includes('vaidoso')) d -= 1;
    if (p.traits.includes('lider')) d -= 0.6;
    p.happiness = 'Quer mais tempo de jogo';
  } else if (p.happiness === 'Quer mais tempo de jogo') p.happiness = undefined;
  if (te.ambition > 0 && club.level + 2 < ovrToLevel(p.ovr)) {
    d -= 0.7;
    p.happiness = p.happiness ?? 'Quer jogar em um clube maior';
  }
  if (p.traits.includes('profissional') && club.facilities.tc_pitches + club.facilities.tc_gym < 6) d -= 0.4;
  d += rng.normal(0, 0.6 + te.moraleVolatility * 1.2);
  p.morale = clamp(p.morale + d, 0, 100);
}

/** Recuperação diária: condição física e lesões. */
export function dailyRecovery(c: Career, rng: Rng, effects: Map<string, Effects>): void {
  const set = recovering(c);
  for (const pid of [...set]) {
    const p = c.players[pid];
    if (!p) {
      set.delete(pid);
      continue;
    }
    const club = p.clubId ? c.clubs[p.clubId] : null;
    let e = club ? effects.get(club.id) : undefined;
    if (club && !e) effects.set(club.id, (e = clubEffects(c, club)));
    const rec = e ? e.recovery : 0.9;
    const userClub = club?.id === c.userClubId;
    const focusRec = userClub && club!.training.focus === 'recovery' ? 1.25 : 1;
    const intensity = userClub ? [1.1, 1, 0.9][club!.training.intensity] : 1;
    if (p.condition < 100) p.condition = clamp(p.condition + 6.5 * rec * focusRec * intensity * (0.8 + p.attrs[A.sta] / 250), 0, 100);
    if (p.injury) {
      p.injury.daysLeft -= e ? e.injuryHeal : 0.9;
      if (p.injury.daysLeft <= 0) {
        p.injuries.push({ name: p.injury.name, days: c.day - p.injury.since, season: c.season });
        if (p.injuries.length > 20) p.injuries.shift();
        p.injury = null;
        p.condition = Math.min(p.condition, 75);
        p.sharpness = Math.min(p.sharpness, 55);
      }
    }
    if (p.condition >= 100 && !p.injury) set.delete(pid);
  }
  void rng;
}

const INJURIES: { name: string; min: number; max: number; sev: number }[] = [
  { name: 'Dores musculares', min: 3, max: 8, sev: 1 },
  { name: 'Entorse no tornozelo', min: 7, max: 21, sev: 1 },
  { name: 'Lesão na coxa', min: 12, max: 35, sev: 2 },
  { name: 'Estiramento na panturrilha', min: 10, max: 28, sev: 2 },
  { name: 'Contusão no joelho', min: 8, max: 30, sev: 2 },
  { name: 'Lesão no adutor', min: 14, max: 40, sev: 2 },
  { name: 'Fratura no pé', min: 45, max: 90, sev: 3 },
  { name: 'Ruptura de ligamento do joelho', min: 150, max: 260, sev: 3 },
];

export function rollInjury(rng: Rng, severityBias = 0): { name: string; days: number; sev: number } {
  const r = rng.next() + severityBias;
  const idx = r < 0.32 ? 0 : r < 0.55 ? 1 : r < 0.72 ? 2 : r < 0.83 ? 3 : r < 0.91 ? 4 : r < 0.97 ? 5 : r < 0.994 ? 6 : 7;
  const t = INJURIES[idx];
  return { name: t.name, days: rng.int(t.min, t.max), sev: t.sev };
}

/** Lesões em treinos: dependem de intensidade, estrutura médica, campos e propensão do atleta. */
export function trainingInjuries(c: Career, rng: Rng, effects: Map<string, Effects>): Player[] {
  const out: Player[] = [];
  for (const club of Object.values(c.clubs)) {
    let e = effects.get(club.id);
    if (!e) effects.set(club.id, (e = clubEffects(c, club)));
    const user = club.id === c.userClubId;
    const intensity = user ? [0.7, 1, 1.45][club.training.intensity] : 1;
    const pitch = 1 + (10 - club.facilities.tc_pitches) * 0.03;
    for (const id of club.playerIds) {
      const p = c.players[id];
      if (!p || p.injury) continue;
      const te = traitEffects(p.traits);
      const risk = 0.0035 * intensity * pitch * e.injuryRisk * (1 + te.injury + te.trainingFatigue * 0.3) * (p.condition < 60 ? 1.4 : 1);
      if (rng.chance(risk)) {
        const inj = rollInjury(rng, -0.15);
        p.injury = { name: inj.name, daysLeft: inj.days, since: c.day, severity: inj.sev };
        markRecovering(c, p.id);
        out.push(p);
      }
    }
  }
  return out;
}

export function refreshValues(c: Career): void {
  for (const p of Object.values(c.players)) p.value = marketValue(p, c.season);
}

export function attrDeltaLabel(i: number): string {
  return ATTRS[i].name;
}
