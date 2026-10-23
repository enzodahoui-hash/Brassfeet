// Gera os dados do universo real usados pelo jogo:
//   src/engine/data/real/clubs.json   — clubes reais por divisão (nome, sigla, cidade, estádio, cores, nível)
//   src/engine/data/real/squads.json  — elencos atuais extraídos da Wikipédia + dados do Wikidata
// Fontes: Wikipédia (seções de elenco atual), Wikidata (nascimento, posição, altura, popularidade) e
// Wikimedia Commons (fotos com licença livre e créditos). Níveis 0..25 são ESTIMATIVAS do jogo.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { DIVS } from './divisions.mjs';

const J = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const resolved = J('./resolved.json');
const wikisquads = J('./wikisquads.json');
const artqid = J('./artqid.json');
const redqid = existsSync(new URL('./redqid.json', import.meta.url)) ? J('./redqid.json') : {};
const det = J('./pdetails.json');
const photos = J('./photos.json');
const clubinfo = J('./clubinfo.json');
const poslab = J('./poslabels.json');
const fallbackSquads = existsSync(new URL('./squads.json', import.meta.url)) ? J('./squads.json') : {};
const SEASON = 2027;

// ───────────── utilidades ─────────────
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (s) => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const rnd = (s) => (hash(s) % 100000) / 100000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hex = (h) => (h ? `#${h.replace('#', '').toLowerCase().slice(0, 6)}` : null);

// ───────────── níveis conhecidos (estimativas de design já existentes no jogo) ─────────────
const starsTxt = readFileSync(new URL('./known-levels.ts', import.meta.url), 'utf8');
const KNOWN = [];
for (const m of starsTxt.matchAll(/'([^'|]+)\|([A-Z]{3})\|([A-Z]{2})\|([A-Z,]*)\|(\d{4})\|(\d+)\|(\d+)\|([^|]*)\|([^|]*)\|([DEA]?)'/g)) {
  KNOWN.push({ name: m[1], n: slug(m[1]), nat: m[2], pos: m[3], alt: m[4], birth: +m[5], lvl: +m[6], pot: +m[7], style: m[8], traits: m[9], foot: m[10] });
}
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const lastTok = (s) => slug(s.split(/\s+/).slice(-1)[0] ?? '');
function known(name, nat, birth) {
  const n = slug(name);
  const ln = lastTok(name);
  let best = null, bd = 9;
  for (const k of KNOWN) {
    if (birth && Math.abs(k.birth - birth) > 1) continue;
    if (nat && k.nat !== nat && !birth) continue;
    let dd = Math.abs(k.n.length - n.length) <= 3 ? lev(k.n, n) : 9;
    // nome adaptado: sobrenome quase igual + mesma nacionalidade + mesmo ano de nascimento
    if (dd > 2 && birth && k.nat === nat && ln.length >= 4 && lev(lastTok(k.name), ln) <= 1) dd = 2;
    if (dd < bd) { bd = dd; best = k; }
  }
  if (!best) return null;
  // nomes de uma palavra (ex.: "Patrick", "Alexandre") só valem com nome idêntico, mesmo ano e mesma seleção
  if (!name.includes(' ') || !best.name.includes(' ')) return bd === 0 && best.birth === birth && best.nat === nat ? best : null;
  return bd <= Math.max(2, Math.floor(n.length / 6)) ? best : null;
}

