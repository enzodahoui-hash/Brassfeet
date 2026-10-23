import { sparql, v, qid } from './sparql.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const red = JSON.parse(readFileSync('redirects.json', 'utf8'));
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const norm = (t) => { t = t.replace(/_/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
const pairs = Object.entries(red).filter(([, t]) => t);
const out = {};
for (let i = 0; i < pairs.length; i += 150) {
  const b = pairs.slice(i, i + 150);
  const en = b.filter(([, t]) => !t.startsWith('es:')).map(([, t]) => norm(t.split('#')[0]));
  const es = b.filter(([, t]) => t.startsWith('es:')).map(([, t]) => norm(t.slice(3).split('#')[0]));
  const q = (list, lang) => list.length ? `{ VALUES ?t { ${list.map((a) => `"${esc(a)}"@${lang}`).join(' ')} } ?a schema:name ?t ; schema:isPartOf <https://${lang}.wikipedia.org/> ; schema:about ?p . }` : '';
  const rows = await sparql(`SELECT ?t ?p WHERE { ${[q(en, 'en'), q(es, 'es')].filter(Boolean).join(' UNION ')} }`);
  const got = Object.fromEntries(rows.map((r) => [v(r, 't'), qid(v(r, 'p'))]));
  for (const [a, t] of b) out[a] = got[norm(t.replace(/^es:/, '').split('#')[0])] ?? null;
}
writeFileSync('redqid.json', JSON.stringify(out));
console.log('resolvidos', Object.values(out).filter(Boolean).length, 'de', pairs.length);
