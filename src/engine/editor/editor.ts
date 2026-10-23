import type { Career, Club, CompTemplate, Player, Pos, World } from '../types';
import { Rng, clamp, seedFrom } from '../core/rng';
import { ATTR_COUNT, computeOvr, levelToOvr, ovrToLevel, POS_LINE } from '../players/attributes';
import { makePlayer, rollPotential } from '../players/generate';
import { marketValue, roundMoney } from '../players/value';
import { addPlayerToClub, assignRoles, emptyClub, finalizePlayer, makeStadium, populateSquad, setupFinances, SCHEMA_VERSION, signContract } from '../universe/world';
import { invalidateRatings } from '../clubs/lineup';
import { moveToClub, removeFromClub } from '../market/roster';

// Funções de domínio do Editor do Universo. Funcionam tanto num universo personalizado quanto
// numa carreira em andamento (que estende World). A interface pede confirmação antes de alterar uma carreira.

export const isCareer = (w: World | Career): w is Career => 'userClubId' in w;
const seasonOf = (w: World | Career) => (isCareer(w) ? w.season : w.config.startYear);

export type PlayerPatch = Partial<Pick<Player, 'firstName' | 'lastName' | 'name' | 'nat' | 'birthYear' | 'pos' | 'alt' | 'foot' | 'height' | 'weight' | 'pot' | 'value' | 'morale' | 'condition' | 'style' | 'traits' | 'reputation' | 'appearance' | 'shirt'>> & {
  attrs?: Record<number, number>;
  wage?: number;
  contractEnd?: number;
  potentialLevel?: number;
  level?: number;
};

export function updatePlayer(w: World | Career, pid: string, patch: PlayerPatch): string | null {
  const p = w.players[pid];
  if (!p) return 'Jogador não encontrado.';
  const { attrs, wage, contractEnd, potentialLevel, level, ...rest } = patch;
  Object.assign(p, rest);
  if (attrs) for (const [i, v] of Object.entries(attrs)) {
    const idx = Number(i);
    if (idx >= 0 && idx < ATTR_COUNT) p.attrs[idx] = Math.round(clamp(Number(v), 1, 100));
  }
  if (level !== undefined) {
    // escala os atributos proporcionalmente até a nota desejada
    const target = levelToOvr(clamp(level, 0, 25));
    const cur = computeOvr(p);
    const k = target / Math.max(1, cur);
    p.attrs = p.attrs.map((v) => Math.round(clamp(v * k, 1, 100)));
  }
  p.alt = (p.alt ?? []).filter((x) => x !== p.pos);
  p.ovr = computeOvr(p);
  if (potentialLevel !== undefined) p.pot = levelToOvr(clamp(potentialLevel, 0, 25));
  if (p.pot < p.ovr) p.pot = p.ovr;
  if (p.contract) {
    if (wage !== undefined) p.contract.wage = Math.max(0, Math.round(wage));
    if (contractEnd !== undefined) p.contract.endYear = Math.max(seasonOf(w), Math.round(contractEnd));
  }
  if (patch.value === undefined) p.value = marketValue(p, seasonOf(w));
  p.morale = clamp(p.morale, 0, 100);
  p.condition = clamp(p.condition, 0, 100);
  invalidateRatings();
  return null;
}

export function editorCreatePlayer(w: World | Career, o: { pos: Pos; nat: string; age: number; level: number; potential: number; clubId: string | null; youth?: boolean; name?: string }): Player {
  const rng = new Rng(seedFrom('ed', w.nextId));
  const club = o.clubId ? w.clubs[o.clubId] : null;
  const p = makePlayer(w, rng, { nat: o.nat, pos: o.pos, age: o.age, level: o.level, potLevel: o.potential, season: seasonOf(w), clubId: club?.id ?? null, squad: o.youth ? 'youth' : 'senior', origin: 'editor', name: o.name });
  finalizePlayer(p, club?.level ?? 8, seasonOf(w));
  if (club) {
    signContract(p, club.level, seasonOf(w), 3);
    if (o.youth) p.youth = { plan: 'balanced', joined: isCareer(w) ? w.day : 0, scoutNoise: rng.range(-1, 1), mentoring: false, recentGain: 0 };
  }
  addPlayerToClub(w, p, club, o.youth ? 'youth' : 'senior');
  if (club) assignRoles(w, club);
  return p;
}

