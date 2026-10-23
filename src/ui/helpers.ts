import type { Career, Player } from '../engine/types';
import { ovrToLevel } from '../engine/players/attributes';
import { clubEffects } from '../engine/infra/infra';
import { potentialEstimate } from '../engine/youth/academy';

/** Potencial exibido: exato para profissionais do clube; faixa estimada pelos olheiros para os demais. */
export function potRange(c: Career, p: Player): { low: number; high: number; exact: boolean } {
  if (p.clubId === c.userClubId && p.squad === 'senior') return { low: Math.round(ovrToLevel(p.pot)), high: Math.round(ovrToLevel(p.pot)), exact: true };
  if (p.clubId === c.userClubId) {
    const e = potentialEstimate(c, p);
    return { low: e.low, high: e.high, exact: false };
  }
  const acc = clubEffects(c, c.clubs[c.userClubId]).scouting;
  const err = Math.max(1, 5 - acc * 4);
  const truth = ovrToLevel(p.pot);
  const off = ((p.num * 37) % 100) / 100 - 0.5;
  const mid = Math.max(ovrToLevel(p.ovr), truth + off * err);
  return { low: Math.max(Math.round(ovrToLevel(p.ovr)), Math.round(mid - err / 2)), high: Math.min(25, Math.round(mid + err / 2)), exact: false };
}


type DownloadsApi = { save: (r: { filename: string; data: string }) => Promise<unknown> };
type ClaudeHost = { use?: (name: string) => Promise<DownloadsApi | null> };

/**
 * Oferece um texto como arquivo (exportação de salvamentos e universos). Na versão hospedada como
 * Artifact usa a capacidade de downloads do visualizador; no navegador comum, um link de download.
 * Retorna uma mensagem para o usuário.
 */
export async function downloadText(name: string, text: string): Promise<{ ok: boolean; msg: string }> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    const dl = await host.use('downloads').catch(() => null);
    if (dl) {
      try {
        await dl.save({ filename: name, data: text });
        return { ok: true, msg: `Arquivo ${name} salvo.` };
      } catch (e) {
        const code = (e as { code?: string }).code;
        return { ok: false, msg: code === 'declined' ? 'Exportação cancelada.' : `Não foi possível salvar o arquivo (${code ?? 'erro'}).` };
      }
    }
  }
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { ok: true, msg: `Download de ${name} iniciado.` };
}

export function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'arquivo';
}
