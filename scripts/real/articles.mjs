import { sparql, v, qid } from './sparql.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const r = JSON.parse(readFileSync('resolved.json', 'utf8'));
const ids = Object.values(r).flat().map((c) => c.qid).filter(Boolean);
const out = {};
for (let i = 0; i < ids.length; i += 150) {
  const rows = await sparql(`SELECT ?c ?a ?w WHERE { VALUES ?c { ${ids.slice(i, i + 150).map((x) => 'wd:' + x).join(' ')} } ?a schema:about ?c ; schema:isPartOf ?w . FILTER(?w IN (<https://en.wikipedia.org/>, <https://es.wikipedia.org/>, <https://pt.wikipedia.org/>, <https://it.wikipedia.org/>, <https://de.wikipedia.org/>, <https://fr.wikipedia.org/>)) }`);
  for (const x of rows) {
    const lang = v(x, 'w').split('//')[1].split('.')[0];
    (out[qid(v(x, 'c'))] ??= {})[lang] = decodeURIComponent(v(x, 'a').split('/wiki/')[1]);
  }
}
writeFileSync('articles.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'clubes com artigo;', Object.values(out).filter((x) => x.en).length, 'com enwiki');
