---
id: 0008
titulo: trafeGO — self-service de tráfego pago e campanhas
dominio: trafego
status: em-revisao
autor: Weydson
criada: 2026-08-30
atualizada: 2026-09-12
branch: feature/W-trafego-self-service-20260908
pr:
peso: completa
---

# 0008 — trafeGO: self-service de tráfego pago e campanhas

---

## 1. Contexto

PMEs que querem investir em tráfego pago hoje têm duas saídas ruins: contratar agência
(mensalidade alta, contrato longo) ou aprender a operar Meta Ads sozinhas. A NASA já tem a
operação de tráfego montada — falta um produto que empacote isso num fluxo que o cliente
percorre sozinho, do primeiro clique ao pagamento, sem reunião comercial.

O que existe hoje no produto e **não** resolve:

- `NasaCampaignPlanner` + `ClientOnboardingProcess` + `/portal/[clientCode]` — jornada de
  cliente, mas disparada por proposta Forge (venda consultiva com humano no meio).
- App CAMPANHAS (`Broadcast`) — disparo WhatsApp para quem **já é** cliente da plataforma e
  tem número Meta Cloud conectado.
- `metaAds.campaigns.*` — gestão de anúncios para org que já conectou a própria conta.

Nenhum desses tem porta de entrada pública, nem cobra, nem cria conta.

O eixo "compra anônima → Stripe → cadastro → acesso" **já existe e está em produção** no NASA
Route (`PendingCoursePurchase` → `/api/checkout/course` → webhook → `signupToken` →
`/resgatar/[token]`). Esta spec reaplica esse eixo a um produto novo.

## 2. Objetivo

Uma PME sem conta na NASA consegue, sozinha e em uma sessão, contratar e pagar uma campanha de
tráfego (Meta Ads) ou de disparo (WhatsApp Oficial), criar sua conta, enviar criativos e copy,
solicitar a ativação, e acompanhar status e desempenho — enquanto a equipe NASA executa e
atualiza o andamento por um painel interno.

### Não-objetivos

- **Google Ads.** Não existe client HTTP, model nem UI no projeto; só o scope OAuth `adwords`
  já solicitado em `google-config.ts`. Fica fora do catálogo v1.
- **Publicação automática no Meta.** O clique de "Ativar" **não** cria campanha, adset, ad nem
  creative na conta de anúncios. A verba é dinheiro real e a conta é da agência — a equipe
  executa e vincula o ID.
- **Criação automática de `Broadcast`.** `Broadcast.trackingId` é obrigatório e exige um
  `Tracking` com `WhatsAppInstance(META_CLOUD)`; o cliente trafeGO não tem número próprio.
- **Assinatura recorrente.** Cobrança é pagamento único por campanha. Recompra é ação nova.
- **PIX/boleto.** O webhook Asaas (`/api/payments/asaas/webhook`) não valida assinatura —
  endurecer isso é pré-requisito, e não entra nesta spec.
- **Barreira server-side por app.** Restringir a sidebar é navegação, não autorização. Ver
  RNF-4 e o caso de borda CB-9.
- **Stripe Connect / split de pagamento.** A verba entra na conta da NASA e é repassada
  manualmente ao Meta.
