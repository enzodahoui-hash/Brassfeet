import { sparql, v, qid } from './sparql.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const r = JSON.parse(readFileSync('resolved.json', 'utf8'));
const ids = Object.values(r).flat().map((c) => c.qid).filter(Boolean);
const out = {};
for (let i = 0; i < ids.length; i += 60) {
  const batch = ids.slice(i, i + 60);
  const rows = await sparql(`SELECT ?c ?venueLabel ?cap ?cityLabel ?hex ?short WHERE { VALUES ?c { ${batch.map((x) => 'wd:' + x).join(' ')} }
    OPTIONAL { ?c wdt:P115 ?venue . OPTIONAL { ?venue wdt:P1083 ?cap } }
    OPTIONAL { ?c wdt:P159 ?city }
    OPTIONAL { ?c p:P6364 ?cs . ?cs ps:P6364 ?col . ?col wdt:P465 ?hex }
    OPTIONAL { ?c wdt:P1813 ?short }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "pt-br,pt,es,en". } }`);
  for (const x of rows) {
    const c = qid(v(x, 'c'));
    const o = (out[c] ??= { venues: {}, city: null, colors: [], short: null });
    const vn = v(x, 'venueLabel');
    if (vn && !/^Q\d+$/.test(vn)) o.venues[vn] = Math.max(o.venues[vn] ?? 0, Number(v(x, 'cap') ?? 0));
    if (!o.city && v(x, 'cityLabel') && !/^Q\d+$/.test(v(x, 'cityLabel'))) o.city = v(x, 'cityLabel');
    const hx = v(x, 'hex');
    if (hx && !o.colors.includes(hx)) o.colors.push(hx);
    if (!o.short && v(x, 'short')) o.short = v(x, 'short');
  }
  await new Promise((s) => setTimeout(s, 700));
}
writeFileSync('clubinfo.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'clubes;', Object.values(out).filter((o) => Object.keys(o.venues).length).length, 'com estádio;', Object.values(out).filter((o) => o.colors.length).length, 'com cores');
