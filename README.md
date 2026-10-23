# Football Manager BR (nome provisório)

Jogo de gestão de futebol para o navegador, com site próprio e contas por e-mail. Você assume um clube real num universo de 15 países (10 sul-americanos e 5 europeus), com 25 divisões, 472 clubes e cerca de 12,9 mil jogadores reais dos elencos de 2026. A carreira começa na temporada 2027 com esses elencos.

Sugestão de nome definitivo: **Mandante**. "Football Manager" é marca registrada da SEGA/Sports Interactive.

## Dados reais: de onde vêm e o que é estimado

| Dado | Fonte | Observação |
|---|---|---|
| Clubes e divisões 2026 | Wikipedia (páginas das ligas) + Wikidata | Nomes reais; **escudos e uniformes são desenhos do próprio jogo**, sem logotipos oficiais |
| Elencos | Seção "elenco atual" da Wikipedia de cada clube (consulta de outubro de 2026) | 451 clubes com elenco público; 21 clubes sem dados públicos foram completados com jogadores gerados (marcados como tal no perfil) |
| Nome, nacionalidade, nascimento, posição, número, altura, pé | Wikipedia / Wikidata | Cada jogador real guarda o identificador Wikidata (`Q…`) |
| Fotos | Wikimedia Commons (3.965 jogadores) | Só imagens com licença livre (CC BY, CC BY-SA, CC0, domínio público). O perfil mostra autor e licença com link para a página da foto. Sem foto, aparece o desenho |
| Treinadores | Wikidata / Wikipedia | 458 clubes |
| Nível 0–25, atributos, potencial, valor e salário | **Estimativas do jogo** | Calibradas pela força do clube e da liga e pela notoriedade do jogador. Não vêm de nenhuma base oficial |

Os dados são gerados pelos scripts em `scripts/real/` (`divisions.mjs` define as listas de clubes e `build.mjs` gera os JSON em `src/engine/data/real/`). O jogo não consulta nenhuma API durante a partida: tudo vai embutido no pacote. As fotos carregam de `upload.wikimedia.org`.

## Como rodar

Requisitos: **Node 22.13+** (o servidor usa o SQLite embutido do Node).

```bash
npm install
npm run dev          # desenvolvimento em http://localhost:5173 (repassa /api para a porta 8080)
npm run build        # checagem de tipos + build de produção em dist/
npm start            # site completo (jogo + contas) em http://localhost:8080
npm test             # testes unitários, de simulação e do servidor (Vitest)
npm run e2e          # ponta a ponta no Chromium: sobe o servidor real (precisa do build antes)
npm run build:single # dist-single/football-manager-br.html (arquivo único, sem contas)
```

Para usar contas durante o desenvolvimento, rode `npm start` num terminal e `npm run dev` em outro.

O E2E usa `playwright-core` com o Chromium em `/opt/pw-browsers/chromium`. Em outra máquina, aponte `CHROMIUM_PATH` para um Chrome ou Chromium instalado.

## Publicar o site

Há dois jeitos, e **os dois rodam o jogo completo com contas e salvamento na nuvem**. O detalhamento está em [`server/README.md`](server/README.md).

### 1. Netlify (tudo dentro da Netlify, sem servidor próprio)

Conecte o repositório na Netlify (**Add new site → Import from GitHub**). O `netlify.toml` já define tudo:
- o jogo é o site estático em `dist/`;
- as rotas `/api/*` são atendidas por uma **Netlify Function** (`netlify/functions/api.mts`), que guarda contas, sessões e salvamentos em **Netlify Blobs** — sem servidor sempre ligado e sem banco de dados pago.

E-mail é opcional: sem SMTP, o jogo funciona (a confirmação de e-mail não é obrigatória) e os links aparecem no log da função. Para enviar de verdade, defina nas configurações do site (escopo **Functions**) as variáveis `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` e `MAIL_FROM`. Outras variáveis opcionais: `REQUIRE_EMAIL_VERIFICATION`, `QUOTA_MB`, `MAX_SAVE_MB`, `SESSION_DAYS`, `APP_NAME` (o endereço público vem de `URL`, que a Netlify define sozinha).

