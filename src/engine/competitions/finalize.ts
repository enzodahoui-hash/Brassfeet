import type { Career, CompInstance } from '../types';
import { compStat } from '../players/stats';
import { clamp } from '../core/rng';
import { post } from '../finance/ledger';
import { addNews } from '../news/news';
import { awardScorerStars, competitionAwards } from '../awards/awards';
import { groupTable, leagueTable } from './manager';
import { winOf } from '../players/generate';

/** Encerramento oficial: campeão, histórico, premiações, estrelas de artilharia e repercussão. Idempotente. */
export function finalizeCompetition(c: Career, comp: CompInstance): void {
  if (comp.finalized || comp.status !== 'finished') return;
  const t = c.config.competitions[comp.templateId];
  // snapshot das tabelas (preservado mesmo após limpeza de partidas antigas)
  const li = comp.stages.findIndex((s) => s.type === 'league');
  if (li >= 0 && !comp.pruned) {
    const st = comp.stages[li];
    if (st.groups.length > 1) comp.groupTables = st.groups.map((_, gi) => groupTable(c, comp, li, gi));
    else comp.finalTable = leagueTable(c, comp);
  }
  const champ = comp.champion ? c.clubs[comp.champion] : null;
  const runner = comp.runnerUp ? c.clubs[comp.runnerUp] : null;
  if (champ) {
    const hist = (c.champions[comp.templateId] ??= []);
    if (!hist.some((x) => x.season === comp.season)) hist.push({ season: comp.season, clubId: champ.id, clubName: champ.name, runnerUpName: runner?.name });
    if (!champ.titles.some((x) => x.compTemplateId === comp.templateId && x.season === comp.season)) champ.titles.push({ compTemplateId: comp.templateId, compName: t.name, season: comp.season });
    if (t.prize.champion) post(c, champ, { key: `champ|${comp.id}`, day: c.day, amount: t.prize.champion, cat: 'premiações', desc: `Título: ${comp.name}` });
    champ.fanMood = clamp(champ.fanMood + 4 + t.importance * 2, 0, 100);
    champ.reputation = clamp(champ.reputation + t.importance * 0.6, 0, 100);
    // títulos no currículo de quem participou
    const prestige = t.importance * t.coefficient * 0.5;
    for (const pid of champ.playerIds) {
      const p = c.players[pid];
      const s = p ? compStat(p, comp.season, comp.id) : undefined;
      if (!p || !s || s.apps === 0) continue;
      const key = `title|${comp.id}`;
      if (!p.achievements.some((a) => a.key === key)) {
        p.achievements.push({ key, kind: 'title', season: comp.season, label: `${t.name} ${comp.season}`, compId: comp.id, compTemplateId: t.id, compName: t.name, clubId: champ.id, clubName: champ.name, day: c.day });
        winOf(p).titles += prestige;
        winOf(p).titleNames.push(t.name);
      }
    }
    if (champ.id === c.userClubId) {
      c.manager.trophies.push({ compName: t.name, season: comp.season });
      c.manager.reputation = clamp(c.manager.reputation + t.importance * 2, 0, 100);
      champ.board.confidence = clamp(champ.board.confidence + t.importance * 5, 0, 100);
    }
  }
  // premiação por posição nas ligas
  const table = comp.finalTable;
  if (table && t.prize.byPosition.length) {
    table.forEach((row, i) => {
      const club = c.clubs[row.clubId];
      const amount = t.prize.byPosition[i] ?? 0;
      if (club && amount) post(c, club, { key: `prize|${comp.id}|${club.id}`, day: c.day, amount, cat: 'premiações', desc: `${comp.name}: ${i + 1}º lugar` });
    });
  }
  awardScorerStars(c, comp);
  competitionAwards(c, comp);
  // notícias
  if (champ) {
    let title = `${champ.name} conquista ${comp.name}!`;
    let body = runner ? `Vice: ${runner.name}.` : '';
    if (comp.kind === 'continental') {
      const avg = comp.participants.reduce((s, id) => s + (c.clubs[id]?.level ?? 0), 0) / comp.participants.length;
      if (champ.level < avg + 1) title = `${champ.name} surpreende gigantes e conquista a ${t.name}!`;
      body += ' O título garante vaga como atual campeão na próxima edição, premiação recorde e prestígio internacional.';
    }
    if (table) body += ` Campanha: ${table[0].pts} pontos, ${table[0].w}V ${table[0].d}E ${table[0].l}D.`;
    addNews(c, { kind: 'trophy', icon: 'trophy', title, body, clubIds: [champ.id, ...(runner ? [runner.id] : [])], playerIds: [], important: t.importance >= 3 || champ.id === c.userClubId, link: { screen: 'comp', id: comp.id } });
  }
  const user = c.clubs[c.userClubId];
  if (comp.participants.includes(user.id) && comp.champion !== user.id) {
    const out = comp.eliminated[user.id];
    if (comp.kind === 'continental' && (out === 'Fase de grupos' || out === 'Fase preliminar')) {
      user.board.confidence = clamp(user.board.confidence - 6, 0, 100);
      addNews(c, { kind: 'board', icon: 'board', title: 'Eliminação precoce aumenta a pressão sobre o treinador', body: `O ${user.name} caiu na ${out.toLowerCase()} da ${t.name}, abaixo do esperado pela diretoria.`, clubIds: [user.id], playerIds: [], important: true });
    }
  }
  comp.finalized = true;
}