// ───────────── posições ─────────────
function detailPos(ids) {
  const labels = ids.map((i) => (poslab[i] ?? '').toLowerCase());
  const has = (re) => labels.some((l) => re.test(l));
  if (has(/goalkeeper|portero/)) return 'GK';
  if (has(/right[- ]back/)) return 'RB';
  if (has(/left[- ]back/)) return 'LB';
  if (has(/full-?back|wing-back/)) return 'FB';
  if (has(/centre-back|center back|stopper|centerhalf/)) return 'CB';
  if (has(/defensive midfielder|steering/)) return 'DM';
  if (has(/attacking midfielder|playmaker/)) return 'AM';
  if (has(/right winger/)) return 'RW';
  if (has(/left winger|left wing/)) return 'LW';
  if (has(/winger|wide midfielder|right midfielder|left midfielder|inside forward|extreme/)) return 'W';
  if (has(/centre-forward|second striker/)) return 'ST';
  if (has(/central midfielder|wing half|midfielder|medio/)) return 'CM';
  if (has(/defender/)) return 'D';
  if (has(/forward|attacker|front/)) return 'F';
  return null;
}
function resolvePos(wikiPos, detail, key) {
  const d = detail;
  const r = rnd(key);
  if (wikiPos === 'GK' || d === 'GK') return 'GK';
  if (wikiPos === 'DF' || (!wikiPos && ['CB', 'RB', 'LB', 'FB', 'D'].includes(d))) {
    if (['CB', 'RB', 'LB'].includes(d)) return d;
    if (d === 'FB') return r < 0.5 ? 'RB' : 'LB';
    return r < 0.55 ? 'CB' : r < 0.78 ? 'RB' : 'LB';
  }
  if (wikiPos === 'MF' || (!wikiPos && ['DM', 'CM', 'AM'].includes(d))) {
    if (['DM', 'CM', 'AM'].includes(d)) return d;
    if (d === 'W' || d === 'RW' || d === 'LW') return r < 0.5 ? 'RM' : 'LM';
    return r < 0.3 ? 'DM' : r < 0.75 ? 'CM' : 'AM';
  }
  if (wikiPos === 'FW' || (!wikiPos && ['ST', 'RW', 'LW', 'W', 'F'].includes(d))) {
    if (['ST', 'RW', 'LW'].includes(d)) return d;
    if (d === 'W') return r < 0.5 ? 'RW' : 'LW';
    if (d === 'AM') return 'AM';
    return r < 0.6 ? 'ST' : r < 0.8 ? 'RW' : 'LW';
  }
  return ['CB', 'CM', 'ST', 'RB', 'LB', 'DM', 'AM'][hash(key) % 7];
}

/** Garante pelo menos o mínimo de cada função (reclassifica os mais próximos). */
function balance(list) {
  const need = { GK: 2, CB: 3, RB: 1, LB: 1, DM: 1, CM: 2, AM: 1, ST: 2 };
  const near = { RB: ['LB', 'CB', 'RM'], LB: ['RB', 'CB', 'LM'], CB: ['DM', 'RB', 'LB'], DM: ['CM', 'CB'], CM: ['DM', 'AM'], AM: ['CM', 'RW', 'LW'], ST: ['RW', 'LW', 'AM'] };
  for (const [pos, n] of Object.entries(need)) {
    if (pos === 'GK') continue;
    let have = list.filter((p) => p.pos === pos).length;
    for (const src of near[pos] ?? []) {
      while (have < n) {
        const counts = list.filter((p) => p.pos === src).length;
        const min = need[src] ?? 0;
        if (counts <= min) break;
        const cand = list.filter((p) => p.pos === src && !p.locked).sort((a, b) => a.sl - b.sl)[0];
        if (!cand) break;
        cand.alt = cand.pos;
        cand.pos = pos;
        have++;
      }
    }
  }
}

