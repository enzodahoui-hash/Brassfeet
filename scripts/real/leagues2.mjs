import { sparql, v, qid } from './sparql.mjs';
for (const n of ['Ecuadorian Serie A', 'Liga 1 (Peru)', 'Peruvian Primera División', 'Bolivian Primera División', 'División de Fútbol Profesional', 'Ligue 1']) {
  const rows = await sparql(`SELECT ?item ?itemLabel ?d WHERE { SERVICE wikibase:mwapi { bd:serviceParam wikibase:endpoint "www.wikidata.org"; wikibase:api "EntitySearch"; mwapi:search "${n}"; mwapi:language "en". ?item wikibase:apiOutputItem mwapi:item. } OPTIONAL { ?item schema:description ?d FILTER(lang(?d)="en") } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 5`);
  console.log(n, '=>', rows.map((r) => `${qid(v(r, 'item'))}=${v(r, 'itemLabel')} (${v(r, 'd') ?? ''})`).join(' ; '));
}