- **Edição self-service de campanha já no ar.** Pedido de mudança vira mensagem de suporte.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Página pública `/trafego`, sem autenticação, com wizard: plataforma → tipo → objetivo → briefing → plano → contato. |
| RF-2 | Simulador de investimento por faixa: o cliente escolhe a verba (mínimo R$ 300) e vê verba + taxa + setup + total. A taxa cai conforme a verba sobe (50% → 25%). |
| RF-2a | O wizard pergunta se o cliente tem conta de anúncios (BM), explica o que é, e cobra setup único de quem não tem — zerado a partir de R$ 2.501. |
| RF-2b | A landing exibe as marcas atendidas em faixa de rolagem contínua, pausável e respeitando `prefers-reduced-motion`. |
| RF-2c | Botão "Falar com um gestor" abre o WhatsApp configurado no admin, com a simulação já no texto. |
| RF-3 | Checkout Stripe em BRL com até **três `line_items`** (verba, taxa e setup), sem exigir conta prévia — só e-mail. |
| RF-4 | Confirmação de pagamento por webhook dedicado, idempotente, tolerante a entrega duplicada e fora de ordem. |
| RF-5 | Pagamento confirmado gera `signupToken` (TTL 7 dias) enviado por e-mail com link de ativação. |
| RF-6 | Na ativação, o comprador cria a senha e o sistema provisiona `User` (já criado no signUp), `Organization`, `Member(owner)` e `TrafegoOrder`, tudo idempotente. |
| RF-7 | Org nascida pelo trafeGO recebe `appScope = "trafego"`: sidebar e tela inicial restritas ao app. |
| RF-8 | No painel, o cliente envia criativos (imagem/vídeo), cadastra e seleciona copies, e preenche o briefing, respeitando `maxCreatives`/`maxCopies` do plano. |
| RF-9 | Botão "Ativar campanha" só habilita com ≥1 criativo, ≥1 copy selecionada e briefing mínimo; a transição é atômica e imune a clique duplo. |
| RF-10 | Timeline de andamento visível ao cliente, alimentada por eventos append-only, com notas internas da equipe ocultas. |
| RF-11 | Painel interno em `/admin/trafego`: fila de pedidos, troca de status, atribuição de responsável, revisão de criativo e vínculo com a execução real. |
| RF-12 | Desempenho: KPIs reais do Meta (`MetaAdsKpiSnapshot`) quando a campanha estiver vinculada; contadores do `Broadcast` para WhatsApp; só timeline quando não houver vínculo. |
| RF-13 | Thread de suporte por pedido, com anexo, entre cliente e equipe. |
| RF-14 | A venda registra receita no financeiro (`PaymentEntry`) e lead no CRM, sem bloquear o resgate se falhar. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Nenhuma cobrança duplicada nem pedido duplicado, mesmo com reentrega de webhook, retry de rede ou duplo clique. Três camadas: `ProcessedStripeEvent`, claim atômico por status, `TrafegoOrder.pendingPurchaseId @unique`. |
| RNF-2 | `prisma.$transaction` contém **apenas** escritas de banco. E-mail, Inngest, PostHog, `logActivity` e side-effects de CRM/financeiro ficam fora, best-effort (CLAUDE.md regra 18). |
| RNF-3 | Toda chamada oRPC client-side vive num hook em `src/features/trafego/hooks/` (CLAUDE.md regra 9). |
| RNF-4 | A procedure de desempenho valida `order.organizationId === context.org.id` **antes** de usar `metricsOrganizationId`; sem isso o campo vira vazamento cross-org. |
| RNF-5 | Upload de criativo tenta presigned e cai para `upload-direct` — o bucket R2 não tem CORS configurado. |
| RNF-6 | Falha em qualquer side-effect pós-commit não invalida um pagamento já confirmado. |
| RNF-7 | O preço **nunca** vem do browser: o checkout recebe a verba e a resposta sobre a BM, e recalcula taxa e setup pela tabela no servidor. |
| RNF-8 | O webhook é **fail-closed**: sem `STRIPE_TRAFEGO_WEBHOOK_SECRET` responde 500 e não processa. Nunca valida com o secret compartilhado de outro produto. |
| RNF-9 | A verba é limitada a R$ 500.000 no Zod e por `clampAdBudget`, garantindo que o total caiba no `Int` do Postgres. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um visitante anônimo em `/trafego`, quando completa o wizard e envia o
      e-mail, então é redirecionado ao Stripe Checkout com os itens da cotação (verba, taxa e,
      se houver, setup) cuja soma é igual a `TrafegoPendingPurchase.amountBrlCents`.
- [ ] **CA-1a** — Dada verba de R$ 1.000 e cliente sem BM, quando simula, então taxa = 40%
      (R$ 400), setup = R$ 450 e total = R$ 1.850.
- [ ] **CA-1b** — Dada verba de R$ 5.000, quando simula, então taxa = 30% e o setup aparece
      como "Grátis", independentemente da resposta sobre a BM.
