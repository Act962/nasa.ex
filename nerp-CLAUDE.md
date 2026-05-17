# nerp — Contexto para Claude Code

> Este arquivo é o briefing permanente do projeto pra qualquer sessão de Claude Code aberta neste repo. Leia antes de qualquer alteração. Se já existir um `CLAUDE.md` neste repo, **anexe** a seção "Integração com NASA" abaixo ao final dele em vez de sobrescrever.

## Stack

| Camada          | Tecnologia                          |
| --------------- | ----------------------------------- |
| Framework       | Next.js 15 (App Router)             |
| Linguagem       | TypeScript                          |
| RPC             | oRPC — handler em `/api/rpc`        |
| Auth            | Better Auth                         |
| DB              | PostgreSQL + Prisma                 |
| Pagamentos      | Stripe + Asaas                      |
| Storage         | AWS S3                              |
| Package manager | pnpm                                |

## Estrutura

```
src/
├── app/
│   ├── api/rpc/[[...rest]]/route.ts   # handler oRPC (não tocar)
│   ├── middlewares/                    # base.ts, auth.ts, org.ts
│   └── router/                         # procedures oRPC por domínio
│       ├── catalog/
│       ├── category/
│       ├── checkout/
│       ├── customer/
│       ├── dashboard/
│       ├── org/
│       ├── products/
│       ├── sales/
│       └── stock/
└── features/<dominio>/                 # UI + lógica de cada domínio
```

Cada domínio em `src/app/router/<dominio>/` segue o padrão: um arquivo por procedure (`create.ts`, `list.ts`, etc.) + `index.ts` exportando o objeto.

---

# Integração com NASA (nasaex)

> Esta seção descreve o contrato S2S entre o NASA (plataforma de tracking de leads, outro repo) e o nerp. Branch base: `integration-with-nasaex`. NASA já está implementado e esperando estas 3 entregas aqui pra desbloquear sua Fase B.

## Visão geral

O NASA precisa chamar **todas** as procedures oRPC do nerp em nome da organização conectada, sem reaproveitar a sessão de Better Auth (server-to-server). Para isso, cada org NASA gera, via um fluxo de consentimento OAuth-like, um par `{ apiKey, secret }` que é armazenado do lado do NASA. Toda chamada vinda do NASA chega no nerp com:

```
X-Nerp-Api-Key:   <apiKey emitido por nerp pra aquela org NASA>
X-Nerp-Org-Id:    <id da org nerp à qual a key pertence>
X-Nerp-Timestamp: <Date.now() em ms, string>
X-Nerp-Signature: <HMAC-SHA256 hex da string canônica>
```

String canônica do HMAC (idêntica nos dois lados):

```
${METHOD.toUpperCase()}\n${path}\n${bodyJson}\n${timestamp}
```

Onde:
- `METHOD` é `GET|POST|PUT|PATCH|DELETE`
- `path` começa com `/` (ex: `/api/rpc/products/list`)
- `bodyJson` é o body JSON.stringify-ado, ou string vazia se sem body
- `timestamp` é o mesmo string mandado no header `X-Nerp-Timestamp`

Implementação canônica (do lado do NASA) — espelhe a verificação aqui:
```ts
import { createHmac } from "crypto";
const canonical = `${method.toUpperCase()}\n${path}\n${body}\n${timestamp}`;
const signature = createHmac("sha256", secret).update(canonical).digest("hex");
```

## As 3 entregas (bloqueiam a Fase B do NASA)

### 1. Página `/authorize/nasa-integration`

**Rota:** `src/app/(auth)/authorize/nasa-integration/page.tsx` (ou onde o roteamento de auth do nerp já viver).

**Query params recebidos:**
- `state` — opaco, NASA repassa de volta no callback. Não decodificar, só guardar.
- `redirect_uri` — URL pra qual redirecionar após consent.
- `scopes` — CSV (ex: `products:rw,sales:rw,...`).
- `client_id` — id do app NASA registrado no nerp.

**Comportamento:**
1. Se não logado: redirecionar para o fluxo de login/cadastro do nerp; preservar a URL atual nos query params pra retornar após login.
2. Se logado mas sem org ativa: pedir pro usuário escolher/criar org no nerp.
3. Mostrar tela de consent: "O NASA quer acessar a org `<orgName>` com os escopos `<scopes>`. Aprovar?"
4. Ao aprovar: gerar um `code` de uso único (TTL ~10 min) associado a `{ nerpOrgId, userId, scopes }` e persistir em tabela tipo `NasaIntegrationConsent`. Redirecionar `${redirect_uri}?code=<code>&state=<state>`.
5. Ao recusar: redirecionar `${redirect_uri}?error=user_denied&state=<state>`.

