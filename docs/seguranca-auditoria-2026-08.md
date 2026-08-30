# Auditoria de Segurança — 2026-08-18

> **Documento interno.** Registro de vulnerabilidades encontradas na auditoria de `f67796d2` e
> checklist de correção. Faz parte da Fase 0 de [`arquitetura-evolucao-overview.md`](arquitetura-evolucao-overview.md).
>
> **Regra de manutenção:** ao corrigir um item, marque o status na tabela, registre o PR e **não
> apague o item** — o histórico é o que impede a regressão voltar despercebida. Todo item corrigido
> precisa de um teste de integração que falhe se a correção for revertida.

**Legenda de status:** ⬜ não iniciado · 🚧 em andamento · ✅ corrigido (com teste) · ⏭️ descartado (justificar)

---

## Resumo

| Severidade | Itens | Status |
| --- | ---: | --- |
| 🔴 Crítico — explorável anonimamente | 8 | ⬜ 8 |
| 🟠 Alto | 6 | ⬜ 6 |
| 🟡 Médio | 5 | ⬜ 5 |

**Ponto de partida:** as quatro primeiras (S1–S4) são **horas de trabalho cada** e os templates
corretos já existem no repo. Não dependem do resto do plano nem umas das outras.

**Contexto que agrava:** não existe `middleware.ts` na raiz — nenhuma proteção centralizada, nenhum
header de segurança, nenhum ponto para rate limit global. Cada uma das 925 procedures e 73 route
handlers é responsável por si.

**Ponto positivo verificado:** ✅ **nenhum segredo hardcoded** no código. Buscas por `sk_live|sk_test|pk_*`,
`Bearer <20+>`, `AIza…`, `ghp_…`, `xox[baprs]-`, hex de 40+ chars e `(secret|password|apikey|token) = "<16+>"`
retornaram apenas um placeholder literal (`"sk_test_placeholder"` em `src/lib/stripe.ts:24`, que é
outro problema — ver A4). O `.env` **nunca esteve** versionado no git.

---

## 🔴 Críticos

### S1 — Webhook Asaas credita Stars sem validar assinatura

| | |
| --- | --- |
| **Status** | ⬜ |
| **Arquivo** | `src/app/api/payments/asaas/webhook/route.ts` |
| **Impacto** | **Perda financeira direta.** Stars são moeda interna com custo real (LLM, OCR, Whisper, WhatsApp) |
| **Template de correção** | `src/app/api/stars/webhook/route.ts:131-150` |

O handler não lê nenhum header de assinatura. Cadeia confirmada por leitura:

```
POST anônimo → { event: "PAYMENT_CONFIRMED", payment: { externalReference: "<StarsPayment.id>" } }
  L50  prisma.starsPayment.findUnique({ where: { id: paymentId } })   ← id vem do body
  L74  update({ status: "paid" })
  L80  purchaseTopUp(organizationId, packageId)                       ← CREDITA STARS
  L84  processPaymentPartnerEffects()                                 ← gera comissão de parceiro
```

Única barreira: idempotência por `status === "paid"` (L61). **`payment.value` nunca é comparado a
`starsPayment.amountBrl`** — mesmo com assinatura válida, um valor divergente creditaria o pacote cheio.

**Correção:**

- [ ] Validar a assinatura do webhook Asaas, fail-closed (sem fallback silencioso — ver o comentário
      em `stars/webhook` explicando por que fallback é brecha)
- [ ] Conferir `payment.value` contra `starsPayment.amountBrl` antes de creditar
- [ ] Manter a idempotência existente
- [ ] Modo *log-only* por 24h antes de fail-closed, contando quantas assinaturas seriam rejeitadas
- [ ] Testes: assinatura válida processa · inválida rejeita sem efeito · ausente rejeita · replay é idempotente · valor divergente rejeita

---

### S2 — `DELETE /api/s3/delete` sem autenticação

| | |
| --- | --- |
| **Status** | ⬜ |
| **Arquivo** | `src/app/api/s3/delete/route.ts` (47 linhas) |
| **Impacto** | **Perda de dados irreversível.** Qualquer pessoa na internet apaga qualquer objeto do bucket de imagens |

```ts
export async function DELETE(request: Request) {
  const body = await request.json();
  const key = body.key;                      // sem auth, sem ownership, sem prefixo
  const command = new DeleteObjectCommand({
    Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
    Key: key });
  await S3.send(command);
}
```

