import { sparql, v, qid } from './sparql.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const ids = JSON.parse(readFileSync('posids.json', 'utf8'));
const rows = await sparql(`SELECT ?p ?pLabel WHERE { VALUES ?p { ${ids.map((x) => 'wd:' + x).join(' ')} } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`);
const lab = Object.fromEntries(rows.map((r) => [qid(v(r, 'p')), v(r, 'pLabel')]));
writeFileSync('poslabels.json', JSON.stringify(lab, null, 1));
console.log(ids.map((i) => `${i}=${lab[i]}`).join(' | '));