**Tabelas sugeridas (Prisma):**
```prisma
model NasaIntegrationConsent {
  id            String   @id @default(cuid())
  code          String   @unique
  nerpOrgId     String
  userId        String
  scopes        String[]
  redirectUri   String
  consumedAt    DateTime?
  expiresAt     DateTime
  createdAt     DateTime @default(now())

  @@index([code])
  @@index([expiresAt])
}

model NasaIntegrationKey {
  id              String    @id @default(cuid())
  organizationId  String
  apiKey          String    @unique         // indexável p/ lookup em cada request
  secretCiphertext String                   // AES-GCM(secret) — precisa decifrar p/ HMAC
  scopes          String[]
  consentByUserId String
  lastUsedAt      DateTime?
  revokedAt       DateTime?
  createdAt       DateTime  @default(now())

  @@index([organizationId])
  @@index([apiKey])
}
```

### 2. Endpoint `POST /api/integrations/nasa/exchange`

**Arquivo:** `src/app/api/integrations/nasa/exchange/route.ts`

**Body recebido:**
```json
{
  "code": "<code emitido pela página de consent>",
  "clientId": "<NERP_CLIENT_ID do NASA>",
  "clientSecret": "<NERP_CLIENT_SECRET do NASA>"
}
```

**Validação:**
1. `clientId`/`clientSecret` batem com os configurados no `.env` do nerp pro app NASA. Se não: 401.
2. `code` existe, não consumido, não expirado. Se não: 400 `invalid_code`.
3. Marcar code como consumido (`consumedAt = now()`).

**Response 200:**
```json
{
  "apiKey": "nerp_live_<random>",
  "secret": "<random 32+ bytes, base64url>",
  "nerpOrgId": "<orgId do consent>",
  "scopes": ["products:rw", "sales:rw", "..."],
  "expiresAt": null
}
```

**Importante:**
- O `secret` é retornado **uma única vez** no response. NÃO usar bcrypt/argon2 (one-way) porque o middleware precisa do plaintext pra reconstruir HMAC. Armazenar **encriptado** em `secretCiphertext` usando AES-256-GCM com chave `NASA_S2S_ENCRYPTION_KEY` (env var, gerar com `openssl rand -hex 32`).
- O `apiKey` armazenar em plaintext (precisa indexar pra lookup rápido).
- Gerar ambos com `randomBytes(32)` do `node:crypto`.

### 3. Middleware S2S no handler oRPC

**Arquivo:** `src/app/middlewares/nasa-s2s.ts` (novo) + ajuste no chain das procedures.

**Lógica:**
```ts
// Pseudo-código — adaptar ao padrão do `base.middleware` do nerp
import { createHmac, timingSafeEqual } from "crypto";

export const nasaS2SOrAuthMiddleware = base.middleware(async ({ context, next, errors }) => {
  const apiKey = context.headers.get("X-Nerp-Api-Key");

  // Sem header → segue fluxo normal (Better Auth cookie)
  if (!apiKey) return next();

  const orgIdHeader = context.headers.get("X-Nerp-Org-Id");
  const timestamp   = context.headers.get("X-Nerp-Timestamp");
  const signature   = context.headers.get("X-Nerp-Signature");

  if (!orgIdHeader || !timestamp || !signature) {
    throw errors.UNAUTHORIZED({ message: "Missing S2S headers" });
  }

  // Drift máximo: 5 minutos
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
    throw errors.UNAUTHORIZED({ message: "Timestamp drift" });
  }

  // Lookup da key
  const key = await prisma.nasaIntegrationKey.findUnique({
    where: { apiKey },
    select: {
      id: true,
      organizationId: true,
      secretCiphertext: true,
      revokedAt: true,
      scopes: true,
    },
  });
  if (!key || key.revokedAt) throw errors.UNAUTHORIZED({ message: "Invalid key" });
  if (key.organizationId !== orgIdHeader) throw errors.UNAUTHORIZED({ message: "Org mismatch" });

  // Decifrar secret → reconstruir canonical → validar HMAC
  const secret = decryptSecret(key.secretCiphertext);   // AES-GCM helper
  const rawBody = await context.request.clone().text(); // CLONE — não consumir o stream original
  const path = new URL(context.request.url).pathname;
  const method = context.request.method;
  const canonical = `${method.toUpperCase()}\n${path}\n${rawBody}\n${timestamp}`;
  const expected = createHmac("sha256", secret).update(canonical).digest("hex");

  // Tempo constante
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw errors.UNAUTHORIZED({ message: "Invalid signature" });
  }

  // Carregar org bypassando Better Auth — MESMO shape de context.org
  const organization = await prisma.organization.findUnique({
    where: { id: key.organizationId },
  });
  if (!organization) throw errors.FORBIDDEN({ message: "Org not found" });

  // Fire-and-forget: lastUsedAt
  prisma.nasaIntegrationKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return next({ context: { org: organization, isS2S: true, scopes: key.scopes } });
});
```

