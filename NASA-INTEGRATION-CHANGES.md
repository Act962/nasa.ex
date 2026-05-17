# Integração NASA ↔ nerp — Mudanças necessárias no lado NASA

> Documento direcionado ao time NASA. Lista o que precisa ser ajustado no repo NASA pra integração funcionar com o nerp que acabou de ser implementado na branch `feat/nasa-s2s-integration`.

## TL;DR

Implementamos no nerp as 3 entregas combinadas (página de consent, exchange endpoint, middleware HMAC), mas com **duas divergências** do que estava escrito no briefing original. Vocês precisam ajustar o lado NASA pra acomodar:

1. **Shape de retorno das procedures é diferente** do contrato definido (`{ items }` não é usado em lugar nenhum).
2. **Algumas procedures listadas ainda não existem** no nerp — precisamos saber quais vocês realmente chamam.

Detalhes abaixo.

---

## 1. Shape de retorno — **AÇÃO OBRIGATÓRIA**

O briefing definia:

```ts
list   → { items: T[], total?, page?, pageSize? }
get    → { <entityKey>: T }
create → { <entityKey>: T }
update → { <entityKey>: T }
delete → { deleted: true }
```

**Decisão tomada:** o nerp NÃO vai migrar para `{ items }`. Nenhuma procedure no nerp segue esse formato hoje, e o custo de refatorar todas as procedures (mais o risco de regressão na UI) é maior que o ajuste no schemas Zod do lado de vocês.

### O que vocês precisam ajustar em `src/http/nerp/<dominio>/schemas.ts`

Os shapes reais que o nerp retorna hoje:

| Procedure | Shape real do nerp |
|---|---|
| `products.list` | `{ products: Product[], page, pageSize, totalCount, totalPages, hasNextPage, hasPreviousPage }` |
| `products.get` | `{ product: Product, stockMovements: StockMovement[] }` |
| `products.create` / `update` / `duplicate` | `{ product: Product }` (confirmar) |
| `products.delete` | confirmar |
| `categories.list` | `{ categories: CategoryWithProductsCount[] }` |
| `categories.create` / `update` / `delete` | confirmar |
| `customer.list` | `{ customers: CustomerWithSales[] }` |
| `customer.get` / `create` / `update` / `delete` | confirmar via código |
| `stocks.list` | `{ movements: StockMovement[] }` |
| `catalogSettings.list` (não tem `get` ainda) | `{ catalogSettings: CatalogSettings }` (confirmar) |
| `sales.list` | confirmar |
| `org.get` | `{ organization: Organization }` |

**Importante:** os nomes das chaves são **plural pra list, singular pra get** — bate com o que costuma ser convenção do oRPC. Mas não bate com `{ items }`.

### Paginação

O nerp já paginou em `products.list` com `{ page, pageSize, totalCount, totalPages, hasNextPage, hasPreviousPage }`. Vocês podem usar exatamente esses campos ou mapear pra `{ total, page, pageSize }` no client-side se preferirem. Não há `cursor` nem `nextCursor`.

---

## 2. Caminhos corretos das procedures — **VERIFICAR**

O `src/app/router/index.ts` do nerp exporta com estes nomes (alguns plurais inconsistentes, herdados do código):

```
/api/rpc/products/*       (plural)
/api/rpc/categories/*     (plural — mas o diretório se chama "category"; não use "/category/")
/api/rpc/catalogSettings/* (camelCase — não "/catalog/" nem "/catalog-settings/")
/api/rpc/stocks/*         (plural — não "/stock/")
/api/rpc/customer/*       (singular — não "/customers/")
/api/rpc/sales/*
/api/rpc/checkout/*
/api/rpc/dashboard/*
/api/rpc/org/*            (singular)
```

**Use exatamente esses paths.** Caminho errado retorna 404 do oRPC mesmo com HMAC válido.

---

## 3. Procedures que ainda não existem — **PRECISO DE INPUT DE VOCÊS**

Quais dessas vocês *de fato* chamam hoje no NASA? As marcadas como **FALTA** ainda não foram criadas no nerp:

| Domínio | Procedure | Status |
|---|---|---|
| `org` | `get` | ✅ existe |
| `org` | `update` | ❌ **FALTA** (só existe `update-subdomain` e `check-subdomain`) |
| `products` | `list`, `get`, `create`, `update`, `duplicate`, `delete` | ✅ todas existem |
| `categories` | `list` | ✅ existe |
| `categories` | `get` | ❌ **FALTA** |
| `categories` | `create`, `update`, `delete` | ✅ existem |
| `catalogSettings` | `update` | ✅ existe |
| `catalogSettings` | `get` | ❌ **FALTA** (existe `list` e `public` — confirmar se serve) |
| `stocks` | `list` | ✅ existe |
| `stocks` | `get`, `create`, `update`, `delete` | ❌ **TODOS FALTAM** (só existem `register-entry`, `register-output`, `register-purchase` — semântica diferente) |
| `customer` | `list`, `get`, `create`, `update`, `delete` | ✅ todas existem |
| `sales` | `list`, `get`, `create` | ✅ existem |
| `sales` | `update`, `delete` | ❌ **FALTAM** |
| `checkout` | `list`, `get`, `create`, `update`, `delete` | ❌ **TODAS FALTAM** (existe só `purchase` e `purchase-assas` — semântica de "fazer pedido" e não CRUD) |
| `dashboard` | `get` | confirmar (existe `dashboard.ts` mas precisa validar o nome exportado) |

**Próximo passo:** olhe seu `src/http/nerp/<dominio>/index.ts` e me mande a lista exata das `nerpFetch(...)` chamadas que vocês fazem. Aí eu crio só o subset realmente necessário pra MVP.

Em particular, sobre `checkout`: o nerp tem `checkout.purchase` que executa uma venda. CRUD genérico de "checkout" não faz sentido aqui — vocês querem listar pedidos? Acho que isso é `sales.list`. Confirmar.

---

## 4. Credenciais e env vars — **TROCAR**

Geramos no `.env` do nerp valores **de desenvolvimento local**. Em produção, vocês precisam combinar valores próprios com a gente. Pra dev local, copie estes valores no `.env.local` do NASA:

```bash
# .env.local do NASA (lado de vocês)
NERP_BASE_URL=http://localhost:3001
NERP_CLIENT_ID=7b3840d7708ac05d0434a0f65aed1f8f81c883b21c46c3a6
NERP_CLIENT_SECRET=TBP9nYNLvoFxSWE9tXmVy6bn6LBatwL3h6SzsuT/6xfeC+7V
```

Esses valores precisam **bater exatamente** com o que está no `.env` do nerp local. Se mudar de um lado, mudar do outro.

Em produção: gerar novos via `openssl rand -hex 24` (id) e `openssl rand -base64 36` (secret), e armazenar nos dois lados.

---

## 5. Setup local — **ATENÇÃO À PORTA DO POSTGRES**

O nerp agora roda Postgres em `:5433` (era 5432, conflitava com o de vocês). Se vocês já tinham nerp local rodando em `:5432`, vai precisar:

```bash
# No nerp:
docker compose down              # se já tinha container em 5432
docker compose up -d             # sobe agora em 5433
# DATABASE_URL no .env local já foi atualizado pra postgresql://docker:docker@localhost:5433/erp-limas
pnpm dev --port 3001
```

NASA segue em `:3000` + Postgres em `:5432` (sem mudanças).

---

## 6. Contrato HMAC — **SEM MUDANÇAS, MAS RECONFIRMAR**

Mantivemos exatamente como combinado:

**Headers que NASA envia:**
```
X-Nerp-Api-Key:   <apiKey emitido por nerp>
X-Nerp-Org-Id:    <id da org nerp>
X-Nerp-Timestamp: <Date.now() em ms, string>
X-Nerp-Signature: <HMAC-SHA256 hex da string canônica>
```

**String canônica (idêntica nos dois lados):**
```
${METHOD.toUpperCase()}\n${path}\n${bodyJson}\n${timestamp}
```

- `path` começa com `/` e é apenas o pathname (sem query, sem hash)
- `bodyJson` é o body JSON.stringify-ado; **string vazia** se request sem body (GET, por exemplo)
- `timestamp` é o mesmo string mandado no header

**Drift máximo:** 5 minutos.

**Headers que o nerp lê (case-insensitive — `Headers.get` normaliza pra lowercase):** se vocês mandam `X-Nerp-Api-Key` ou `x-nerp-api-key`, tanto faz.

### Verificação manual com curl

Pra testar isolado sem o lado NASA, use este script no nerp:

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

**Resposta esperada (200):** `{"result": {"data": {"org": { "id": "...", "name": "...", ...}}}}` (formato oRPC).

**Erros que vocês podem receber:**
- 401 `{"error":"missing_s2s_headers"}` — falta algum header obrigatório
- 401 `{"error":"timestamp_drift"}` — timestamp fora da janela de 5min
- 401 `{"error":"invalid_key"}` — apiKey não existe ou foi revogada
- 401 `{"error":"org_mismatch"}` — `X-Nerp-Org-Id` não bate com a org dona da apiKey
- 401 `{"error":"invalid_signature"}` — HMAC inválido (canonical string ou secret errado)
- 403 `{"error":"org_not_found"}` — org foi deletada
- 403 `{"error":"consent_user_not_found"}` — usuário que aprovou foi deletado

