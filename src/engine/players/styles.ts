import type { Pos } from '../types';

// Estilos de jogo influenciam a avaliação (25% via STYLE_WEIGHTS em attributes.ts),
// a função tática e o comportamento no motor de partidas. Nunca substituem atributos.

export interface StyleDef {
  id: string;
  name: string;
  positions: Pos[];
  desc: string;
  match: { shot: number; dribble: number; pass: number; cross: number; defend: number; header: number; run: number };
}

export const STYLES: StyleDef[] = [
  { id: 'artilheiro', name: 'Artilheiro', positions: ['ST'], desc: 'Vive para o gol: ocupa a área e finaliza de primeira.', match: { shot: 0.35, dribble: 0, pass: -0.15, cross: 0, defend: -0.1, header: 0.1, run: 0.1 } },
  { id: 'pontaDriblador', name: 'Ponta driblador', positions: ['RW', 'LW', 'RM', 'LM'], desc: 'Busca o um contra um pelos lados.', match: { shot: 0.05, dribble: 0.4, pass: 0, cross: 0.05, defend: -0.1, header: 0, run: 0.15 } },
  { id: 'armador', name: 'Armador', positions: ['CM', 'DM', 'AM'], desc: 'Dita o ritmo e distribui o jogo.', match: { shot: -0.1, dribble: -0.05, pass: 0.4, cross: 0, defend: 0.05, header: 0, run: 0 } },
  { id: 'volanteMarcador', name: 'Volante marcador', positions: ['DM', 'CM'], desc: 'Protege a defesa e rouba bolas.', match: { shot: -0.2, dribble: -0.1, pass: 0, cross: 0, defend: 0.4, header: 0.05, run: 0 } },
  { id: 'zagueiroConstrutor', name: 'Zagueiro construtor', positions: ['CB'], desc: 'Sai jogando com qualidade desde a defesa.', match: { shot: -0.1, dribble: 0, pass: 0.25, cross: 0, defend: 0.15, header: 0.05, run: 0 } },
  { id: 'goleiroReflexos', name: 'Goleiro de reflexos', positions: ['GK'], desc: 'Especialista em defesas difíceis.', match: { shot: 0, dribble: 0, pass: 0, cross: 0, defend: 0.3, header: 0, run: 0 } },
  { id: 'goleiroConstrutor', name: 'Goleiro construtor', positions: ['GK'], desc: 'Participa da saída de bola com os pés.', match: { shot: 0, dribble: 0, pass: 0.3, cross: 0, defend: 0.1, header: 0, run: 0 } },
  { id: 'alaOfensivo', name: 'Ala ofensivo', positions: ['RB', 'LB', 'RM', 'LM'], desc: 'Apoia o ataque e cruza com frequência.', match: { shot: 0, dribble: 0.1, pass: 0.05, cross: 0.4, defend: -0.1, header: 0, run: 0.2 } },
  { id: 'atacanteProfundidade', name: 'Atacante de profundidade', positions: ['ST', 'RW', 'LW'], desc: 'Ataca o espaço nas costas da defesa.', match: { shot: 0.2, dribble: 0.1, pass: -0.1, cross: 0, defend: -0.1, header: 0, run: 0.4 } },
  { id: 'centroavanteReferencia', name: 'Centroavante de referência', positions: ['ST'], desc: 'Segura a bola e ganha pelo alto.', match: { shot: 0.15, dribble: -0.1, pass: 0.1, cross: 0, defend: 0, header: 0.45, run: -0.1 } },
  { id: 'meiaCriativo', name: 'Meia criativo', positions: ['AM', 'CM', 'RW', 'LW'], desc: 'Inventa passes e jogadas entre linhas.', match: { shot: 0.05, dribble: 0.15, pass: 0.3, cross: 0.05, defend: -0.15, header: 0, run: 0.05 } },
  { id: 'polivalente', name: 'Jogador polivalente', positions: ['CM', 'DM', 'RB', 'LB', 'RM', 'LM', 'AM', 'CB'], desc: 'Cumpre várias funções com eficiência.', match: { shot: 0, dribble: 0, pass: 0.1, cross: 0, defend: 0.1, header: 0, run: 0.05 } },
];
export const STYLE_MAP: Record<string, StyleDef> = Object.fromEntries(STYLES.map((s) => [s.id, s]));
export const NO_STYLE = { shot: 0, dribble: 0, pass: 0, cross: 0, defend: 0, header: 0, run: 0 };
export function styleMatch(id: string | null) {
  return (id && STYLE_MAP[id]?.match) || NO_STYLE;
}
export function stylesFor(pos: Pos): StyleDef[] {
  return STYLES.filter((s) => s.positions.includes(pos));
}