**Cuidado #1 — body do oRPC:** o handler oRPC do nerp lê o body do request. Se o middleware consumir o stream, o handler quebra. SEMPRE `request.clone().text()`.

**Cuidado #2 — replay attack:** com drift de 5min alguém capturando uma request válida pode replayar. Pra mitigar (v2), cachear `(apiKey, timestamp, signature)` em Redis com TTL 5min e rejeitar repetidos. Skip no v1.

**Cuidado #3 — onde aplicar o middleware:** se for um middleware oRPC custom, plugar no chain de cada domínio (substituindo `auth.ts` por `nasaS2SOrAuthMiddleware` que delega). Se preferir um único ponto, interceptar no `src/app/api/rpc/[[...rest]]/route.ts` antes do `RPCHandler.handleRequest`. Recomendado: chain por domínio, pra ficar explícito quais procedures aceitam S2S.

## Procedures que o NASA chama (precisam existir e funcionar via S2S)

NASA já mandou requests pra todas elas. As que **já existem** na branch `integration-with-nasaex` não precisam ser reescritas — só validar que respondem corretamente quando autenticadas via S2S.

| Domínio          | Procedures esperadas                                        |
| ---------------- | ----------------------------------------------------------- |
| `org`            | `get`, `update`                                             |
| `products`       | `list`, `get`, `create`, `update`, `duplicate`, `delete`    |
| `categories`     | `list`, `get`, `create`, `update`, `delete`                 |
| `catalogSettings`| `get`, `update`                                             |
| `stocks`         | `list`, `get`, `create`, `update`, `delete`                 |
| `customer`       | `list`, `get`, `create`, `update`, `delete`                 |
| `sales`          | `list`, `get`, `create`, `update`, `delete`                 |
| `checkout`       | `list`, `get`, `create`, `update`, `delete`                 |
| `dashboard`      | `get`                                                       |

**Shape dos retornos esperados** (NASA parseia com Zod):
- `list` → `{ items: T[], total?: number, page?: number, pageSize?: number }`
- `get` → `{ <entityKey>: T }` (ex: `{ product: ... }`, `{ org: ... }`)
- `create / update / duplicate` → `{ <entityKey>: T }`
- `delete` → `{ deleted: true }`

Se as procedures atuais retornam outro shape, **dois caminhos**:
1. Ajustar o retorno aqui pra bater (preferido — contrato limpo);
2. Avisar o time NASA pra ajustar os schemas Zod do lado dele (em `src/http/nerp/<dominio>/schemas.ts` no repo NASA).

## Setup local pra rodar lado-a-lado com NASA

NASA roda em `:3000` + Postgres em `:5432`. Pra evitar conflito:

**`docker-compose.yml` do nerp:**
```yaml
services:
  postgres:
    container_name: nerp-db
    ports:
      - "5433:5432"
    # ...
```

**`.env.local` do nerp:**
```
DATABASE_URL=postgresql://docker:docker@localhost:5433/nerp_db
NEXT_PUBLIC_APP_URL=http://localhost:3001
NASA_CLIENT_ID=<combinar com NASA — mesmo valor do NERP_CLIENT_ID no .env do NASA>
NASA_CLIENT_SECRET=<idem NERP_CLIENT_SECRET>
NASA_S2S_ENCRYPTION_KEY=<openssl rand -hex 32>
```

**Subir:**
```bash
docker compose up postgres -d
pnpm dev --port 3001            # ou PORT=3001 pnpm dev
```

## Verificação end-to-end

1. NASA local rodando em `:3000`, nerp local em `:3001`.
2. No NASA, configurar `.env.local`:
   ```
   NERP_BASE_URL=http://localhost:3001
   NERP_CLIENT_ID=<mesmo NASA_CLIENT_ID do nerp>
   NERP_CLIENT_SECRET=<mesmo NASA_CLIENT_SECRET do nerp>
   ```
