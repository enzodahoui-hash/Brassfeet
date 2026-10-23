import { readFileSync, writeFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync('raw-players.json', 'utf8'));
const mem = JSON.parse(readFileSync('memberships.json', 'utf8'));
const types = JSON.parse(readFileSync('clubtypes.json', 'utf8'));
const tl = JSON.parse(readFileSync('typelabels.json', 'utf8'));
const res = JSON.parse(readFileSync('resolved.json', 'utf8'));
const ours = new Set(Object.values(res).flat().map((c) => c.qid).filter(Boolean));
const TODAY = '2026-10-23';
const bad = (c) => !ours.has(c) && (types[c] ?? []).some((t) => /national|women|futsal|basketball|handball|rugby|volleyball/i.test(tl[t] ?? '') || t === 'Q2412834');
const players = {};
for (const list of Object.values(raw)) for (const p of list) players[p.id] ??= p;
const squads = {};
let stale = 0, elsewhere = 0, ok = 0;
for (const p of Object.values(players)) {
  const ms = (mem[p.id] ?? []).filter((m) => !bad(m[0]));
  const open = ms.filter((m) => !m[2] || m[2] > TODAY).filter((m) => !m[1] || m[1] <= TODAY);
  if (!open.length) { stale++; continue; }
  open.sort((a, b) => (b[1] ?? '').localeCompare(a[1] ?? ''));
  const cur = open[0];
  let latestOther = '';
  for (const m of ms) if (m !== cur) for (const d of [m[1], m[2]]) if (d && d <= TODAY && d > latestOther && !(open.includes(m) && d === m[1])) latestOther = d;
  // vínculos abertos mais antigos não contam como "outros" (podem ser o clube dono do empréstimo)
  latestOther = ''; for (const m of ms) { if (open.includes(m)) continue; for (const d of [m[1], m[2]]) if (d && d <= TODAY && d > latestOther) latestOther = d; }
  if (cur[1] ? cur[1] < latestOther.slice(0, 7) + '-00' && cur[1] < latestOther : !!latestOther && latestOther > '2015') { stale++; continue; }
  if (cur[1] && cur[1] < '2015-01-01' && p.birth < '1992') { stale++; continue; }
  if (!cur[1] && p.birth < '1991') { stale++; continue; }
  if (!ours.has(cur[0])) { elsewhere++; continue; }
  // empréstimo: o jogador atua no clube do vínculo mais recente; guarda o clube dono se houver outro vínculo aberto
  const owner = open.find((m) => m !== cur && ours.has(m[0]));
  (squads[cur[0]] ??= []).push({ ...p, start: cur[1], loanFrom: cur[3] && owner ? owner[0] : null });
  ok++;
}
// elenco final: até 30 jogadores, priorizando vínculos recentes e jogadores mais conhecidos
const yearsSince = (d) => (d ? Math.max(0, (Date.parse(TODAY) - Date.parse(d)) / 31557600000) : 5);
for (const [c, list] of Object.entries(squads)) {
  for (const p of list) p.score = Math.log(p.sl + 1) * 1.5 - Math.min(4, yearsSince(p.start)) * 0.6;
  list.sort((a, b) => b.score - a.score);
  squads[c] = list.slice(0, 30);
}
const sizes = Object.values(res).flat().map((c) => [c.name, c.qid ? (squads[c.qid]?.length ?? 0) : -1]);
console.log({ ok, stale, elsewhere });
console.log(sizes.map(([n, s]) => `${n}:${s}`).join(' '));
writeFileSync('squads.json', JSON.stringify(squads));
