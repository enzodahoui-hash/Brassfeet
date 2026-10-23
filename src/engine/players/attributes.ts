import type { Player, Pos } from '../types';
import { clamp } from '../core/rng';

export const ATTRS = [
  { key: 'fin', name: 'Finalização', group: 'tec' },
  { key: 'pas', name: 'Passe', group: 'tec' },
  { key: 'vis', name: 'Visão de jogo', group: 'tec' },
  { key: 'dri', name: 'Drible', group: 'tec' },
  { key: 'cro', name: 'Cruzamento', group: 'tec' },
  { key: 'mar', name: 'Marcação', group: 'tec' },
  { key: 'tac', name: 'Desarme', group: 'tec' },
  { key: 'hea', name: 'Cabeceio', group: 'tec' },
  { key: 'bct', name: 'Controle de bola', group: 'tec' },
  { key: 'psn', name: 'Posicionamento', group: 'tec' },
  { key: 'pac', name: 'Velocidade', group: 'fis' },
  { key: 'acc', name: 'Aceleração', group: 'fis' },
  { key: 'str', name: 'Força', group: 'fis' },
  { key: 'sta', name: 'Resistência', group: 'fis' },
  { key: 'agi', name: 'Agilidade', group: 'fis' },
  { key: 'jum', name: 'Impulsão', group: 'fis' },
  { key: 'dec', name: 'Decisões', group: 'men' },
  { key: 'com', name: 'Compostura', group: 'men' },
  { key: 'tea', name: 'Trabalho em equipe', group: 'men' },
  { key: 'lea', name: 'Liderança', group: 'men' },
  { key: 'con', name: 'Concentração', group: 'men' },
  { key: 'cns', name: 'Consistência', group: 'men' },
  { key: 'ref', name: 'Reflexos', group: 'gol' },
  { key: 'han', name: 'Manejo', group: 'gol' },
  { key: 'one', name: 'Um contra um', group: 'gol' },
  { key: 'aer', name: 'Saída do gol / alto', group: 'gol' },
  { key: 'dis', name: 'Reposição', group: 'gol' },
] as const;

export type AttrKey = (typeof ATTRS)[number]['key'];
export const ATTR_COUNT = ATTRS.length;
export const A: Record<AttrKey, number> = Object.fromEntries(ATTRS.map((a, i) => [a.key, i])) as Record<AttrKey, number>;
export const ATTR_GROUPS: Record<string, string> = { tec: 'Técnicos', fis: 'Físicos', men: 'Mentais', gol: 'Goleiro' };

export const POSITIONS: Pos[] = ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST'];
export const POS_NAME: Record<Pos, string> = {
  GK: 'Goleiro', RB: 'Lateral-direito', CB: 'Zagueiro', LB: 'Lateral-esquerdo', DM: 'Volante', CM: 'Meio-campista',
  AM: 'Meia-atacante', RM: 'Meia-direita', LM: 'Meia-esquerda', RW: 'Ponta-direita', LW: 'Ponta-esquerda', ST: 'Centroavante',
};
export const POS_SHORT: Record<Pos, string> = {
  GK: 'GOL', RB: 'LD', CB: 'ZAG', LB: 'LE', DM: 'VOL', CM: 'MC', AM: 'MEI', RM: 'MD', LM: 'ME', RW: 'PD', LW: 'PE', ST: 'ATA',
};
export type Line = 'G' | 'D' | 'M' | 'A';
export const POS_LINE: Record<Pos, Line> = { GK: 'G', RB: 'D', CB: 'D', LB: 'D', DM: 'M', CM: 'M', AM: 'M', RM: 'M', LM: 'M', RW: 'A', LW: 'A', ST: 'A' };

