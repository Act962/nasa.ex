# NASA Route — Visão Geral Completa

> Documentação técnica e funcional do feature **NASA Route**, a plataforma de cursos integrada da N.A.S.A. Última revisão: 2026-05-27 (e-mail de pós-compra).

NASA Route é o módulo que permite que organizações (criadores) vendam **cursos, eBooks, eventos, comunidades, mentorias, treinamentos e assinaturas** dentro da plataforma. O domínio cobre desde a criação do conteúdo (editor visual, upload de vídeo, planos de preço) até a aquisição pelo aluno (interna via Stars ou pública via Stripe), passando por progresso, recorrência e certificação.

---

## 1. Stack & Localização

| Camada | Localização |
| --- | --- |
| Schema Prisma | `prisma/schema.prisma` (modelos `NasaRoute*`) |
| Feature folder | `src/features/nasa-route/` |
| Procedures oRPC | `src/app/router/nasa-route/routes/` (~42 handlers) |
| Helpers de servidor | `src/app/router/nasa-route/helpers/` |
| Páginas criador | `src/app/(platform)/(tracking)/nasa-route/` |
| Settings | `src/app/(platform)/(tracking)/settings/nasa-route/` |
| Páginas públicas/aluno | `src/app/router/nasa-route/` |

Convenção: tudo que pertence ao domínio mora dentro de `src/features/nasa-route/` (UI, hooks, libs, stores). Apenas infra global (Stripe, R2, Prisma, oRPC) vive em `src/lib/`.

---

## 2. Modelo de Domínio (Prisma)

| Modelo | Função | Campos-chave |
| --- | --- | --- |
| `NasaRouteCategory` | Taxonomia do catálogo | `slug`, `name`, `order`, `isActive` |
| `NasaRouteCourse` | Curso (metadados + configuração de formato) | `slug`, `title`, `format`, **`priceBrlCents`** (fonte de verdade para checkout), **`isFree`** (flag), `priceStars` (legado), `creatorOrgId`, `creatorUserId`, `isPublished`, `startsAt`, `endsAt`, `purchaseTrackingId`, `redirectUrl`, `pixelId`, `gtmId`, **`purchaseEmailEnabled`**, **`purchaseEmailSubject`**, **`purchaseEmailBodyJson`** (TipTap JSON do e-mail customizado de pós-compra) |
| `NasaRouteModule` | Agrupamento de aulas (opcional) | `courseId`, `order`, `title` |
| `NasaRouteLesson` | Aula individual | `courseId`, `moduleId`, `videoUrl`, `videoFileKey`, `videoProvider`, `contentMd`, `isFreePreview`, `durationMin`, `awardSp` |
| `NasaRouteLessonAttachment` | Anexos da aula | `lessonId`, `kind` (file/image/link), `fileKey`, `fileSize` |
| `NasaRoutePlan` | Tier de preço do curso | `courseId`, `name`, **`priceBrlCents`** (fonte de verdade), `priceStars` (legado), `isDefault`, `order` |
| `NasaRoutePlanLesson` | N:N plano ↔ aula | `planId`, `lessonId` |
| `NasaRoutePlanAttachment` | Downloadables do plano | `planId`, `kind`, `fileKey`, `title` |
| `NasaRouteEnrollment` | Matrícula do aluno | `userId`, `courseId`, `planId`, `paidStars`, **`paidBrlCents`**, **`stripeCheckoutSessionId`**, **`stripePaymentIntentId`**, `source` (purchase/free_access/gift/stripe_purchase), `status` (active/refunded), `enrolledAt`, `completedAt` |
| `NasaRouteSubscription` | Cobranças recorrentes | `enrollmentId`, `status`, `currentPeriodStart/End`, `nextChargeAt`, `failedChargeCount` |
| `NasaRouteProgress` | Aulas concluídas | `userId`, `courseId`, `completedLessonIds[]`, `completedAt` |
| `NasaRouteFreeAccess` | Acesso gratuito concedido | `creatorOrgId`, `userId`, `courseId` (null = toda a org), `grantedById` |
| `NasaRouteCertificate` | Certificado emitido | `userId`, `courseId`, `enrollmentId`, `code` (único), `issuedAt` |
| `NasaRouteVideoUpload` | Sessão de upload multipart | `fileKey`, `multipartUploadId`, `sizeBytes`, `costStars`, `status` (uploading/completed/aborted/expired) |

