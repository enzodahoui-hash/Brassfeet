import { sparql, v, qid } from './sparql.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const ws = JSON.parse(readFileSync('wikisquads.json', 'utf8'));
const map = existsSync('artqid.json') ? JSON.parse(readFileSync('artqid.json', 'utf8')) : {};
const arts = [...new Set(Object.values(ws).flat().map((p) => p.article).filter(Boolean))].filter((a) => !(a in map));
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
for (let i = 0; i < arts.length; i += 200) {
  const batch = arts.slice(i, i + 200);
  const en = batch.filter((a) => !a.startsWith('es:') && !a.startsWith(':'));
  const es = batch.filter((a) => a.startsWith('es:') || a.startsWith(':es:')).map((a) => a.replace(/^:?es:/, ''));
  const norm = (t) => { t = t.replace(/_/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
  const q = (list, lang) => list.length ? `{ VALUES ?t { ${list.map((a) => `"${esc(norm(a))}"@${lang}`).join(' ')} } ?a schema:name ?t ; schema:isPartOf <https://${lang}.wikipedia.org/> ; schema:about ?p . }` : '';
  const parts = [q(en, 'en'), q(es, 'es')].filter(Boolean);
  const rows = parts.length ? await sparql(`SELECT ?t ?p WHERE { ${parts.join(' UNION ')} }`) : [];
  const got = {};
  for (const r of rows) got[v(r, 't')] = qid(v(r, 'p'));
  for (const a of batch) { const key = norm(a.replace(/^:?es:/, '')); map[a] = got[key] ?? null; }
  writeFileSync('artqid.json', JSON.stringify(map));
  console.log(i + batch.length, '/', arts.length);
  await sleep(700);
}
console.log('resolvidos', Object.values(map).filter(Boolean).length, 'de', Object.keys(map).length);