// ───────────── nomes ─────────────
function displayName(entry, d) {
  let name = (entry.display ?? '').replace(/'''/g, '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const art = (entry.article ?? '').replace(/^:?es:/, '').replace(/\s*\(.*?\)\s*$/g, '').trim();
  if (!name || /^[A-ZÁÉÍÓÚ]\.\s/.test(name) || name.length < 3) name = art || name;
  return name;
}
function splitName(name, d) {
  if (d?.given && d?.family && name.includes(d.family)) return [d.given, d.family];
  const parts = name.split(/\s+/);
  if (parts.length === 1) return [name, ''];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
}

// ───────────── nacionalidades (código FIFA) ─────────────
const FIX_NAT = { CUR: 'CUW', SER: 'SRB', ROM: 'ROU', SLO: 'SVN', SPA: 'ESP', CHL: 'CHI', LIT: 'LTU', DRC: 'COD', KVX: 'KOS', TGO: 'TOG', GBS: 'GNB', DNK: 'DEN', JAP: 'JPN', SWI: 'SUI', PHL: 'PHI' };

// ───────────── clubes ─────────────
function infoboxColors(qid) {
  const f = new URL(`./wiki/${qid}.en.txt`, import.meta.url);
  if (!existsSync(f)) return [];
  const t = readFileSync(f, 'utf8');
  const get = (k) => t.match(new RegExp(`\\|\\s*${k}\\s*=\\s*#?([0-9A-Fa-f]{6})`))?.[1];
  return [get('body1'), get('shorts1'), get('socks1'), get('leftarm1')].filter(Boolean).map((x) => `#${x.toLowerCase()}`);
}
function pickColors(qid, level) {
  const raw = [...(clubinfo[qid]?.colors ?? []).map(hex), ...infoboxColors(qid)].filter(Boolean);
  const uniq = [...new Set(raw)];
  const c1 = uniq[0] ?? '#1d6b3a';
  let c2 = uniq.find((x) => x !== c1) ?? (c1 === '#ffffff' ? '#111111' : '#ffffff');
  const c3 = uniq.find((x) => x !== c1 && x !== c2) ?? (c2 === '#111111' ? '#ffffff' : '#111111');
  return [c1, c2, c3];
}
function venue(qid, level) {
  const vs = Object.entries(clubinfo[qid]?.venues ?? {}).sort((a, b) => b[1] - a[1]);
  const [name, cap] = vs[0] ?? [null, 0];
  return { name, cap: cap > 1000 ? cap : Math.round(4000 + level * level * 120) };
}

const usedKeys = new Set();
const keyFor = (name, country) => {
  let k = slug(name).slice(0, 18) || 'clube';
  if (usedKeys.has(k)) k = `${k}${country.toLowerCase()}`;
  while (usedKeys.has(k)) k += 'x';
  usedKeys.add(k);
  return k;
};

function coachOf(qid) {
  const f = new URL(`./wiki/${qid}.en.txt`, import.meta.url);
  if (!existsSync(f)) return null;
  const t = readFileSync(f, 'utf8');
  const m = t.match(/\|\s*(?:manager|head coach|coach|mgrtitle_x)\s*=\s*([^\n|]*(?:\[\[[^\]]+\]\])?[^\n]*)/i);
  if (!m) return null;
  const v = m[1];
  const link = v.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  const name = (link ? link[2] ?? link[1] : v).replace(/\{\{[^}]*\}\}|<[^>]+>|\(.*?\)|'''|''/g, '').trim();
  return name && name.length > 2 && name.length < 40 && !/^(vacant|tba)/i.test(name) ? name : null;
}

// chaves internas: em nomes repetidos (Liverpool, Everton, River Plate), o clube de maior nível fica com a chave simples
const KEYS = {};
for (const d of DIVS.slice().flatMap((d) => d.clubs.map((c, i) => ({ d, c, i }))).sort((a, b) => b.c[2] - a.c[2])) KEYS[`${d.d.id}|${d.i}`] = keyFor(d.c[0], d.d.country);

const clubsOut = {};
const coachesOut = {};
const squadsOut = {};
const photosOut = {};
const report = { clubs: 0, players: 0, real: 0, generatedNeeded: 0, photos: 0, known: 0, sources: { wiki: 0, wikidata: 0, none: 0 } };
const seenPlayers = new Set();