Modelos de checkout público:

- **`PendingCoursePurchase`** — estado intermediário entre Stripe e enrollment. Suporta dois fluxos discriminados pelo campo `flow`:
  - `"authenticated"` → usuário já logado; o webhook finaliza o enrollment direto via `userId` salvo na linha.
  - `"public"` → anônimo; o webhook marca `PAID` e gera `signupToken` para o resgate pós-cadastro.
  Campos: `email`, `userId?`, `flow`, `stripeSessionId`, `stripePaymentIntentId`, `signupToken`, `amountBrlCents`, `status` (PENDING/PAID/REDEEMED/EXPIRED/CANCELLED).
- **`RouterPaymentSettings`** — singleton com `starPriceBrl` (default 0,15 BRL/★). Cache de 5 min em memória.

---

## 3. Formatos de Curso

Definidos em [formats.ts](src/features/nasa-route/lib/formats.ts) (fonte única da verdade).

| Formato | Viewer | Campos exclusivos | Comportamento |
| --- | --- | --- | --- |
| `course` | `course-route-viewer.tsx` | Módulos + aulas + vídeos | E-learning padrão |
| `training` | igual | idem | Programa intensivo |
| `mentoring` | igual | idem | Mentoria 1-on-1 ou em grupo |
| `ebook` | `ebook-viewer.tsx` | `ebookFileKey`, `ebookFileName`, `ebookPageCount` | Download de PDF/EPUB |
| `event` | `event-viewer.tsx` | `eventStartsAt/EndsAt`, `eventStreamUrl`, `eventTimezone`, `eventLocationNote` | Bloqueia compra após `endsAt` |
| `community` | `community-viewer.tsx` | `communityType` (whatsapp/telegram/discord/other), `communityInviteUrl`, `communityRules` | Link externo |
| `subscription` | `subscription-viewer.tsx` | `subscriptionPeriod` (monthly/yearly) | Cria `NasaRouteSubscription` recorrente |

Cada formato tem uma seção dedicada no editor: [forms/](src/features/nasa-route/components/creator/forms/) (`event-section.tsx`, `ebook-upload-section.tsx`, `community-section.tsx`, `subscription-section.tsx` etc.).

---

## 4. Arquitetura de Componentes

```
src/features/nasa-route/components/
├── creator/    # editor, formulários, dashboards, tabelas de vendas/alunos
│   ├── course-editor.tsx          ← shell com tabs (Básico, Módulos, Planos, Integrações)
│   ├── course-form.tsx / lesson-form.tsx / module-form.tsx / plan-form.tsx
│   ├── lessons-board.tsx          ← DnD (@dnd-kit) pra reordenar módulos, reordenar aulas dentro do módulo e movê-las entre módulos (incl. "Aulas avulsas")
│   ├── plan-lessons-picker.tsx    ← DnD pra atribuir aulas a planos
│   ├── lesson-form-video-uploader.tsx + video-upload-cost-modal.tsx
│   ├── free-access-manager.tsx
│   ├── creator-dashboard.tsx + sales-table.tsx + students-table.tsx
│   │   └── sales-table.tsx → abas "Confirmadas" (enrollments) e
│   │      "Pendentes" (pending purchases), com KPIs de faturamento.
│   ├── integrations-tab.tsx       ← Pixel, GTM, redirect URL
│   └── forms/                     ← seções condicionais por formato
├── student/    # player, "meus cursos", certificados, modal de matrícula
│   ├── course-player-shell.tsx + lesson-list-sidebar.tsx
│   ├── viewers/                   ← um viewer por formato (course/ebook/event/community/subscription)
│   ├── enrollment-modal.tsx       ← fluxo de compra para usuário autenticado
│   ├── certificate-page.tsx + certificate-view.tsx + certificates-list.tsx
│   ├── course-completion-celebration.tsx
│   └── my-courses-grid.tsx
├── public/     # landing page do curso, checkout anônimo, tracking
│   ├── course-public-page.tsx + course-hero.tsx
│   ├── course-lessons-section.tsx + course-plans-section.tsx
│   ├── public-checkout-modal.tsx  ← email → Stripe Checkout
│   ├── free-preview-player.tsx
│   ├── format-cta-button.tsx + format-details-section.tsx
│   └── tracking-scripts.tsx       ← injeta Pixel/GTM
├── shared/     # cards, posters, price display, share menu, video embed
└── upload-manager-dock.tsx        ← dock flutuante com uploads ativos
```

