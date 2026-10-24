# Auditoria — Brassfeet / "Mandante"

> Levantamento de (1) melhorias de experiência do jogador e de jogo, (2) funções
> que faltam programar e (3) pendências na tela do usuário. Feito com apoio das
> skills `ui-ux-pro-max`, `frontend-design`, `web-design-guidelines`,
> `vercel-react-best-practices` e `security-review`, e do grafo de conhecimento
> (`graphify-out/`). Data: 2026-10-24.

## 1. Resumo executivo

- **O jogo está completo em termos de funções.** Varredura por `TODO`/`FIXME`/`WIP`/
  stubs/"não implementado"/"em breve" em `src/`, `server/` e `scripts/`: **zero
  ocorrências de código inacabado.** Os `placeholder` encontrados são atributos
  legítimos de `<input>`, e os `throw new Error(...)` são validações reais.
- **Não há pendências "fantasma" na tela.** Nenhum "em breve"/"coming soon". Todos
  os botões desabilitados têm motivo de estado legítimo (campo vazio, nada
  selecionado, jogador já emprestado, sem salvamento recente).
- **O diag temporário foi removido.** O commit `c4194a8` (que expunha a mensagem de
  erro no 500 da função) não existe mais no código atual — bom do ponto de vista
  de segurança.
- O que resta é **polimento**: acessibilidade de teclado/toque, performance de
  re-render e a lista de otimizações já anotada em `CONTINUIDADE.md`.

## 2. Funções que faltam programar

**Resultado: nenhuma função pendente de implementação no código.** O motor, a
interface, os dados reais, as substituições automáticas, as estatísticas, as
contas e o servidor estão concluídos (confere com o `CONTINUIDADE.md`).

Os únicos itens "em aberto" são os **próximos passos sugeridos** (otimização e
manutenção, não funcionalidades faltando) do `CONTINUIDADE.md`:

| # | Item | Natureza | Impacto |
|---|------|----------|---------|
| 1 | Dividir o bundle JS: carregar dados reais e o Editor sob demanda | Performance | Carregamento inicial mais rápido |
| 2 | Mover a simulação da IA para um Web Worker | Performance | UI não trava ao avançar dias |
| 3 | Escolher o nome definitivo (sugestão: **Mandante**) | Produto | Identidade/marca |
| 4 | Atualização periódica dos elencos a cada janela de transferências | Dados | Manter elencos atuais |

## 3. Pendências na tela do usuário

Nada travado por falta de código. As "pendências" visíveis são todas de **estado de
jogo** (o fluxo normal), sinalizadas por *badges*:

- **Inbox** → nº de decisões pendentes (`pendingDecisions`).
- **Mercado** → nº de ofertas com status `pending`.
- **Base** → nº de candidatos da peneira (`intakeCandidates`).

Botões desabilitados verificados (todos corretos, por estado):
- `Start.tsx` — "Continuar" desabilitado sem salvamento recente.
- `Editor.tsx` / `Saves.tsx` — "Salvar/Renomear" desabilitado com nome vazio.
- `Live.tsx` — "Confirmar troca" desabilitado sem jogador de saída/entrada.
- `Player.tsx` — "Pedir emprestado" desabilitado se já há empréstimo.

## 4. Melhorias de experiência do jogador

### 4.1 Acessibilidade — prioridade ALTA (barato, alto impacto)

O app já acerta muito no mobile (bottom-nav, `env(safe-area-inset-*)`, inputs a
16px para evitar zoom no iOS, alvos de toque 40–46px, `prefers-reduced-motion`,
`:focus-visible`). Os furos são de **teclado e toque**:

