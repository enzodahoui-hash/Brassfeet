import type { Club, KitCollection, KitDesign, KitPattern } from '../types';
import { clamp, hashString } from '../core/rng';

// ───── cores ─────
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}
export function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}
function lum(hex: string): number {
  const c = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrastRatio(a: string, b: string): number {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
export function colorDistance(a: string, b: string): number {
  const x = hexToRgb(a), y = hexToRgb(b);
  return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2) / 441.7; // 0..1
}
function isNeutral(hex: string): boolean {
  const [, s, l] = rgbToHsl(hexToRgb(hex));
  return s < 0.12 || l < 0.1 || l > 0.93;
}

export const KIT_PATTERNS: { id: KitPattern; name: string; busy: number; rarity: number }[] = [
  { id: 'plain', name: 'Lisa', busy: 0, rarity: 0.2 },
  { id: 'vstripes', name: 'Listras verticais', busy: 0.45, rarity: 0.4 },
  { id: 'hstripes', name: 'Faixas horizontais', busy: 0.5, rarity: 0.55 },
  { id: 'hoops', name: 'Aros largos', busy: 0.45, rarity: 0.6 },
  { id: 'pinstripes', name: 'Risca de giz', busy: 0.2, rarity: 0.65 },
  { id: 'diagonal', name: 'Listras diagonais', busy: 0.55, rarity: 0.7 },
  { id: 'sash', name: 'Faixa transversal', busy: 0.3, rarity: 0.6 },
  { id: 'halves', name: 'Metades', busy: 0.35, rarity: 0.55 },
  { id: 'gradient', name: 'Degradê', busy: 0.25, rarity: 0.8 },
  { id: 'geometric', name: 'Padrão geométrico', busy: 0.7, rarity: 0.9 },
  { id: 'chevron', name: 'Chevron', busy: 0.4, rarity: 0.75 },
];
const PATTERN = Object.fromEntries(KIT_PATTERNS.map((p) => [p.id, p]));

export const BRANDS = ['Vortex', 'Arkos', 'Tribu', 'Nordika', 'Kalango', 'Fenix Sport', 'Ondina', 'Brava'];
export const SPONSORS = ['BancoRio', 'Viação Horizonte', 'TecnoSul', 'Café Serrano', 'Aurora Seguros', 'Mercado Bom Preço', 'Lumen Energia', 'AeroLatina', 'Grupo Atlas', 'VeloNet'];

/** Preferência estável da torcida (derivada do clube) — não muda entre partidas. */
export function fanPreference(club: Pick<Club, 'id'>): { pattern: KitPattern; tradition: number } {
  const h = hashString(club.id);
  const prefs: KitPattern[] = ['plain', 'vstripes', 'hstripes', 'sash', 'halves', 'hoops', 'plain', 'vstripes'];
  return { pattern: prefs[h % prefs.length], tradition: 0.4 + ((h >> 4) % 50) / 100 };
}
/** Tendência fictícia de mercado da temporada. */
export function seasonTrend(season: number): { name: string; patterns: KitPattern[]; collars: string[] } {
  const trends = [
    { name: 'Retrô anos 90', patterns: ['geometric', 'halves', 'sash'] as KitPattern[], collars: ['polo', 'v'] },
    { name: 'Minimalista', patterns: ['plain', 'pinstripes', 'gradient'] as KitPattern[], collars: ['crew', 'round'] },
    { name: 'Clássico listrado', patterns: ['vstripes', 'hstripes', 'hoops'] as KitPattern[], collars: ['round', 'polo'] },
    { name: 'Ousadia gráfica', patterns: ['diagonal', 'chevron', 'geometric'] as KitPattern[], collars: ['v', 'crew'] },
  ];
  return trends[hashString(`trend${season}`) % trends.length];
}

export interface KitScore {
  total: number;
  acceptance: number;
  parts: { harmony: number; contrast: number; identity: number; legibility: number; originality: number; fans: number; trend: number };
  suggestions: string[];
}

/** Avaliação estética reproduzível: mesma camisa, mesmo clube, mesma temporada → mesma nota. */
export function scoreKit(design: KitDesign, club: Pick<Club, 'id' | 'colors' | 'reputation'>, season: number, kind: 'home' | 'away' | 'third' | 'gk' = 'home', previous: KitDesign[] = []): KitScore {
  const [h1, s1] = rgbToHsl(hexToRgb(design.primary));
  const [h2, s2] = rgbToHsl(hexToRgb(design.secondary));
  let harmony: number;
  if (isNeutral(design.primary) || isNeutral(design.secondary)) harmony = 86;
  else {
    const dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
    harmony = dh < 25 ? 80 : dh < 60 ? 62 : dh < 100 ? 70 : dh < 140 ? 82 : dh <= 210 ? 90 : 72;
    if (s1 > 0.85 && s2 > 0.85 && dh > 60 && dh < 140) harmony -= 12; // duas cores saturadas brigando
  }
  const detailClash = colorDistance(design.detail, design.primary) < 0.08 && colorDistance(design.detail, design.secondary) < 0.08 ? -6 : 0;
  harmony = clamp(harmony + detailClash, 0, 100);

  const cr = contrastRatio(design.numberColor, design.primary);
  const contrast = cr >= 4.5 ? 100 : cr >= 3 ? 78 : cr >= 2 ? 55 : 28;

  const clubCols = club.colors;
  const dPrim = Math.min(...clubCols.map((c) => colorDistance(c, design.primary)));
  const dSec = Math.min(...clubCols.map((c) => colorDistance(c, design.secondary)));
  let identity = clamp(100 - dPrim * 140 - dSec * 60, 10, 100);
  if (kind !== 'home') identity = clamp(identity * 0.5 + 55, 0, 100); // reservas podem ousar mais

  const pat = PATTERN[design.pattern] ?? PATTERN.plain;
  const sponsorLoad = design.sponsor ? 0.1 : 0;
  const decoLoad = design.decoration === 'none' ? 0 : 0.08;
  const legibility = clamp(100 - (pat.busy + sponsorLoad + decoLoad) * 55 - (cr < 3 ? 15 : 0), 10, 100);

  let originality = 45 + pat.rarity * 45 + (design.decoration !== 'none' ? 6 : 0);
  for (const prev of previous) {
    const same = prev.pattern === design.pattern && colorDistance(prev.primary, design.primary) < 0.1 && colorDistance(prev.secondary, design.secondary) < 0.15;
    if (same) originality -= 30;
  }
  originality = clamp(originality, 5, 100);

  const pref = fanPreference(club);
  let fans = design.pattern === pref.pattern ? 92 : 62;
  fans = fans * pref.tradition + identity * (1 - pref.tradition);
  if (kind !== 'home') fans = fans * 0.6 + 32;

  const trend = seasonTrend(season);
  const trendScore = (trend.patterns.includes(design.pattern) ? 75 : 45) + (trend.collars.includes(design.collar) ? 20 : 0);

  const parts = { harmony: Math.round(harmony), contrast: Math.round(contrast), identity: Math.round(identity), legibility: Math.round(legibility), originality: Math.round(originality), fans: Math.round(fans), trend: Math.round(trendScore) };
  const total = Math.round(parts.harmony * 0.2 + parts.contrast * 0.12 + parts.identity * 0.18 + parts.legibility * 0.12 + parts.originality * 0.12 + parts.fans * 0.18 + parts.trend * 0.08);
  const acceptance = clamp(Math.round(total * 0.75 + parts.fans * 0.2 + club.reputation * 0.05), 0, 100);
  const suggestions: string[] = [];
  if (parts.contrast < 60) suggestions.push('O número tem pouco contraste com a cor principal: experimente um tom mais claro ou mais escuro.');
  if (parts.identity < 55 && kind === 'home') suggestions.push('A camisa principal se afasta das cores do clube; a torcida tende a rejeitar.');
  if (parts.harmony < 70) suggestions.push('As cores principal e secundária competem entre si; tente uma combinação análoga ou com uma cor neutra.');
  if (parts.legibility < 55) suggestions.push('Padrão e patrocínio deixam a camisa carregada; simplifique um dos elementos.');
  if (parts.originality < 50) suggestions.push('O design repete coleções anteriores; um detalhe novo pode atrair compradores.');
  if (parts.trend < 60) suggestions.push(`A tendência da temporada é "${trend.name}".`);
  return { total, acceptance, parts, suggestions };
}

export function defaultDesign(club: Pick<Club, 'colors' | 'id'>, kind: 'home' | 'away' | 'third' | 'gk'): KitDesign {
  const [c1, c2, c3] = club.colors;
  const h = hashString(club.id);
  const pref = fanPreference(club);
  if (kind === 'home') {
    return { primary: c1, secondary: c2, detail: c3, pattern: pref.pattern === 'hoops' ? 'hstripes' : pref.pattern, collar: (['round', 'v', 'polo', 'crew'] as const)[h % 4], sleeves: 'short', sleeveColor: 'primary', cuffs: true, decoration: 'none', sponsor: SPONSORS[h % SPONSORS.length], brand: BRANDS[h % BRANDS.length], numberColor: contrastRatio(c2, c1) > 2.5 ? c2 : contrastRatio('#ffffff', c1) > 3 ? '#ffffff' : '#111111' };
  }
  if (kind === 'away') {
    const bg = isNeutral(c1) && rgbToHsl(hexToRgb(c1))[2] > 0.8 ? c2 : '#ffffff';
    return { primary: bg, secondary: c1, detail: c2, pattern: 'plain', collar: 'crew', sleeves: 'short', sleeveColor: 'secondary', cuffs: true, decoration: 'pinline', sponsor: SPONSORS[h % SPONSORS.length], brand: BRANDS[h % BRANDS.length], numberColor: contrastRatio(c1, bg) > 2.5 ? c1 : '#111111' };
  }
  if (kind === 'third') {
    return { primary: '#1d2430', secondary: c1, detail: c2, pattern: 'gradient', collar: 'v', sleeves: 'short', sleeveColor: 'primary', cuffs: false, decoration: 'sidepanels', sponsor: SPONSORS[h % SPONSORS.length], brand: BRANDS[h % BRANDS.length], numberColor: '#ffffff' };
  }
  return { primary: '#2bb673', secondary: '#0d3b24', detail: '#ffffff', pattern: 'geometric', collar: 'crew', sleeves: 'long', sleeveColor: 'primary', cuffs: true, decoration: 'none', sponsor: SPONSORS[h % SPONSORS.length], brand: BRANDS[h % BRANDS.length], numberColor: '#0d3b24' };
}

export function defaultKitCollection(club: Club, season: number): KitCollection {
  const home = defaultDesign(club, 'home');
  const sc = scoreKit(home, club, season);
  return {
    id: `${club.id}-k${season}`, season, name: `Coleção ${season}`, home, away: defaultDesign(club, 'away'), third: defaultDesign(club, 'third'), gk: defaultDesign(club, 'gk'),
    launched: false, price: Math.round(45 + club.level * 2.2), unitCost: 14, produced: 0, stock: 0, sold: 0, lostSales: 0, revenue: 0, productionCost: 0, marketing: 0,
    discount: 0, designScore: sc.total, acceptance: sc.acceptance, status: 'rascunho', weeklySales: [],
  };
}

export function referenceKitPrice(club: Pick<Club, 'level'>): number {
  return 40 + club.level * 2.5;
}

/** Demanda semanal de camisas. Não determina sucesso garantido: depende de vários fatores do clube. */
export function weeklyKitDemand(c: KitCollection, club: Pick<Club, 'fans' | 'fanMood' | 'level'>, weeksSinceLaunch: number, starPower: number): number {
  const fansFactor = club.fans * 0.00042;
  const accept = 0.25 + (c.acceptance / 100) * 1.1;
  const perf = 0.7 + (club.fanMood / 100) * 0.6;
  const price = c.price * (1 - c.discount);
  const elasticity = Math.pow(referenceKitPrice(club) / Math.max(5, price), 1.6);
  const marketingBoost = 1 + Math.min(0.7, c.marketing / (club.fans * 0.04 + 25_000)) * Math.exp(-weeksSinceLaunch / 10);
  const freshness = Math.max(0.22, Math.exp(-weeksSinceLaunch / 32));
  const launchBoost = weeksSinceLaunch < 2 ? 1.6 : 1;
  return Math.max(0, Math.round(fansFactor * accept * perf * elasticity * marketingBoost * freshness * launchBoost * (1 + starPower)));
}

export function collectionProfit(c: KitCollection): number {
  return c.revenue - c.productionCost - c.marketing;
}
