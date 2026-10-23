# Servidor do jogo (site + contas + salvamentos na nuvem)

O servidor entrega o jogo compilado (`dist/`) e uma API de contas por e-mail. É um único processo
Node.js, sem dependências externas além do `nodemailer` (envio de e-mail). O banco é SQLite
(`node:sqlite`, embutido no Node 22.13+), gravado em `DATA_DIR/fmbr.sqlite`.

## Onde a lógica vive (dois backends, um núcleo)

Toda a regra de contas e salvamentos fica em **`server/core.mjs`**, independente de armazenamento. Ela fala
com um "store" abstrato, e há duas implementações:

- **`server/index.mjs`** (este servidor Node) usa `sqliteStore` — guarda tudo num arquivo SQLite. É o caminho
  para Render, Railway, Fly.io, uma VPS ou Docker.
- **`netlify/functions/api.mts`** usa `blobsStore` (`server/blobs-store.mjs`) — guarda tudo em **Netlify Blobs**.
  É o caminho para rodar **inteiro na Netlify**, sem servidor sempre ligado e sem banco pago. O `netlify.toml`
  já aponta `/api/*` para essa função.

Como o núcleo é o mesmo, os dois caminhos têm exatamente o mesmo comportamento. Os testes comprovam:
`tests/server.test.ts` exercita o núcleo pelo servidor Node + SQLite, e `tests/blobs-store.test.ts` exercita
o mesmo núcleo pelo caminho dos Blobs (com um Blobs falso em memória).

Na Netlify, as variáveis de ambiente abaixo (as que fazem sentido) são definidas nas configurações do site,
com escopo **Functions**; o endereço público vem de `URL`, que a Netlify define sozinha. O limite de corpo de
uma função é ~6 MB, então lá o `MAX_SAVE_MB` vale no máximo ~5.

## Rodar

```bash
npm install
npm run build        # compila o jogo em dist/
npm start            # sobe em http://localhost:8080
```

Sem SMTP configurado, os e-mails (confirmação e redefinição de senha) aparecem no log do servidor:
útil para testar. Em produção, configure o SMTP.

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `8080` | Porta HTTP |
| `BASE_URL` | `http://localhost:8080` | Endereço público (usado nos links dos e-mails; `https://` ativa cookie seguro) |
| `DATA_DIR` | `./data` | Pasta do banco SQLite (use um volume persistente) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | — | Servidor de e-mail |
| `MAIL_FROM` | `Football Manager BR <no-reply@domínio>` | Remetente |
| `REQUIRE_EMAIL_VERIFICATION` | `0` | `1` exige confirmar o e-mail antes de entrar |
| `QUOTA_MB` | `300` | Espaço por conta |
| `MAX_SAVE_MB` | `40` | Tamanho máximo de um salvamento |
| `SESSION_DAYS` | `30` | Duração da sessão |
| `TRUST_PROXY` | `0` | `1` atrás de proxy/CDN (usa `X-Forwarded-For` no limite de tentativas) |

## Segurança

- Senhas com scrypt e sal aleatório; comparação em tempo constante.
- Sessão em cookie `HttpOnly`, `SameSite=Lax` (e `Secure` em HTTPS); no banco fica só o hash do token.
- Rotas que alteram dados exigem o cabeçalho `X-Requested-With: fmbr` (proteção contra CSRF).
- Limite de tentativas de login, de cadastros e de e-mails por rede.
- "Esqueci a senha" não revela se o e-mail existe; links de uso único com validade (1 h para senha, 48 h para confirmação).
- Cabeçalhos de segurança e CSP restritiva no site.
- Excluir a conta apaga sessões, tokens e todos os salvamentos dela.

## Hospedagem

Qualquer serviço que rode Node 22 com disco persistente funciona (Render, Railway, Fly.io, uma VPS
com Docker). Use HTTPS (o próprio serviço ou um proxy como Caddy/Nginx). Exemplo com Docker:

```bash
docker compose up -d --build
```

Hospedagens só de arquivos estáticos (sem servidor) também rodam o jogo, mas sem contas: o
progresso fica salvo no navegador de cada jogador.

Faça backup periódico de `DATA_DIR/fmbr.sqlite` (por exemplo, `sqlite3 fmbr.sqlite ".backup copia.sqlite"`).
