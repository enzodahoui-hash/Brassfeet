export async function sparql(q, tries = 4) {
  const url = 'https://query.wikidata.org/sparql';
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json', 'User-Agent': 'fmbr-data-builder/0.1 (game dev; contact via repo)' }, body: 'query=' + encodeURIComponent(q) });
    if (r.ok) return (await r.json()).results.bindings;
    const t = await r.text();
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 3000 * (i + 1))); continue; }
    throw new Error(`SPARQL ${r.status}: ${t.slice(0, 400)}`);
  }
  throw new Error('SPARQL falhou após várias tentativas');
}
export const v = (b, k) => b[k]?.value;
export const qid = (u) => u?.split('/').pop();
