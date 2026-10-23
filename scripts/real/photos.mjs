// Autor e licença de cada foto (Wikimedia Commons). Só fotos com licença livre identificada entram no jogo.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const det = JSON.parse(readFileSync('pdetails.json', 'utf8'));
const files = [...new Set(Object.values(det).map((d) => d.img).filter(Boolean))];
const out = existsSync('photos.json') ? JSON.parse(readFileSync('photos.json', 'utf8')) : {};
const todo = files.filter((f) => !(f in out));
console.log('fotos', files.length, 'faltam', todo.length);
const strip = (h) => (h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
for (let i = 0; i < todo.length; i += 50) {
  const batch = todo.slice(i, i + 50);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=240&titles=${encodeURIComponent(batch.map((f) => 'File:' + f).join('|'))}`;
  let data = null;
  for (let k = 0; k < 5 && !data; k++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'FMBR-DataBuilder/0.1 (football game; photo credits; low rate)' } });
    if (r.ok) data = await r.json();
    else await sleep(6000 * (k + 1));
  }
  if (!data) { console.log('falhou lote', i); continue; }
  const norm = {};
  for (const n of data.query.normalized ?? []) norm[n.to] = n.from;
  for (const pg of data.query.pages) {
    const title = norm[pg.title] ?? pg.title;
    const file = title.replace(/^File:/, '');
    const ii = pg.imageinfo?.[0];
    const m = ii?.extmetadata ?? {};
    out[file] = ii ? { thumb: ii.thumburl ?? null, author: strip(m.Artist?.value).slice(0, 120), license: strip(m.LicenseShortName?.value), licUrl: m.LicenseUrl?.value ?? null } : null;
  }
  for (const f of batch) if (!(f in out)) out[f] = null;
  writeFileSync('photos.json', JSON.stringify(out));
  if ((i / 50) % 10 === 0) console.log(i + batch.length);
  await sleep(1500);
}
const vals = Object.values(out).filter(Boolean);
const lic = {};
for (const x of vals) lic[x.license] = (lic[x.license] ?? 0) + 1;
console.log('ok', vals.length, Object.entries(lic).sort((a, b) => b[1] - a[1]).slice(0, 12));
