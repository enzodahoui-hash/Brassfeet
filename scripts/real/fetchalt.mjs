import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const arts = JSON.parse(readFileSync('articles.json', 'utf8'));
const ws = JSON.parse(readFileSync('wikisquads.json', 'utf8'));
const res = JSON.parse(readFileSync('resolved.json', 'utf8'));
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
for (const [div, cs] of Object.entries(res)) for (const c of cs) {
  if (!c.qid || (ws[c.qid]?.length ?? 0) >= 15) continue;
  const lang = ['BRA'].includes(div.startsWith('bra') ? 'BRA' : '') ? 'pt' : 'es';
  const title = arts[c.qid]?.[lang];
  const f = `wiki/${c.qid}.${lang}.txt`;
  if (!title || existsSync(f)) continue;
  const r = await fetch(`https://${lang}.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`, { headers: { 'User-Agent': 'FMBR-DataBuilder/0.1 (football game data; low rate)' } });
  writeFileSync(f, r.ok ? await r.text() : '');
  console.log(c.name, lang, r.status);
  await sleep(1300);
}