Stores/hooks/lib:

- `stores/use-video-upload-manager.ts` — Zustand store para progresso, pause/resume de uploads.
- `hooks/use-video-upload.ts` — ciclo de vida do upload (seleção → quote → multipart).
- `lib/pricing.ts` — `getStarPriceBrl()`, `starsToBrl()`, `formatStarsAndBrl()` (cache 5 min).
- `lib/video-storage-pricing.ts` — `computeVideoUploadCost()` (modelo: 0,015 USD/GB × 36 meses + 10 % de margem).
- `lib/upload-manager-db.ts` — persiste estado de upload no IndexedDB (idb-keyval) para sobreviver a reloads.
- `lib/event-date.ts` — formatação compacta (“13 mai · 19h00”, “30 mai – 02 jun”).
- `lib/video-url.ts` — presigned R2 + URL otimizada via CDN.

---

## 5. Procedures oRPC

Localização: `src/app/router/nasa-route/routes/` (~42 arquivos).

**Criador (CRUD):**
- `creator-upsert-course | -lesson | -module | -plan`
- `creator-set-plan-lessons`
- `creator-delete-course | -lesson | -plan`
- `creator-reorder-lessons` — batch update de `order` (e opcionalmente `moduleId`) das aulas. Usado pelo board DnD do editor.
- `creator-reorder-modules` — batch update de `order` dos módulos. Usado pelo board DnD do editor.
- `creator-publish-course`
- `creator-list-courses | -students | -plans`
- `creator-list-sales` — vendas confirmadas (lê `NasaRouteEnrollment`): comprador, curso, plano, `paidBrlCents`, `paidStars` (payout), IDs Stripe, `source`, `status`. Filtros: `courseId`, `source`, `status`, `search`, `from`, `to`, paginado. Retorna `totals` (faturamento BRL, contagem, payout Stars).
- `creator-list-pending-sales` — funil de checkout (lê `PendingCoursePurchase`): pendentes (`PENDING`), pagos aguardando resgate público (`PAID`), expirados (`EXPIRED`) e cancelados. Exclui `REDEEMED` por default (essas já viraram enrollment).
- `creator-send-test-purchase-email` — envia um preview do e-mail de pós-compra para o próprio criador, resolvendo placeholders com dados fake (Aluno Teste, R$ 99,90 etc.). Aceita override dos campos `purchaseEmail*` no input para testar o estado não-salvo do form.

**Upload de vídeo:**
- `creator-quote-video-upload` — calcula custo (input: `sizeBytes`).
- `creator-start-video-upload` — inicia multipart, **cobra Stars upfront** via `chargeStarsByAction(...)`, retorna URLs presigned.
- `creator-get-upload-part-url` — presigned PUT por parte.
- `creator-complete-video-upload` — valida ETags, finaliza multipart, vincula à aula.
- `creator-abort-video-upload` — cancela e estorna Stars se aplicável.

