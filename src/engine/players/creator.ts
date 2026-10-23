import type { Appearance, Career, Club, Foot, Player, Pos, SquadRole, World } from '../types';
import { Rng, clamp, hashString } from '../core/rng';
import { attributeWarnings, computeOvr, levelToOvr, ovrToLevel, positionFit } from './attributes';
import { buildAttrs, nextId } from './generate';
import { expectedWage, marketValue, playerReputation, roundMoney } from './value';
import { assignShirt, wageBill, assignRoles } from '../universe/world';
import { invalidateRatings } from '../clubs/lineup';

export type Placement = 'userPro' | 'userYouth' | 'otherClub' | 'free';

export interface CreatorSpec {
  firstName: string;
  lastName: string;
  name: string;
  age: number;
  nat: string;
  pos: Pos;
  alt: Pos[];
  foot: Foot;
  height: number;
  weight: number;
  appearance: Appearance;
  level: number;
  potential: number;
  attrs?: number[];
  traits: string[];
  style: string | null;
  placement: Placement;
  clubId?: string;
  shirt?: number;
  formativeClub?: string;
  backstory?: string;
  promise?: string;
  experience: number;
  reputation?: number;
  value?: number;
  wage?: number;
  contractYears: number;
  expectations?: string;
  role?: SquadRole;
}

export const PRESETS: { id: string; name: string; desc: string; apply: (s: CreatorSpec) => Partial<CreatorSpec> }[] = [
  { id: 'jovem', name: 'Jovem promessa', desc: '17 anos, nível baixo e potencial alto.', apply: () => ({ age: 17, level: 9, potential: 22, experience: 5, traits: ['dedicado'], promise: 'Promessa da base', placement: 'userYouth' }) },
  { id: 'excepcional', name: 'Talento excepcional', desc: '19 anos, já titular e com potencial máximo.', apply: () => ({ age: 19, level: 16, potential: 25, experience: 25, traits: ['ambicioso', 'decisivo'], promise: 'Joia rara' }) },
  { id: 'craque', name: 'Craque mundial', desc: 'No auge, entre os melhores do universo.', apply: () => ({ age: 26, level: 24, potential: 25, experience: 70, traits: ['profissional', 'decisivo'], promise: 'Estrela consolidada' }) },
  { id: 'veterano', name: 'Veterano experiente', desc: '33 anos, líder e com pouca margem de evolução.', apply: () => ({ age: 33, level: 17, potential: 17, experience: 95, traits: ['lider', 'profissional'], promise: 'Referência do vestiário' }) },
  { id: 'especialista', name: 'Especialista em uma posição', desc: 'Atributos concentrados no estilo escolhido.', apply: (s) => ({ age: 25, level: 16, potential: 18, experience: 45, traits: ['consistente'], style: s.style ?? 'artilheiro' }) },
  { id: 'equilibrado', name: 'Jogador equilibrado', desc: 'Versátil e regular.', apply: () => ({ age: 24, level: 14, potential: 17, experience: 40, traits: ['disciplinado'], style: 'polivalente' }) },
  { id: 'manual', name: 'Criação totalmente manual', desc: 'Você define cada campo e atributo.', apply: () => ({}) },
];

export function defaultSpec(world: World, userClubId?: string): CreatorSpec {
  return {
    firstName: 'Novo', lastName: 'Craque', name: 'Novo Craque', age: 18, nat: 'BRA', pos: 'ST', alt: [], foot: 'D', height: 181, weight: 76,
    appearance: { skin: 2, hair: 1, hairColor: 0, beard: 0, face: 0 }, level: 10, potential: 20, traits: [], style: 'artilheiro', placement: userClubId ? 'userPro' : 'free',
    clubId: userClubId, experience: 10, contractYears: 4, role: 'rotation',
  };
}

/** Atributos coerentes com o nível escolhido (determinísticos para o mesmo nome/posição/estilo). */
export function attrsForSpec(s: CreatorSpec): number[] {
  if (s.attrs?.length) return s.attrs.map((v) => Math.round(clamp(v, 1, 100)));
  const rng = new Rng(hashString(`${s.name}|${s.pos}|${s.style}|${s.age}`));
  return buildAttrs(rng, s.pos, s.age, levelToOvr(clamp(s.level, 0, 25)), s.style, s.height);
}

export interface CreatorPreview {
  player: Player;
  level: number;
  levelExact: number;
  potentialLevel: number;
  warnings: string[];
  comparisons: { id: string; name: string; club: string; level: number; age: number; value: number }[];
  finance: { wage: number; value: number; wageBillBefore: number; wageBillAfter: number; budget: number; balance: number; club?: string } | null;
}

function targetClub(world: World | Career, s: CreatorSpec): Club | null {
  if (s.placement === 'free') return null;
  if (s.placement === 'userPro' || s.placement === 'userYouth') return 'userClubId' in world ? world.clubs[(world as Career).userClubId] : s.clubId ? world.clubs[s.clubId] : null;
  return s.clubId ? world.clubs[s.clubId] : null;
}