**Correção:**

- [ ] ⚠️ **Primeiro:** verificar se a rota ainda é usada (item 8 dos abertos). Se não for, **remover**
- [ ] Se for: exigir sessão autenticada + validar que a `key` pertence à organização do usuário
      (prefixo por org ou lookup do registro dono do arquivo)
- [ ] Testes: sem sessão rejeita · sessão de outra org rejeita · dono apaga

---

### S3 — `POST /api/upload-local` anônimo aceitando SVG → stored XSS

| | |
| --- | --- |
| **Status** | ⬜ |
| **Arquivo** | `src/app/api/upload-local/route.ts` (40 linhas) |
| **Impacto** | **Comprometimento de conta.** SVG é HTML executável servido na **mesma origem** → roubo de sessão |
| **Template de correção** | `src/app/api/s3/upload-script-video/route.ts` |

Sem auth. Valida tipo (L18-21) e tamanho (10 MB, L23), mas a allowlist **inclui `image/svg+xml`** e
há bypass explícito por extensão (`|| file.name.endsWith(".svg")`). Servido de `/uploads/<uuid>.svg`.
Também escreve em `public/uploads/` em runtime — efêmero em container.

**Correção:**

- [ ] ⚠️ Verificar se a rota ainda é usada. Se não, **remover**
- [ ] Se for: exigir sessão + remover `image/svg+xml` da allowlist + remover o bypass por extensão
- [ ] Se SVG for requisito real: sanitizar com `isomorphic-dompurify` (já instalado) e servir de
      origem separada ou com `Content-Disposition: attachment`
- [ ] Testes: sem sessão rejeita · SVG rejeitado · extensão `.svg` com MIME falsificado rejeitado · acima do limite rejeitado

---

### S4 — Webhooks Meta e domain-providers sem validação de assinatura

| | |
| --- | --- |
| **Status** | ⬜ |
| **Arquivos** | `src/app/api/integrations/facebook/webhook/route.ts` (268 L) · `.../instagram/webhook/route.ts` (270 L) · `src/app/api/domain-providers/[provider]/webhook/route.ts` (69 L) |
| **Impacto** | Injeção de mensagens no pipeline de conversas; mutação de `NasaPageDomainPurchase` e disparo de Inngest por terceiro |
| **Template de correção** | `src/http/whats-oficial/verify-signature.ts` |

Facebook e Instagram validam `hub.verify_token` no **GET**, mas o **POST não valida
`x-hub-signature-256`**. `domain-providers` não valida nada.

**Correção:**

- [ ] HMAC `x-hub-signature-256` sobre o **raw body** nos POST de Facebook e Instagram, com
      `timingSafeEqual`, fail-closed
- [ ] Autenticação no webhook de `domain-providers` (assinatura do provider ou token dedicado)
- [ ] Modo *log-only* por 24h antes de fail-closed
- [ ] Testes: assinatura válida processa · inválida rejeita · ausente rejeita · corpo adulterado rejeita

---

### S5 — IDOR sistêmico: isolamento multi-tenant quebrado

| | |
| --- | --- |
| **Status** | ⬜ |
| **Escopo** | ~175–190 procedures em `src/app/router/` |
| **Impacto** | **Incidente LGPD.** Leitura e destruição de dados entre clientes |

`requireOrgMiddleware` resolve apenas a **organização ativa da sessão**. Não recebe nem valida
nenhum ID vindo do input. Correlacionar `input.xId` com `context.org.id` ficou 100% a cargo de cada
procedure — e a maioria não faz.

| Situação | Arquivos |
| --- | ---: |
| Usam `requiredAuthMiddleware` | 712 |
| Usam `requireOrgMiddleware` | 391 |
| **Autenticadas sem org** | **321** |
| **Sem org e sem menção a `organizationId`/`orgId`** | **~175–190** |
| Sem nenhum middleware | 231 (63 com `.handler(`) |

No schema, só **80 de 240 models (33%)** têm `organizationId`; não há RLS nem `$extends` global de
tenant. O isolamento é 100% aplicação, sem rede.

**Confirmados por leitura direta:**