for (const d of DIVS) {
  clubsOut[d.id] = [];
  for (let i = 0; i < d.clubs.length; i++) {
    const [name, short, level, , city, state] = d.clubs[i];
    const r = resolved[d.id][i];
    const qid = r?.qid;
    const key = KEYS[`${d.id}|${i}`];
    const v = qid ? venue(qid, level) : { name: null, cap: Math.round(4000 + level * level * 120) };
    const colors = qid ? pickColors(qid, level) : ['#1d6b3a', '#ffffff', '#111111'];
    const fansK = Math.round(clamp(Math.pow(level, 2.6) * 3, 15, 45000));
    clubsOut[d.id].push([key, name, short.slice(0, 4), city ?? clubinfo[qid]?.city ?? '', colors.join(','), level, v.name ?? `Estádio ${name}`, Math.round(v.cap / 100) / 10, fansK, state ?? undefined, qid ?? undefined]);
    report.clubs++;
    const coach = qid ? coachOf(qid) : null;
    if (coach) coachesOut[key] = coach;
    // elenco
    let entries = (qid && wikisquads[qid]) || [];
    let source = 'wiki';
    if (entries.length < 15 && qid && fallbackSquads[qid]?.length >= 15) {
      entries = fallbackSquads[qid].filter((p) => p.start && p.start >= '2023').map((p) => ({ no: p.num ?? null, pos: '', nat: '', article: null, display: p.name, qid: p.id }));
      source = 'wikidata';
    }
    if (entries.length < 11) { source = 'none'; entries = []; }
    report.sources[source]++;
    const list = [];
    for (const e of entries) {
      const pq = e.qid ?? (e.article ? artqid[e.article] ?? redqid[e.article] ?? null : null);
      const dd = pq ? det[pq] : null;
      const nm = displayName(e, dd);
      if (!nm || /^\d/.test(nm)) continue;
      const pkey = pq ?? `${key}:${slug(nm)}`;
      if (seenPlayers.has(pkey)) continue; // mesmo jogador listado em dois clubes: fica no primeiro (elenco principal)
      seenPlayers.add(pkey);
      const birth = dd?.birth ? Number(dd.birth.slice(0, 4)) : null;
      const k = known(nm, e.nat, birth);
      const pos = k?.pos ?? resolvePos(e.pos, dd ? detailPos(dd.pos) : null, pkey);
      const [first, last] = splitName(nm, dd);
      const ph = dd?.img ? photos[dd.img] : null;
      if (ph?.thumb) {
        photosOut[pkey] = [ph.thumb.split('?')[0].replace('https://upload.wikimedia.org/wikipedia/commons/thumb/', '').replace('https://thumb.wikimedia.org/wikipedia/commons/thumb/', ''), ph.author || 'Autor desconhecido', ph.license || 'Licença livre'];
        report.photos++;
      }
      if (k) report.known++;
      list.push({ key: pkey, name: nm, first, last, nat: (e.nat && /^[A-Z]{3}$/.test(e.nat) ? FIX_NAT[e.nat] ?? e.nat : d.country), pos, alt: k?.alt || '', birth: birth ?? (k?.birth ?? null), sl: dd?.sl ?? 0, no: e.no ?? null, height: dd?.height ?? null, known: k, locked: !!k, loanFrom: /loan from/i.test(e.other ?? '') });
    }
    balance(list);
    // nível: nível do clube ajustado pela notoriedade relativa dentro do elenco e pela idade
    const fame = list.map((p) => Math.log(1 + p.sl));
    const mean = fame.reduce((a, b) => a + b, 0) / Math.max(1, fame.length);
    const sd = Math.max(0.45, Math.sqrt(fame.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, fame.length)));
    // qualidade típica de um titular (escala absoluta 0..25): depende da estatura do clube e da força da liga
    const euro = ['ENG', 'ESP', 'ITA', 'GER', 'FRA'].includes(d.country);
    const tier = Number(d.id.slice(-1));
    const T = euro ? 0.75 * level + (tier === 1 ? 4.5 : 3.5) : 0.7 * level + 2.5;
    squadsOut[key] = list.map((p, idx) => {
      const age = p.birth ? SEASON - p.birth : 25 + Math.round(rnd(p.key + 'a') * 6 - 3);
      let lvl;
      let pot;
      if (p.known) {
        lvl = p.known.lvl + (p.known.birth ? 0 : 0);
        pot = Math.max(lvl, p.known.pot);
      } else {
        const z = (fame[idx] - mean) / sd;
        lvl = T + clamp(z * 1.8, -4.5, 2.6);
        if (p.sl > 60) lvl += Math.min(2, Math.log(p.sl / 60) * 1.4);
        if (age <= 19) lvl -= 2.6; else if (age <= 21) lvl -= 1.3; else if (age >= 33) lvl -= (age - 32) * 0.45;
        lvl = clamp(lvl + (rnd(p.key + 'l') - 0.5) * 1.2, 1, Math.min(23.5, T + 3.5));
        const grow = age <= 19 ? 5 : age <= 21 ? 3.6 : age <= 23 ? 2.2 : age <= 25 ? 1 : age <= 27 ? 0.4 : 0;
        pot = clamp(lvl + grow * (0.6 + rnd(p.key + 'p') * 0.8), lvl, 25);
      }
      report.players++;
      report.real++;
      const k = p.known;
      return [p.name, p.nat, p.pos, p.alt, p.birth ?? SEASON - age, Math.round(lvl * 10) / 10, Math.round(pot * 10) / 10, k?.style ?? '', k?.traits ?? '', k?.foot ?? '', p.no ?? 0, p.height ?? 0, p.key, p.first, p.last];
    });
    if (squadsOut[key].length < 18) report.generatedNeeded++;
  }
}

mkdirSync(new URL('../../src/engine/data/real/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../src/engine/data/real/clubs.json', import.meta.url), JSON.stringify(clubsOut));
writeFileSync(new URL('../../src/engine/data/real/squads.json', import.meta.url), JSON.stringify(squadsOut));
writeFileSync(new URL('../../src/engine/data/real/photos.json', import.meta.url), JSON.stringify(photosOut));
writeFileSync(new URL('../../src/engine/data/real/coaches.json', import.meta.url), JSON.stringify(coachesOut));
report.coaches = Object.keys(coachesOut).length;
writeFileSync(new URL('./build-report.json', import.meta.url), JSON.stringify(report, null, 1));
console.log(report);