- [ ] **CA-1c** — Dado um body de checkout com valor de taxa adulterado, quando o servidor
      processa, então o valor é ignorado e a cotação é recalculada pela tabela.
- [ ] **CA-1d** — Dada verba abaixo de R$ 300, quando simula, então o piso de R$ 300 é aplicado
      e o cliente é avisado.
- [ ] **CA-1e** — Dada verba acima de R$ 500.000, quando simula, então o teto é aplicado e o
      cliente é orientado a falar com um gestor; e um POST direto ao checkout com valor acima do
      teto é recusado com 422, sem criar pending nem chamar o Stripe.
- [ ] **CA-16** — Dado `STRIPE_TRAFEGO_WEBHOOK_SECRET` ausente, quando um evento chega em
      `/api/trafego/webhook`, então a resposta é 500 e nada é processado — nunca uma validação
      com o secret de outro produto.
- [ ] **CA-17** — Dado um payload assinado com `STRIPE_WEBHOOK_SECRET` (secret de outro produto),
      quando chega ao webhook do trafeGO, então é recusado.
- [ ] **CA-18** — Dado um erro no processamento de um evento, quando o handler falha, então o
      registro em `ProcessedStripeEvent` é removido e o Stripe consegue reentregar.
- [ ] **CA-2** — Dado um `TrafegoPendingPurchase` PENDING criado há menos de 30 min com mesmo
      `(email, planId, objective)`, quando o visitante repete o checkout, então a mesma sessão
      Stripe é reaproveitada e nenhuma pending nova é criada.
- [ ] **CA-3** — Dado o mesmo evento Stripe entregue duas vezes, quando o webhook processa,
      então o segundo é descartado por `ProcessedStripeEvent` e nenhum `signupToken` é regerado.
- [ ] **CA-4** — Dado `checkout.session.completed` com `payment_status: "unpaid"`, quando o
      webhook processa, então a pending permanece PENDING e a confirmação só ocorre no
      `payment_intent.succeeded` seguinte.
- [ ] **CA-5** — Dado um `signupToken` válido, quando o comprador cria a senha, então existem
      exatamente um `Organization` com `appScope="trafego"`, um `Member(owner)`, um
      `TrafegoOrder` com `pendingPurchaseId` preenchido, e a pending fica `REDEEMED`.
- [ ] **CA-6** — Dado o mesmo `signupToken` resgatado duas vezes em paralelo, quando as duas
      execuções rodam, então uma vence, a outra recebe `CONFLICT`, e existe **um** `TrafegoOrder`.
- [ ] **CA-7** — Dado um usuário que **já possui** organização, quando resgata, então nenhuma
      org nova é criada, `appScope` não é alterado e o pedido nasce na org existente.
- [ ] **CA-8** — Dado um cliente logado com `appScope="trafego"`, quando abre `/home` ou navega
      para `/tracking`, então é levado a `/trafego/painel` e a sidebar lista apenas trafeGO.
- [ ] **CA-9** — Dado um pedido sem criativo ou sem copy selecionada, quando o cliente tenta
      ativar, então a ação é recusada e o estado não muda.
- [ ] **CA-10** — Dado um pedido pronto, quando "Ativar" é clicado duas vezes em sequência,
      então há uma única transição para `REQUESTED`, um `requestedAt` e um evento Inngest.
- [ ] **CA-11** — Dado um pedido sem `metaCampaignExternalId`, quando o cliente abre Desempenho,
      então recebe `hasMetrics: false` com `reason: "not_linked"` e vê apenas a timeline.
- [ ] **CA-12** — Dado um pedido vinculado com snapshots no período, quando o cliente abre
      Desempenho, então os KPIs vêm de `MetaAdsKpiSnapshot` filtrado por `metricsOrganizationId`
      e `entityId = metaCampaignExternalId`.
- [ ] **CA-13** — Dado um usuário de outra organização, quando pede o desempenho de um pedido
      alheio, então recebe erro de autorização e nenhum dado é retornado.