export function duplicatePlayer(w: World | Career, pid: string): Player | null {
  const src = w.players[pid];
  if (!src) return null;
  const id = `p${w.nextId}`;
  const num = w.nextId++;
  const p: Player = structuredClone(src);
  Object.assign(p, { id, num, name: `${src.name} (cópia)`, stats: {}, history: [], achievements: [], origin: 'editor', loan: undefined, listed: false, injury: null, win: undefined });
  w.players[id] = p;
  if (src.clubId && w.clubs[src.clubId]) {
    const club = w.clubs[src.clubId];
    (p.squad === 'youth' ? club.youthIds : club.playerIds).push(id);
    p.shirt = 0;
  } else p.clubId = null;
  return p;
}

export function deletePlayer(w: World | Career, pid: string): string | null {
  const p = w.players[pid];
  if (!p) return 'Jogador não encontrado.';
  if (isCareer(w)) {
    removeFromClub(w, p);
    w.shortlist = w.shortlist.filter((x) => x !== pid);
    w.intakeCandidates = w.intakeCandidates.filter((x) => x !== pid);
  } else if (p.clubId) {
    const club = w.clubs[p.clubId];
    if (club) {
      club.playerIds = club.playerIds.filter((x) => x !== pid);
      club.youthIds = club.youthIds.filter((x) => x !== pid);
    }
  }
  delete w.players[pid];
  return null;
}

export function editorMovePlayer(w: World | Career, pid: string, clubId: string | null, squad: 'senior' | 'youth' = 'senior'): string | null {
  const p = w.players[pid];
  if (!p) return 'Jogador não encontrado.';
  const club = clubId ? w.clubs[clubId] : null;
  if (isCareer(w)) moveToClub(w, p, club, squad);
  else {
    if (p.clubId) {
      const old = w.clubs[p.clubId];
      old.playerIds = old.playerIds.filter((x) => x !== pid);
      old.youthIds = old.youthIds.filter((x) => x !== pid);
    }
    addPlayerToClub(w, p, club, squad);
  }
  if (club && !p.contract) signContract(p, club.level, seasonOf(w), 2);
  if (!club) p.contract = null;
  if (club) assignRoles(w, club);
  return null;
}

export interface PlayerFilter {
  q?: string;
  clubId?: string;
  pos?: Pos | '';
  line?: string;
  minAge?: number;
  maxAge?: number;
  minLevel?: number;
  maxLevel?: number;
  free?: boolean;
  origin?: string;
}

export function searchPlayers(w: World | Career, f: PlayerFilter, limit = 400): Player[] {
  const season = seasonOf(w);
  const q = f.q?.trim().toLowerCase();
  const out: Player[] = [];
  for (const p of Object.values(w.players)) {
    if (f.clubId && p.clubId !== f.clubId) continue;
    if (f.free && p.clubId) continue;
    if (f.pos && p.pos !== f.pos) continue;
    if (f.line && POS_LINE[p.pos] !== f.line) continue;
    if (f.origin && p.origin !== f.origin) continue;
    const age = season - p.birthYear;
    if (f.minAge && age < f.minAge) continue;
    if (f.maxAge && age > f.maxAge) continue;
    const l = ovrToLevel(p.ovr);
    if (f.minLevel !== undefined && l < f.minLevel) continue;
    if (f.maxLevel !== undefined && l >= f.maxLevel + 1) continue;
    if (q && !p.name.toLowerCase().includes(q) && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(q)) continue;
    out.push(p);
  }
  out.sort((a, b) => b.ovr - a.ovr);
  return out.slice(0, limit);
}

// ───────────────────────── clubes ─────────────────────────

export type ClubPatch = Partial<Pick<Club, 'name' | 'short' | 'city' | 'state' | 'colors' | 'crest' | 'level' | 'reputation' | 'fans' | 'balance' | 'revenueBase' | 'transferBudget' | 'wageBudget' | 'coach' | 'divisionId'>> & { stadiumName?: string; capacity?: number };