type W = Partial<Record<AttrKey, number>>;
/** Pesos por posição: a nota geral NÃO é a média simples, cada posição valoriza atributos diferentes. */
export const POS_WEIGHTS: Record<Pos, W> = {
  GK: { ref: 10, han: 8, one: 7, aer: 6, dis: 4, psn: 5, con: 4, com: 3, dec: 3, agi: 3, jum: 2, lea: 1, cns: 2 },
  CB: { mar: 9, tac: 9, hea: 7, psn: 8, str: 6, jum: 4, con: 5, dec: 4, com: 3, pac: 3, pas: 2, tea: 2, lea: 1, cns: 2, acc: 2 },
  RB: { tac: 6, mar: 6, pac: 6, acc: 5, sta: 5, cro: 5, psn: 4, pas: 3, dri: 2, tea: 3, dec: 2, con: 3, agi: 2, cns: 1 },
  LB: { tac: 6, mar: 6, pac: 6, acc: 5, sta: 5, cro: 5, psn: 4, pas: 3, dri: 2, tea: 3, dec: 2, con: 3, agi: 2, cns: 1 },
  DM: { tac: 8, mar: 6, pas: 6, psn: 6, sta: 5, str: 4, dec: 5, tea: 5, con: 4, vis: 2, bct: 3, com: 3, cns: 2 },
  CM: { pas: 9, vis: 6, bct: 6, dec: 6, sta: 5, tea: 5, tac: 3, dri: 3, fin: 2, com: 4, psn: 3, acc: 2, cns: 2 },
  AM: { vis: 8, pas: 8, dri: 7, bct: 7, fin: 5, dec: 5, com: 5, acc: 4, agi: 4, psn: 2, tea: 2, cns: 2 },
  RM: { cro: 7, pas: 6, dri: 6, pac: 6, sta: 6, acc: 5, bct: 4, tea: 4, vis: 3, tac: 2, dec: 3, cns: 1 },
  LM: { cro: 7, pas: 6, dri: 6, pac: 6, sta: 6, acc: 5, bct: 4, tea: 4, vis: 3, tac: 2, dec: 3, cns: 1 },
  RW: { dri: 9, pac: 8, acc: 8, fin: 6, cro: 5, bct: 6, agi: 5, vis: 3, com: 3, pas: 3, dec: 2, cns: 1 },
  LW: { dri: 9, pac: 8, acc: 8, fin: 6, cro: 5, bct: 6, agi: 5, vis: 3, com: 3, pas: 3, dec: 2, cns: 1 },
  ST: { fin: 10, psn: 8, com: 6, hea: 5, bct: 5, acc: 5, pac: 4, str: 4, dri: 4, dec: 3, agi: 2, jum: 2, cns: 2 },
};

/** Compatibilidade entre posições (jogador fora de posição recebe penalidade). */
const RELATED: Partial<Record<Pos, Pos[]>> = {
  RB: ['RM', 'CB', 'LB'], LB: ['LM', 'CB', 'RB'], CB: ['DM', 'RB', 'LB'], DM: ['CM', 'CB'], CM: ['DM', 'AM', 'RM', 'LM'],
  AM: ['CM', 'ST', 'RW', 'LW'], RM: ['RW', 'RB', 'CM'], LM: ['LW', 'LB', 'CM'], RW: ['RM', 'LW', 'ST', 'AM'],
  LW: ['LM', 'RW', 'ST', 'AM'], ST: ['AM', 'RW', 'LW'],
};

export function positionFit(p: Pick<Player, 'pos' | 'alt'>, slot: Pos): number {
  if (p.pos === slot) return 1;
  if (slot === 'GK' || p.pos === 'GK') return p.alt.includes(slot) ? 0.9 : 0.35;
  if (p.alt.includes(slot)) return 0.95;
  if (RELATED[p.pos]?.includes(slot)) return 0.86;
  if (POS_LINE[p.pos] === POS_LINE[slot]) return 0.8;
  return 0.68;
}