- [ ] **CA-14** — Dado `amount_total` divergente do esperado (cupom, ajuste), quando o webhook
      confirma, então o valor recebido é gravado, `amountMismatch = true`, e a verba **não** é
      reescalada silenciosamente.
- [ ] **CA-15** — Dado que o registro de `PaymentEntry` ou do Lead falha, quando o resgate roda,
      então a conta e o pedido são criados normalmente e o erro apenas é logado.

## 5. Casos de borda

Enumerados **antes** do código, como o `specs/README.md` cobra.

| ID | Situação | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Pagou e nunca resgatou | Pending fica PAID; cron de recuperação avisa; link vale 7 dias |
| CB-2 | Token expirado | Tela de expirado com caminho para o suporte; status vira EXPIRED |
| CB-3 | Resgate logado com outro e-mail | Bloqueia com `FORBIDDEN` e instrui a sair da conta |
| CB-4 | Resgate concorrente (duas abas) | Claim atômico; a segunda recebe `CONFLICT` |
| CB-5 | Usuário já tem organização | Reusa a org mais antiga; **não** aplica `appScope` |
| CB-6 | Plano desativado entre compra e resgate | Resgate prossegue — o pedido usa o snapshot, não o catálogo |
| CB-6a | Tabela de faixas muda entre compra e resgate | O pedido preserva `serviceFeePercent` e `setupFeeBrlCents` do momento da compra |
| CB-6b | Cliente responde "não sei" sobre a BM | Tratado como quem não tem: cobra setup. Se a conta existir, a equipe estorna |
| CB-6c | Verba exatamente no limite da faixa (R$ 500, R$ 1.000…) | Vale a faixa de baixo; o simulador mostra quanto falta e quanto se economiza subindo |
| CB-7 | Plano deletado entre compra e resgate | `planId` do pedido vira null (`SetNull`); snapshots preservam o vendido |
| CB-8 | `payment_intent.succeeded` antes de `checkout.session.completed` | Qualquer um confirma; o segundo vira no-op pelo claim |
| CB-9 | Cliente `appScope="trafego"` acessa `/tracking` por URL | Redirecionado ao painel; **as procedures seguem alcançáveis** (não-objetivo declarado) |
| CB-10 | Refund total após a campanha no ar | Pedido vira `REFUNDED` + evento + aviso à equipe; criativos preservados |
| CB-11 | Campanha vinculada mas sem snapshot ainda | `hasMetrics: false` com `reason: "no_data_yet"` |
| CB-12 | Org da agência sem `config.adAccountId` | O cron pula a org em silêncio e não há KPI — validar antes de prometer métrica |
| CB-13 | Upload presigned bloqueado por CORS | Cai em `upload-direct` sem erro visível ao cliente |
| CB-14 | Stripe falha ao criar a sessão | Pending marcada `CANCELLED`; erro claro na tela |
| CB-15 | Verba digitada acima do teto ou `NaN` | `clampAdBudget` prende entre piso e teto; o checkout recusa valor acima do teto |
| CB-16 | Secret do webhook ausente em produção | 500 fail-closed; nenhuma compra é confirmada até configurar |

## 6. Modelo de dados

Models novos: `TrafegoPlan`, `TrafegoPendingPurchase`, `TrafegoOrder`, `TrafegoOrderEvent`,
`TrafegoCreative`, `TrafegoCopy`, `TrafegoSupportMessage`, `TrafegoSettings`.
Campo novo: `Organization.appScope`.

Decisões que merecem registro:

- **`TrafegoOrder`, não `TrafegoCampaign`.** "Campanha" já nomeia três coisas no projeto
  (`Broadcast`, `MetaAdCampaign`, `NasaCampaignPlanner`).
- **Timeline como eventos append-only** (`TrafegoOrderEvent`), não uma coluna `*At` por
  estágio como em `ClientOnboardingProcess`. O fluxo do trafeGO tem voltas
  (`CHANGES_REQUESTED → MATERIALS_SUBMITTED → REQUESTED`) e coluna por estágio perderia a
  segunda passagem.