3. No NASA, abrir `/settings/integrations`, clicar "Conectar com nerp".
4. Redireciona pra nerp `/authorize/nasa-integration?state=...&redirect_uri=...&scopes=...`.
5. Logar no nerp, escolher org, aprovar.
6. Volta pro NASA `/settings/integrations?nerp_connected=1`.
7. Card NASA mostra "Conectado", botão "Testar conexão" → request chega no nerp com headers S2S → middleware valida → procedure `org.get` responde → NASA mostra nome da org nerp.
8. Repetir pra um endpoint de cada domínio (list/get).

**Smoke test direto do lado nerp** (sem precisar do NASA):
```bash
API_KEY="nerp_live_..."
SECRET="..."
ORG_ID="..."
TS=$(date +%s%3N)
BODY='{}'
SIG=$(printf "POST\n/api/rpc/org/get\n%s\n%s" "$BODY" "$TS" \
  | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')

curl -X POST http://localhost:3001/api/rpc/org/get \
  -H "Content-Type: application/json" \
  -H "X-Nerp-Api-Key: $API_KEY" \
  -H "X-Nerp-Org-Id: $ORG_ID" \
  -H "X-Nerp-Timestamp: $TS" \
  -H "X-Nerp-Signature: $SIG" \
  -d "$BODY"
```

## Ordem de implementação sugerida

1. **DB + tabelas** — `NasaIntegrationConsent` + `NasaIntegrationKey` no schema, migration (`pnpm prisma migrate dev --name nasa_integration`).
2. **Encryption helper** — `src/lib/nasa-s2s-crypto.ts` (encrypt/decrypt do secret com `NASA_S2S_ENCRYPTION_KEY`, AES-256-GCM).
3. **Endpoint exchange** — `src/app/api/integrations/nasa/exchange/route.ts`. Testar com curl manual (gerar um `code` mock no DB primeiro).
4. **Página authorize** — `src/app/(auth)/authorize/nasa-integration/page.tsx`. Testar fluxo completo via browser.
5. **Middleware S2S** — `src/app/middlewares/nasa-s2s.ts`. Aplicar no chain das procedures. Testar com curl assinado.
6. **UI de gestão** (nice-to-have) — `/settings/integrations/nasa-keys` lista keys ativas + botão revogar.
7. **End-to-end com NASA** rodando local.

## O que NÃO mexer

- Não alterar o shape do `context.org` retornado por `org.ts` middleware — outros consumidores dependem.
- Não tocar nas procedures de domínio em si (criar/listar produtos etc.) a menos que precise ajustar o shape de retorno pra bater com o contrato acima.
- Não trocar bibliotecas (oRPC, Better Auth, Prisma) — o NASA depende exatamente do mesmo stack.

## Pontos abertos pra negociar com o time NASA

- **Rotação de keys**: NASA não implementou refresh. v1 são long-lived. Confirmar se nerp quer forçar rotação periódica (Inngest cron + e-mail pro owner da org).
- **Rate limit**: NASA quer headers `X-RateLimit-Remaining` + `Retry-After`. Nice-to-have v2.
- **Webhooks reversos** (nerp → NASA, ex: `sale.paid`): NASA tem casca pronta em `src/app/api/integrations/nerp/webhook/route.ts` mas não implementou consumer. Definir junto se vale a pena no MVP.
- **Multi-tenant nerp**: a tabela `NasaIntegrationKey` assume 1 org NASA = 1 key. Se uma mesma org nerp puder ter múltiplas conexões com diferentes orgs NASA, basta múltiplas linhas. Confirmar.

## Onde NASA implementou seu lado (pra referência)

Repo: outro projeto, branch `feature/W-integration-nerp-full-integration-20260517`. Arquivos chave:
- `src/http/nerp/client.ts` — função `nerpFetch` que gera os headers e assina.
- `src/http/nerp/sign.ts` — `signRequest` (igual à verificação aqui).
- `src/http/nerp/<dominio>/{schemas,index}.ts` — schemas Zod esperados + funções de chamada.
- `src/app/router/nerp/<dominio>/index.ts` — procedures oRPC do NASA que repassam ao nerp.
- `src/app/api/integrations/nerp/start/route.ts` — inicia OAuth-like, redireciona pra `/authorize/nasa-integration` daqui.
- `src/app/api/integrations/nerp/callback/route.ts` — recebe `code`, chama `/api/integrations/nasa/exchange`, persiste `apiKey`+`secret` em `PlatformIntegration.config` JSON.
- `src/features/nerp/lib/oauth.ts` — `exchangeNerpCode`, `buildNerpAuthorizeUrl`.

Se precisar ver o código exato do lado NASA, peça pro time os snippets — não tem PR público ainda.