export function styleWeights(styleId: string | null): W | null {
  return styleId ? STYLE_WEIGHTS[styleId] ?? null : null;
}
/** Pesos adicionais de estilo (25% da avaliação). Definidos aqui para evitar dependência circular. */
export const STYLE_WEIGHTS: Record<string, W> = {
  artilheiro: { fin: 10, psn: 8, com: 6, hea: 3, acc: 3 },
  pontaDriblador: { dri: 10, agi: 6, acc: 7, bct: 6, pac: 5 },
  armador: { pas: 10, vis: 9, dec: 6, bct: 4 },
  volanteMarcador: { tac: 10, mar: 8, str: 5, sta: 5, psn: 5 },
  zagueiroConstrutor: { pas: 7, com: 6, mar: 6, tac: 6, vis: 4, psn: 5 },
  goleiroReflexos: { ref: 10, agi: 6, one: 6 },
  goleiroConstrutor: { dis: 9, pas: 6, com: 5, han: 5 },
  alaOfensivo: { cro: 8, sta: 7, pac: 6, dri: 4, acc: 5 },
  atacanteProfundidade: { pac: 9, acc: 9, fin: 7, psn: 6 },
  centroavanteReferencia: { hea: 9, str: 8, jum: 6, fin: 6, psn: 5 },
  meiaCriativo: { vis: 9, dri: 7, pas: 7, bct: 6, fin: 3 },
  polivalente: { tea: 6, dec: 5, sta: 5, pas: 3, tac: 3, cns: 4 },
};

function weightedAvg(attrs: number[], w: W): number {
  let s = 0;
  let t = 0;
  for (const k in w) {
    const wt = w[k as AttrKey]!;
    s += attrs[A[k as AttrKey]] * wt;
    t += wt;
  }
  return t ? s / t : 50;
}

/** Nota de 1..100 para uma posição específica. */
export function ratingAt(attrs: number[], pos: Pos, style: string | null = null): number {
  const base = weightedAvg(attrs, POS_WEIGHTS[pos]);
  const sw = styleWeights(style);
  if (!sw) return base;
  // o estilo complementa a avaliação, mas nunca a substitui
  return base * 0.8 + weightedAvg(attrs, sw) * 0.2;
}

export function computeOvr(p: Pick<Player, 'attrs' | 'pos' | 'style'>): number {
  return Math.round(ratingAt(p.attrs, p.pos, p.style) * 10) / 10;
}

// ── Escala 0..25 ──
export const LEVEL_BASE = 40;
export const LEVEL_STEP = 2.2;
export function ovrToLevel(ovr: number): number {
  return clamp((ovr - LEVEL_BASE) / LEVEL_STEP, 0, 25);
}
export function levelToOvr(level: number): number {
  return LEVEL_BASE + level * LEVEL_STEP;
}
/** Nível exibido (inteiro 0..25). Considera atributos/posição e um pequeno ajuste por forma recente. */
export function playerLevel(p: Pick<Player, 'ovr' | 'form'>): number {
  return Math.round(clamp(ovrToLevel(p.ovr) + formAdjust(p.form), 0, 25));
}
export function levelExact(p: Pick<Player, 'ovr'>): number {
  return ovrToLevel(p.ovr);
}
export function potentialLevel(p: Pick<Player, 'pot'>): number {
  return Math.round(ovrToLevel(p.pot));
}
/** Desempenho atual: média recente acima/abaixo de 6,6 desloca até ±0,8 nível. */
export function formAdjust(form: number[]): number {
  if (!form || form.length < 3) return 0;
  const avg = form.reduce((a, b) => a + b, 0) / form.length;
  return clamp((avg - 6.6) * 0.6, -0.8, 0.8);
}