### 2. Servidor Node próprio (Render, Railway, Fly.io, VPS, Docker)

```bash
npm ci && npm run build
BASE_URL=https://seu-dominio.com DATA_DIR=/var/lib/fmbr \
SMTP_HOST=smtp.exemplo.com SMTP_USER=... SMTP_PASS=... MAIL_FROM="Mandante <no-reply@seu-dominio.com>" \
npm start
```

Também dá para usar Docker: `docker compose up -d --build`. Use um disco persistente para `DATA_DIR` (o banco SQLite) e HTTPS na frente.

> A mesma lógica de contas e salvamentos vive em `server/core.mjs` e é usada pelos dois caminhos: o servidor Node guarda em SQLite; a função da Netlify guarda em Blobs. Uma hospedagem só de arquivos estáticos também roda o jogo, mas sem contas (o progresso fica no navegador).

## Jogar no celular

O jogo foi ajustado para telas de toque (testado num iPhone simulado de 390 px):

- **Barra inferior** com Início, Elenco, Táticas e Mais (menu completo). O botão grande do meio é **Continuar / Jogar**, ao alcance do polegar.
- **Menu lateral** abre por "Mais" ou pelo ☰ e fecha tocando fora dele.
- **Partida ao vivo**:
  - o placar e os controles ficam fixos no topo;
  - o resto se divide em abas: Lances, Estatísticas, Tática, Trocas e Em campo;
  - em gol, o placar pisca e o celular vibra;
  - a tela não apaga enquanto a partida corre.
- **Toque**:
  - botões e campos com pelo menos ~40 px;
  - campos com letra de 16 px, para o iPhone não dar zoom;
  - janelas abrem como painéis que sobem da base da tela;
  - avisos aparecem no topo e fecham com um toque.
- **Instalar como aplicativo** (PWA):
  - no site com servidor, o navegador oferece "Instalar aplicativo" (Android/Chrome/Edge). No iPhone, use Compartilhar → "Adicionar à Tela de Início";
  - o jogo abre em tela cheia, com ícone próprio;
  - depois da primeira visita, abre mesmo sem internet. Sem conta, o progresso fica no aparelho.

## Contas e salvamentos

- **Contas**:
  - criar conta, entrar e sair;
  - confirmação de e-mail e "esqueci a senha" por link (uso único, com validade);
  - trocar a senha encerra as outras sessões;
  - excluir a conta apaga a conta e todos os salvamentos dela.
- **Com conta**, as carreiras e os universos ficam no servidor, com cópia de segurança automática e cota por conta. Ao entrar, os salvamentos do navegador podem ser enviados para a conta (em Salvamentos).
- **Sem conta**, tudo fica no IndexedDB do navegador, como antes. A exportação e a importação de `.json` funcionam nos dois casos.

## Como jogar

1. **Nova carreira**: escolha o universo, o país, a divisão e o clube. Depois informe seu nome, a dificuldade e o modo financeiro.
2. **Continuar** (ou a tecla espaço) avança até o próximo evento. O clique duplo é bloqueado.
3. Na partida, há três modos: **resultado rápido**, **ao vivo** (minuto a minuto, com substituições e táticas) e **relato detalhado**.
4. O menu lateral organiza o jogo:
   - **Clube**: elenco, base, táticas, partidas e competições;
   - **Gestão**: mercado, finanças, infraestrutura, estádio, uniformes e comissão técnica;
   - **Universo**: prêmios, histórico, Criador de Craques, Editor do Universo e salvamentos.

## Substituições automáticas

Configure em **Táticas → Substituições automáticas**.

- **Modos**:
  - **Manual**: o jogo nunca troca sozinho, mas avisa sobre cansaço, lesão e cartão;
  - **Por regras**: só as regras que você criar;
  - **Por condição física**: troca abaixo do limite de cansaço (padrão 65%) e em caso de lesão;
  - **Inteligente e misto**: regras, cansaço, lesão, risco de segundo amarelo e contexto do placar (proteger vantagem, buscar gol).
