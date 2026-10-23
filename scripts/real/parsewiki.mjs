// Extrai o elenco principal (seção "First-team squad"/"Current squad") dos artigos dos clubes na Wikipédia em inglês.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const res = JSON.parse(readFileSync('resolved.json', 'utf8'));
const SKIP = /loan|reserve|youth|academy|under[- ]?\d|u-?\d\d|b team|b squad|women|ladies|retired|notable|former|staff|management|personnel|second team|development|feminin|futsal/i;
const WANT = /first[- ]?team|current squad|^\s*squad\s*$|^\s*players\s*$|senior squad|professional squad|first squad|squad\s*20\d\d|plantel|current roster|team squad|first team squad/i;

function parseParams(s) {
  // separa por | no nível superior (ignora | dentro de [[ ]] e {{ }})
  const out = {}; let depth = 0, buf = '', parts = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if ((c === '[' && n === '[') || (c === '{' && n === '{')) { depth++; buf += c + n; i++; continue; }
    if ((c === ']' && n === ']') || (c === '}' && n === '}')) { depth--; buf += c + n; i++; continue; }
    if (c === '|' && depth === 0) { parts.push(buf); buf = ''; continue; }
    buf += c;
  }
  parts.push(buf);
  for (const p of parts.slice(1)) { const k = p.indexOf('='); if (k > 0) out[p.slice(0, k).trim().toLowerCase()] = p.slice(k + 1).trim(); }
  return out;
}
const PLAYER_TPL = /^\s*((fs2?|football squad2?|fs2 player|fs) player|jugador de fútbol)\s*$/i;
/** Encontra todas as chamadas {{fs player|...}} / {{Fs2 player|...}} (com chaves aninhadas), na ordem, com a posição no texto. */
function scanPlayers(text) {
  const out = [];
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] !== '{' || text[i + 1] !== '{' || text[i + 2] === '{') continue;
    const head = text.slice(i + 2, i + 40).split(/[|}]/)[0];
    if (!PLAYER_TPL.test(head)) continue;
    let depth = 0, j = i;
    for (; j < text.length - 1; j++) {
      if (text[j] === '{' && text[j + 1] === '{') { depth++; j++; continue; }
      if (text[j] === '}' && text[j + 1] === '}') { depth--; j++; if (depth === 0) break; }
    }
    out.push({ at: i, params: parseParams(text.slice(i + 2, j - 1)) });
    i = j;
  }
  return out;
}
function nameOf(v) {
  if (!v) return null;
  let m = v.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (m) return { article: m[1].trim(), display: (m[2] ?? m[1]).trim() };
  m = v.match(/\{\{\s*sortname\s*\|([^}]+)\}\}/i);
  if (m) {
    const ps = m[1].split('|').map((x) => x.trim());
    const pos = ps.filter((x) => !x.includes('='));
    const kv = Object.fromEntries(ps.filter((x) => x.includes('=')).map((x) => x.split('=').map((y) => y.trim())));
    const display = `${pos[0] ?? ''} ${pos[1] ?? ''}`.trim();
    let article = pos[2] && pos[2] !== 'nolink' ? pos[2] : display;
    if (kv.dab) article = `${display} (${kv.dab})`;
    return { article: pos[2] === 'nolink' || kv.nolink ? null : article, display };
  }
  const plain = v.replace(/\{\{[^}]*\}\}/g, '').replace(/<[^>]+>/g, '').trim();
  return plain ? { article: null, display: plain } : null;
}
function headingsOf(text) {
  const hs = [];
  const re = /^(=+)\s*(.*?)\s*\1\s*$/gm; let m;
  while ((m = re.exec(text))) hs.push({ at: m.index, title: m[2].replace(/\[\[|\]\]|'''/g, '') });
  return hs;
}
function squadOf(text) {
  const hs = headingsOf(text);
  const merged = {};
  for (const p of scanPlayers(text)) {
    const h = hs.filter((x) => x.at < p.at).pop()?.title ?? '';
    (merged[h] ??= []).push(p.params);
  }
  const heads = Object.keys(merged);
  const pick = heads.filter((h) => WANT.test(h) && !SKIP.test(h));
  // elenco transcluído de uma predefinição ({{Clube squad}}) dentro de uma seção de elenco
  let tpl = null;
  const sec = text.split(/\n(?==+\s*)/).filter((part) => { const h = part.match(/^=+\s*(.*?)\s*=+/); return h && WANT.test(h[1]) && !SKIP.test(h[1]); }).join('\n');
  const tm = sec.match(/\{\{\s*([^|{}\n]*?(?:squad|roster|plantel)[^|{}\n]*?)\s*(\|[^{}]*)?\}\}/i);
  if (tm && !/fs |football squad|squad on pitch|^col-/i.test(tm[1])) tpl = tm[1].trim();
  return { heading: pick.join(' + '), players: pick.flatMap((h) => merged[h]), tpl };
}
const out = {}; const report = []; const needTpl = new Set();
const nm = (p) => {
  if (p.name) return nameOf(p.name);
  if (p.first || p.last) { const display = `${p.first ?? ''} ${p.last ?? ''}`.trim(); return { article: p.link ?? display, display }; }
  return null;
};
for (const [div, clubs] of Object.entries(res)) for (const c of clubs) {
  const f = `wiki/${c.qid}.en.txt`;
  if (!c.qid || !existsSync(f)) { report.push(`${div} ${c.name}: sem artigo`); continue; }
  let { heading, players, tpl } = squadOf(readFileSync(f, 'utf8'));
  if (players.length < 12 && tpl) {
    const tf = `wiki/tpl_${tpl.replace(/[^\w-]+/g, '_')}.txt`;
    if (existsSync(tf)) {
      const tt = readFileSync(tf, 'utf8');
      const cut = tt.search(/out on loan|emprestados|=\s*loan/i);
      players = scanPlayers(tt).filter((p) => cut < 0 || p.at < cut).map((p) => p.params);
      heading = 'Template:' + tpl;
    } else needTpl.add(tpl);
  }
  out[c.qid] = players.map((p) => ({ no: p.no ? +String(p.no).replace(/\D/g, '') || null : null, pos: (p.pos ?? '').toUpperCase().slice(0, 2), nat: (p.nat ?? '').toUpperCase(), ...nm(p), other: p.other ?? '' })).filter((p) => p.display);
  const fes = `wiki/${c.qid}.es.txt`;
  if (out[c.qid].length < 15 && existsSync(fes)) {
    const t = readFileSync(fes, 'utf8');
    const hs = headingsOf(t);
    const ES = { argentina: 'ARG', uruguay: 'URU', paraguay: 'PAR', colombia: 'COL', chile: 'CHI', 'perú': 'PER', peru: 'PER', bolivia: 'BOL', venezuela: 'VEN', ecuador: 'ECU', brasil: 'BRA', 'españa': 'ESP', 'méxico': 'MEX' };
    const POS = { POR: 'GK', DEF: 'DF', MED: 'MF', CEN: 'MF', DEL: 'FW' };
    const ps = scanPlayers(t).filter((p) => { const h = hs.filter((x) => x.at < p.at).pop()?.title ?? ''; return /plantel|plantilla/i.test(h) && !/altas|bajas|cesion|destacad|ídolo|idolo|histór/i.test(h); });
    if (ps.length >= 15) {
      out[c.qid] = ps.map(({ params: p }) => { const n = nameOf((p.name ?? p.nombre ?? '').replace(/'''/g, '')); return { no: p.no ? +String(p.no).replace(/\D/g, '') || null : null, pos: POS[(p.pos ?? '').toUpperCase().slice(0, 3)] ?? '', nat: ES[(p.nat ?? p.nac ?? '').toLowerCase().trim()] ?? (p.nat ?? '').toUpperCase().slice(0, 3), article: n?.article ? 'es:' + n.article : null, display: n?.display, other: '' }; }).filter((p) => p.display);
      heading = 'eswiki plantel';
    }
  }
  report.push(`${div} ${c.name}: ${out[c.qid].length} [${heading}]`);
}
writeFileSync('wikisquads.json', JSON.stringify(out));
writeFileSync('needtpl.json', JSON.stringify([...needTpl]));
console.log(report.join('\n'));