**Aluno:**
- `purchase-course` — fluxo principal de matrícula (ver §6).
- `list-my-enrollments`, `get-course-as-student`, `get-free-lesson`
- `mark-lesson-complete` — atualiza progresso, concede Space Points, emite certificado se concluiu tudo.
- `list-my-certificates`
- `get-subscription-status`, `get-event-stream-url`, `get-community-invite`, `get-ebook-download-url`

**Público (sem auth):**
- `public-get-course`, `public-list-by-company`, `public-search`, `public-get-certificate`
- `track-course-view`

**Acesso gratuito & resgate público:**
- `free-access-grant | -list | -revoke`
- `redeem-course-purchase` — finaliza `PendingCoursePurchase` após signup.
- `get-pending-purchase`

**Helpers (`helpers/`):**
- `purchase-helpers.executeCoursePurchaseInTx()` — transação atômica: débito do aluno, crédito do criador (90 %), criação de enrollment + progress + incremento de `studentsCount`.
- `subscription-helpers.createSubscriptionInTx()` — agenda recorrência.
- `purchase-crm-side-effects.createPurchaseSideEffects()` — gera lead no tracking `purchaseTrackingId` se configurado.

---

## 6. Fluxos de Aquisição (Stripe BRL direto)

Modelo unificado: **todo curso pago passa por Stripe Checkout em BRL**,
independentemente do aluno estar logado. Stars deixou de ser moeda de
compra de curso — segue como moeda interna para payout do criador (até
Stripe Connect ser implementado) e para uploads de vídeo.

### 6.1 Aluno autenticado (com organização)

1. Acessa landing pública (`/c/<orgSlug>/<courseSlug>`) ou o player.
2. Clica em **Comprar** → abre `EnrollmentModal`.
3. Se houver múltiplos planos, seleciona; senão usa o `isDefault`.
4. Confirmação → chama `purchase-course` (oRPC).
5. Procedure decide:
   - **Curso `isFree` ou plano `priceBrlCents=0` ou free-access concedido** → matrícula direta (sem Stripe). Cria enrollment com `source: "free_access" | "purchase"`, progresso vazio, incrementa `studentsCount`.
   - **Curso pago** → cria `PendingCoursePurchase (flow="authenticated", userId, priceStars=snapshot, amountBrlCents)`, abre **Stripe Checkout Session** (`unit_amount = plan.priceBrlCents`, currency=BRL, `allow_promotion_codes: true` — campo de cupom nativo) e retorna `{ kind: "checkout", checkoutUrl }`.
6. Cliente recebe `checkoutUrl` e faz `window.location.href = checkoutUrl`.
7. Pagamento confirmado → webhook `checkout.session.completed` valida
   `payment_status="paid"` e `amount_total` (ver §6.4) e chama
   `finalizeStripePurchaseInTx`:
   - cria `NasaRouteEnrollment` (`source: "stripe_purchase"`, `paidBrlCents`, `stripeCheckoutSessionId`, `stripePaymentIntentId`);
   - cria `NasaRouteProgress`;
   - incrementa `studentsCount` (apenas no insert, não em retries);
   - credita o criador em **Stars** (90 % do snapshot, taxa 10 % retida) — payout interno até Stripe Connect chegar;
   - dispara side-effects de CRM (`createPurchaseSideEffects`).
8. Aluno volta para `success_url` → redireciona para o player ou `redirectUrl`.
9. Pixel/GTM (FB Purchase, GA ecommerce) — agora em BRL — são disparados pelo `enrollment-modal` para fluxo gratuito; no fluxo pago a recomendação é configurar conversão Stripe-side.
10. Certificado é emitido quando todas as aulas forem concluídas.
11. **E-mail de pós-compra** — `triggerPurchaseEmail(enrollmentId)` dispara o evento Inngest `nasa-route/purchase.completed` (ver §9), fire-and-forget. Roda imediatamente após `finalizeStripePurchaseInTx`.

