import type { Career, Club, Player, SquadType } from '../types';
import { assignShirt } from '../universe/world';
import { ovrToLevel } from '../players/attributes';
import { addInto, emptyStats, normalizeLine, parseKey } from '../players/stats';

export const MAX_SENIOR = 32;
export const MIN_SENIOR = 18;

export function removeFromClub(c: Career, p: Player): void {
  if (!p.clubId) return;
  const club = c.clubs[p.clubId];
  if (club) {
    club.playerIds = club.playerIds.filter((x) => x !== p.id);
    club.youthIds = club.youthIds.filter((x) => x !== p.id);
    if (club.lineup) {
      club.lineup.starters = club.lineup.starters.map((x) => (x === p.id ? null : x));
      club.lineup.bench = club.lineup.bench.filter((x) => x !== p.id);
    }
    if (club.tactics.captain === p.id) club.tactics.captain = null;
    if (club.tactics.penaltyTaker === p.id) club.tactics.penaltyTaker = null;
    if (club.tactics.freeKickTaker === p.id) club.tactics.freeKickTaker = null;
  }
  p.clubId = null;
}

/** Fecha o trecho de carreira no clube atual (preserva estatísticas e histórico). */
export function closeSpell(c: Career, p: Player, loan = false): void {
  if (!p.clubId) return;
  const club = c.clubs[p.clubId];
  // soma só o que o jogador produziu por ESTE clube na temporada (as linhas já trazem o clube na chave)
  const agg = emptyStats();
  for (const [k, s] of Object.entries(p.stats)) {
    const { season, clubId } = parseKey(k);
    if (season !== c.season || clubId !== club.id) continue;
    addInto(agg, normalizeLine(s));
  }
  if (agg.apps <= 0 && !loan) return;
  const entry = {
    season: c.season, clubId: club.id, clubName: club.name, apps: agg.apps, goals: agg.goals, assists: agg.assists,
    avgRating: agg.apps > 0 ? Math.round((agg.ratingSum / agg.apps) * 100) / 100 : 0, level: Math.round(ovrToLevel(p.ovr) * 10) / 10, value: p.value, loan,
  };
  const prev = p.history.find((h) => h.season === c.season && h.clubId === club.id);
  if (prev) Object.assign(prev, entry); // reprocessar não duplica
  else p.history.push(entry);
}

export function moveToClub(c: Career, p: Player, club: Club | null, squad: SquadType = 'senior'): void {
  if (p.clubId) {
    closeSpell(c, p, !!p.loan);
    removeFromClub(c, p);
  }
  p.clubId = club?.id ?? null;
  p.squad = squad;
  p.listed = false;
  p.loanListed = false;
  p.joined = c.day;
  p.shirt = 0;
  if (!club) return;
  if (squad === 'senior') club.playerIds.push(p.id);
  else club.youthIds.push(p.id);
  assignShirt(c, club, p);
  club.cohesion = Math.max(20, club.cohesion - 3);
}

export function seniorCount(club: Club): number {
  return club.playerIds.length;
}