- **Regras**: por jogador ou por posição, com minuto inicial e final, placar (vencendo, empatando, perdendo, qualquer), limite de cansaço, papel desejado do substituto (mesmo papel, mais ofensivo, mais defensivo, mais físico) e prioridade. O jogo avisa sobre regras conflitantes ou impossíveis.
- **Regulamento** por competição: 5 trocas em 3 janelas, sem contar o intervalo, e mais 1 troca e 1 janela na prorrogação. Trocas feitas no mesmo minuto contam como uma janela. O motor nunca passa do limite.
- **Ao vivo**: painel de trocas restantes e janelas, condição física de cada jogador e sugestões. No relato detalhado, cada sugestão pede confirmação (aceitar ou recusar). Cada troca automática aparece no relato com o motivo. A IA dos adversários usa o mesmo sistema e o mesmo regulamento.

## Estatísticas do elenco

Ficam em **Elenco → Estatísticas do Elenco** e na aba **Estatísticas** do perfil de cada jogador.

- **Coletadas a cada partida**:
  - jogos, titular ou reserva, minutos e gols;
  - assistências, finalizações e chutes no alvo, xG estimado, chances criadas;
  - passes e acerto, desarmes, interceptações, cortes, bloqueios, faltas cometidas e sofridas, impedimentos, erros que geraram gol;
  - pênaltis (convertidos, perdidos, defendidos), cartões e notas;
  - para goleiros: defesas, gols sofridos e jogos sem sofrer gol.
- **Filtros**: temporada, competição, posição, mínimo de minutos e recorte (totais, por jogo ou por 90 min). A tabela pode ser ordenada por qualquer coluna, e há destaques: artilheiro, garçom, melhor nota, mais minutos.
- **Histórico**: os números são guardados por temporada, competição e clube. Transferências não misturam os clubes, e o fim de temporada arquiva tudo sem duplicar.
- **Comparação**: até 3 jogadores lado a lado (temporada, carreira e atributos).

## Editor do Universo e Criador de Craques

O editor tem duas formas de acesso:
- **pelo menu inicial**, num universo separado;
- **dentro de uma carreira**, com confirmação antes da primeira alteração.

Abas: Jogadores, Clubes (com construtor de escudo), Competições, Prêmios e regras, Ferramentas, Universos e Criador de Craques.

## Testes

- **`npm test`**: 106 testes em 9 arquivos.
  - `tests/subs-stats.test.ts` cobre os 13 testes exigidos de substituições e estatísticas;
  - `tests/server.test.ts` cobre contas, e-mails, sessões, CSRF, limite de tentativas, cota e uma carreira real salva e carregada pela conta (servidor Node + SQLite);
  - `tests/blobs-store.test.ts` cobre a mesma lógica no caminho da Netlify (núcleo + Netlify Blobs em memória): contas, confirmação e redefinição por link, isolamento entre contas, cópia de segurança, cota e exclusão de conta;
  - os demais cobrem motor de partidas, competições, gestão, editor e persistência, incluindo duas temporadas completas simuladas.
- **`npm run e2e`**: 20 cenários jogados pela interface real no Chromium, contra o servidor real, um deles num celular com tela de toque. Incluem:
  - criar conta, sair, entrar e encontrar a carreira salva;
  - esqueci a senha, com o link capturado do e-mail;
  - regras de substituição em Táticas;
  - estatísticas do elenco e comparação;
  - temporada completa;
  - celular: barra inferior, menu, partida ao vivo com abas, alvos de toque e PWA.

  As capturas ficam em `e2e/shots/`.

## Limitações conhecidas

- Os elencos refletem a Wikipedia em outubro de 2026. Nas divisões inferiores, a composição das ligas é aproximada.
- Nível, atributos, potencial e valores são estimativas do jogo, não números oficiais.
- Simular uma temporada inteira leva cerca de 25 a 30 s de processamento no navegador. O avanço é incremental.
- O pacote JavaScript tem ~2,7 MB (~800 KB comprimido), a maior parte com os dados dos elencos.
- Na versão de arquivo único publicada no claude.ai:
  - não há contas;
  - as fotos externas podem ser bloqueadas, e nesse caso aparece o desenho do jogador.
- A partida ao vivo é textual. Não há visualização 2D do campo.
