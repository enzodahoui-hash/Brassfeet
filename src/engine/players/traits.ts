// Sistema modular de personalidade. Para criar um traço novo basta adicionar uma entrada ao registro:
// os módulos de progressão, partida, moral e mercado leem apenas os efeitos numéricos agregados.

export interface TraitEffects {
  dev: number; // ritmo de evolução
  injury: number; // risco de lesão (multiplicador aditivo)
  cards: number; // risco disciplinar
  consistency: number; // reduz variação de desempenho
  bigGame: number; // desempenho em jogos grandes
  teamMorale: number; // influência na moral do elenco
  moraleVolatility: number;
  wageDemand: number;
  ambition: number; // vontade de sair para clube maior
  loyalty: number;
  shooting: number; // tendência a finalizar
  passing: number; // tendência a servir
  cohesion: number;
  repGrowth: number;
  lapses: number; // erros de concentração
  pressure: number; // rendimento sob pressão
  popularity: number;
  trainingFatigue: number;
}

export interface TraitDef {
  id: string;
  name: string;
  desc: string;
  upside: string;
  downside: string;
  effects: Partial<TraitEffects>;
  conflicts?: string[];
}

export const TRAITS: TraitDef[] = [
  { id: 'profissional', name: 'Profissional exemplar', desc: 'Cuida do corpo e segue o plano à risca.', upside: 'Evolui mais e se lesiona menos.', downside: 'Perde moral quando a estrutura do clube é precária.', effects: { dev: 0.12, injury: -0.15, consistency: 0.08, teamMorale: 0.02 } },
  { id: 'ambicioso', name: 'Ambicioso', desc: 'Quer vencer tudo e jogar no maior palco.', upside: 'Evolui mais rápido e cresce em jogos grandes.', downside: 'Fica insatisfeito se o clube não briga por títulos e pede para sair.', effects: { dev: 0.08, ambition: 0.5, bigGame: 0.03, wageDemand: 0.1 } },
  { id: 'lider', name: 'Líder', desc: 'Referência no vestiário.', upside: 'Eleva a moral e a coesão do elenco, sobretudo como capitão.', downside: 'Se fica no banco, a insatisfação contamina o grupo.', effects: { teamMorale: 0.06, cohesion: 0.05, pressure: 0.04 } },
  { id: 'leal', name: 'Leal ao clube', desc: 'Tem forte vínculo com a camisa.', upside: 'Aceita renovar por menos e raramente força saída.', downside: 'Arrisca pouco: evolui um pouco mais devagar.', effects: { loyalty: 0.6, wageDemand: -0.12, ambition: -0.4, dev: -0.03 } },
  { id: 'competitivo', name: 'Competitivo', desc: 'Detesta perder, até no treino.', upside: 'Rende mais em jogos decisivos.', downside: 'Recebe mais cartões.', effects: { bigGame: 0.04, cards: 0.25, dev: 0.03 } },
  { id: 'disciplinado', name: 'Disciplinado', desc: 'Cumpre a função tática sem inventar.', upside: 'Mais regular e menos cartões.', downside: 'Menos ousado: dribla e arrisca menos.', effects: { consistency: 0.1, cards: -0.35, shooting: -0.08, lapses: -0.2 } },
  { id: 'temperamental', name: 'Temperamental', desc: 'Joga no limite emocional.', upside: 'Pode decidir em momentos quentes.', downside: 'Oscila, recebe mais cartões e a moral varia muito.', effects: { cards: 0.6, moraleVolatility: 0.6, consistency: -0.1, bigGame: 0.02 } },
  { id: 'individualista', name: 'Individualista', desc: 'Prefere resolver sozinho.', upside: 'Finaliza mais e cria jogadas pessoais.', downside: 'Passa menos e reduz o entrosamento.', effects: { shooting: 0.25, passing: -0.2, cohesion: -0.05 } },
  { id: 'humilde', name: 'Humilde', desc: 'Discreto e focado no coletivo.', upside: 'Pede salários menores e mantém a moral estável.', downside: 'A reputação cresce mais devagar.', effects: { wageDemand: -0.1, moraleVolatility: -0.3, repGrowth: -0.15, teamMorale: 0.02 } },
  { id: 'vaidoso', name: 'Vaidoso', desc: 'Gosta dos holofotes.', upside: 'Vende mais camisas e ganha reputação rápido.', downside: 'Exige salário alto e perde moral sem protagonismo.', effects: { wageDemand: 0.2, repGrowth: 0.2, popularity: 0.3, moraleVolatility: 0.2 } },
  { id: 'consistente', name: 'Consistente', desc: 'Rende sempre perto do seu nível.', upside: 'Poucas atuações ruins.', downside: 'Também raramente tem atuações espetaculares.', effects: { consistency: 0.18, bigGame: -0.01 } },
  { id: 'desconcentrado', name: 'Propenso a perder a concentração', desc: 'Desliga em alguns lances.', upside: 'Nenhum benefício relevante.', downside: 'Comete erros que viram chances do adversário.', effects: { lapses: 0.6, consistency: -0.06 } },
  { id: 'decisivo', name: 'Decisivo em jogos grandes', desc: 'Cresce em finais e clássicos.', upside: 'Rende bem acima do normal em jogos grandes.', downside: 'Em jogos comuns pode render abaixo.', effects: { bigGame: 0.1, consistency: -0.04 } },
  { id: 'resiliente', name: 'Resiliente sob pressão', desc: 'Não se abala com placar adverso.', upside: 'Rende mais quando a equipe está atrás e perde menos moral.', downside: 'Nenhum, mas o efeito só aparece sob pressão.', effects: { pressure: 0.1, moraleVolatility: -0.25 } },
  { id: 'lesoes', name: 'Propenso a lesões', desc: 'Histórico físico delicado.', upside: 'Nenhum.', downside: 'Lesiona-se com muito mais frequência.', effects: { injury: 0.7 } },
  { id: 'dedicado', name: 'Dedicado ao treinamento', desc: 'Primeiro a chegar, último a sair.', upside: 'Evolui mais com treino.', downside: 'Desgaste extra nos treinos e leve risco de sobrecarga.', effects: { dev: 0.1, trainingFatigue: 0.2, injury: 0.05 } },
];

export const TRAIT_MAP: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

const ZERO: TraitEffects = {
  dev: 0, injury: 0, cards: 0, consistency: 0, bigGame: 0, teamMorale: 0, moraleVolatility: 0, wageDemand: 0, ambition: 0,
  loyalty: 0, shooting: 0, passing: 0, cohesion: 0, repGrowth: 0, lapses: 0, pressure: 0, popularity: 0, trainingFatigue: 0,
};

const cache = new Map<string, TraitEffects>();
export function traitEffects(traits: string[]): TraitEffects {
  const k = traits.join(',');
  const hit = cache.get(k);
  if (hit) return hit;
  const out = { ...ZERO };
  for (const id of traits) {
    const t = TRAIT_MAP[id];
    if (!t) continue;
    for (const key in t.effects) {
      out[key as keyof TraitEffects] += t.effects[key as keyof TraitEffects]!;
    }
  }
  cache.set(k, out);
  return out;
}