### 6.2 Visitante anônimo (checkout público)

1. Landing pública (`/c/<orgSlug>/<courseSlug>`) exibe preço em BRL.
2. Clica em **Comprar** → `PublicCheckoutModal` solicita email.
3. POST `/api/checkout/course` cria `PendingCoursePurchase (flow="public")` e abre **Stripe Checkout Session** (`unit_amount = plan.priceBrlCents`, `allow_promotion_codes: true` — campo de cupom nativo do Stripe).
4. Pagamento aprovado → webhook marca `status=PAID` + gera `signupToken` (TTL 7 dias).
5. Inngest envia email com link `/redeem/<token>`.
6. Usuário cria conta (User + Organization via signup) → chama `redeem-course-purchase`.
7. A procedure cria a Organization se não existir, concede welcome bonus de Stars (uma vez por org), e chama `finalizeStripePurchaseInTx` para criar o enrollment (`source: "stripe_purchase"`). **Não há mais topup de Stars nem débito do comprador** — o pagamento já foi captado em BRL pelo Stripe.
8. Dispara `triggerPurchaseEmail(enrollmentId)` (ver §9) — aluno recebe o e-mail customizado do criador (ou default), além do e-mail de signup já enviado em (5).
9. Redireciona para o player.

### 6.3 Acesso gratuito

Criador → editor → aba **Acesso Gratuito** (`free-access-manager.tsx`) → concede a um usuário específico ou à org inteira (`courseId = null`). Aluno entra sem paywall; enrollment fica com `source: "free_access"`. O e-mail de pós-compra (§9) também é disparado neste fluxo — o mesmo branch que trata `isFree=true` em `purchase-course` chama `triggerPurchaseEmail`.

### 6.4 Garantias de idempotência & defesas no webhook

Hardening implementado em 2026-05-28 (Fase 1 do plano de segurança Stripe):

1. **`Idempotency-Key` em toda `stripe.checkout.sessions.create`** — todas
   as 5 rotas de criação (público `course-checkout:public:<pendingId>`,
   autenticado `course-checkout:auth:<pendingId>`, top-up Stars
   `stars-topup:<paymentId>`, assinatura de plano
   `plan-subscription:<orgId>:<planId>:<hourBucket>` e o helper genérico
   `createCheckoutSession`) passam um key derivado de identidade estável.
   Retries de rede / double-click reaproveitam a mesma Session ao invés
   de criar uma nova cobrança paralela.
2. **Validação de `session.payment_status`** — o webhook só finaliza com
   `payment_status === "paid"`. Eventos `checkout.session.completed`
   disparados em status `unpaid` (async methods, captura manual) são
   pulados; o pagamento real chega depois via `payment_intent.succeeded`
   (a ser implementado na Fase 3).
3. **Validação de `session.amount_total`** — se divergir de
   `pending.amountBrlCents` (cupom Stripe aplicado, divergência por
   bug), o webhook **recalcula payout proporcional**:
   `effectivePriceStars = floor(priceStars × (amount_total / amountBrlCents))`.
   Antes, qualquer desconto resultava em crédito ao criador no valor
   cheio — money leak.
4. **Idempotência atômica via `updateMany where status=PENDING`** — o
   check `pending.status === "PAID"` fora de transação era TOCTOU: dois
   webhooks paralelos passavam ambos e ambos rodavam side-effects. Agora
   um `updateMany` condicional faz a "claim" da pending; o segundo vê
   `count=0` e sai. Mesma técnica aplicada em
   `redeem-course-purchase` (claim `PAID → REDEEMED`).
