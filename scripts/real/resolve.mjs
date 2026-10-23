import { sparql, v, qid } from './sparql.mjs';
import { DIVS, COUNTRY_QID } from './divisions.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const p118 = JSON.parse(readFileSync('p118.json', 'utf8'));
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const all = Object.values(p118).flat();
const prev = existsSync('resolved.json') ? JSON.parse(readFileSync('resolved.json', 'utf8')) : {};
const out = {};
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
for (const d of DIVS) {
  out[d.id] = [];
  for (const [name, short, level, term, city, state] of d.clubs) {
    const old = prev[d.id]?.find((x) => x.name === name && x.qid);
    let q = old?.qid;
    if (!q) {
      const t = norm(term ?? name);
      const hit = all.find((x) => norm(x.n) === t);
      if (hit) q = hit.q;
    }
    if (!q) {
      for (const lang of ['en', 'pt', 'es']) {
        const rows = await sparql(`SELECT ?item ?sl WHERE { SERVICE wikibase:mwapi { bd:serviceParam wikibase:endpoint "www.wikidata.org"; wikibase:api "EntitySearch"; mwapi:search "${(term ?? name).replace(/"/g, '\\"')}"; mwapi:language "${lang}". ?item wikibase:apiOutputItem mwapi:item. } ?item wdt:P31/wdt:P279* wd:Q476028 ; wdt:P17 wd:${COUNTRY_QID[d.country]} ; wikibase:sitelinks ?sl . } ORDER BY DESC(?sl) LIMIT 1`);
        await sleep(400);
        if (rows[0]) { q = qid(v(rows[0], 'item')); break; }
      }
      if (!q) {
        const rows = await sparql(`SELECT ?item ?sl WHERE { SERVICE wikibase:mwapi { bd:serviceParam wikibase:endpoint "www.wikidata.org"; wikibase:api "EntitySearch"; mwapi:search "${name.replace(/"/g, '\\"')}"; mwapi:language "en". ?item wikibase:apiOutputItem mwapi:item. } ?item wdt:P31/wdt:P279* wd:Q476028 ; wdt:P17 wd:${COUNTRY_QID[d.country]} ; wikibase:sitelinks ?sl . } ORDER BY DESC(?sl) LIMIT 1`);
        await sleep(400);
        if (rows[0]) q = qid(v(rows[0], 'item'));
      }
    }
    out[d.id].push({ name, short, level, city, state, qid: q ?? null });
    if (!q) console.log('NÃO RESOLVIDO', d.id, name);
  }
  console.log(d.id, out[d.id].filter((x) => x.qid).length, '/', d.clubs.length);
}
writeFileSync('resolved.json', JSON.stringify(out, null, 1));
