import { sparql, v, qid } from './sparql.mjs';
for (const term of process.argv.slice(2)) {
  const rows = await sparql(`SELECT ?item ?itemLabel ?d ?sl WHERE { SERVICE wikibase:mwapi { bd:serviceParam wikibase:endpoint "www.wikidata.org"; wikibase:api "EntitySearch"; mwapi:search "${term}"; mwapi:language "en". ?item wikibase:apiOutputItem mwapi:item. } ?item wikibase:sitelinks ?sl . OPTIONAL { ?item schema:description ?d FILTER(lang(?d)="en") } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?sl) LIMIT 4`);
  console.log(term, '=>', rows.map((r) => `${qid(v(r, 'item'))} ${v(r, 'itemLabel')} [${v(r, 'd') ?? ''}] sl=${v(r, 'sl')}`).join(' | '));
}