- **Snapshot financeiro no pedido.** `adBudgetBrlCents`, `serviceFeeBrlCents` e
  `totalBrlCents` são copiados do plano no momento do resgate. Mudar o catálogo depois não
  reescreve o que foi vendido.
- **`metricsOrganizationId` no pedido.** `MetaAdsKpiSnapshot` é chaveado por `organizationId`
  da org que detém a `PlatformIntegration(META)` — a da agência, não a do cliente. Sem esse
  campo o dashboard do cliente volta vazio.
- **`position`, não `order`,** como campo de ordenação em `TrafegoCreative`/`TrafegoCopy`:
  `order` colidiria com a relação de mesmo nome.

## 7. Impacto em outros domínios

| Domínio | Impacto |
| --- | --- |
| `campanhas` | Nenhuma mudança. A equipe usa o app existente para disparar; o pedido só referencia `broadcastId`. |
| `meta-ads` | Nenhuma mudança de contrato. O trafeGO **lê** `MetaAdsKpiSnapshot` e referencia `MetaAdCampaign`. |
| `payment` | Recebe `PaymentEntry` novos (receita da taxa e repasse da verba). |
| `admin` | Item novo na sidebar e telas em `/admin/trafego`. |
| `apps` / sidebar | `SIDEBAR_NAV_ITEMS` e `apps-data` ganham o trafeGO; `nav-menu` passa a respeitar `appScope`. |
| `stars` | Nenhum. O trafeGO não usa Stars (sem welcome bonus, sem débito). |

## 8. Alternativas consideradas

- **Reusar `PendingCoursePurchase` com um campo de tipo** — descartado: o model é acoplado a
  curso (`courseId` obrigatório, `priceStars`, `redeemedEnrollmentId`) e é caminho de dinheiro
  em produção.
- **Adicionar um `case` no webhook de cursos** — descartado: o arquivo tem 581 linhas e já
  atende curso, topup legado, refund e dispute. Um throw no ramo trafeGO devolveria 500 para o
  endpoint inteiro e o Stripe reentregaria tudo, inclusive compras de curso. O projeto já
  separou `/api/stars/webhook` pelo mesmo motivo, declarado no cabeçalho do arquivo.
- **Estender `SupportTicket` com thread** — descartado: é one-way por design, sem
  `organizationId`, e atende todos os apps hoje. Thread própria por pedido não é padrão novo
  (`ActionChatMessage` já existe).
- **`Organization.metadata` para o escopo** — descartado: é campo gerenciado pelo plugin
  `organization` do better-auth, que serializa JSON nele.
- **Criar a campanha no Meta na ativação** — descartado para a v1: verba é dinheiro real em
  conta da agência.

## 9. Plano de implementação e rollback

Faseado; cada fase é entregável sozinha.

1. **Fase 1 — venda ponta a ponta.** Schema, catálogo admin, wizard público, checkout, webhook,
   ativação de conta, painel com timeline, fila interna.
2. **Fase 2 — materiais.** Criativos, copies, briefing, botão Ativar.
3. **Fase 3 — desempenho.** Vínculo de campanha e KPIs unificados.
4. **Fase 4 — suporte e retenção.** Thread, notificações, recuperação de carrinho, recompra.

**Rollback:** os models são aditivos e não alteram tabela existente exceto por
`Organization.appScope` (nullable, default null). Desativar o produto = `isActive = false` em
todos os `TrafegoPlan` e remover a rota pública; nada no resto da plataforma depende do trafeGO.

## 10. Changelog

| Data | Mudança |
| --- | --- |
| 2026-08-30 | Spec criada (rascunho → em-revisão). |
| 2026-09-12 | Webhook fail-closed (RNF-8), teto de verba (RNF-9) e dedupe compartilhado entre os três webhooks Stripe. Verificado que o Stripe já cobra valor avulso e que o trafeGO já usa a mesma integração das Stars — nenhuma migração necessária. |
| 2026-09-11 | Planos fixos dão lugar ao simulador por faixa (RF-2). Entram pergunta sobre BM com taxa de setup (RF-2a), carrossel de marcas (RF-2b) e contato com gestor (RF-2c). Checkout passa a ter até três itens. |
