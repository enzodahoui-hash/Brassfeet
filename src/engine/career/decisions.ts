import type { Career, Decision } from '../types';
import { clamp } from '../core/rng';
import { promote } from '../youth/academy';
import { post } from '../finance/ledger';
import { moveToClub } from '../market/roster';
import { addNews } from '../news/news';
import { clubStaff, staffCapacity } from '../infra/infra';
import { roundMoney } from '../players/value';

/** Aplica a decisão escolhida com consequências reais. */
export function resolveDecision(c: Career, id: string, optionId: string): string {
  const d = c.inbox.find((x) => x.id === id);
  if (!d || d.resolved) return 'Decisão já tomada.';
  const p = d.playerId ? c.players[d.playerId] : undefined;
  const club = c.clubs[c.userClubId];
  let msg = 'Decisão registrada.';
  switch (d.kind) {
    case 'coachPromote':
    case 'askChance':
      if (!p) break;
      if (optionId === 'promote') {
        const err = promote(c, p, 'rotation');
        msg = err ?? `${p.name} promovido ao profissional.`;
      } else if (optionId === 'promise') {
        p.morale = clamp(p.morale + 2, 0, 100);
        msg = 'Promessa feita: o jogador aguarda uma chance.';
      } else if (optionId === 'no') {
        p.morale = clamp(p.morale - 12, 0, 100);
        msg = `${p.name} ficou decepcionado.`;
      } else p.morale = clamp(p.morale - 3, 0, 100);
      break;
    case 'poach': {
      if (!p) break;
      const buyer = d.clubId ? c.clubs[d.clubId] : null;
      const fee = Number(d.data?.fee ?? 0);
      if (optionId === 'sell' && buyer) {
        post(c, club, { key: `sale|${d.id}`, day: c.day, amount: fee, cat: 'venda de jogadores', desc: `Venda de ${p.name} (base) para ${buyer.short}` });
        moveToClub(c, p, buyer, 'youth');
        msg = `${p.name} vendido por ${fee.toLocaleString('pt-BR')}.`;
        addNews(c, { kind: 'transfer', icon: 'transfer', title: `${p.name} deixa a base rumo ao ${buyer.name}`, body: `Negócio de ${fee.toLocaleString('pt-BR')}.`, clubIds: [club.id, buyer.id], playerIds: [p.id] });
      } else if (optionId === 'renew' && p.contract) {
        p.contract.wage = roundMoney(p.contract.wage * 1.6);
        p.contract.endYear = Math.max(p.contract.endYear, c.season + 3);
        p.morale = clamp(p.morale + 8, 0, 100);
        msg = 'Contrato melhorado: o jovem fica.';
      } else {
        p.morale = clamp(p.morale - 8, 0, 100);
        msg = 'Proposta recusada; o jogador ficou chateado.';
      }
      break;
    }
    case 'youthContract':
      if (!p?.contract) break;
      if (optionId === 'accept') {
        p.contract.wage = roundMoney(p.contract.wage * 1.4);
        p.contract.endYear = c.season + 2;
        p.morale = clamp(p.morale + 6, 0, 100);
        msg = 'Contrato renovado com aumento.';
      } else {
        p.morale = clamp(p.morale - 10, 0, 100);
        msg = 'Condições mantidas; o jovem pode sair ao fim do vínculo.';
      }
      break;
    case 'noMinutes':
      if (!p) break;
      if (optionId === 'talk') p.morale = clamp(p.morale + 5, 0, 100);
      else if (optionId === 'loanlist') {
        p.loanListed = true;
        msg = `${p.name} disponível para empréstimo (aba Mercado).`;
      } else p.morale = clamp(p.morale - 5, 0, 100);
      break;
    case 'staffOffer': {
      const sid = String(d.data?.staffId ?? '');
      const s = c.staff[sid];
      if (optionId === 'hire' && s && !s.clubId) {
        if (clubStaff(c, club, s.role).length >= staffCapacity(club, s.role)) msg = 'Sem vaga na comissão para essa função. Libere ou amplie a estrutura.';
        else {
          s.clubId = club.id;
          club.staffIds.push(s.id);
          msg = `${s.name} agora faz parte da comissão técnica.`;
        }
      }
      break;
    }
    case 'wageRequest':
      if (!p?.contract) break;
      if (optionId === 'accept') {
        p.contract.wage = roundMoney(p.contract.wage * 1.15);
        p.morale = clamp(p.morale + 8, 0, 100);
        p.happiness = undefined;
        msg = 'Aumento concedido.';
      } else {
        p.morale = clamp(p.morale - 10, 0, 100);
        p.happiness = 'Pede aumento salarial';
      }
      break;
    case 'transferRequest':
      if (!p) break;
      if (optionId === 'list') {
        p.listed = true;
        msg = `${p.name} colocado na lista de transferências.`;
      } else if (optionId === 'persuade') {
        p.morale = clamp(p.morale + 4, 0, 100);
        msg = 'Você convenceu o jogador a ficar por enquanto.';
      } else {
        p.morale = clamp(p.morale - 12, 0, 100);
        msg = 'Pedido negado; o clima ficou pesado.';
      }
      break;
    default:
      break;
  }
  d.resolved = optionId;
  return msg;
}

/** Decisões vencidas são resolvidas pela opção mais conservadora (a última). */
export function expireDecisions(c: Career): void {
  for (const d of c.inbox) {
    if (d.resolved || !d.expires || d.expires >= c.day) continue;
    resolveDecision(c, d.id, d.options[d.options.length - 1].id);
    d.resolved = `${d.options[d.options.length - 1].id} (automático)`;
  }
}

export function pendingDecisions(c: Career): Decision[] {
  return c.inbox.filter((d) => !d.resolved);
}