export function updateClub(w: World | Career, clubId: string, patch: ClubPatch): string | null {
  const club = w.clubs[clubId];
  if (!club) return 'Clube não encontrado.';
  const { stadiumName, capacity, divisionId, ...rest } = patch;
  if (rest.short !== undefined && (rest.short.length < 2 || rest.short.length > 4)) return 'A sigla deve ter de 2 a 4 letras.';
  if (rest.name !== undefined && !rest.name.trim()) return 'O nome não pode ficar vazio.';
  Object.assign(club, rest);
  club.level = clamp(club.level, 0, 25);
  club.reputation = clamp(club.reputation, 0, 100);
  if (stadiumName) club.stadium.name = stadiumName;
  if (capacity && capacity > 500) {
    const total = club.stadium.sectors.reduce((s, x) => s + x.capacity, 0);
    for (const s of club.stadium.sectors) s.capacity = Math.round((s.capacity / total) * capacity);
  }
  if (divisionId && divisionId !== club.divisionId) {
    if (!w.config.competitions[divisionId] || w.config.competitions[divisionId].kind !== 'league') return 'Divisão inválida.';
    club.divisionId = divisionId; // em carreiras, vale a partir da próxima temporada
  }
  return null;
}

export function createClub(w: World | Career, o: { name: string; short: string; city: string; country: string; divisionId: string; level: number; colors: [string, string, string]; capacity: number; fans: number; state?: string }): Club | string {
  if (!o.name.trim()) return 'Informe o nome do clube.';
  if (Object.values(w.clubs).some((c) => c.name.toLowerCase() === o.name.trim().toLowerCase())) return 'Já existe um clube com esse nome.';
  if (!w.config.competitions[o.divisionId]) return 'Divisão inválida.';
  const id = `club${w.nextId++}`;
  const rng = new Rng(seedFrom('club', id));
  const club = emptyClub(id, o.name.trim(), o.short.toUpperCase().slice(0, 4), o.country, o.divisionId, clamp(o.level, 0, 25), o.colors, rng);
  club.city = o.city;
  club.state = o.state;
  club.fans = o.fans;
  club.stadium = makeStadium(rng, `Estádio de ${o.city}`, o.capacity, o.level);
  w.clubs[id] = club;
  populateSquad(w, rng, club, seasonOf(w));
  setupFinances(w, club, seasonOf(w));
  return club;
}

export function deleteClub(w: World | Career, clubId: string): string | null {
  const club = w.clubs[clubId];
  if (!club) return 'Clube não encontrado.';
  if (isCareer(w)) {
    if (clubId === w.userClubId) return 'Não é possível excluir o clube que você treina.';
    const active = Object.values(w.competitions).some((x) => x.status !== 'finished' && x.participants.includes(clubId));
    if (active) return 'O clube disputa competições em andamento. Exclua após o fim da temporada.';
  }
  for (const id of club.playerIds.concat(club.youthIds)) {
    const p = w.players[id];
    if (!p) continue;
    p.clubId = null;
    p.contract = null;
    p.squad = 'senior';
  }
  for (const other of Object.values(w.clubs)) other.rivals = other.rivals.filter((x) => x !== clubId);
  delete w.clubs[clubId];
  return null;
}

// ───────────────────────── competições ─────────────────────────