| ID | Onde | Problema | Correção sugerida |
|----|------|----------|-------------------|
| A11Y-1 | `components/common.tsx` `Modal` | Sem foco inicial, sem *focus trap*, e **Esc não fecha** (só clique no overlay/botão). | Focar o modal ao abrir, prender o Tab dentro dele e fechar no `Escape`. |
| A11Y-2 | `common.tsx` `Table` | Ordenação no `<th onClick>` — **não acessível por teclado** e sem `aria-sort`. | Cabeçalho como `<button>` dentro do `<th>` + `aria-sort`. |
| A11Y-3 | `common.tsx` `PName`/`ClubName` | Nomes clicáveis são `<span class="link">` — **não focáveis nem ativáveis por teclado**. | Trocar por `<button>` (ou `role="link"` + `tabIndex` + handler de Enter/Espaço). |
| A11Y-4 | tooltips `data-tip` | Só aparecem em `:hover`/`:focus-visible` → **invisíveis em toque**; vários sem texto acessível (ex.: ícone de lesão em `PName`). | Garantir `aria-label`/texto equivalente; considerar toque/clique para revelar. |
| A11Y-5 | `common.tsx` `Tabs` | Tem `role="tablist"/"tab"`, mas **sem navegação por setas** e os painéis não têm `role="tabpanel"`/`aria-controls`. | Adicionar navegação por seta e amarrar painéis. |

### 4.2 Performance de interface — prioridade MÉDIA

- **PERF-1 (re-render global):** `store.ts` usa `useSyncExternalStore` com uma
  **versão global única**; todo `bump()` re-renderiza **toda** a árvore que chama
  `useGame()`. Durante a **partida ao vivo**, cada *tick* re-renderiza a tela
  inteira. Sugestão (alinhada ao `vercel-react-best-practices`): subscrição por
  **seletor** (ex.: `useStore(sel)` com comparação), para cada componente
  re-renderizar só quando o seu fatia de estado muda.
- **PERF-2 (bundle):** os dados reais (`squads.json` ~1,2 MB, `photos.json` ~0,6 MB)
  e o Editor vão embutidos no pacote inicial. Carregar sob demanda
  (`React.lazy`/import dinâmico) encurta o *time-to-interactive* — é o item 1 do
  `CONTINUIDADE.md`.
- **PERF-3 (travamento ao avançar):** a IA roda no *main thread*; avançar muitos
  dias pode congelar a UI. Web Worker (item 2 do `CONTINUIDADE.md`) resolve e
  permite barra de progresso responsiva.

### 4.3 Visual / produto — prioridade BAIXA (polish)

- Tema **somente escuro** (`color-scheme: dark`). É uma escolha válida para o clima
  do jogo; um tema claro opcional seria um extra, não uma falha.
- Nome definitivo pendente (item 3): afeta `config.gameName`, `index.html`,
  `scripts/single-file.mjs`, `server/index.mjs` e o logo em `Start.tsx`.

## 5. Segurança (passagem leve)

Pontos **bons** já presentes (de `CONTINUIDADE.md` e do código do servidor):
- toda rota que altera dados exige o cabeçalho `X-Requested-With: fmbr`;
- CSP libera imagens só de `upload.wikimedia.org`;
- senha guardada com *hash*; salvamento em pedaços (limite de 6 MB da função);
- o diag que vazava mensagem de erro no 500 **já foi removido**.

Recomendação: rodar a skill **`/security-review`** completa em `server/` +
`netlify/functions/` para uma análise sistemática (autenticação de sessão,
validação de entrada no `/api/kv`, cota/limites, CSRF via `X-Requested-With`).

## 6. Plano sugerido (ordem de valor)

1. **Acessibilidade A11Y-1..A11Y-5** — pequeno, melhora a experiência de todos.
2. **PERF-1 (seletores no store)** — tira os re-renders globais, suaviza a partida.
3. **PERF-2 (lazy load de dados/Editor)** — carregamento inicial mais rápido.
4. **PERF-3 (Web Worker da IA)** — avançar temporadas sem travar.
5. **`/security-review` completo** no servidor.
6. **Nome definitivo** + atualização de elencos (manutenção).
