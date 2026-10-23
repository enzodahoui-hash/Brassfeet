// Datas do jogo são inteiros: dias desde 01/01/2000 (UTC). Nunca dependem do relógio do computador.

export type Day = number;
const MS = 86400000;
const EPOCH = Date.UTC(2000, 0, 1);

export function dayOf(y: number, m: number, d: number): Day {
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / MS);
}
export function ymd(day: Day): { y: number; m: number; d: number } {
  const dt = new Date(EPOCH + day * MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
export function yearOf(day: Day): number {
  return ymd(day).y;
}
/** 0 = domingo ... 6 = sábado */
export function weekday(day: Day): number {
  return new Date(EPOCH + day * MS).getUTCDay();
}
/** "MM-DD" → dia no ano informado */
export function mmdd(year: number, s: string): Day {
  const [m, d] = s.split('-').map(Number);
  return dayOf(year, m, d);
}
/** Primeiro dia >= day que cai no dia da semana pedido. */
export function onOrAfter(day: Day, wd: number): Day {
  return day + ((wd - weekday(day) + 7) % 7);
}
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function fmtDay(day: Day): string {
  const { y, m, d } = ymd(day);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}
export function fmtShort(day: Day): string {
  const { m, d } = ymd(day);
  return `${d} ${MONTHS[m - 1]}`;
}
export function fmtLong(day: Day): string {
  const { y, m, d } = ymd(day);
  return `${WD[weekday(day)]}, ${d} de ${MONTHS_FULL[m - 1]} de ${y}`;
}
export function weekdayName(day: Day): string {
  return WD[weekday(day)];
}
export function monthName(m: number): string {
  return MONTHS_FULL[m - 1];
}
export function isFirstOfMonth(day: Day): boolean {
  return ymd(day).d === 1;
}
export function inWindow(day: Day, year: number, start: string, end: string): boolean {
  return day >= mmdd(year, start) && day <= mmdd(year, end);
}
