// Busca elencos atuais (vínculos P54 sem data de término) e dados dos jogadores no Wikidata.
import { sparql, v, qid } from './sparql.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const r = JSON.parse(readFileSync('resolved.json', 'utf8'));
const clubs = Object.values(r).flat().filter((c) => c.qid);
const cache = existsSync('raw-players.json') ? JSON.parse(readFileSync('raw-players.json', 'utf8')) : {};
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const B = 6;
for (let i = 0; i < clubs.length; i += B) {
  const batch = clubs.slice(i, i + B).filter((c) => !cache[c.qid]);
  if (!batch.length) continue;
  const rows = await sparql(`SELECT ?club ?p ?pLabel ?birth ?pos ?nat ?cit ?height ?img ?sl ?start ?num WHERE {
    VALUES ?club { ${batch.map((c) => 'wd:' + c.qid).join(' ')} }
    ?p p:P54 ?st . ?st ps:P54 ?club .
    FILTER NOT EXISTS { ?st pq:P582 ?end }
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?birth .
    FILTER(YEAR(?birth) >= 1984)
    FILTER NOT EXISTS { ?p wdt:P570 ?death }
    OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P1618 ?num }
    OPTIONAL { ?p wdt:P413 ?pos } OPTIONAL { ?p wdt:P1532 ?nat } OPTIONAL { ?p wdt:P27 ?cit }
    OPTIONAL { ?p wdt:P2048 ?height } OPTIONAL { ?p wdt:P18 ?img }
    ?p wikibase:sitelinks ?sl .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "pt-br,pt,en,es,fr,de,it". }
  }`);
  const per = {};
  for (const b of batch) per[b.qid] = {};
  for (const x of rows) {
    const c = qid(v(x, 'club')); const p = qid(v(x, 'p'));
    const o = (per[c][p] ??= { id: p, name: v(x, 'pLabel'), birth: v(x, 'birth')?.slice(0, 10), pos: [], nat: [], cit: [], height: null, img: null, sl: +v(x, 'sl'), start: null, num: null });
    const add = (arr, val) => val && !arr.includes(val) && arr.push(val);
    add(o.pos, qid(v(x, 'pos'))); add(o.nat, qid(v(x, 'nat'))); add(o.cit, qid(v(x, 'cit')));
    if (v(x, 'height')) o.height = +v(x, 'height');
    if (v(x, 'img')) o.img = decodeURIComponent(v(x, 'img').split('/').pop());
    if (v(x, 'start') && (!o.start || v(x, 'start') > o.start)) o.start = v(x, 'start').slice(0, 10);
    if (v(x, 'num')) o.num = +v(x, 'num');
  }
  for (const b of batch) cache[b.qid] = Object.values(per[b.qid]);
  writeFileSync('raw-players.json', JSON.stringify(cache));
  console.log(`${Math.min(i + B, clubs.length)}/${clubs.length}`, batch.map((b) => `${b.name}:${cache[b.qid].length}`).join(' '));
  await sleep(1200);
}
