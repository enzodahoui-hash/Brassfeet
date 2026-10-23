import { sparql, v, qid } from './sparql.mjs';
for (const L of process.argv.slice(2)) {
const rows = await sparql(`SELECT ?c ?cLabel ?sl WHERE { ?c p:P118 ?st . ?st ps:P118 wd:${L} . FILTER NOT EXISTS { ?st pq:P582 ?e } ?c wikibase:sitelinks ?sl . ?c wdt:P31/wdt:P279* wd:Q476028 . SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en,es". } } ORDER BY DESC(?sl)`);
console.log(L, rows.length, rows.map(r => v(r,'cLabel')).join(' | '));
}
