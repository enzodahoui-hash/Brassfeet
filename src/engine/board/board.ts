import type { Career, Club, Objective } from '../types';
import { clamp } from '../core/rng';
import { compKey, leagueTable } from '../competitions/manager';
import { addNews } from '../news/news';

/** Posição esperada: ranking do nível do clube entre os rivais da divisão. */
export function expectedRank(c: Career, club: Club): { rank: number; size: number } {
  const peers = Object.values(c.clubs).filter((x) => x.divisionId === club.divisionId).sort((a, b) => b.level - a.level);
  return { rank: peers.findIndex((x) => x.id === club.id) + 1, size: peers.length };
}

export function setObjectives(c: Career, club: Club): Objective[] {
  const t = c.config.competitions[club.divisionId];
  const { rank, size } = expectedRank(c, club);
  const objs: Objective[] = [];
  const tier = t?.tier ?? 1;
  const id = (k: string) => `${k}-${c.season}`;
  if (tier === 1) {
    if (rank <= 2) objs.push({ id: id('liga'), kind: 'title', label: `Conquistar o título da ${t.name}`, target: 1, importance: 3 });
    else if (rank <= 6) objs.push({ id: id('liga'), kind: 'top', label: `Terminar entre os 6 primeiros da ${t.name}`, target: 6, importance: 3 });
    else if (rank <= Math.ceil(size * 0.6)) objs.push({ id: id('liga'), kind: 'midtable', label: `Terminar na metade de cima (até ${Math.ceil(size / 2)}º)`, target: Math.ceil(size / 2), importance: 3 });
    else objs.push({ id: id('liga'), kind: 'avoid', label: `Evitar o rebaixamento (até ${size - (t.relegate ?? 0)}º)`, target: size - (t.relegate ?? 0), importance: 3 });
  } else {
    const promo = t?.promote ?? 0;
    if (rank <= promo + 1) objs.push({ id: id('liga'), kind: 'promotion', label: `Conquistar o acesso (até ${promo}º)`, target: promo, importance: 3 });
    else if (rank <= Math.ceil(size * 0.6)) objs.push({ id: id('liga'), kind: 'midtable', label: `Brigar na parte de cima (até ${Math.ceil(size / 2)}º)`, target: Math.ceil(size / 2), importance: 3 });
    else objs.push({ id: id('liga'), kind: 'avoid', label: `Evitar o rebaixamento (até ${size - (t?.relegate ?? 0)}º)`, target: size - (t?.relegate ?? 0), importance: 3 });
  }
  const country = c.config.countries.find((x) => x.code === club.country);
  if (country?.cup && Object.values(c.competitions).some((x) => x.templateId === country.cup && x.season === c.season && x.participants.includes(club.id))) {
    const target = club.level >= 17 ? 3 : club.level >= 12 ? 2 : 1; // 3=semifinal 2=quartas 1=oitavas
    objs.push({ id: id('copa'), kind: 'cup', label: `Chegar ${['às oitavas', 'às quartas', 'à semifinal'][target - 1]} da ${c.config.competitions[country.cup].name}`, target, importance: 2 });
  }
  const cont = Object.values(c.competitions).find((x) => x.kind === 'continental' && x.season === c.season && x.participants.includes(club.id));
  if (cont) objs.push({ id: id('cont'), kind: 'continental', label: `Passar da fase de grupos da ${cont.name.replace(/ \d+$/, '')}`, target: 1, importance: 2 });
  objs.push({ id: id('fin'), kind: 'finance', label: 'Terminar a temporada com saldo positivo', target: 0, importance: c.finance.mode === 'casual' ? 1 : 2 });
  objs.push({ id: id('base'), kind: 'youth', label: 'Promover ao menos um jovem da base', target: 1, importance: 1 });
  club.board.objectives = objs;
  return objs;
}

const KO_PROGRESS: Record<string, number> = { 'Oitavas de final': 1, 'Quartas de final': 2, Semifinal: 3, Final: 4 };

