import type { Player } from '../types';
import { clamp } from '../core/rng';
import { levelExact, ovrToLevel } from './attributes';
import { traitEffects } from './traits';

/** Valor de referência por nível: cresce exponencialmente (nível 10 ≈ 1 mi, nível 24 ≈ 150 mi). */
export function baseValueForLevel(level: number): number {
  return 27_000 * Math.exp(0.36 * level);
}

export function ageValueFactor(age: number, potGap: number): number {
  if (age <= 21) return 1 + clamp(potGap, 0, 12) * 0.09 * (age <= 19 ? 1.2 : 1);
  if (age <= 23) return 1 + clamp(potGap, 0, 8) * 0.05;
  if (age <= 28) return 1;
  const table: Record<number, number> = { 29: 0.85, 30: 0.7, 31: 0.55, 32: 0.42, 33: 0.3, 34: 0.2 };
  return table[age] ?? 0.12;
}

export function contractFactor(yearsLeft: number): number {
  if (yearsLeft <= 0) return 0.5;
  if (yearsLeft === 1) return 0.75;
  return 1;
}

export function roundMoney(v: number): number {
  if (v >= 10_000_000) return Math.round(v / 500_000) * 500_000;
  if (v >= 1_000_000) return Math.round(v / 50_000) * 50_000;
  if (v >= 100_000) return Math.round(v / 5_000) * 5_000;
  return Math.max(5_000, Math.round(v / 1_000) * 1_000);
}

export function marketValue(p: Pick<Player, 'ovr' | 'pot' | 'birthYear' | 'contract' | 'reputation' | 'injury' | 'pos'>, season: number): number {
  const lvl = ovrToLevel(p.ovr);
  const age = season - p.birthYear;
  const gap = ovrToLevel(p.pot) - lvl;
  let v = baseValueForLevel(lvl) * ageValueFactor(age, gap);
  v *= contractFactor(p.contract ? p.contract.endYear - season : 0);
  v *= 0.9 + clamp(p.reputation, 0, 100) / 400; // 0,9..1,15
  if (p.pos === 'GK') v *= 0.8;
  if (p.injury && p.injury.daysLeft > 60) v *= 0.85;
  return roundMoney(v);
}

/** Salário anual esperado: qualidade, reputação e poder financeiro do clube. */
export function expectedWage(p: Pick<Player, 'ovr' | 'reputation' | 'traits' | 'birthYear'>, clubLevel: number, season: number): number {
  const lvl = ovrToLevel(p.ovr);
  const base = 8_000 + baseValueForLevel(lvl) * 0.2;
  const clubPay = 0.55 + clamp(clubLevel, 0, 25) / 25; // clubes ricos pagam mais
  const rep = 0.9 + p.reputation / 500;
  const t = traitEffects(p.traits);
  const age = season - p.birthYear;
  const youth = age <= 19 ? 0.6 : 1;
  return roundMoney(base * clubPay * rep * (1 + t.wageDemand) * youth);
}

export function playerReputation(level: number, clubLevel: number): number {
  return Math.round(clamp(level * 3.4 + clubLevel * 0.6, 0, 100));
}

export function levelOf(p: Pick<Player, 'ovr'>): number {
  return levelExact(p);
}