export function validateCompetition(w: World | Career, t: CompTemplate): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!t.name.trim()) errors.push('Informe o nome.');
  if (t.points.win <= t.points.draw || t.points.draw < t.points.loss) errors.push('Pontuação inválida: vitória deve valer mais que empate, e empate pelo menos o mesmo que derrota.');
  if (!t.tiebreakers.length) errors.push('Defina ao menos um critério de desempate.');
  if (t.kind === 'league') {
    const n = Object.values(w.clubs).filter((c) => c.divisionId === t.id).length;
    if (t.numClubs < 2) errors.push('Uma liga precisa de pelo menos 2 clubes.');
    if (n !== t.numClubs) warnings.push(`Há ${n} clubes nesta divisão, mas o formato prevê ${t.numClubs}. Ajuste os clubes no editor de clubes.`);
    if (t.lowerId) {
      const lower = w.config.competitions[t.lowerId];
      if (lower && (t.relegate ?? 0) !== (lower.promote ?? 0)) errors.push(`Rebaixados (${t.relegate}) diferente de promovidos da divisão inferior (${lower.promote}).`);
    }
    if ((t.relegate ?? 0) + (t.promote ?? 0) >= t.numClubs) errors.push('Acesso + rebaixamento não pode envolver todos os clubes.');
  }
  if (t.kind === 'continental') {
    let total = 0;
    for (const s of t.slots ?? []) {
      if (s.type === 'league' && s.sourceId) {
        const src = w.config.competitions[s.sourceId];
        if (!src) errors.push(`Vaga ligada a uma liga inexistente (${s.sourceId}).`);
        else if ((s.positions ?? []).some((pos) => pos < 1 || pos > src.numClubs)) errors.push(`Posições fora da tabela da ${src.name}.`);
        total += s.positions?.length ?? 0;
      } else if (s.type === 'cupWinner') total++;
    }
    if (total < 4) errors.push('São necessárias pelo menos 4 vagas.');
    if (t.groups && (t.groups.size < 3 || t.groups.size > 6)) errors.push('Grupos devem ter entre 3 e 6 clubes.');
    if (t.groups && ![1, 2, 4, 8, 16].includes(t.groups.count)) warnings.push('Número de grupos fora de potência de 2: o mata-mata será adaptado automaticamente.');
  }
  if (t.dates.start > t.dates.end && t.kind !== 'super') errors.push('A data de início deve ser anterior à de término.');
  return { errors, warnings };
}

/** Atualiza o regulamento. Em carreiras, mudanças estruturais valem a partir da próxima temporada. */
export function updateCompetition(w: World | Career, id: string, patch: Partial<CompTemplate>): { errors: string[]; warnings: string[]; deferred: boolean } {
  const cur = w.config.competitions[id];
  if (!cur) return { errors: ['Competição não encontrada.'], warnings: [], deferred: false };
  const next: CompTemplate = { ...cur, ...patch };
  const v = validateCompetition(w, next);
  if (v.errors.length) return { ...v, deferred: false };
  w.config.competitions[id] = next;
  let deferred = false;
  if (isCareer(w)) {
    const inst = Object.values(w.competitions).find((x) => x.templateId === id && x.season === w.season);
    if (inst) {
      if (patch.name) inst.name = `${patch.name} ${inst.season}`;
      const structural = Object.keys(patch).some((k) => k !== 'name' && k !== 'short' && k !== 'color' && k !== 'accent');
      deferred = structural;
    }
  }
  return { ...v, deferred };
}

// ───────────────────────── ferramentas especiais ─────────────────────────

export function batchCreate(w: World | Career, o: { count: number; pos?: Pos | ''; nat: string; minAge: number; maxAge: number; minLevel: number; maxLevel: number; clubId: string | null; youth?: boolean }): Player[] {
  const rng = new Rng(seedFrom('batch', w.nextId));
  const out: Player[] = [];
  const positions: Pos[] = ['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'];
  for (let i = 0; i < clamp(o.count, 1, 200); i++) {
    const age = rng.int(o.minAge, o.maxAge);
    const level = rng.range(o.minLevel, o.maxLevel);
    out.push(editorCreatePlayer(w, { pos: o.pos || rng.pick(positions), nat: o.nat, age, level, potential: rollPotential(rng, level, age, 0.5), clubId: o.clubId, youth: o.youth }));
  }
  return out;
}

export function generateYouth(w: World | Career, clubId: string, count: number): Player[] {
  const club = w.clubs[clubId];
  if (!club) return [];
  return batchCreate(w, { count, nat: club.country, minAge: 15, maxAge: 17, minLevel: Math.max(0, club.level * 0.25), maxLevel: Math.max(2, club.level * 0.45), clubId, youth: true });
}

