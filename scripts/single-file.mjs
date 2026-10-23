// Gera uma versão de arquivo único (JS e CSS embutidos) a partir de dist/, para hospedar como página estática.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const dir = 'dist/assets';
const files = readdirSync(dir);
const js = readFileSync(`${dir}/${files.find((f) => f.endsWith('.js'))}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(`${dir}/${files.find((f) => f.endsWith('.css'))}`, 'utf8');
const fonts = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&family=Saira+Condensed:wght@600;700;800&display=swap';
const html = `<title>Football Manager BR</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/football-manager-br.html', html);
console.log(`dist-single/football-manager-br.html (${(html.length / 1024).toFixed(0)} KB)`);
