import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const arts = JSON.parse(readFileSync('articles.json', 'utf8'));
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const UA = 'FMBR-DataBuilder/0.1 (football game data; low rate) node-fetch';
async function raw(lang, title) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`https://${lang}.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.text();
    if (r.status === 404) return null;
    await sleep(5000 * (i + 1));
  }
  throw new Error(`falha ${lang}:${title}`);
}
let n = 0;
for (const [q, a] of Object.entries(arts)) {
  const f = `wiki/${q}.en.txt`;
  if (existsSync(f) || !a.en) continue;
  let t = await raw('en', a.en);
  // redirecionamentos
  const red = t?.match(/^#REDIRECT\s*\[\[([^\]|#]+)/i);
  if (red) { await sleep(1200); t = await raw('en', red[1]); }
  writeFileSync(f, t ?? '');
  n++;
  if (n % 25 === 0) console.log(n);
  await sleep(1200);
}
console.log('baixados', n);
