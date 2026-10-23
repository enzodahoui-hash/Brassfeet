import type { Career, StaffRole } from '../types';
import { clamp } from '../core/rng';
import { post } from '../finance/ledger';
import { addNews } from '../news/news';
import { ovrToLevel } from './attributes';
import { canSpend } from '../infra/infra';
import { ROLE_NAME } from '../infra/infra';

/** Homenagem a um atleta do clube: custa dinheiro, eleva moral e torcida (uma vez por temporada). */
export function payTribute(c: Career, pid: string): string | null {
  const p = c.players[pid];
  const club = c.clubs[c.userClubId];
  if (!p || p.clubId !== club.id) return 'Jogador não pertence ao clube.';
  const key = `tribute|${pid}|${c.season}`;
  if (club.ledger.some((e) => e.key === key)) return 'Este jogador já foi homenageado nesta temporada.';
  const cost = Math.round(40_000 + ovrToLevel(p.ovr) * 8_000);
  if (!canSpend(c, club, cost)) return 'Saldo insuficiente.';
  post(c, club, { key, day: c.day, amount: -cost, cat: 'outras despesas', desc: `Homenagem a ${p.name}` });
  p.morale = clamp(p.morale + 12, 0, 100);
  club.fanMood = clamp(club.fanMood + 3, 0, 100);
  for (const id of club.playerIds) if (id !== pid) c.players[id].morale = clamp(c.players[id].morale + 1, 0, 100);
  addNews(c, { kind: 'board', icon: 'star', title: `${club.name} homenageia ${p.name}`, body: 'Cerimônia antes do jogo emocionou a torcida e o elenco.', clubIds: [club.id], playerIds: [pid] });
  return null;
}

/** Despedida planejada: o jogador encerra a carreira ao fim da temporada, com cerimônia. */
export function planFarewell(c: Career, pid: string, on: boolean): string | null {
  const p = c.players[pid];
  if (!p || p.clubId !== c.userClubId) return 'Jogador não pertence ao clube.';
  if (on && c.season - p.birthYear < 31) return 'Despedidas só fazem sentido para veteranos (31+).';
  p.farewell = on;
  if (on) addNews(c, { kind: 'retire', icon: 'retire', title: `${p.name} fará sua última temporada`, body: 'O clube prepara uma despedida para o fim do ano.', clubIds: [c.userClubId], playerIds: [pid] });
  return null;
}

/** Define uma possível função na comissão após a aposentadoria (aumenta a chance de aceitar). */
export function setFutureRole(c: Career, pid: string, role: StaffRole | null): string | null {
  const p = c.players[pid];
  if (!p || p.clubId !== c.userClubId) return 'Jogador não pertence ao clube.';
  if (c.season - p.birthYear < 29) return 'Avalie funções futuras para jogadores a partir de 29 anos.';
  p.futureRole = role ?? undefined;
  return role ? null : null;
}

export function toggleListed(c: Career, pid: string, loan = false): void {
  const p = c.players[pid];
  if (!p) return;
  if (loan) p.loanListed = !p.loanListed;
  else p.listed = !p.listed;
}

export { ROLE_NAME };