---

## 7. Página de consent — **URL FINAL**

URL real que vocês devem redirecionar no `src/app/api/integrations/nerp/start/route.ts`:

```
http://localhost:3001/authorize/nasa-integration
  ?state=<opaco>
  &redirect_uri=<URL absoluta do callback de vocês>
  &scopes=<CSV ex: products:rw,sales:rw>
  &client_id=<NERP_CLIENT_ID>
```

Observação: a página está em `/authorize/nasa-integration` (não em `(auth)/authorize/...` como o briefing dizia) — colocamos fora do grupo `(auth)` pra não herdar o layout de login. Pra vocês isso é transparente — só o path muda.

### Comportamento

- **Sem login no nerp:** redireciona pra `/login?redirectTo=<URL atual url-encoded>`. Após login, volta sozinho pra página de consent.
- **Logado sem org ativa:** mostra tela pedindo pra criar/escolher org. **Não redireciona automaticamente** — fluxo manual por enquanto.
- **Logado com org ativa:** mostra consent. Aprovar → redireciona `${redirect_uri}?code=<24-byte-b64url>&state=<state>`. Recusar → redireciona `${redirect_uri}?error=user_denied&state=<state>`.
- **client_id inválido:** mostra erro estático "Cliente desconhecido" (não redireciona — protege contra phishing).

### Code do consent

- TTL: 10 minutos
- Single-use (`consumedAt` marcado no exchange)
- Formato: `randomBytes(24).toString("base64url")` (32 chars)

---

## 8. Exchange endpoint

```
POST http://localhost:3001/api/integrations/nasa/exchange
Content-Type: application/json

{
  "code":         "<code do consent>",
  "clientId":     "<NERP_CLIENT_ID>",
  "clientSecret": "<NERP_CLIENT_SECRET>"
}
```

**Resposta 200:**
```json
{
  "apiKey":    "nerp_live_<33 chars base64url>",
  "secret":    "<43 chars base64url, 32 random bytes>",
  "nerpOrgId": "<orgId>",
  "scopes":    ["products:rw", "sales:rw", "..."],
  "expiresAt": null
}
```

**Erros:**
- 400 `{"error":"invalid_body"}` — JSON malformado ou campos faltando
- 400 `{"error":"invalid_code"}` — code não existe
- 400 `{"error":"code_already_used"}` — code já consumido
- 400 `{"error":"code_expired"}` — passou dos 10min
- 401 `{"error":"invalid_client"}` — clientId/Secret errados
- 500 `{"error":"server_misconfigured"}` — `.env` do nerp sem `NASA_CLIENT_ID/SECRET`

**Importante:** o `secret` é retornado **uma única vez**. Vocês precisam persistir do lado de lá imediatamente. Não dá pra recuperar depois (armazenamos cifrado com AES-256-GCM).

---

## 9. Débitos técnicos conhecidos (v1)

Combinamos no briefing que ficam pra v2 — só pra ficar registrado e vocês não baterem na trave:

- **Sem replay protection.** Drift de 5min significa que uma request capturada pode ser replayada nessa janela. Mitigação v2: Redis com TTL 5min indexando `(apiKey, signature)`.
- **Sem rotação de keys.** São long-lived. Sem refresh token. Vocês precisarão re-conectar manualmente se uma key for revogada.
- **Sem rate limit.** Headers `X-RateLimit-Remaining` e `Retry-After` não estão implementados.
- **Sem webhooks reversos (nerp → NASA).** Vocês têm casca em `src/app/api/integrations/nerp/webhook/route.ts` mas o nerp não envia nada ainda.

---

## Checklist pra vocês

- [ ] Ajustar schemas Zod em `src/http/nerp/<dominio>/schemas.ts` pra novos shapes (item 1)
- [ ] Confirmar paths corretos em `src/http/nerp/client.ts` (item 2 — atenção a `categories`/`catalogSettings`/`stocks`/`customer`)
- [ ] Listar pra gente quais procedures NASA realmente chama, pra criarmos só o subset necessário (item 3)
- [ ] Atualizar `.env.local` do NASA com `NERP_CLIENT_ID`/`NERP_CLIENT_SECRET` que estão no `.env` do nerp (item 4)
- [ ] Confirmar canonical string idêntica em `src/http/nerp/sign.ts` (item 6)
- [ ] Atualizar URL do `/start/route.ts` pra apontar pra `/authorize/nasa-integration` (item 7 — sem `(auth)` no path)
- [ ] Testar fluxo end-to-end com `pnpm dev` dos dois lados

Qualquer dúvida me chamem.