| Arquivo | Efeito |
| --- | --- |
| `router/form/delete.ts` | **Apaga formulário de qualquer organização** por ID |
| `router/conversation/get.ts` | Lê conversa + lead completo (PII) de qualquer org. `context` é recebido e **nunca usado** |
| `router/status/create.ts` | **Escreve** status em qualquer tracking |
| `router/status/list-status-simple.ts` | Lê status de qualquer tracking |
| `router/column/get-many.ts` | Lê colunas de qualquer workspace |
| `router/leads/delete-file.ts` | **Destrutivo**, sem amarração ao tenant |

O time já suspeitava: existem `scripts/diag-cross-org.ts` e `scripts/seed-cross-org-test.ts` no repo.

**Correção** (item longo da Fase 0 — 1 a 2 semanas):

- [ ] Script que classifica cada uma das ~190 em
      `{escopada-por-org | escopada-por-usuário | pública-intencional | VULNERÁVEL}`
      (partir de `scripts/diag-cross-org.ts`)
- [ ] Revisão humana da classificação — nem toda procedure sem org é falha (preferências de usuário
      são legitimamente escopadas por usuário)
- [ ] Guard de tenancy reutilizável: middleware que recebe o ID do input e valida a posse antes do handler
- [ ] Correção em lotes por domínio, começando pelas **destrutivas**
- [ ] Teste cross-org para **cada** procedure corrigida — "org A acessa recurso de org B → FORBIDDEN".
      Estes são os primeiros testes do projeto e definem o template
- [ ] Alvo de longo prazo: `TenantScope` obrigatório na construção do repositório (§5.3 do overview) —
      torna o esquecimento impossível por omissão, não só improvável

---

### S6 — Endpoints anônimos criam estrutura organizacional

| | |
| --- | --- |
| **Status** | ⬜ |
| **Arquivos** | `src/app/router/integrations/new-nasa-partial.ts:56` · `new-nasa-total.ts:72` (492 L) |
| **Impacto** | DoS de escrita; criação de orgs em massa; vinculação indevida de membro por e-mail |

Usam `base` puro, **sem auth**, input só `{ email }`. Chamam API externa e depois `$transaction`
criando **Organization + Member + Trackings + Status + Tags**. Sem rate limit.

**Correção:**

- [ ] Autenticação ou token de integração dedicado
- [ ] Rate limit persistente por IP e por e-mail
- [ ] Validação Zod do input
- [ ] Testes: sem credencial rejeita · acima do rate limit rejeita

---

### S7 — `POST /api/external/new-lead` público, sem validação, logando PII

| | |
| --- | --- |
| **Status** | ⬜ |
| **Arquivo** | `src/app/api/external/new-lead/route.ts` |
| **Impacto** | Injeção de leads em qualquer org; poluição de funil; **PII em log de produção** |

Sem auth, sem API key, sem assinatura, sem rate limit, sem Zod. Aceita `trackingId`/`statusId`
arbitrários do body e cria `Lead` em qualquer organização. **Linha 11: `console.log(json)`** despeja
nome, telefone e e-mail em stdout.

**Correção:**

- [ ] API key por organização (o `trackingId` deve ser derivado da chave, nunca aceito do body cru)
- [ ] Validação Zod do payload
- [ ] Rate limit
- [ ] **Remover `console.log(json)`**
- [ ] Testes: sem chave rejeita · chave de outra org não injeta no tracking alheio · payload inválido rejeita

---

### S8 — Debug de produção logando payload de cliente

| | |
| --- | --- |
| **Status** | ⬜ |
| **Arquivo** | `src/app/api/rpc/[[...rest]]/route.ts:43-66` |
| **Impacto** | Dados de cliente em log; violação de privacidade |

Bloco comentado como `// TEMP debug: log raw body for /api/rpc/nerp/* mutations. Remove after fix.` —
**ativo**. Materializa o body inteiro de toda mutation `/api/rpc/nerp/*` e loga 500 chars sem redação.

**Correção:**

- [ ] Remover o bloco inteiro
- [ ] Trocar por logging estruturado com redação por allowlist quando houver `pino` (Fase 1)

---

## 🟠 Altos

### A1 — 228 `throw errors.X;` sem invocação

| | |
| --- | --- |
| **Status** | ⬜ |
| **Escopo** | 228 ocorrências em `src/app/router/` |

`errors.NOT_FOUND` é uma **função** (Proxy que devolve o construtor). `throw errors.NOT_FOUND;` lança
o objeto-função, que não é `instanceof ORPCError`. **90 casos** convertem 404/403/400/401 em
500 "Something went wrong". Concentração: `leads` 32, `insights` 19, `admin` 17.