5. **`finalizeStripePurchaseInTx` é idempotente end-to-end** — guard
   logo no início: se já existe enrollment com o **mesmo**
   `stripeCheckoutSessionId` e `status="active"`, devolve
   `alreadyFinalized: true` sem refazer payout, sem incrementar
   `studentsCount`, sem criar `StarTransaction`. O caller do webhook
   pula `triggerPurchaseEmail`, CRM side-effects e PostHog quando
   `alreadyFinalized` é true. O crédito ao criador também trocou de
   `update { starsBalance: X }` (vulnerável a lost update) para
   `update { starsBalance: { increment: payoutStars } }` (atômico no SQL).

**Eventos Stripe tratados pelo webhook** (`/api/stripe/webhook`):

| Evento | Handler | Idempotência |
| --- | --- | --- |
| `checkout.session.completed` | Finaliza compra (auth direta / public via signupToken). Skip se `payment_status !== "paid"`. | Claim atômica `updateMany where status='PENDING'`. |
| `payment_intent.succeeded` | **Fallback** do `checkout.session.completed`. Garante finalização mesmo se o session.completed falhar na entrega OU se for async method (boleto/Pix após captura real). | Mesma claim + `finalizeStripePurchaseInTx.alreadyFinalized` guard. |
| `checkout.session.expired` | Marca `PendingCoursePurchase.status='EXPIRED'`. | `updateMany where status='PENDING'`. |
| `charge.refunded` | **Full refund** → `revokeStripePurchaseInTx`: marca enrollment `refunded`, debita Stars do criador (proporcional), decrementa `studentsCount`, registra `StarTransaction(type=REFUND)`, dispara Inngest `nasa-route/enrollment.refunded`. **Partial refund** → só loga (ação manual). | `updateMany where status='active'` no enrollment. |
| `charge.dispute.created` | NÃO revoga acesso (merchant pode contestar). Loga + dispara Inngest `stripe/charge.dispute.created` pra notificação manual. | N/A (evento informacional). |
| `invoice.payment_succeeded` | Stub (renovação de plano — Fase 2). | — |
| `customer.subscription.deleted` | Stub (cancelamento — Fase 2). | — |

**Configuração no Stripe Dashboard** — endpoint `/api/stripe/webhook` deve
assinar **TODOS** estes eventos. Sem `payment_intent.succeeded` configurado,
o defense-in-depth contra entrega perdida do `checkout.session.completed`
não funciona. Sem `charge.refunded`, refunds via Dashboard não sincronizam
no sistema interno.

Próximas fases (ainda pendentes):

- **Fase 2** — reaproveitar pending PENDING recente em ambos os fluxos
  de criação; unique parcial no schema; mover crédito Stars para
  Inngest assíncrono; tabela `ProcessedStripeEvent` por `event.id`;
  índice em `PendingCoursePurchase.stripePaymentIntentId` (lookup do
  fallback `payment_intent.succeeded` faz table scan hoje).
- **Fase 3 (resto)** — handler `payment_intent.payment_failed` (marca
  pending CANCELLED); cron Inngest pra varrer pendings PENDING órfãs
  (>24h sem evento); UI "reenviar email de resgate" + diferenciar
  visual "aguardando pagamento" vs "pago aguardando resgate" na
  `sales-table`; Inngest function pra `nasa-route/enrollment.refunded`
  enviar email ao aluno + criador; Inngest function pra
  `stripe/charge.dispute.created` notificar admin.

### 6.5 Validação de acesso (defense in depth)

- **Backend (oRPC):** todo conteúdo restrito passa por
  `verifyEnrollmentActive(userId, courseId)` — helper centralizado em
  `src/app/router/nasa-route/helpers/access-helpers.ts`. Aplicado em
  `get-course-as-student`, `mark-lesson-complete`, `get-ebook-download-url`,
  `get-event-stream-url`, `get-community-invite`. `get-subscription-status`
  faz checagem inline equivalente mas devolve dados de subscriptions inativas
  para que o viewer renderize alertas de `past_due`/`cancelled`.
