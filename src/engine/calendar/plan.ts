import type { CompTemplate, UniverseConfig } from '../types';
import { type Day, mmdd, onOrAfter, weekday } from '../core/date';

// Planejamento de datas: continentais às terças/quintas em semanas reservadas, copas nacionais
// às quartas fora dessas semanas, ligas aos domingos (com rodadas no meio da semana quando necessário).

export const weekIdx = (d: Day) => Math.floor((d + 5) / 7);

export interface ContinentalDates {
  pre: Day[];
  groups: Day[];
  ko: Record<string, Day[]>; // R16, QF, SF, F
}

export function continentalDates(t: CompTemplate, year: number): ContinentalDates {
  const wd = t.dates.weekday;
  const at = (s: string) => onOrAfter(mmdd(year, s), wd);
  return {
    pre: [at('03-03'), at('03-10')],
    groups: [at('04-07'), at('04-21'), at('05-05'), at('05-19'), at('06-02'), at('06-16')],
    ko: { R32: [at('07-21'), at('07-28')], R16: [at('08-04'), at('08-18')], QF: [at('09-01'), at('09-15')], SF: [at('10-06'), at('10-20')], F: [onOrAfter(mmdd(year, '11-21'), 6)] },
  };
}

export function regionOf(config: UniverseConfig, country: string): 'SA' | 'EU' {
  return config.countries.find((c) => c.code === country)?.region ?? 'SA';
}

/** Semanas ocupadas por competições continentais em cada região. */
export function continentalWeeks(config: UniverseConfig, year: number): Record<string, Set<number>> {
  const out: Record<string, Set<number>> = { SA: new Set(), EU: new Set() };
  for (const t of Object.values(config.competitions)) {
    if (t.kind !== 'continental' || !t.enabled) continue;
    const d = continentalDates(t, year);
    for (const day of [...d.pre, ...d.groups, ...Object.values(d.ko).flat()]) out[t.region]?.add(weekIdx(day));
  }
  return out;
}

export function daysOfWeek(start: Day, end: Day, wd: number): Day[] {
  const out: Day[] = [];
  for (let d = onOrAfter(start, wd); d <= end; d += 7) out.push(d);
  return out;
}

/** Escolhe n itens espalhados uniformemente (mantém o primeiro e o último). */
export function spread<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return arr.slice();
  if (n <= 0) return [];
  if (n === 1) return [arr[0]];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  return out;
}

/** Quartas-feiras disponíveis para competições domésticas de um país. */
export function domesticMidweeks(config: UniverseConfig, country: string, year: number, start: Day, end: Day): Day[] {
  const busy = continentalWeeks(config, year)[regionOf(config, country)] ?? new Set();
  return daysOfWeek(start, end, 3).filter((d) => !busy.has(weekIdx(d)));
}

/** Datas para N jogos de copa (cada perna ocupa uma data). */
export function cupDates(config: UniverseConfig, t: CompTemplate, year: number, slots: number): Day[] {
  const start = mmdd(year, t.dates.start);
  const end = mmdd(year, t.dates.end);
  const mids = domesticMidweeks(config, t.country ?? 'BRA', year, start, end);
  if (mids.length >= slots) return spread(mids, slots);
  // poucas datas: usa também quintas-feiras livres
  const extra = daysOfWeek(start, end, 4).filter((d) => !mids.includes(d - 1));
  return spread([...mids, ...extra].sort((a, b) => a - b), slots);
}

/** Datas das rodadas de liga: domingos e, se faltar, quartas livres (que não são da copa nacional). */
export function leagueDates(config: UniverseConfig, t: CompTemplate, year: number, rounds: number, reserved: Set<Day>): Day[] {
  const start = mmdd(year, t.dates.start);
  const end = mmdd(year, t.dates.end);
  const sundays = daysOfWeek(start, end, t.dates.weekday ?? 0);
  if (rounds <= sundays.length) return spread(sundays, rounds);
  const need = rounds - sundays.length;
  const mids = domesticMidweeks(config, t.country ?? 'BRA', year, start, end).filter((d) => !reserved.has(d) && !reserved.has(d + 1) && !reserved.has(d - 1));
  const chosen = spread(mids.slice(1, -1), need);
  return [...sundays, ...chosen].sort((a, b) => a - b);
}

export function dayIsWeekend(d: Day): boolean {
  const w = weekday(d);
  return w === 0 || w === 6;
}
