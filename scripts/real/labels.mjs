import { sparql, v, qid } from './sparql.mjs';
import { readFileSync } from 'node:fs';
const r = JSON.parse(readFileSync('resolved.json', 'utf8'));
const ids = Object.values(r).flat().filter((x) => x.qid).map((x) => x.qid);
const lab = {};
for (let i = 0; i < ids.length; i += 150) {
  const rows = await sparql(`SELECT ?c ?cLabel WHERE { VALUES ?c { ${ids.slice(i, i + 150).map((x) => 'wd:' + x).join(' ')} } SERVICE wikibase:label { bd:serviceParam wikibase:language "en,pt,es". } }`);
  for (const x of rows) lab[qid(v(x, 'c'))] = v(x, 'cLabel');
}
for (const [d, cs] of Object.entries(r)) console.log(d + ': ' + cs.map((c) => `${c.name}=${c.qid ? lab[c.qid] : '??'}`).join(' ; '));
