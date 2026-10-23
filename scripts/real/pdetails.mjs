// Dados complementares de cada jogador no Wikidata (nascimento, posição, altura, foto, popularidade).
import { sparql, v, qid } from './sparql.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const map = JSON.parse(readFileSync('artqid.json', 'utf8'));
const red = existsSync('redqid.json') ? JSON.parse(readFileSync('redqid.json', 'utf8')) : {};
const ids = [...new Set([...Object.values(map), ...Object.values(red)].filter(Boolean))];
const out = existsSync('pdetails.json') ? JSON.parse(readFileSync('pdetails.json', 'utf8')) : {};
const todo = ids.filter((q) => !out[q]);
console.log('detalhes', todo.length);
for (let i = 0; i < todo.length; i += 150) {
  const batch = todo.slice(i, i + 150);
  const rows = await sparql(`SELECT ?p ?birth ?pos ?nat ?cit ?height ?img ?sl ?given ?family ?foot WHERE { VALUES ?p { ${batch.map((x) => 'wd:' + x).join(' ')} }
    OPTIONAL { ?p wdt:P569 ?birth } OPTIONAL { ?p wdt:P413 ?pos } OPTIONAL { ?p wdt:P1532 ?nat } OPTIONAL { ?p wdt:P27 ?cit }
    OPTIONAL { ?p wdt:P2048 ?height } OPTIONAL { ?p wdt:P18 ?img } OPTIONAL { ?p wikibase:sitelinks ?sl }
    OPTIONAL { ?p wdt:P735 ?g . ?g rdfs:label ?given FILTER(lang(?given) = "en") } OPTIONAL { ?p wdt:P734 ?f . ?f rdfs:label ?family FILTER(lang(?family) = "en") }
    OPTIONAL { ?p wdt:P552 ?foot } }`);
  for (const b of batch) out[b] = { birth: null, pos: [], nat: [], cit: [], height: null, img: null, sl: 0, given: null, family: null, foot: null };
  for (const x of rows) {
    const o = out[qid(v(x, 'p'))];
    const add = (arr, val) => val && !arr.includes(val) && arr.push(val);
    if (v(x, 'birth') && !o.birth) o.birth = v(x, 'birth').slice(0, 10);
    add(o.pos, qid(v(x, 'pos'))); add(o.nat, qid(v(x, 'nat'))); add(o.cit, qid(v(x, 'cit')));
    if (v(x, 'height')) { let h = Number(v(x, 'height')); if (h < 3) h *= 100; if (h > 140 && h < 220) o.height = Math.round(h); }
    if (v(x, 'img') && !o.img) o.img = decodeURIComponent(v(x, 'img').split('/').pop());
    if (v(x, 'sl')) o.sl = Number(v(x, 'sl'));
    if (v(x, 'given') && !o.given) o.given = v(x, 'given');
    if (v(x, 'family') && !o.family) o.family = v(x, 'family');
    if (v(x, 'foot')) o.foot = qid(v(x, 'foot'));
  }
  writeFileSync('pdetails.json', JSON.stringify(out));
  if ((i / 150) % 10 === 0) console.log(i + batch.length, '/', todo.length);
  await new Promise((s) => setTimeout(s, 700));
}
console.log('ok', Object.keys(out).length);
