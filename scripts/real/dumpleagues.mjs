import { sparql, v, qid } from './sparql.mjs';
import { writeFileSync } from 'node:fs';
const L = { bra1: 'Q206813', bra2: 'Q610175', bra3: 'Q2037826', bra4: 'Q931513', arg1: 'Q223170', arg2: 'Q934724', uru1: 'Q287453', chi1: 'Q606832', chi2: 'Q2686290', col1: 'Q1033349', ecu1: 'Q2289847', par1: 'Q954911', per1: 'Q606652', bol1: 'Q1622667', ven1: 'Q1033339', eng1: 'Q9448', eng2: 'Q19510', esp1: 'Q324867', esp2: 'Q35615', ita1: 'Q15804', ita2: 'Q194052', ger1: 'Q82595', ger2: 'Q152665', fra1: 'Q13394', fra2: 'Q217374' };
const out = {};
for (const [k, l] of Object.entries(L)) {
  const rows = await sparql(`SELECT ?c ?cLabel ?sl ?start WHERE { ?c p:P118 ?st . ?st ps:P118 wd:${l} . FILTER NOT EXISTS { ?st pq:P582 ?e } OPTIONAL { ?st pq:P580 ?start } ?c wikibase:sitelinks ?sl . ?c wdt:P31/wdt:P279* wd:Q476028 . FILTER NOT EXISTS { ?c wdt:P576 ?dis } SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en,es". } } ORDER BY DESC(?sl)`);
  out[k] = rows.map((r) => ({ q: qid(v(r, 'c')), n: v(r, 'cLabel'), sl: +v(r, 'sl'), start: v(r, 'start')?.slice(0, 10) }));
  console.log(k, out[k].length, out[k].map((x) => x.n + (x.start ? `(${x.start.slice(0, 4)})` : '')).join(' | '));
  await new Promise((s) => setTimeout(s, 800));
}
writeFileSync('p118.json', JSON.stringify(out, null, 1));
