import { store, useCareer, useGame } from '../store';
import { Panel, PageHead, ClubName, Form, Money, Bar, Lvl, PName } from '../components/common';
import { Icon } from '../components/Icon';
import { Crest } from '../components/graphics';
import { NewsList } from './Inbox';
import { compKey, leagueTable, roundName } from '../../engine/competitions/manager';
import { clubFixtures, nextClubFixture } from '../../engine/career/index';
import { fmtLong, fmtShort, ymd } from '../../engine/core/date';
import { objectiveStatus } from '../../engine/board/board';
import { wageBill } from '../../engine/universe/world';
import { pendingDecisions } from '../../engine/career/decisions';
import { promotionForecast, youthOfClub } from '../../engine/youth/academy';
import { currentCollection } from '../../engine/kits/commerce';
import { ballonDay } from '../../engine/awards/awards';
import { windowOpen, nextWindowText } from '../../engine/market/transfers';
import { ovrToLevel } from '../../engine/players/attributes';
import { averageAttendance } from '../../engine/stadium/stadium';

export function Home() {
  useGame();
  const c = useCareer();
  const club = c.clubs[c.userClubId];
  const next = nextClubFixture(c, club.id, c.day);
  const league = c.competitions[compKey(club.divisionId, c.season)];
  const table = league ? leagueTable(c, league) : [];
  const myPos = table.findIndex((r) => r.clubId === club.id);
  const from = Math.max(0, Math.min(myPos - 4, table.length - 9));
  const recent = clubFixtures(c, club.id).filter((f) => f.status === 'played').slice(-5).reverse();
  const decisions = pendingDecisions(c);
  const offers = c.offers.filter((o) => o.status === 'pending');
  const building = club.projects.filter((p) => p.status === 'building');
  const youth = youthOfClub(c, club).map((p) => ({ p, f: promotionForecast(c, p) })).filter((x) => x.f.startsWith('Pronto') || x.f.startsWith('Em até')).slice(0, 4);
  const kit = currentCollection(c);
  const bill = wageBill(c, club);
  const lastAward = Object.values(c.awards).filter((a) => a.awardId === 'ballon').sort((a, b) => b.edition - a.edition)[0];
  const { y } = ymd(c.day);
  const nextBallon = ballonDay(c, c.day > ballonDay(c, y) ? y + 1 : y);

  return (
    <div className="page">
      <PageHead title="Visão geral" sub={`${fmtLong(c.day)} · Temporada ${c.season} · ${windowOpen(c) ? 'Janela de transferências aberta' : nextWindowText(c)}`} />
      <div className="grid g-main">
        <div className="stack">
          {next ? (
            <Panel title="Próxima partida" right={<button className="btn sm" onClick={() => store.go({ name: 'tactics' })}><Icon name="tactics" />Escalação</button>}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row"><Crest crest={c.clubs[next.home].crest} size={44} /><div><div className="strong">{c.clubs[next.home].name}</div><div className="small muted">mandante</div></div></div>
                <div className="center"><div style={{ font: '700 22px var(--f-display)' }}>{fmtShort(next.day)}</div><div className="small muted">{c.competitions[next.compId]?.name}</div><div className="tiny muted">{roundName(c, next)}</div></div>
                <div className="row" style={{ flexDirection: 'row-reverse' }}><Crest crest={c.clubs[next.away].crest} size={44} /><div className="right"><div className="strong">{c.clubs[next.away].name}</div><div className="small muted">visitante</div></div></div>
              </div>
            </Panel>
          ) : (
            <Panel title="Próxima partida"><div className="muted">Sem jogos marcados até o fim da temporada.</div></Panel>
          )}
          {(decisions.length > 0 || offers.length > 0 || c.intakeCandidates.length > 0) && (
            <Panel title="Pendências">
              <div className="stack" style={{ gap: 6 }}>
                {decisions.slice(0, 4).map((d) => <button key={d.id} className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={() => store.go({ name: 'inbox' })}><Icon name="warn" />{d.title}</button>)}
                {offers.length > 0 && <button className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={() => store.go({ name: 'market', tab: 'offers' })}><Icon name="transfer" />{offers.length} proposta(s) por jogadores do seu elenco</button>}
                {c.intakeCandidates.length > 0 && <button className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={() => store.go({ name: 'youth', tab: 'intake' })}><Icon name="youth" />{c.intakeCandidates.length} candidato(s) da peneira aguardando avaliação</button>}
              </div>
            </Panel>
          )}
          <div className="grid g2">
            <Panel title={league?.name ?? 'Liga'} right={league && <button className="btn sm" onClick={() => store.go({ name: 'comp', id: league.id })}>Tabela completa</button>} flush>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th className="n">#</th><th>Clube</th><th className="n">J</th><th className="n">SG</th><th className="n">P</th></tr></thead>
                  <tbody>
                    {table.slice(from, from + 9).map((r, i) => (
                      <tr key={r.clubId} className={r.clubId === club.id ? 'me' : ''}>
                        <td className="n">{from + i + 1}</td><td><ClubName id={r.clubId} /></td><td className="n">{r.p}</td><td className="n">{r.gf - r.ga}</td><td className="n strong">{r.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Últimos resultados" flush>
              <div className="tbl-wrap">
                <table className="tbl">
                  <tbody>
                    {recent.map((f) => {
                      const r = f.result!;
                      const ug = f.home === club.id ? r.hg : r.ag, og = f.home === club.id ? r.ag : r.hg;
                      const res = ug > og ? 'V' : ug < og ? 'D' : 'E';
                      return (
                        <tr key={f.id} className="click" onClick={() => store.go({ name: 'match', id: f.id })}>
                          <td><Form f={[res]} /></td>
                          <td className="small">{fmtShort(f.day)}</td>
                          <td><ClubName id={f.home === club.id ? f.away : f.home} short /></td>
                          <td className="n strong">{r.hg}–{r.ag}{r.pens ? ` (${r.pens[0]}–${r.pens[1]})` : ''}</td>
                          <td className="small muted">{f.home === club.id ? 'casa' : 'fora'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!recent.length && <div className="empty">A temporada ainda não começou para o seu time.</div>}
              </div>
            </Panel>
          </div>
          <Panel title="Notícias" right={<button className="btn sm" onClick={() => store.go({ name: 'inbox' })}>Ver todas</button>} flush>
            <NewsList items={c.news.filter((n) => n.important || n.clubIds.includes(club.id)).slice(0, 8)} />
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Diretoria" right={<span className="small muted">Presidente {club.board.president}</span>}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="small muted">Confiança no treinador</span><strong>{Math.round(club.board.confidence)}%</strong></div>
            <Bar v={club.board.confidence} color={club.board.confidence < 30 ? 'var(--loss)' : club.board.confidence < 55 ? 'var(--draw)' : 'var(--win)'} />
            <div className="stack" style={{ gap: 6, marginTop: 10 }}>
              {club.board.objectives.map((o) => {
                const st = objectiveStatus(c, club, o);
                return (
                  <div key={o.id} className="row tight" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <span className={`chip ${st === 'ok' ? 'good' : st === 'fail' ? 'bad' : ''}`}>{st === 'ok' ? 'cumprido' : st === 'fail' ? 'falhou' : 'em aberto'}</span>
                    <span className="small">{o.label}{o.importance === 3 && <span className="muted"> · prioridade</span>}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel title="Finanças" right={<button className="btn sm" onClick={() => store.go({ name: 'finance' })}>Detalhes</button>}>
            <div className="grid g2 small">
              <div><div className="muted">Saldo</div><div className="strong"><Money v={club.balance} color /></div></div>
              <div><div className="muted">Orçamento de transferências</div><div className="strong"><Money v={club.transferBudget} /></div></div>
              <div><div className="muted">Folha anual</div><div className="strong"><Money v={bill} /></div></div>
              <div><div className="muted">Limite de folha</div><div className="strong" style={{ color: bill > club.wageBudget ? 'var(--loss)' : undefined }}><Money v={club.wageBudget} /></div></div>
              <div><div className="muted">Público médio</div><div className="strong">{averageAttendance(club).toLocaleString('pt-BR')}</div></div>
              <div><div className="muted">Parcelas mensais</div><div className="strong"><Money v={club.installments.reduce((s, i) => s + i.amountPerMonth, 0)} /></div></div>
            </div>
            {club.embargo && <div className="chip bad" style={{ marginTop: 8 }}>Contratações bloqueadas pelo saldo negativo</div>}
          </Panel>
          {building.length > 0 && (
            <Panel title="Obras em andamento">
              <div className="stack" style={{ gap: 8 }}>
                {building.map((p) => {
                  const prog = Math.min(100, ((c.day - p.start) / Math.max(1, p.end - p.start)) * 100);
                  return <div key={p.id}><div className="row small" style={{ justifyContent: 'space-between' }}><span>{p.label}</span><span className="muted">até {fmtShort(p.end)}</span></div><Bar v={prog} /></div>;
                })}
              </div>
            </Panel>
          )}
          <Panel title="Base: perto do profissional" right={<button className="btn sm" onClick={() => store.go({ name: 'youth' })}>Base</button>}>
            {youth.length ? youth.map(({ p, f }) => <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}><PName p={p} /><span className="row tight"><Lvl v={ovrToLevel(p.ovr)} size="sm" /><span className="small muted">{f}</span></span></div>) : <div className="small muted">Nenhum jovem pronto ainda.</div>}
          </Panel>
          <Panel title="Uniformes" right={<button className="btn sm" onClick={() => store.go({ name: 'kits' })}>Abrir</button>}>
            {kit.launched ? (
              <div className="grid g2 small">
                <div><div className="muted">Vendidas</div><div className="strong">{kit.sold.toLocaleString('pt-BR')}</div></div>
                <div><div className="muted">Estoque</div><div className="strong">{kit.stock.toLocaleString('pt-BR')}</div></div>
                <div><div className="muted">Receita bruta</div><div className="strong"><Money v={kit.revenue} /></div></div>
                <div><div className="muted">Aceitação</div><div className="strong">{kit.acceptance}%</div></div>
              </div>
            ) : <div className="small muted">A coleção {c.season} ainda não foi lançada. Crie o uniforme e defina preço e produção.</div>}
          </Panel>
          <Panel title="Prêmios">
            <div className="small">Próxima cerimônia da <strong>{c.config.awards.ballonName}</strong>: {fmtLong(nextBallon)}.</div>
            {lastAward && <div className="small" style={{ marginTop: 6 }}>Última edição: <strong>{lastAward.winnerName}</strong> ({lastAward.winnerClubName})</div>}
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => store.go({ name: 'awards' })}><Icon name="award" />Corrida pelos prêmios</button>
          </Panel>
        </div>
      </div>
    </div>
  );
}
