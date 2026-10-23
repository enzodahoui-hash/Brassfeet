// Testes de ponta a ponta no navegador (Chromium via playwright-core).
// Uso: npm run build && npm run e2e
// Sobe o "vite preview", joga uma carreira real pela interface e verifica os resultados.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4179;
const BASE = `http://localhost:${PORT}/?e2e`;
const SHOTS = new URL('./shots/', import.meta.url).pathname;
rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const results = [];
const errors = [];
let page;

function ok(cond, msg) {
  if (!cond) throw new Error(`Falhou: ${msg}`);
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, err: e.message });
    console.log(`  ✗ ${name}: ${e.message}`);
    await page?.screenshot({ path: `${SHOTS}falha-${results.length}.png`, fullPage: false }).catch(() => {});
  }
}

const game = (fn, arg) => page.evaluate(fn, arg);
const clickNav = (label) => page.locator('nav.nav button', { hasText: label }).first().click();

async function waitIdle(timeout = 120000) {
  await page.waitForFunction(() => !window.__fmbr.busy, null, { timeout });
}

let serverLog = '';
/** Sobe o servidor real do jogo (site + contas + salvamentos) com um banco temporário. */
async function startServer() {
  const dataDir = mkdtempSync(join(tmpdir(), 'fmbr-e2e-'));
  const proc = spawn(process.execPath, ['server/index.mjs'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, BASE_URL: `http://localhost:${PORT}`, SMTP_HOST: '' } });
  proc.stderr.on('data', (d) => (serverLog += String(d)));
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('servidor não subiu')), 30000);
    proc.stdout.on('data', (d) => {
      serverLog += String(d);
      if (serverLog.includes('no ar em')) {
        clearTimeout(to);
        res();
      }
    });
  });
  return proc;
}
const lastLink = (re) => [...serverLog.matchAll(re)].pop()?.[0];

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ executablePath: EXEC, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

  let clubName = '';
  console.log('Football Manager BR — testes E2E (servidor real: site + contas)');

  await step('Tela inicial carrega', async () => {
    await page.goto(BASE);
    await page.getByText('Nova carreira').first().waitFor();
    await page.screenshot({ path: `${SHOTS}01-inicio.png` });
  });

  await step('Criar conta por e-mail (cadastro) e ficar conectado', async () => {
    await page.getByRole('button', { name: 'Criar conta' }).first().click();
    await page.locator('#acc-name').fill('Técnica E2E');
    await page.locator('#acc-email').fill('tecnica@e2e.test');
    await page.locator('#acc-pw').fill('senhaE2E123');
    await page.locator('#acc-pw2').fill('senhaE2E123');
    await page.getByRole('button', { name: 'Criar conta', exact: true }).last().click();
    await page.getByText('Conectado como').waitFor();
    ok(serverLog.includes('confirme seu e-mail'), 'e-mail de confirmação enviado (modo de teste)');
    ok((await game(() => window.__fmbr.account?.email)) === 'tecnica@e2e.test', 'sessão ativa');
    await page.screenshot({ path: `${SHOTS}01b-conta.png` });
  });

  await step('Criar nova carreira pelo assistente', async () => {
    await page.locator('.menu-card', { hasText: 'Nova carreira' }).click();
    await page.getByRole('button', { name: /Universo padrão/ }).click();
    await page.getByText('Escolha seu clube').waitFor({ timeout: 60000 });
    await page.locator('.tbl tbody tr').first().click();
    await page.getByRole('button', { name: /Continuar com/ }).click();
    await page.getByPlaceholder('Ex.: Ana Ribeiro').fill('Técnica E2E');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('button', { name: /Iniciar carreira/ }).click();
    await page.locator('.top-club .name').waitFor({ timeout: 90000 });
    clubName = await page.locator('.top-club .name').innerText();
    ok(clubName.length > 2, 'nome do clube no cabeçalho');
    await page.getByRole('button', { name: 'Pular tutorial' }).click();
    const st = await game(() => ({ club: window.__fmbr.career.clubs[window.__fmbr.career.userClubId].name, mgr: window.__fmbr.career.manager.name }));
    ok(st.club === clubName && st.mgr === 'Técnica E2E', 'carreira criada com clube e treinador escolhidos');
    await page.screenshot({ path: `${SHOTS}02-visao-geral.png` });
  });

  await step('Avançar com clique duplo não pula eventos e abre o próximo jogo', async () => {
    const next = await game(() => {
      const c = window.__fmbr.career;
      const f = Object.values(c.fixtures).filter((x) => x.status === 'scheduled' && (x.home === c.userClubId || x.away === c.userClubId)).sort((a, b) => a.day - b.day)[0];
      return { id: f.id, day: f.day };
    });
    await page.locator('header.top button', { hasText: /Continuar|Jogar partida/ }).dblclick();
    await page.getByText('Resultado rápido').waitFor({ timeout: 180000 });
    await waitIdle();
    const st = await game(() => ({ day: window.__fmbr.career.day, pending: window.__fmbr.pendingMatch }));
    ok(st.day === next.day, `dia do jogo (${st.day} = ${next.day})`);
    ok(st.pending === next.id, 'partida pendente é a próxima do clube');
  });

  await step('Jogar partida em modo rápido', async () => {
    const id = await game(() => window.__fmbr.pendingMatch);
    await page.getByText('Resultado rápido').click();
    await page.waitForFunction((fid) => window.__fmbr.career.fixtures[fid].status === 'played', id);
    const r = await game((fid) => window.__fmbr.career.fixtures[fid].result, id);
    ok(r && r.hg >= 0 && r.ag >= 0 && r.stats, 'resultado com estatísticas');
    ok(await page.locator('.page').getByText(/Estatísticas|Relato|Escalações/).first().isVisible(), 'relatório da partida visível');
    await page.screenshot({ path: `${SHOTS}03-relatorio.png` });
  });

  await step('Jogar partida ao vivo e simular até o fim', async () => {
    await page.locator('header.top button', { hasText: /Continuar|Jogar partida/ }).click();
    await page.getByText('Ao vivo').first().waitFor({ timeout: 180000 });
    await waitIdle();
    const id = await game(() => window.__fmbr.pendingMatch);
    await page.locator('.choice', { hasText: 'Ao vivo' }).click();
    await page.getByRole('button', { name: 'Simular até o fim' }).waitFor();
    await page.getByText('Oportunidades').waitFor();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}04-ao-vivo.png` });
    await page.getByRole('button', { name: 'Simular até o fim' }).click();
    await page.getByRole('button', { name: 'Ver relatório da partida' }).click();
    await page.waitForFunction((fid) => window.__fmbr.career.fixtures[fid].status === 'played', id);
    const subs = await game((fid) => { const c = window.__fmbr.career; return c.fixtures[fid].result.subs.filter((x) => x.club === c.userClubId); }, id);
    ok(subs.length <= 5 && subs.every((x) => !x.auto || x.reason), `trocas do usuário com motivo (${subs.length})`);
  });

  let savedDay = 0;
  await step('Salvar, recarregar a página e continuar a carreira', async () => {
    await page.locator('nav.nav button', { hasText: 'Salvar agora' }).click();
    await page.getByText('Carreira salva.').waitFor();
    savedDay = await game(() => window.__fmbr.career.day);
    await page.reload();
    await page.locator('.menu-card', { hasText: 'Continuar' }).click();
    await page.locator('.top-club .name').waitFor({ timeout: 60000 });
    ok((await page.locator('.top-club .name').innerText()) === clubName, 'mesmo clube após recarregar');
    const d = await game(() => window.__fmbr.career.day);
    ok(d === savedDay, `mesmo dia após recarregar (${d} = ${savedDay})`);
  });

  await step('Sair, entrar de novo e encontrar a carreira salva na conta', async () => {
    await page.locator('nav.nav button', { hasText: 'Menu inicial' }).click();
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.getByText('Sem conta').waitFor();
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await page.locator('#acc-email').fill('tecnica@e2e.test');
    await page.locator('#acc-pw').fill('senhaE2E123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).last().click();
    await page.getByText('Conectado como').waitFor();
    await page.locator('.menu-card', { hasText: 'Continuar' }).click();
    await page.locator('.top-club .name').waitFor({ timeout: 60000 });
    ok((await page.locator('.top-club .name').innerText()) === clubName, 'carreira da conta carregada');
  });

  await step('Substituições automáticas: modo e regras em Táticas', async () => {
    await clickNav('Táticas');
    await page.getByRole('radio', { name: /Regras personalizadas/ }).click();
    await page.getByLabel('Adicionar regra de exemplo').selectOption({ label: 'Ponta titular sai aos 65 minutos' });
    await page.locator('.rule-row').first().waitFor();
    await page.locator('.rule-row').first().getByRole('button', { name: 'Duplicar' }).click();
    ok((await page.locator('.rule-row').count()) === 2, 'regra duplicada');
    await page.locator('.rule-row').nth(1).getByRole('button', { name: 'Excluir regra' }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    ok((await page.locator('.rule-row').count()) === 1, 'regra excluída');
    await page.getByRole('button', { name: 'Nova regra' }).click();
    await page.getByRole('button', { name: 'Salvar regra' }).click();
    const plan = await game(() => window.__fmbr.career.clubs[window.__fmbr.career.userClubId].subPlan);
    ok(plan.mode === 'rules' && plan.rules.length === 2, `plano salvo (${plan.mode}, ${plan.rules.length} regras)`);
    await page.getByRole('radio', { name: /Inteligente e misto/ }).click();
    await page.screenshot({ path: `${SHOTS}05b-substituicoes.png`, fullPage: true });
  });

  await step('Estatísticas do Elenco: filtros, recorte e comparação', async () => {
    await clickNav('Elenco profissional');
    await page.getByRole('tab', { name: 'Estatísticas do Elenco' }).click();
    await page.getByText('Recorte:').waitFor();
    await page.getByLabel('Período').selectOption('all');
    await page.locator('div.small', { hasText: 'Recorte:' }).filter({ hasText: 'Todas as temporadas da carreira' }).waitFor();
    await page.getByRole('tab', { name: 'Ataque' }).click();
    const boxes = page.locator('.tbl tbody input[type=checkbox]');
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await page.getByRole('button', { name: /Comparar selecionados/ }).click();
    await page.getByText('Comparação de jogadores').waitFor();
    await page.screenshot({ path: `${SHOTS}05c-comparacao.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Fechar' }).click().catch(() => {});
    // perfil: estatísticas por temporada/clube/competição e fonte do jogador real
    await page.locator('.tbl tbody tr').first().click();
    await page.getByText('Jogador real').waitFor();
    await page.getByRole('tab', { name: 'Por competição' }).click();
    await page.getByRole('tab', { name: 'Carreira' }).click();
    await page.screenshot({ path: `${SHOTS}05d-perfil.png` });
  });

  await step('Editor do Universo: editar jogador da carreira com confirmação', async () => {
    const pid = await game(() => { const c = window.__fmbr.career; return c.clubs[c.userClubId].playerIds[0]; });
    const name = await game((id) => window.__fmbr.career.players[id].lastName, pid);
    await clickNav('Editor do Universo');
    await page.getByPlaceholder('Buscar jogador').fill(name);
    await page.locator('.tbl tbody tr').first().waitFor();
    const rows = page.locator('.tbl tbody tr');
    const n = await rows.count();
    let clicked = false;
    for (let i = 0; i < n && !clicked; i++) {
      const txt = await rows.nth(i).innerText();
      if (txt.includes(await game((id) => window.__fmbr.career.players[id].name, pid))) {
        await rows.nth(i).click();
        clicked = true;
      }
    }
    ok(clicked, 'jogador encontrado na busca do editor');
    await page.getByLabel('Nome de exibição do jogador').fill('Jogador Editado E2E');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await page.getByRole('button', { name: 'Sim, editar' }).click();
    await page.waitForFunction((id) => window.__fmbr.career.players[id].name === 'Jogador Editado E2E', pid);
    await clickNav('Elenco profissional');
    await page.getByText('Jogador Editado E2E').first().waitFor();
    await page.screenshot({ path: `${SHOTS}05-elenco-editado.png` });
  });

  await step('Criador de Craques: criar e inserir jogador nível 25 no elenco', async () => {
    await clickNav('Criador de Craques');
    await page.locator('.choice', { hasText: 'Craque mundial' }).click();
    await page.getByLabel('Nome', { exact: true }).fill('Zeca');
    await page.getByLabel('Sobrenome').fill('Foguete');
    await page.getByRole('tab', { name: 'Nível e atributos' }).click();
    await page.getByLabel('Nível', { exact: true }).fill('25');
    await page.getByLabel('Potencial', { exact: true }).fill('25');
    await page.screenshot({ path: `${SHOTS}06-criador.png` });
    await page.getByRole('button', { name: 'Inserir no universo' }).click();
    await page.getByRole('button', { name: 'Inserir', exact: true }).click();
    await page.locator('h1', { hasText: 'Zeca Foguete' }).waitFor();
    const p = await game(() => { const c = window.__fmbr.career; const p = Object.values(c.players).find((x) => x.name === 'Zeca Foguete'); return p && { club: p.clubId, origin: p.origin, ovr: p.ovr, inSquad: c.clubs[c.userClubId].playerIds.includes(p.id) }; });
    ok(p && p.origin === 'creator' && p.inSquad, 'craque inserido no elenco do usuário');
    ok(p.ovr >= 94, `nível máximo preservado (nota ${p.ovr})`);
  });

  await step('Comissão técnica, infraestrutura, estádio e uniformes abrem e funcionam', async () => {
    for (const [nav, text] of [['Comissão técnica', 'Áreas e capacidade'], ['Infraestrutura', 'Centro de treinamento'], ['Estádio', 'Obras disponíveis'], ['Uniformes', 'Lançamento'], ['Finanças', 'Receitas'], ['Base', 'Base'], ['Mercado', 'Mercado'], ['Táticas', 'Formação']]) {
      await clickNav(nav);
      await page.locator('.page').getByText(text).first().waitFor({ timeout: 15000 });
    }
    // contratação real de um profissional livre
    await clickNav('Comissão técnica');
    await page.getByRole('tab', { name: 'Profissionais livres' }).click();
    const before = await game(() => window.__fmbr.career.clubs[window.__fmbr.career.userClubId].staffIds.length);
    const btn = page.getByRole('button', { name: 'Contratar' }).and(page.locator(':not([disabled])')).first();
    await btn.click();
    const after = await game(() => window.__fmbr.career.clubs[window.__fmbr.career.userClubId].staffIds.length);
    ok(after === before + 1, 'profissional contratado');
  });

  await step('Temporada completa: competições, estrelas de artilharia e Bola de Ouro', async () => {
    const t0 = await game(() => window.__fmbr.career.season);
    // joga cada partida do usuário em modo rápido, como um jogador faria clicando em "Resultado rápido"
    await page.evaluate(async (season) => {
      const s = window.__fmbr;
      let guard = 0;
      while (s.career.season === season && guard++ < 400) {
        if (s.career.firedPending) break;
        if (s.pendingMatch) s.playQuick();
        else await s.advance('next');
        if (s.seasonSummary) break;
      }
    }, t0);
    await waitIdle(600000);
    await page.screenshot({ path: `${SHOTS}07-fim-temporada.png` });
    const sum = await game(() => !!window.__fmbr.seasonSummary);
    if (sum) await page.getByRole('button', { name: /Seguir para/ }).click();
    const st = await game(() => {
      const c = window.__fmbr.career;
      const golds = Object.values(c.players).filter((p) => p.achievements.some((a) => a.kind === 'gold_star'));
      const reds = Object.values(c.players).filter((p) => p.achievements.some((a) => a.kind === 'red_star'));
      return { golds: golds.length, reds: reds.length, gold: golds[0]?.id, red: reds[0]?.id, ballon: Object.keys(c.awards).filter((k) => k.startsWith('ballon|')), hist: c.seasonHistory.length };
    });
    ok(st.hist >= 1, 'resumo da temporada registrado');
    ok(st.golds >= 10, `estrelas douradas atribuídas (${st.golds})`);
    ok(st.reds >= 2, `estrelas vermelhas atribuídas (${st.reds})`);
    ok(st.ballon.length === 1, 'uma edição da Bola de Ouro');
    // estrela dourada visível no perfil, com tooltip
    await game((id) => window.__fmbr.go({ name: 'player', id }), st.gold);
    const star = page.locator('h1 .stars [data-tip], .pname .stars [data-tip], .stars [data-tip]').first();
    await star.waitFor();
    const tip = await star.getAttribute('data-tip');
    ok(/Artilheiro/i.test(tip ?? ''), `tooltip da estrela: ${tip}`);
    await star.hover();
    await page.screenshot({ path: `${SHOTS}08-estrela.png` });
    await game((id) => window.__fmbr.go({ name: 'player', id }), st.red);
    const redTip = await page.locator('.stars [data-tip]').first().getAttribute('data-tip');
    ok(/Artilheiro/i.test(redTip ?? ''), `tooltip da estrela vermelha: ${redTip}`);
    // cerimônia da Bola de Ouro
    await clickNav('Prêmios');
    await page.locator('.tbl tbody tr', { hasText: 'Bola de Ouro' }).first().click();
    await page.locator('.ceremony .award-name').waitFor();
    await page.screenshot({ path: `${SHOTS}09-bola-de-ouro.png` });
  });

  await step('Nova temporada: classificados para as continentais e calendário sem conflito', async () => {
    const st = await game(() => {
      const c = window.__fmbr.career;
      const cur = Object.values(c.competitions).filter((x) => x.season === c.season);
      const by = (tid) => cur.find((x) => x.templateId === tid);
      const days = {};
      let clash = 0;
      for (const f of Object.values(c.fixtures)) {
        if (f.status === 'void' || c.competitions[f.compId]?.season !== c.season) continue;
        for (const id of [f.home, f.away]) {
          const k = `${id}|${f.day}`;
          if (days[k]) clash++;
          days[k] = 1;
        }
      }
      const ids = Object.keys(c.config.competitions).filter((k) => c.config.competitions[k].kind === 'continental');
      return { season: c.season, cont: ids.map((k) => ({ k, n: by(k)?.participants.length ?? 0 })), clash };
    });
    ok(st.cont.every((x) => x.n >= 16), `continentais com participantes: ${JSON.stringify(st.cont)}`);
    ok(st.clash === 0, `nenhum clube joga duas vezes no mesmo dia (${st.clash})`);
    await clickNav('Competições');
    await page.getByRole('tab', { name: 'Sul-americanas' }).click();
    await page.locator('.page').getByText('Copa das Américas').first().waitFor();
    await page.getByRole('tab', { name: 'Europeias' }).click();
    await page.locator('.page').getByText('Champions Euro').first().click();
    await page.locator('.page .tbl').first().waitFor();
    await page.screenshot({ path: `${SHOTS}10-competicoes.png` });
  });

  let exported = '';
  await step('Exportar e importar a carreira como arquivo', async () => {
    await clickNav('Salvamentos');
    await page.locator('.tbl tbody tr').first().waitFor();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar' }).first().click()]);
    exported = `${SHOTS}carreira.json`;
    await dl.saveAs(exported);
    const data = JSON.parse(readFileSync(exported, 'utf8'));
    ok(data.userClubId && data.schemaVersion >= 4, 'arquivo de carreira válido');
    const before = await game(() => window.__fmbr.saves.length);
    await page.locator('input[type=file]').setInputFiles(exported);
    await page.getByText(/importada/).waitFor();
    const after = await game(() => window.__fmbr.saves.length);
    ok(after === before + 1, 'carreira importada como novo salvamento');
  });

  await step('Arquivo inválido é recusado com mensagem clara', async () => {
    await page.locator('input[type=file]').setInputFiles({ name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') });
    await page.getByText(/Arquivo inválido|inválido/).first().waitFor();
  });

  await step('Editor independente: universo personalizado salvo e usado numa nova carreira', async () => {
    await page.locator('nav.nav button', { hasText: 'Menu inicial' }).click();
    await page.locator('.menu-card', { hasText: 'Editor do Universo' }).click();
    await page.getByRole('button', { name: /Novo universo a partir do padrão/ }).click();
    await page.getByRole('tab', { name: 'Clubes' }).click();
    await page.locator('.tbl tbody tr').first().click();
    const nameInput = page.locator('.field', { hasText: 'Nome' }).locator('input').first();
    await nameInput.fill('Clube Inventado E2E');
    await page.getByRole('button', { name: 'Salvar clube' }).click();
    await page.getByText('Clube Inventado E2E atualizado.').waitFor();
    await page.getByRole('tab', { name: 'Universos' }).click();
    await page.getByLabel('Nome do universo').fill('Universo E2E');
    await page.getByRole('button', { name: /Salvar universo/ }).click();
    await page.getByText('Universo "Universo E2E" salvo.').waitFor();
    await page.getByRole('button', { name: /Menu inicial/ }).click();
    await page.locator('.menu-card', { hasText: 'Nova carreira' }).click();
    await page.getByRole('button', { name: /Universo E2E/ }).click();
    await page.getByText('Escolha seu clube').waitFor({ timeout: 60000 });
    await page.getByText('Clube Inventado E2E').first().waitFor();
    // o universo padrão continua intacto
    const intact = await game(() => !Object.values(window.__fmbr.defaultWorld().clubs).some((c) => c.name === 'Clube Inventado E2E'));
    ok(intact, 'universo padrão não foi alterado');
  });

  await step('Esqueci a senha: link por e-mail e nova senha', async () => {
    await page.goto(BASE);
    if (await page.getByRole('button', { name: 'Sair' }).count()) await page.getByRole('button', { name: 'Sair' }).click();
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await page.getByRole('button', { name: 'Esqueci a senha' }).click();
    await page.locator('#acc-email').fill('tecnica@e2e.test');
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await page.getByText('Se o e-mail estiver cadastrado').waitFor();
    await page.waitForTimeout(500);
    const link = lastLink(/http:\/\/localhost:\d+\/\?redefinir=[\w-]+/g);
    ok(!!link, 'link de redefinição gerado');
    await page.goto(link.replace('/?', '/?e2e&'));
    await page.locator('#acc-pw').fill('outraSenha456');
    await page.locator('#acc-pw2').fill('outraSenha456');
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await page.getByText('Conectado como').waitFor();
  });

  await step('Layout em tela de celular sem rolagem horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE);
    await page.locator('.menu-card', { hasText: 'Continuar' }).click();
    await page.locator('.top-club .name').waitFor({ timeout: 60000 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(over <= 1, `largura excedente ${over}px`);
    await page.screenshot({ path: `${SHOTS}11-celular.png` });
  });

  await browser.close();
  server.kill();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} cenários aprovados.`);
  if (errors.length) {
    console.log(`Erros de console/página (${errors.length}):`);
    for (const e of errors.slice(0, 20)) console.log(`  - ${e}`);
  }
  process.exit(failed.length || errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