- **SSR (Server Components):** `ensureEnrollmentOrRedirect` em
  `src/features/nasa-route/lib/server-access.ts` redireciona para a landing
  pública se o aluno não estiver matriculado. Aulas com `isFreePreview=true`
  são liberadas mesmo sem enrollment.

---

## 7. Pipeline de Vídeo

```
[arquivo] → quote (cliente) → confirm modal (R$ X · Y★)
        → creator-start-video-upload (cobra ★ upfront)
        → para cada chunk (10 MB):
             get-upload-part-url → PUT direto no R2
             salva ETag + progresso no IndexedDB
        → creator-complete-video-upload (valida ETags) → vincula videoFileKey à aula
```

- Bucket: `nasa-route-videos` (Cloudflare R2).
- Modelo de custo (`video-storage-pricing.ts`): `0,015 USD/GB/mês × 36 meses + overhead multipart + 10 % de margem` → BRL → Stars.
  - Exemplo: arquivo de 1 GB ≈ 0,65 USD ≈ R$ 3,50 ≈ ~24★.
- Entrega: presigned R2 ou URL otimizada via `lib/video-url.ts` (CDN/Workers).
- Player suporta também providers externos (YouTube/Vimeo) via `videoProvider`.
- Dock global `upload-manager-dock.tsx` mostra uploads em andamento (pausar, retomar, %).
- IndexedDB (`upload-manager-db.ts`) permite retomar após reload do navegador.

---

## 8. Certificados

- Emitidos automaticamente quando `completedLessonIds.length === totalLessons` (em `mark-lesson-complete`).
- Modelo `NasaRouteCertificate` snapshota `studentName`, `courseTitle`, `orgName`, `durationMin` e gera `code` único.
- Aluno visualiza em `/certificados` (`certificates-list.tsx` → `certificate-view.tsx`).
- Verificação pública via `public-get-certificate` (magic link, sem auth) — suporta `?download=true` para PDF.

---

## 9. Integrações & Tracking

- **Pixel (Meta)** e **GTM/GA** — IDs configurados por curso (`pixelId`, `gtmId`), injetados via `tracking-scripts.tsx` na landing e no checkout.
- **CRM interno** — `purchaseTrackingId` opcional vincula a compra a um funil de tracking; `createPurchaseSideEffects` gera o lead.
- **Inngest** — automações assíncronas (envio de emails, recorrência de assinaturas, expiração de `PendingCoursePurchase`).
- **Redirect URL** — após matrícula, criador pode redirecionar para página externa (upsell, obrigado etc.).
- **E-mail de pós-compra** — opcionalmente personalizável por curso (`purchaseEmailEnabled` + `purchaseEmailSubject` + `purchaseEmailBodyJson` no `NasaRouteCourse`). Corpo em TipTap JSON com placeholders `{{studentName}}`, `{{courseTitle}}`, `{{creatorName}}`, `{{orgName}}`, `{{planName}}`, `{{amountBrl}}`, `{{accessUrl}}`, `{{certificateUrl}}` resolvidos no envio. Quando desativado, usa o template default dinâmico assinado pela org (`src/lib/email/purchase-default.tsx`). Disparado nos 3 fluxos de matrícula (Stripe autenticado, resgate público pós-signup e matrícula gratuita) via `triggerPurchaseEmail(enrollmentId)` em [src/features/nasa-route/lib/purchase-email.ts](src/features/nasa-route/lib/purchase-email.ts), que enfileira o evento `nasa-route/purchase.completed`. A função Inngest `nasaRoutePurchaseEmail` em `src/inngest/functions/nasa-route/purchase-email.ts` carrega o enrollment, renderiza via `renderPurchaseEmail` e envia pelo Resend. UI: aba **Email pós-compra** no editor (`purchase-email-tab.tsx`) com Switch + Input de assunto + RichtTextEditor + chips clicáveis de variáveis + botão "Enviar teste para mim" (procedure `creator-send-test-purchase-email`).