- [ ] Codemod `throw errors.X;` → `throw errors.X({ message: "..." })`
- [ ] Regra de lint que impede a forma sem invocação voltar

---

### A2 — Nenhum `middleware.ts`; nenhum header de segurança

| | |
| --- | --- |
| **Status** | ⬜ |
| **Arquivos** | raiz (ausente) · `next.config.ts:47-67` |

`next.config.ts` define apenas `Permissions-Policy`. **Faltam:** `Content-Security-Policy`,
`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.
Sem `middleware.ts`, um `page.tsx` que esqueça `getSession` fica público.

- [ ] Criar `src/middleware.ts` com os headers de segurança
- [ ] Usar como ponto de injeção do request-id (Fase 1)
- [ ] Revisar `images.remotePatterns` — wildcards abertos `*.r2.dev` e `*.t3.storage.dev` permitem
      proxy de bucket de terceiro pelo `/_next/image`

---

### A3 — Três uploads S3 sem auth nem validação de MIME

| | |
| --- | --- |
| **Status** | ⬜ |
| **Arquivos** | `s3/upload/route.ts` (96 L) · `s3/upload-direct/route.ts` (102 L) · `s3/upload-video/route.ts` (71 L) |

Validam tamanho (20 MB / 20 MB / 500 MB) mas **não validam `contentType`** e não exigem sessão. O de
vídeo confia no header `content-length`, controlado pelo cliente.

| Rota | Auth | Tipo | Tamanho |
| --- | :-: | :-: | :-: |
| `s3/upload-script-video` | ✅ | ✅ `video/mp4` | ✅ 16 MB |
| `s3/upload` | ❌ | ❌ | ✅ 20 MB |
| `s3/upload-direct` | ❌ | ❌ | ✅ 20 MB |
| `s3/upload-video` | ❌ | ❌ | 🟡 500 MB via header |
| `upload-local` | ❌ | 🟡 inclui SVG | ✅ 10 MB |
| `s3/delete` | ❌ | — | — |

- [ ] Replicar o padrão de `s3/upload-script-video` nas três: sessão + allowlist de MIME + limite real

---

### A4 — Sem validação de env; 65 de 107 vars ausentes

| | |
| --- | --- |
| **Status** | ⬜ |

Sem `.env.example` (embora `.gitignore:38` tenha a exceção `!.env.example` e dois docs mandem
copiá-lo). Falha silenciosa confirmada: `src/lib/stripe.ts:24` —
`new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder")` sobe normal e só quebra na
primeira cobrança real, **para o usuário**. `.env` tem `AI_SECRETS_KEY` e `RESEND_API_KEY` duplicados
(o último vence em silêncio).

Contra-exemplos corretos: `features/sync/lib/system-cred.ts:23-35` e `api/stars/webhook/route.ts:137-139`
fazem fail-fast — são 2 de 107.

- [ ] `.env.example` com as 107 vars, sem valores
- [ ] Validação Zod no boot, fail-fast
- [ ] Remover o fallback `?? "sk_test_placeholder"`
- [ ] Remover as chaves duplicadas do `.env`

---

### A5 — `dangerouslySetInnerHTML` com HTML do banco em páginas públicas

| | |
| --- | --- |
| **Status** | ⬜ |
| **Escopo** | 26 ocorrências; 7 de risco confirmado, 7 dependem de sanitização não verificada |

| Arquivo | Conteúdo |
| --- | --- |
| `features/forge/components/public/public-contract.tsx:439,501,603` | `letterheadHeader`, **`contract.content`**, `letterheadFooter` — página pública |
| `features/form/components/public/form-tracking-scripts.tsx:34` | Script analítico por org |
| `features/pages/components/public/page-analytics.tsx:69,99,116` | Script analítico por org |

O projeto **tem** `dompurify` e `isomorphic-dompurify` instalados — o uso é irregular.
`forge/proposal-templates.tsx` já sanitiza corretamente (5 usos via `sanitizeDescription`).

- [ ] Sanitizar os 7 confirmados com o DOMPurify já instalado
- [ ] Auditar os 7 que dependem de sanitização upstream (item 4 dos abertos)
- [ ] Para injeção de script analítico: allowlist de domínios em vez de HTML livre

---

### A6 — Rate limiting quase inexistente

