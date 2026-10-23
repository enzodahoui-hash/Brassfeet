// Para cada jogador candidato, busca todos os vínculos P54 (clube, início, fim) para descobrir o clube atual real.
import { sparql, v, qid } from './sparql.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const raw = JSON.parse(readFileSync('raw-players.json', 'utf8'));
const ids = [...new Set(Object.values(raw).flat().map((p) => p.id))];
const out = existsSync('memberships.json') ? JSON.parse(readFileSync('memberships.json', 'utf8')) : {};
const todo = ids.filter((id) => !out[id]);
console.log('jogadores', ids.length, 'faltam', todo.length);
const B = 250;
for (let i = 0; i < todo.length; i += B) {
  const batch = todo.slice(i, i + B);
  const rows = await sparql(`SELECT ?p ?club ?start ?end ?loan WHERE { VALUES ?p { ${batch.map((x) => 'wd:' + x).join(' ')} } ?p p:P54 ?st . ?st ps:P54 ?club . OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?st pq:P1642 ?loan } }`);
  for (const b of batch) out[b] = [];
  for (const x of rows) out[qid(v(x, 'p'))].push([qid(v(x, 'club')), v(x, 'start')?.slice(0, 10) ?? null, v(x, 'end')?.slice(0, 10) ?? null, v(x, 'loan') ? 1 : 0]);
  writeFileSync('memberships.json', JSON.stringify(out));
  console.log(i + batch.length, '/', todo.length);
  await new Promise((s) => setTimeout(s, 800));
}
// tipos dos clubes (para ignorar seleções nacionais)
const clubIds = [...new Set(Object.values(out).flat().map((m) => m[0]))];
const types = existsSync('clubtypes.json') ? JSON.parse(readFileSync('clubtypes.json', 'utf8')) : {};
const t2 = clubIds.filter((c) => !types[c]);
for (let i = 0; i < t2.length; i += 300) {
  const batch = t2.slice(i, i + 300);
  const rows = await sparql(`SELECT ?c ?t WHERE { VALUES ?c { ${batch.map((x) => 'wd:' + x).join(' ')} } ?c wdt:P31 ?t }`);
  for (const b of batch) types[b] = [];
  for (const x of rows) types[qid(v(x, 'c'))].push(qid(v(x, 't')));
  writeFileSync('clubtypes.json', JSON.stringify(types));
  await new Promise((s) => setTimeout(s, 600));
}
console.log('clubes', clubIds.length);