export function recalcValues(w: World | Career, factor = 1, filter?: (p: Player) => boolean): number {
  let n = 0;
  for (const p of Object.values(w.players)) {
    if (filter && !filter(p)) continue;
    p.value = roundMoney(marketValue(p, seasonOf(w)) * factor);
    n++;
  }
  return n;
}

export function setFinances(w: World | Career, clubId: string, o: { balance?: number; revenueBase?: number; transferBudget?: number; wageBudget?: number }): void {
  const club = w.clubs[clubId];
  if (!club) return;
  if (o.balance !== undefined) club.balance = Math.round(o.balance);
  if (o.revenueBase !== undefined) club.revenueBase = Math.max(0, Math.round(o.revenueBase));
  if (o.transferBudget !== undefined) club.transferBudget = Math.max(0, Math.round(o.transferBudget));
  if (o.wageBudget !== undefined) club.wageBudget = Math.max(0, Math.round(o.wageBudget));
}

/** Redistribui jogadores para que todos os elencos fiquem entre 20 e 34 profissionais. */
export function redistributePlayers(w: World | Career, divisionId?: string): number {
  const clubs = Object.values(w.clubs).filter((c) => !divisionId || c.divisionId === divisionId);
  let moved = 0;
  const big = () => clubs.filter((c) => c.playerIds.length > 34).sort((a, b) => b.playerIds.length - a.playerIds.length);
  // recebe quem tem menos jogadores (primeiro os abaixo de 20; se não houver, qualquer elenco abaixo do limite)
  const small = () => clubs.filter((c) => c.playerIds.length < 34 && !(isCareer(w) && c.id === w.userClubId)).sort((a, b) => a.playerIds.length - b.playerIds.length);
  let guard = 0;
  while (big().length && small().length && guard++ < 500) {
    const from = big()[0];
    const to = small()[0];
    const pid = from.playerIds.map((id) => w.players[id]).filter((p) => p && !(isCareer(w) && from.id === w.userClubId)).sort((a, b) => a.ovr - b.ovr)[0]?.id;
    if (!pid) break;
    editorMovePlayer(w, pid, to.id);
    moved++;
  }
  for (const c of clubs) if (c.playerIds.length < 18) {
    const rng = new Rng(seedFrom('fill', c.id, w.nextId));
    while (c.playerIds.length < 20) {
      editorCreatePlayer(w, { pos: rng.pick(['CB', 'CM', 'ST', 'GK', 'RB', 'LB'] as Pos[]), nat: c.country, age: rng.int(19, 30), level: Math.max(0, c.level - 3), potential: c.level, clubId: c.id });
      moved++;
    }
  }
  return moved;
}

// ───────────────────────── universos ─────────────────────────

/** Extrai o universo (sem o progresso da carreira) para exportar ou criar um cenário a partir dela. */
export function worldFromCareer(c: Career, name: string): World {
  const w: World = structuredClone({ schemaVersion: SCHEMA_VERSION, meta: c.meta, config: c.config, clubs: c.clubs, players: c.players, staff: c.staff, retired: c.retired, nextId: c.nextId });
  w.meta = { id: `u${Date.now().toString(36)}`, name, createdAt: Date.now(), base: c.meta.id, description: `Criado a partir da carreira "${c.saveName}" (${c.season}).`, custom: true };
  for (const club of Object.values(w.clubs)) club.ledger = [];
  for (const p of Object.values(w.players)) {
    p.stats = {};
    p.win = undefined;
  }
  return w;
}

export function duplicateUniverse(w: World, name: string): World {
  const copy: World = structuredClone(w);
  copy.meta = { ...w.meta, id: `u${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`, name, createdAt: Date.now(), base: w.meta.id, custom: true };
  return copy;
}

export function exportUniverseText(w: World): string {
  return JSON.stringify(w);
}

export function universeStats(w: World) {
  const clubs = Object.values(w.clubs);
  const players = Object.values(w.players);
  return {
    clubs: clubs.length, players: players.length, free: players.filter((p) => !p.clubId).length,
    countries: w.config.countries.filter((c) => c.enabled).length, competitions: Object.values(w.config.competitions).filter((c) => c.enabled).length,
    elite: players.filter((p) => ovrToLevel(p.ovr) >= 22.5).length,
  };
}
