import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const need = JSON.parse(readFileSync('needtpl.json', 'utf8'));
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
for (const t of need) {
  const tf = `wiki/tpl_${t.replace(/[^\w-]+/g, '_')}.txt`;
  if (existsSync(tf)) continue;
  let txt = '';
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent('Template:' + t)}&action=raw`, { headers: { 'User-Agent': 'FMBR-DataBuilder/0.1 (football game data; low rate)' } });
    if (r.ok) { txt = await r.text(); break; }
    if (r.status === 404) break;
    await sleep(4000 * (i + 1));
  }
  const red = txt.match(/^#REDIRECT\s*\[\[(?:Template:)?([^\]|#]+)/i);
  if (red) { await sleep(1200); const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent('Template:' + red[1].replace(/^Template:/, ''))}&action=raw`, { headers: { 'User-Agent': 'FMBR-DataBuilder/0.1' } }); txt = r.ok ? await r.text() : ''; }
  writeFileSync(tf, txt);
  console.log(t, txt.length);
  await sleep(1200);
}
