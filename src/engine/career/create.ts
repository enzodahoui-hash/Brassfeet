import type { Career, Difficulty, FinanceSettings, World } from '../types';
import { dayOf } from '../core/date';
import { applyFinanceMode, defaultFinanceSettings } from '../finance/economy';
import { computeQualification } from '../competitions/qualification';
import { buildSeason } from './season';
import { setObjectives } from '../board/board';
import { addNews } from '../news/news';
import { currentCollection } from '../kits/commerce';
import { seedUserStaff } from './staffSeed';
import { resetIndex } from './index';
import { autoLineup } from '../clubs/lineup';

export interface NewCareerOptions {
  clubId: string;
  managerName: string;
  managerNat?: string;
  difficulty: Difficulty;
  finance?: FinanceSettings;
  saveName?: string;
  id?: string;
}

/** Cria uma carreira a partir de uma cópia do universo (o universo original nunca é alterado). */
export function newCareer(world: World, o: NewCareerOptions): Career {
  const base: World = structuredClone(world);
  const club = base.clubs[o.clubId];
  if (!club) throw new Error('Clube inexistente no universo.');
  const startYear = base.config.startYear;
  const c: Career = {
    ...base,
    id: o.id ?? `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    saveName: o.saveName ?? `${club.name} — ${startYear}`,
    userClubId: club.id,
    manager: { name: o.managerName || 'Treinador', nat: o.managerNat ?? club.country, reputation: Math.round(club.level * 3 + 10), history: [], trophies: [], fired: 0 },
    difficulty: o.difficulty,
    finance: o.finance ?? defaultFinanceSettings('realista', club, base as Career),
    day: dayOf(startYear, 1, 1),
    season: startYear,
    competitions: {}, fixtures: {}, news: [], inbox: [], awards: {}, seasonHistory: [], champions: {}, qualification: {}, qualificationWarnings: [],
    intakeCandidates: [], shortlist: [], flags: {}, rngState: 1, seasonEnded: false, firedPending: false, lastAdvance: 0, tutorialDone: false,
    records: {}, offers: [], negotiations: [],
  };
  resetIndex(c);
  applyFinanceMode(c);
  seedUserStaff(c, club);
  club.lineup = autoLineup(c, club, club.tactics.formation);
  const q = computeQualification(c, startYear - 1, true);
  c.qualification = q.lists;
  c.qualificationWarnings = q.warnings;
  const warnings = buildSeason(c, startYear);
  setObjectives(c, club);
  currentCollection(c);
  addNews(c, { kind: 'board', icon: 'board', title: `${c.manager.name} é o novo treinador do ${club.name}`, body: `O presidente ${club.board.president} apresentou o novo comandante e definiu as metas para ${startYear}. Boa sorte!`, clubIds: [club.id], playerIds: [], important: true, link: { screen: 'club' } });
  if (warnings.length) addNews(c, { kind: 'warning', icon: 'warning', title: 'Avisos de configuração', body: warnings.join(' '), clubIds: [], playerIds: [], important: true, link: { screen: 'editor' } });
  return c;
}
