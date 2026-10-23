import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const map = JSON.parse(readFileSync('artqid.json', 'utf8'));
const red = existsSync('redirects.json') ? JSON.parse(readFileSync('redirects.json', 'utf8')) : {};
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const todo = Object.entries(map).filter(([a, q]) => !q && !(a in red)).map(([a]) => a);
console.log('verificando', todo.length);
let k = 0;
for (const a of todo) {
  const lang = a.startsWith('es:') || a.startsWith(':es:') ? 'es' : 'en';
  const title = a.replace(/^:?es:/, '');
  let target = null;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://${lang}.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`, { headers: { 'User-Agent': 'FMBR-DataBuilder/0.1 (football game data; low rate)' } });
    if (r.status === 404) break;
    if (r.ok) { const t = await r.text(); const m = t.match(/^#(?:REDIRECT|REDIRECCIÓN)\s*\[\[([^\]|#]+)/i); target = m ? (lang === 'es' ? 'es:' : '') + m[1].trim() : ''; break; }
    await sleep(5000 * (i + 1));
  }
  red[a] = target;
  if (++k % 50 === 0) { writeFileSync('redirects.json', JSON.stringify(red)); console.log(k); }
  await sleep(900);
}
writeFileSync('redirects.json', JSON.stringify(red));
console.log('fim', Object.values(red).filter(Boolean).length, 'redirecionamentos');