| | |
| --- | --- |
| **Status** | ⬜ |

Um único caso, **in-memory e por instância** (não sobrevive a restart nem escala):
`api/public/booking-chat/route.ts:30-44` (`Map`, 20 req/min).
`api/in-chat/[slug]/identify/route.ts:25` documenta a lacuna: `"TODO: rate-limit por IP"`.
Todos os demais endpoints públicos — **incluindo os de IA, que custam dinheiro por chamada** — são
ilimitados. `base.ts:5` tem a mensagem `"You are being ratee limited"` (typo incluso) sem
implementação correspondente.

- [ ] Rate limit persistente (Redis ou tabela) nos endpoints públicos e de IA
- [ ] Corrigir a mensagem de `BAD_REQUEST` em `base.ts` — hoje diz rate limit para qualquer 400
- [ ] ⚠️ Verificar se há rate limit em proxy/edge antes de implementar (item aberto)

---

## 🟡 Médios

| # | Item | Arquivo | Ação |
| --- | --- | --- | --- |
| M1 | `victimIdsArr` — concatenação de input do usuário em literal de array Postgres. **Atualmente não usada** nas queries (que são parametrizadas), mas é bomba-relógio | `router/tags/merge-duplicates.ts:92` | ⬜ Remover a variável |
| M2 | Webhook Uazapi autentica por `json.token` do body contra `WhatsAppInstance.apiKey` — sem HMAC, sem comparação em tempo constante. 762 linhas, 51 commits em 6 meses | `api/chat/webhook/route.ts:443,463,476` | ⬜ Migrar para HMAC ou, no mínimo, `timingSafeEqual` |
| M3 | `CRON_SECRET` comparado com `!==` (não timing-safe) e ausente do `.env` | `api/cron/delete-archived-trackings/route.ts:9` | ⬜ `timingSafeEqual` + adicionar ao `.env.example` |
| M4 | Rotas admin com `catch` genérico devolvendo `401` para qualquer erro — mascara 500 reais | `api/admin/popup-templates/route.ts:17` e irmãs | ⬜ Diferenciar erro de auth de erro interno |
| M5 | Estado WebAuthn em `Map` de módulo — com >1 instância, registro e finalização caem em processos diferentes | `router/payment/access.ts:52-55` | ⬜ Mover para Redis/tabela ⚠️ severidade depende da topologia |

---

## Itens verificados e considerados OK

Registrados para não serem re-auditados sem motivo:

| Item | Veredito |
| --- | --- |
| Segredos hardcoded | ✅ **Nenhum.** Único hit é o placeholder literal em `stripe.ts:24` |
| `.env` no git | ✅ Nunca esteve versionado; `.gitignore` correto |
| SQL raw (53 ocorrências) | ✅ Tagged templates parametrizados pelo Prisma. Os 2 `$executeRawUnsafe` (`tags/merge-duplicates.ts:93,102`) usam parâmetros posicionais — seguros. Ressalva em M1 |
| Webhook Stripe (cursos e Stars) | ✅ `constructWebhookEvent` com secret dedicado; o de Stars **sem fallback**, com justificativa comentada |
| Webhook WhatsApp Oficial (Meta) | ✅ HMAC sobre raw body, `timingSafeEqual`, fail-closed |
| Webhook Inngest | ✅ `serve()` do SDK com signing key própria |
| Sync NERP / Comments | ✅ HMAC `SYNC_SHARED_SECRET` + header `x-sync-api-key` |
| `api/pusher/auth` | ✅ Allowlist explícita de canais privados, documentada inline |
| `api/s3/upload-script-video` | ✅ Auth + MIME + tamanho — é o template |
| `api/health` | ✅ `SELECT 1` com timeout de 2s |
| `src/lib/auth.ts` (387 L) | ✅ better-auth com `useSecureCookies` por ambiente, `trustedOrigins`, `databaseHooks` best-effort |
| Middleware admin | ✅ Re-lê `isSystemAdmin` do banco com comentário "do not trust session cache" |
| Prisma em componentes React de feature | ✅ **Zero** — a fronteira client/server nos componentes está intacta |

---

## Changelog

| Data | O quê |
| --- | --- |
| 2026-08-18 | Registro inicial. 8 críticos, 6 altos, 5 médios, a partir da auditoria de `f67796d2`. Todos os itens 🔴 confirmados por leitura direta do código. Nenhuma correção aplicada. |
