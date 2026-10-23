import type { Pos, SubPlan, SubRegulation, SubRule } from '../types';

// Configuração de substituições automáticas e regulamento. A decisão em si fica no motor (engine.ts),
// porque depende do estado minuto a minuto da partida.

export const DEFAULT_REG: SubRegulation = { max: 5, windows: 3, etExtra: 1, etWindows: 1 };

export function defaultSubPlan(mode: SubPlan['mode'] = 'smart'): SubPlan {
  return { mode, fatigue: 65, posFatigue: {}, confirm: false, variety: true, rules: [] };
}

export const SUB_MODES: { id: SubPlan['mode']; name: string; desc: string }[] = [
  { id: 'manual', name: 'Manual', desc: 'Você faz todas as trocas durante a partida. Em simulações rápidas, só lesionados são substituídos.' },
  { id: 'rules', name: 'Regras personalizadas', desc: 'O jogo executa apenas as regras que você cadastrar (quem sai, quem entra e quando).' },
  { id: 'fitness', name: 'Automático por condição física', desc: 'O jogo troca atletas cansados por reservas adequados à mesma função.' },
  { id: 'smart', name: 'Inteligente e misto', desc: 'Respeita suas regras e completa as trocas com decisões pelo cansaço e pelo placar.' },
];

/** Exigência física de cada função: pontas e laterais cansam antes de zagueiros e goleiros. */
export const ROLE_DEMAND: Record<Pos, number> = { GK: -30, CB: -4, RB: 5, LB: 5, DM: 2, CM: 3, AM: 2, RM: 4, LM: 4, RW: 6, LW: 6, ST: 3 };

export const ROLE_NAME: Record<Pos, string> = {
  GK: 'goleiro', CB: 'zagueiro', RB: 'lateral-direito', LB: 'lateral-esquerdo', DM: 'volante', CM: 'meio-campista', AM: 'meia', RM: 'meia pela direita', LM: 'meia pela esquerda', RW: 'ponta', LW: 'ponta', ST: 'centroavante',
};

export function roleGoal(slot: Pos): string {
  if (['ST', 'RW', 'LW', 'AM'].includes(slot)) return 'preservar a intensidade ofensiva';
  if (['CB', 'RB', 'LB', 'GK'].includes(slot)) return 'manter a solidez defensiva';
  return 'manter o ritmo no meio-campo';
}

export function newRule(n: number): SubRule {
  return { id: `r${Date.now().toString(36)}${n}`, enabled: true, priority: n, label: `Regra ${n}`, outPid: null, outPos: 'ST', inPid: null, inPos: null, minFrom: 65, minTo: null, condBelow: null, minOvrDiff: null, score: 'any', preserveRole: true };
}

/** Valida uma regra (usado pela interface e pelos testes). */
export function ruleProblems(r: SubRule): string[] {
  const out: string[] = [];
  if (!r.outPid && !r.outPos) out.push('Defina quem sai (jogador ou posição).');
  if (r.minFrom == null && r.condBelow == null && !r.yellowRisk) out.push('Defina quando a troca acontece (minuto, condição física ou risco de cartão).');
  if (r.minFrom != null && r.minTo != null && r.minTo < r.minFrom) out.push('O minuto final é anterior ao inicial.');
  if (r.condBelow != null && (r.condBelow < 5 || r.condBelow > 99)) out.push('Limite de condição física deve ficar entre 5% e 99%.');
  if (r.outPid && r.inPid && r.outPid === r.inPid) out.push('O mesmo jogador não pode sair e entrar.');
  return out;
}
