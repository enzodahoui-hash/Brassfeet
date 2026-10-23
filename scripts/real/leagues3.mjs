import { sparql, v, qid } from './sparql.mjs';
const C = { BOL: 'Q750', PER: 'Q419', ARG: 'Q414', FRA: 'Q142', VEN: 'Q717', ECU: 'Q736', CHI: 'Q298', URU: 'Q77', PAR: 'Q733', COL: 'Q739' };
for (const [k, c] of Object.entries(C)) {
  const rows = await sparql(`SELECT ?l ?lLabel (COUNT(DISTINCT ?c) AS ?n) WHERE { ?c wdt:P17 wd:${c} ; p:P118 ?st . ?st ps:P118 ?l . FILTER NOT EXISTS { ?st pq:P582 ?e } ?c wdt:P31/wdt:P279* wd:Q476028 . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } GROUP BY ?l ?lLabel ORDER BY DESC(?n) LIMIT 4`);
  console.log(k, rows.map((r) => `${qid(v(r, 'l'))}=${v(r, 'lLabel')}:${v(r, 'n')}`).join(' ; '));
}