export function objectiveStatus(c: Career, club: Club, o: Objective): 'ok' | 'fail' | 'pending' {
  const league = c.competitions[compKey(club.divisionId, c.season)];
  switch (o.kind) {
    case 'title': case 'top': case 'midtable': case 'avoid': case 'promotion': {
      if (!league) return 'pending';
      const pos = leagueTable(c, league).findIndex((r) => r.clubId === club.id) + 1;
      const ok = pos > 0 && pos <= o.target;
      return league.status === 'finished' ? (ok ? 'ok' : 'fail') : 'pending';
    }
    case 'cup': {
      const country = c.config.countries.find((x) => x.code === club.country);
      const comp = country?.cup ? c.competitions[compKey(country.cup, c.season)] : undefined;
      if (!comp) return 'pending';
      if (comp.champion === club.id) return 'ok';
      const out = comp.eliminated[club.id];
      const reached = out ? KO_PROGRESS[out] ?? 0 : comp.status === 'finished' ? 5 : -1;
      if (reached >= o.target) return 'ok';
      return out || comp.status === 'finished' ? 'fail' : 'pending';
    }
    case 'continental': {
      const comp = Object.values(c.competitions).find((x) => x.kind === 'continental' && x.season === c.season && x.participants.includes(club.id));
      if (!comp) return 'pending';
      const out = comp.eliminated[club.id];
      if (out === 'Fase de grupos' || out === 'Fase preliminar') return 'fail';
      const groupDone = comp.stages.find((s) => s.name === 'Fase de grupos')?.done;
      return groupDone ? 'ok' : 'pending';
    }
    case 'finance':
      return c.seasonEnded ? (club.balance >= 0 ? 'ok' : 'fail') : club.balance >= 0 ? 'pending' : 'pending';
    case 'youth': {
      const promoted = Object.values(c.players).some((p) => p.clubId === club.id && p.youth?.promotedDay && p.youth.promotedDay >= c.day - 400 && p.squad === 'senior');
      return promoted ? 'ok' : 'pending';
    }
  }
}

/** Atualização semanal da confiança da diretoria no treinador. */
export function weeklyBoard(c: Career): void {
  const club = c.clubs[c.userClubId];
  const league = c.competitions[compKey(club.divisionId, c.season)];
  if (league && league.status === 'running') {
    const table = leagueTable(c, league);
    const row = table.find((r) => r.clubId === club.id);
    const played = row?.p ?? 0;
    if (played >= 4) {
      const pos = table.indexOf(row!) + 1;
      const target = club.board.objectives.find((o) => ['title', 'top', 'midtable', 'avoid', 'promotion'].includes(o.kind))?.target ?? table.length / 2;
      const delta = clamp((target + 1 - pos) / table.length, -0.5, 0.5) * 4;
      const form = row!.form.slice(-3);
      const formDelta = form.filter((x) => x === 'V').length * 0.6 - form.filter((x) => x === 'D').length * 0.7;
      club.board.confidence = clamp(club.board.confidence + delta * 0.6 + formDelta * 0.5, 0, 100);
    }
  }
  if (club.balance < 0 && !c.finance.unlimited) club.board.confidence = clamp(club.board.confidence - 0.8, 0, 100);
  if (club.board.confidence < 25 && club.board.warnings < 1) {
    club.board.warnings++;
    addNews(c, { kind: 'board', icon: 'board', title: `Diretoria do ${club.name} cobra resultados`, body: `O presidente ${club.board.president} demonstrou insatisfação com o desempenho recente e exige reação imediata.`, clubIds: [club.id], playerIds: [], important: true, link: { screen: 'club' } });
  }
}

export const FIRE_THRESHOLD: Record<string, number> = { facil: 5, normal: 14, dificil: 24 };

/** Avaliação de fim de temporada. Retorna true se o treinador for demitido. */
export function seasonBoardReview(c: Career): { fired: boolean; verdict: string } {
  const club = c.clubs[c.userClubId];
  let score = 0;
  let weight = 0;
  const lines: string[] = [];
  for (const o of club.board.objectives) {
    const st = objectiveStatus(c, club, o);
    o.status = st === 'pending' ? 'fail' : st;
    if (o.kind === 'youth' && st === 'pending') o.status = 'fail';
    score += (o.status === 'ok' ? 1 : -1) * o.importance;
    weight += o.importance;
    lines.push(`${o.status === 'ok' ? '✔' : '✘'} ${o.label}`);
  }
  const ratio = weight ? score / weight : 0;
  club.board.confidence = clamp(club.board.confidence * 0.5 + 50 + ratio * 35, 0, 100);
  const fired = club.board.confidence < FIRE_THRESHOLD[c.difficulty] && !c.finance.unlimited;
  const verdict = fired ? 'A diretoria decidiu encerrar o seu trabalho.' : ratio > 0.4 ? 'A diretoria está satisfeita e renova a confiança.' : ratio > -0.2 ? 'Temporada aceitável; a diretoria espera evolução.' : 'Temporada abaixo do esperado; a pressão aumenta.';
  return { fired, verdict: `${verdict}\n${lines.join('\n')}` };
}