export const LEVEL_LABELS: { max: number; label: string }[] = [
  { max: 4, label: 'Muito modesto' },
  { max: 8, label: 'Pequeno' },
  { max: 12, label: 'Intermediário' },
  { max: 16, label: 'Forte na divisão' },
  { max: 19, label: 'Alto nível' },
  { max: 22, label: 'Elite nacional / destaque internacional' },
  { max: 23, label: 'Gigante mundial' },
  { max: 24, label: 'Superpotência mundial' },
  { max: 25, label: 'Nível máximo excepcional' },
];
export function levelLabel(level: number): string {
  const l = Math.round(level);
  return LEVEL_LABELS.find((x) => l <= x.max)!.label;
}
export function playerLevelLabel(level: number): string {
  if (level >= 24) return 'Lenda em atividade';
  if (level >= 22) return 'Craque mundial';
  if (level >= 19) return 'Estrela';
  if (level >= 16) return 'Titular de elite';
  if (level >= 12) return 'Titular sólido';
  if (level >= 8) return 'Jogador de rotação';
  if (level >= 4) return 'Reserva';
  return 'Iniciante';
}

/** Aviso para combinações contraditórias (ex.: goleiro com atributos de atacante). */
export function attributeWarnings(p: Pick<Player, 'attrs' | 'pos' | 'style' | 'pot' | 'ovr'>): string[] {
  const w: string[] = [];
  const gk = (p.attrs[A.ref] + p.attrs[A.han] + p.attrs[A.one]) / 3;
  const outfield = (p.attrs[A.fin] + p.attrs[A.dri] + p.attrs[A.tac] + p.attrs[A.pas]) / 4;
  if (p.pos === 'GK' && outfield > gk + 15) w.push('Goleiro com atributos de linha superiores aos de goleiro.');
  if (p.pos !== 'GK' && gk > outfield + 10) w.push('Jogador de linha com atributos de goleiro mais altos que os de linha.');
  if (p.pot < p.ovr - 0.5) w.push('O potencial está abaixo da qualidade atual; ele será igualado à nota atual.');
  if (p.pos === 'ST' && p.attrs[A.fin] < 35 && ovrToLevel(p.ovr) > 12) w.push('Centroavante de bom nível com finalização muito baixa.');
  if ((p.pos === 'CB' || p.pos === 'DM') && p.attrs[A.tac] < 35 && ovrToLevel(p.ovr) > 12) w.push('Defensor de bom nível com desarme muito baixo.');
  if (p.style) {
    const sw = STYLE_WEIGHTS[p.style];
    if (sw) {
      const keys = Object.keys(sw) as AttrKey[];
      const avg = keys.reduce((s, k) => s + p.attrs[A[k]], 0) / keys.length;
      if (avg < p.ovr - 12) w.push('Os atributos não combinam com o estilo escolhido; o estilo terá pouco efeito.');
    }
  }
  return w;
}

export function clampAttrs(attrs: number[]): number[] {
  return attrs.map((v) => Math.round(clamp(v, 1, 100)));
}

/**
 * Ajusta todos os atributos relevantes para que a nota da posição atinja o alvo.
 * Usado pelo gerador e pelo Criador de Craques (controle deslizante de nível).
 */
export function scaleToOvr(attrs: number[], pos: Pos, style: string | null, target: number): number[] {
  let out = attrs.slice();
  const w = POS_WEIGHTS[pos];
  const sw = styleWeights(style) ?? {};
  const factors = out.map((_, i) => {
    const key = ATTRS[i].key as AttrKey;
    const group = ATTRS[i].group;
    if (pos !== 'GK' && group === 'gol') return 0; // goleiro só em goleiros
    const rel = (w[key] ?? 0) + (sw[key] ?? 0) * 0.5;
    return rel > 0 ? 1.15 : pos === 'GK' && group !== 'men' ? 0.12 : 0.35;
  });
  // ganho efetivo da nota por unidade de passo (a nota é uma média ponderada linear)
  const probe = out.map((v, i) => v + factors[i]);
  const gain = Math.max(0.05, ratingAt(probe, pos, style) - ratingAt(out, pos, style));
  for (let it = 0; it < 8; it++) {
    const cur = ratingAt(out, pos, style);
    const diff = target - cur;
    if (Math.abs(diff) < 0.15) break;
    const step = diff / gain;
    out = out.map((v, i) => clamp(v + step * factors[i], 1, 100));
  }
  return out.map((v) => Math.round(v));
}
