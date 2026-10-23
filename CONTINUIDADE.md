# Documento de continuidade

Estado real do projeto para retomar o trabalho em outra sessão.

## Estado atual

- Motor, interface, dados reais, substituições automáticas, estatísticas do elenco, contas e servidor concluídos.
- Testes: 101 unitários, de simulação e do servidor; 20 cenários E2E. Todos passando.
- `SCHEMA_VERSION = 5`. Migrações em `src/engine/save/migrations.ts`:
  - o passo 4→5 refaz as chaves das estatísticas por clube, cria `statArchive`, `subPlan` e o regulamento de trocas;
  - qualquer mudança no formato de `Career` ou `World` precisa de um passo novo e de uma versão maior.

## Arquitetura

- **`src/engine/`**: regras do jogo em TypeScript puro, determinístico a partir de sementes.
  - `data/real/*.json`: clubes, elencos, fotos e treinadores reais, gerados por `scripts/real/build.mjs`.
  - `universe/world.ts` (`populateSquad`, `realPlayer`):
    - transforma as linhas reais em jogadores;
    - jogadores de 20 anos ou menos que excedem o elenco vão para a base;
    - o elenco principal tem no máximo 34 jogadores;
    - jogadores gerados entram só onde falta gente.
  - `players/stats.ts`: estatísticas.
    - Durante a temporada, ficam em `p.stats` com a chave `temporada|competição|clube`.
    - No fim da temporada, `archiveSeason` move tudo para `p.statArchive`, de forma idempotente.
    - `statRows` junta as duas fontes, e todas as telas leem dele.
  - `match/subs.ts` + `match/engine.ts`: substituições automáticas.
    - Janelas são contadas por `tick`, e o intervalo não conta.
    - `gameMinute()` trata os acréscimos do 1º tempo como minuto 45.
    - Com `confirm` ligado (relato detalhado), as sugestões ficam pendentes até o jogador aceitar ou recusar.
  - `save/remote.ts`: `remoteKV`, a mesma interface KV do IndexedDB, mas falando com `/api/kv`. O `SaveManager` não sabe a diferença.
- **`src/ui/`**: React 18.
  - Estado em `ui/store.ts`: `account`, `server`, `initAccount`, `useAccount` e `uploadLocalSaves`.
  - Telas novas: `Account.tsx`, `SubsPanel.tsx` e `StatsViews.tsx`.
- **`server/`**: `index.mjs` (HTTP puro + `node:sqlite`) e `mail.mjs` (nodemailer, ou log em modo de teste). Documentação em `server/README.md`.
- **Testes**: `tests/` usa Vitest; `e2e/run.mjs` sobe o servidor com uma pasta de dados temporária e lê os links de e-mail do log.

## Pontos sensíveis

- **Caches em tempo de execução**:
  - índice de partidas;
  - avaliação por posição: chame `invalidateRatings()` ao alterar atributos;
  - tabela de público.
- **Atributos fracionários**: a evolução acumula frações de propósito. Mostre sempre com `Math.round`.
- **Poda**: as partidas da IA de temporadas anteriores são apagadas no início de cada temporada. Por isso o arquivamento das estatísticas acontece antes da poda.
- **Idempotência**: lançamentos financeiros, prêmios, estrelas, histórico de campeões, `archiveSeason` e `closeSpell` (transferências).
- **Servidor**:
  - toda rota que altera dados exige `X-Requested-With: fmbr`;
  - a CSP libera imagens só de `upload.wikimedia.org`;
  - `node:sqlite` é carregado com `createRequire` para funcionar dentro do Vitest.
- **Dados reais**:
  - os caches de coleta (`scripts/real/wiki/`, `scripts/real/*.json`) não são versionados;
  - para atualizar os elencos, rode os scripts de coleta (sem pressa: a Wikipedia limita a taxa de acesso) e depois `node scripts/real/build.mjs`.

## Próximos passos sugeridos

1. Colocar o projeto num repositório Git (o contêiner desta sessão é temporário).
2. Dividir o pacote JS: carregar os dados reais e o Editor sob demanda.
3. Mover a simulação da IA para um Web Worker.
4. Escolher o nome definitivo (sugestão: **Mandante**). Trocar em `config.gameName` (`data/competitions.ts`), `index.html`, `scripts/single-file.mjs`, `server/index.mjs` (`appName`) e no logotipo (`ui/screens/Start.tsx`).
5. Atualização periódica dos elencos a cada janela de transferências.