/** Monta o jogador sem inseri-lo no universo (para visualização, comparação e impacto financeiro). */
export function previewCreated(world: World | Career, s: CreatorSpec): CreatorPreview {
  const season = 'season' in world ? (world as Career).season : world.config.startYear;
  const attrs = attrsForSpec(s);
  const club = targetClub(world, s);
  const p: Player = {
    id: 'preview', num: 0, firstName: s.firstName, lastName: s.lastName, name: s.name || `${s.firstName} ${s.lastName}`, nat: s.nat, birthYear: season - s.age, pos: s.pos,
    alt: s.alt.filter((x) => x !== s.pos), foot: s.foot, height: s.height, weight: s.weight, attrs, ovr: 0, pot: 0, style: s.style, traits: s.traits.slice(0, 4), clubId: club?.id ?? null,
    squad: s.placement === 'userYouth' ? 'youth' : 'senior', shirt: s.shirt ?? 0, contract: null, value: 0, reputation: 0, morale: 75, condition: 100, sharpness: 70, form: [],
    injury: null, injuries: [], susp: {}, yellows: {}, stats: {}, history: [], achievements: [], origin: 'creator', appearance: s.appearance,
    experience: clamp(s.experience, 0, 100), joined: 0, recentMinutes: [],
    creator: { formativeClub: s.formativeClub, backstory: s.backstory, promise: s.promise, expectations: s.expectations, freeEdit: true },
  };
  p.ovr = computeOvr(p);
  p.pot = Math.max(p.ovr, levelToOvr(clamp(s.potential, 0, 25)));
  p.reputation = s.reputation ?? playerReputation(ovrToLevel(p.ovr), club?.level ?? 10);
  if (club) {
    const wage = s.wage ?? (p.squad === 'youth' ? roundMoney(3000 + club.level * 900) : expectedWage(p, club.level, season));
    p.contract = { wage, endYear: season + Math.max(1, s.contractYears) - 1, signedDay: 0, role: s.role ?? 'rotation' };
  }
  p.value = s.value ?? marketValue(p, season);
  const warnings = attributeWarnings(p);
  const lvl = ovrToLevel(p.ovr);
  if (Math.abs(lvl - s.level) >= 1.5 && s.attrs?.length) warnings.push(`O nível calculado pelos atributos (${lvl.toFixed(1)}) difere do nível escolhido (${s.level}).`);
  if (s.potential < Math.round(lvl)) warnings.push('Potencial menor que o nível atual: o jogador não terá margem de evolução.');
  if (s.age >= 34 && s.potential > lvl + 1) warnings.push('Jogador veterano raramente evolui além do nível atual.');
  if (s.alt.some((x) => positionFit({ pos: s.pos, alt: [] }, x) < 0.8)) warnings.push('Há posições secundárias muito diferentes da principal.');
  if (lvl >= 24.5) warnings.push('Modo de edição livre: craque de nível máximo. O jogo não reduzirá os atributos, mas a idade ainda causará declínio natural.');
  const comps = Object.values(world.players)
    .filter((x) => x.pos === s.pos && x.squad === 'senior')
    .map((x) => ({ x, d: Math.abs(ovrToLevel(x.ovr) - lvl) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6)
    .map(({ x }) => ({ id: x.id, name: x.name, club: x.clubId ? world.clubs[x.clubId]?.name ?? '' : 'Sem clube', level: Math.round(ovrToLevel(x.ovr) * 10) / 10, age: season - x.birthYear, value: x.value }));
  let finance: CreatorPreview['finance'] = null;
  if (club) {
    const before = wageBill(world as Career, club);
    finance = { wage: p.contract!.wage, value: p.value, wageBillBefore: before, wageBillAfter: before + p.contract!.wage, budget: club.wageBudget, balance: club.balance, club: club.name };
  }
  return { player: p, level: Math.round(lvl), levelExact: lvl, potentialLevel: Math.round(ovrToLevel(p.pot)), warnings, comparisons: comps, finance };
}

/** Insere o craque no universo/carreira com identificador único e histórico próprio. */
export function insertCreated(world: World | Career, s: CreatorSpec): Player {
  const pv = previewCreated(world, s);
  const { id, num } = nextId(world);
  const p: Player = { ...pv.player, id, num };
  const season = 'season' in world ? (world as Career).season : world.config.startYear;
  p.creator = { ...p.creator!, createdDay: 'day' in world ? (world as Career).day : 0 };
  p.joined = 'day' in world ? (world as Career).day : 0;
  const club = targetClub(world, s);
  world.players[p.id] = p;
  if (club) {
    if (p.squad === 'youth') {
      club.youthIds.push(p.id);
      p.youth = { plan: 'balanced', joined: p.joined, scoutNoise: 0, mentoring: false, recentGain: 0 };
    } else club.playerIds.push(p.id);
    p.shirt = s.shirt ?? 0;
    assignShirt(world, club, p);
    if (p.squad === 'senior') assignRoles(world, club);
    if (s.role && p.contract) p.contract.role = s.role;
  } else {
    p.clubId = null;
    p.contract = null;
  }
  if (s.formativeClub) p.history.push({ season: season - 1, clubId: '', clubName: `${s.formativeClub} (formação)`, apps: 0, goals: 0, assists: 0, avgRating: 0, level: Math.round(ovrToLevel(p.ovr) * 10) / 10, value: p.value });
  invalidateRatings();
  return p;
}