---

## 10. Stars × NASA Route

A moeda interna **Stars (★) deixou de comprar cursos**. Cursos pagos
sempre passam por Stripe Checkout em BRL. Stars segue presente em:

- **Payout interno do criador** — quando uma venda é finalizada, o criador
  recebe 90 % do `priceStarsSnapshot` (calculado no momento do checkout
  via `RouterPaymentSettings.starPriceBrl`) em Stars. Compatibilidade
  temporária até Stripe Connect ser habilitado, quando o criador passará a
  receber BRL diretamente.
- **Uploads de vídeo** — continuam cobrando Stars upfront (modelo de
  custo em `lib/video-storage-pricing.ts`).
- **Welcome bonus** — orgs novas criadas via resgate público recebem
  Stars de boas-vindas.

Consulte também:
- [STARS_OVERVIEW.md](docs/STARS_OVERVIEW.md)
- [STARS_AUDIT.md](docs/STARS_AUDIT.md)

## 13. Próximos passos — Stripe Connect

Roadmap para que criadores recebam o dinheiro **diretamente em conta
própria** (em BRL), tirando Stars do payout:

1. Schema: `Organization.stripeConnectAccountId`, `stripeConnectStatus`
   (`pending|active|disabled`), `stripeConnectChargesEnabled`.
2. Onboarding: rota `/api/stripe/connect/onboard` criando `AccountLink`
   (Express ou Standard).
3. Checkout: na criação da session, usar
   `payment_intent_data.transfer_data.destination = creatorOrg.stripeConnectAccountId`
   e `application_fee_amount = 10 % * priceBrlCents`.
4. Webhook: tratar `account.updated`, `payout.paid`, `payout.failed`.
5. Migrar `finalizeStripePurchaseInTx` para pular o payout em Stars
   quando o criador tem Connect ativo.
6. UI: tela "Configurações de pagamento" no editor com status da conexão.

---

## 11. Rotas (App Router)

**Criador (autenticado):**
- `/(platform)/(tracking)/nasa-route/criador` — dashboard de cursos.
- `/(platform)/(tracking)/nasa-route/criador/curso/[courseId]` — editor (tabs).
- `/(platform)/(tracking)/settings/nasa-route` — configurações (pagamento, webhooks, acessos).

**Aluno / Público:**
- `/router/nasa-route/[slug]` — landing pública do curso.
- `/router/nasa-route/[orgSlug]` — catálogo da empresa.
- `/router/nasa-route/search` — busca + filtros.
- `/router/nasa-route/meus-cursos` — dashboard do aluno.
- `/router/nasa-route/curso/[courseId]/aula/[lessonId]` — player.
- `/router/nasa-route/certificados` — certificados.

**API/Webhooks:**
- `/api/checkout/course` — cria `PendingCoursePurchase` + Stripe Session.
- Webhook Stripe → marca `paid` e gera `signupToken`.
- `/redeem/<token>` — página de resgate pós-signup.

---

## 12. Resumo Executivo

NASA Route é um “mini-Hotmart/Kiwify” embutido na plataforma. Oferece **7 formatos** de produto, **dois fluxos de aquisição** (interno via Stars com transação atômica e público via Stripe com resgate por email), **upload nativo de vídeo** com cobrança previsível por GB-ano, **pipeline completo de progresso e certificação**, e **integrações de tracking** (Pixel/GTM/CRM interno). Toda a economia gira em Stars, com fee fixo de 10 % para a plataforma e 90 % para o criador.

A separação de responsabilidades segue rigidamente a arquitetura por features do projeto: domínio fechado em `src/features/nasa-route/`, procedimentos oRPC em `src/app/router/nasa-route/routes/`, e nenhum vazamento de domínio para `src/lib/` (que mantém apenas infra global como R2, Stripe, Prisma e oRPC).
