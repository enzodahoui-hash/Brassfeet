import { sparql, v } from './sparql.mjs';
const leagues = { bra1: 'Q206813' };
const rows = await sparql(`SELECT ?s ?sLabel ?start (COUNT(?t) AS ?n) WHERE { ?s wdt:P3450 wd:Q206813 . OPTIONAL{?s wdt:P580 ?start} OPTIONAL{?s wdt:P1923 ?t} SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". } } GROUP BY ?s ?sLabel ?start ORDER BY DESC(?start) LIMIT 5`);
for (const r of rows) console.log(v(r,'s'), v(r,'sLabel'), v(r,'start'), v(r,'n'));
