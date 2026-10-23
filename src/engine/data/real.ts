// Elencos reais (outubro de 2026), fotos licenciadas e técnicos, gerados por scripts/real/build.mjs.
// Fontes: Wikipédia (elenco atual de cada clube), Wikidata (nascimento, posição, altura) e Wikimedia
// Commons (fotos com licença livre; o crédito acompanha cada foto). Níveis e potenciais são estimativas.
import SQUADS_JSON from './real/squads.json';
import PHOTOS_JSON from './real/photos.json';
import COACHES_JSON from './real/coaches.json';

/** [nome, nac, pos, alt, ano, nível, potencial, estilo, traços, pé, número, altura, chave, primeiro nome, sobrenome] */
export type RealPlayerRow = [string, string, string, string, number, number, number, string, string, string, number, number, string, string, string];

export const REAL_SQUADS = SQUADS_JSON as unknown as Record<string, RealPlayerRow[]>;
/** chave do jogador → [caminho da miniatura no Commons, autor, licença] */
export const REAL_PHOTOS = PHOTOS_JSON as unknown as Record<string, [string, string, string]>;
export const REAL_COACHES = COACHES_JSON as unknown as Record<string, string>;

export const COMMONS_THUMB = 'https://upload.wikimedia.org/wikipedia/commons/thumb/';
