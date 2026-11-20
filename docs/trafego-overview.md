# trafeGO — self-service de tráfego pago e campanhas

> Documento de referência do domínio `trafego`. Status: **venda (0008) implementada ·
> operação, PIX, chat, políticas, KPIs e inteligência (0009, Fases A–D) implementadas em
> 2026-09-12/13 · Fase E, PIX pelo Asaas e captura de lead em 2026-09 · pedido avulso e correções
> de pagamento em 2026-10 · Desempenho pela conta do cliente e "Corrigir valores" (0122),
> cobrança só do serviço com complemento (0123) e campanha de WhatsApp pelo painel (0124) em
> 2026-10-30 · migration da 0123 (`20261030200000_trafego_service_only_billing`) aplicada no banco de desenvolvimento em 2026-10-30 (produção aplica no boot do container) ·
> demais migrations do domínio aplicadas (conferido em clone de 2026-10-21)**.
> Specs: [`0008`](../specs/trafego/0008-trafego-self-service.md) (venda) ·
> [`0009`](../specs/trafego/0009-trafego-operacao-inteligencia.md) (operação, PIX, Astro, políticas,
> Release, KPIs) · [`0010`](../specs/trafego/0010-trafego-checkout-cupom.md) (cupom) ·
> [`0021`](../specs/trafego/0021-trafego-captura-lead-e-notificacao-admin.md) (captura de lead) ·
> [`0022`](../specs/trafego/0022-trafego-pix-asaas.md) (PIX Asaas) ·
> [`0116`](../specs/trafego/0116-trafego-pedido-avulso.md) (pedido avulso) ·
> [`0122`](../specs/trafego/0122-trafego-base-meta-e-desempenho.md) (base Meta, Desempenho real, Corrigir valores) ·
> [`0123`](../specs/trafego/0123-trafego-cobranca-so-do-servico.md) (cobrança só do serviço, complemento, wizard da org logada) ·
> [`0124`](../specs/trafego/0124-trafego-campanha-pelo-painel.md) (owner/admin cria e publica pelo painel). Backlog:
> [`trafego-correcoes-pendentes.md`](trafego-correcoes-pendentes.md). Playbook do gestor: [`trafego-playbook-gestor.md`](trafego-playbook-gestor.md).
>
> **Regra de manutenção**: ao mexer em `src/features/trafego/`, `src/app/router/trafego/`,
> `src/app/(public)/trafego/`, `src/app/(platform)/(tracking)/trafego/`,
> `src/app/(admin)/admin/trafego/`, nos endpoints `/api/checkout/trafego` e
> `/api/trafego/webhook`, ou nos modelos `Trafego*` do schema, **atualize este documento na
> mesma sessão**. Espelha as regras 10 (NASA Route), 14 (WhatsApp Oficial) e 19 (arquitetura).

---

## 1. O que é

Produto self-service para PMEs contratarem tráfego pago sem passar por agência. O cliente
percorre sozinho: escolhe o canal, o tipo de campanha, o objetivo e a verba, paga, cria a conta,
envia criativos e copy, e clica em "Ativar". A equipe NASA executa (Claude Code + MCP da Meta) e o
status anda num **tracking de operação** — cada card é um cliente, cada coluna uma fase. O cliente
acompanha pelo painel e é avisado por WhatsApp e e-mail a cada mudança.

**Modelo de cobrança (spec 0123, pedidos novos)**: a **verba** é paga pelo cliente direto à Meta,
no cartão da conta de anúncios dele. A Órbita cobra **só o serviço**: 30% da verba declarada, com
**mínimo de R$ 150**, mais setup (se não tem conta) e criativos extras. A verba declarada continua
entre R$ 300 e R$ 500.000 e serve de base da taxa. Setup por faixa de verba:

| Verba declarada | Setup da BM |
| --- | --- |
| R$ 300 a R$ 500 | R$ 500 |
| R$ 501 a R$ 1.000 | R$ 450 |
| R$ 1.001 a R$ 2.500 | R$ 400 |
| Acima de R$ 2.500 | Grátis |

**Complemento**: se o gasto real da conta no período do pedido passar da verba declarada, a taxa
acompanha: `devido = max(30% × gasto, R$ 150)` menos o já cobrado. A partir de R$ 30 nasce um
lançamento a receber `TG-NNNN-Cn` na org da agência, como **rascunho** (sem régua). A equipe envia
pelo cartão "Complementos" do admin, que atribui a régua padrão das Cobranças (spec 0115).
Complemento **enviado e vencido** trava a criação e a publicação de campanha pelo painel.

O pedido guarda o modelo em `adBudgetPaidToMeta`. Pedidos e pendências anteriores à 0123 ficam
`false` e seguem o modelo antigo (verba + taxa por faixa de 50% a 25%, verba como repasse a pagar).

O **setup da BM** é cobrado uma única vez, apenas de quem ainda não tem conta de anúncios. Cobre a
criação da BM, da página do Facebook e a correção de problemas na conta. Produção de criativo é
serviço à parte. As três parcelas aparecem separadas: na landing, no Stripe e no e-mail.

**Criativos extras (Fase E)**: o pedido inclui `TrafegoSettings.includedCreatives` criativos (padrão
3). Quem quer mais escolhe no wizard (`desiredCreativeCount`) e paga
`extraCreativeBrlCents` por criativo adicional, como quarta parcela no Stripe. O pedido não tem
coluna própria para isso: no financeiro, extras = total − taxa − setup (− verba, só no modelo
antigo), e entram como receita junto da taxa. Quem já tem perfil pronto pode mandar o link (`materialsProfileLink`) em vez
dos arquivos.

**Cupom (spec 0010)**: aceito no Stripe (`allow_promotion_codes`). O desconto **não** é gravado no
banco: é lido do Stripe na hora de lançar o financeiro (`stripe-discount.ts`) e distribuído por
`allocateTrafegoDiscount` na ordem taxa → setup → extras → verba (no modelo novo a verba não é
cobrada, então o cupom nunca chega nela). Cupom que chega na verba gera
evento interno e aviso aos admins. Se o Stripe não responder, nada é lançado e a equipe é avisada.

A tabela vive em `src/features/trafego/lib/pricing-tiers.ts` e é a fonte de verdade. O servidor
**sempre recalcula** a cotação no checkout. A verba é limitada entre **R$ 300 e R$ 500.000**.

## 2. Decisões travadas

| Decisão | Escolha | Porquê |
| --- | --- | --- |
| Catálogo | Meta Ads + Google Ads + WhatsApp API Oficial | Google entra como pedido executado pela equipe |
| Cobrança | Pagamento único: cartão pelo Stripe Checkout, PIX pelo Asaas (spec 0022) | Reusa o eixo `PendingCoursePurchase`. O PIX manual continua como fallback quando o gateway está desligado |
| Preço | **Só o serviço**: 30% da verba declarada, mínimo R$ 150; verba paga direto à Meta — spec 0123 | A verba nunca passa pela Órbita; o setup segue por faixa |
| Complemento | Gasto real da **conta toda** no período, com exclusão manual de campanhas; nasce rascunho; só enviado e vencido trava — 0123 D-2, D-4, D-5 | Contar só o código no nome deixaria escapar por outra campanha |
| Execução | Equipe via Claude Code + MCP **e**, desde a 0124, o **owner/admin pelo painel** (campanha de WhatsApp, tudo pausado até publicar) — revoga a D-1 das 0008/0009/0010 | Travas: pausado, confirmação com valor, conta da org do pedido, complemento vencido bloqueia |
| Mesa de operação | **Tracking** (não Workspace) — spec 0009 D-1 | Instância de WhatsApp e formulário se prendem ao lead/tracking |
| Fonte de verdade do status | **O pedido**; o card é espelho — D-2 | O pedido carrega `startedAt/endsAt` e consequências contratuais |
| Card por cliente | `TrafegoOrder.leadId` **não** único — D-3 | Cliente recorrente tem N pedidos no mesmo card |
| Fase inicial do pedido | `ACCOUNT_REVIEW` para todo pedido — D-6 | Conta restrita é pega antes de gastar verba |
| Financeiro | Receita = taxa + setup + extras; verba = conta a pagar **só no modelo antigo** — D-5, 0123 RF-6 | Somar inflaria faturamento; no modelo novo a verba não passa pela Órbita |
| Conta do cliente | Organization própria com `appScope="trafego"` | Reusa auth/org/permissões |
| Nome do pedido | `TrafegoOrder`, nunca "campanha" | "Campanha" já nomeia `Broadcast`, `MetaAdCampaign` e `NasaCampaignPlanner` |
| Timeline | Eventos append-only com `source` | O fluxo tem voltas; a origem diz quem mexeu |
| Webhook | Endpoint próprio, fail-closed no secret | Um throw derruba o endpoint inteiro |
| Números do Desempenho | Integração Meta dos **Satélites da org do pedido** (token manual); sem ela, modo antigo pela agência — spec 0122 D-1 | Tudo vem dos Satélites; o token da agência leria a conta de qualquer cliente |
| Token do usuário do sistema da Órbita | Integração marcada "gerenciada pela Órbita": só admin do sistema edita — 0122 D-2 | Esse token enxerga todos os clientes; o owner trocaria o número da conta e leria outro |

### Não-objetivos declarados

Publicação sem confirmação de uma pessoa · objetivos além de mensagens no WhatsApp pelo painel · senha de redes sociais (acesso é por parceiro na BM) · PIX
por gateway · RAG das políticas (base curada em código) · raspagem de Instagram/Facebook.

## 3. Fluxo ponta a ponta (estado atual — Fase A da 0009)

```
/trafego (público, sem auth)
  wizard: canal → tipo → objetivo → seu negócio → investimento → contato + termos
     Meta Ads:  @ do Instagram/página → Graph API (Business Discovery) → preview em mockup
     WhatsApp:  já tem número na API Oficial? → checagem do número · senão, setup + aquecimento
     Contato:   telefone OBRIGATÓRIO, verificado por código de 6 dígitos (fail-open)
  └─ POST /api/checkout/trafego
       cria TrafegoPendingPurchase (PENDING) + Stripe Session (até 3 line_items)
       ➜ card do lead em "Aguardando pagamento" (tracking de operação, telefone normalizado
         como o wa_id do inbound) + resposta "Briefing TrafeGO" no card
  └─ Stripe Checkout → /trafego/sucesso?token=<pendingId> (polling)

POST /api/trafego/webhook   [STRIPE_TRAFEGO_WEBHOOK_SECRET]
  dedupe por event.id · claim atômico PENDING → PAID
  gera signupToken (7 dias) → Inngest `trafego/purchase.paid`
     → e-mail + WhatsApp (template `trafego_ativacao`) com o link · card → "Pagamento confirmado"

/trafego/ativar/<signupToken>
  signUp → trafego.redeemPurchase → $transaction: Organization + Member + TrafegoOrder(ACCOUNT_REVIEW)
  fora da tx (`runTrafegoOrderPostCreation`, igual para público / autenticado / PIX):
     card herda o lead e ganha o apelido TG-NNNN · Briefing rotulado · PaymentEntry (taxa+setup
     PAGA na conta/categoria configuradas; verba A PAGAR) · card → "Análise da conta de tráfego"
     · aviso ao cliente (pedido de acesso de parceiro com o Business ID)

Operação
  gestor arrasta o card ─┐                     ┌─ admin muda status em /admin/trafego
                         ▼                     ▼
             eventBus lead.status_changed   transitionTrafegoOrder(source)
                         └── kanban-subscriber ──┘  (uma função só; sem loop — D-9)
       → TrafegoOrderEvent{source} → card movido (exceto KANBAN) → Inngest
         `trafego/order.status-changed` → e-mail + WhatsApp (template `trafego_status`)
  materiais: ≥1 criativo + ≥1 copy selecionada → MATERIALS_SUBMITTED sozinho
  "Ativar" → REQUESTED (claim) → `trafego/order.requested` → notifica a equipe
  cron horário `trafego-kanban-drift-sweep`: card fora da coluna → realinha (pedido é autoridade)

Pedido avulso (spec 0116) — cliente que pagou fora da landing
  /admin/trafego → "Pedido avulso" → trafego.admin.orders.createManual (só admin do sistema)
  $transaction: TrafegoOrder(ACCOUNT_REVIEW) sem pendingPurchaseId, eventos com source=ADMIN
     ("Pagamento registrado pela equipe"), dono = membro owner → admin → mais antigo da org
  fora da tx: o mesmo `runTrafegoOrderPostCreation`; financeiro opcional (skipFinance)
  meio de pagamento: PIX ou Cartão, escolhido pela equipe (sem enum novo)
```

Colunas do tracking (ordem): Aguardando pagamento · Pagamento confirmado · Análise da conta de
tráfego · Aguardando seus materiais · Materiais enviados · Na fila da equipe · Em análise · Agendada
· No ar · Concluída · Ajustes solicitados · Pausada. Cancelado/reembolsado = card perdido.
Arrastar para "Aguardando pagamento"/"Pagamento confirmado" nunca muda o pedido.

## 4. Modelo de dados

| Model | Papel |
| --- | --- |
| `TrafegoPlan` | Catálogo legado de planos fixos (ofertas pontuais) |
| `TrafegoPendingPurchase` | Compra antes de existir conta. `leadId` (card) e `briefingResponseId` nascem aqui; guarda as verificações do wizard (`phoneVerifiedAt`, `socialHandle`/`socialProfile`, `hasOfficialNumber`/`officialNumber`/`officialNumberCheck`) |
| `TrafegoOrder` | A campanha contratada. Snapshot de catálogo, preço e das verificações do wizard. `leadId` (não único), `materialsSubmittedAt` |
| `TrafegoOrderEvent` | Timeline append-only; `isClientVisible`, `source` (KANBAN/ADMIN/CLIENT/SYSTEM), `clientNotifiedAt` |
| `TrafegoCreative` / `TrafegoCopy` | Materiais; `isSelected` marca o que veicula |
| `TrafegoSupportMessage` | Thread de suporte por pedido |
| `TrafegoSettings` | Singleton: org da agência, **tracking de operação + `statusColumnMap`**, formulário de briefing, Business ID, templates de WhatsApp, toggle de avisos, conta/categorias do financeiro |

`TrafegoOrderStatus`: PAID → **ACCOUNT_REVIEW** → ONBOARDING → MATERIALS_SUBMITTED → REQUESTED →
IN_REVIEW → SCHEDULED → RUNNING → COMPLETED, com CHANGES_REQUESTED, PAUSED, CANCELLED, REFUNDED.
Cliente edita materiais em ACCOUNT_REVIEW/ONBOARDING/MATERIALS_SUBMITTED/CHANGES_REQUESTED; só ativa
a partir de ONBOARDING (ativar antes pularia a análise da conta).

### Sincronização card ↔ pedido

- **Kanban → pedido**: `leads.updateNewOrder`, `leads.updateManyStatus` e `leads.update` publicam
  `lead.status_changed` (agora com `actorUserId`); `registerTrafegoSubscribers()` (instrumentation)
  resolve o pedido corrente do lead e chama `transitionTrafegoOrder(source: "KANBAN")`.
- **Pedido → kanban**: `transitionTrafegoOrder` move o card por `prisma.lead.update` direto,
  dentro da transação, sem publicar no bus. Coluna sem mapa → evento interno, pedido intacto.
- **Divergência** (workflow/Astro movendo card): cron horário realinha; se o card mudou depois do
  pedido, notifica admins em vez de adivinhar.

### Aceite dos termos

`acceptedTermsAt` / `acceptedTermsVersion` (versão em `src/features/trafego/lib/legal.ts`).

### Dois pontos que causam bug silencioso

1. **`metricsOrganizationId`** — no modo antigo, os snapshots do Meta são da org da **agência**;
   sem ele o painel volta vazio. Com a integração Meta na org do pedido (spec 0122), o Desempenho
   ignora esse campo e lê a conta do cliente ao vivo, com cache de 15 min.
2. **Telefone** — `Lead.phone` precisa ser igual ao `wa_id` do inbound (`normalizeWhatsappPhoneBr`
   → `normalizePhoneToMetaE164`); senão o comprovante cria um segundo card.
3. **Verificações são fail-open** — sem instância Uazapi ou sem integração Meta na agência,
   `getPublicConfig.verification` devolve `false`, os botões somem e o wizard segue. Nunca
   bloqueiam a venda: o que não foi confirmado vira aviso no Briefing do card.

## 5. Arquivos

```
specs/trafego/0008-*.md · 0009-*.md              specs (venda · operação)
specs/trafego/0116-trafego-pedido-avulso.md     pedido criado pela equipe
docs/trafego-playbook-gestor.md                  operação coluna a coluna + Claude Code/MCP

src/features/trafego/
├── lib/          pricing · pricing-tiers · order-status (ACCOUNT_REVIEW, TERMINAL…)
│                 kanban-columns (colunas + mapa) · phone · urls · client-notifications
│                 briefing-form-spec · catalog-labels · legal · preview-fixtures
│                 social-profile (normalização do @ + shape do perfil)
│                 ad-policies/ (fontes · regras · prescreen) · timeline · pix
│                 campaign-code (TG-NNNN) · release (fontes + checklist de acessos)
│                 recommendation-rules (verba/dia mínima, formato por objetivo)
├── schema/       trafego-schemas.ts
├── hooks/        use-trafego-plans · -purchase · -orders · -support · -admin
│                 -release (fontes, geração, salvar, acessos) · -recommendations
├── server/lib/   transition-order (ÚNICO caminho de status) · lead-card · kanban-subscriber
│                 ensure-trafego-lead · briefing-form-response · materials-submitted
│                 send-client-whatsapp · create-order-and-side-effects · sale-side-effects
│                 trafego-settings (cache 30 s) · provision-operations-tracking
│                 provision-briefing-form · create-order-from-purchase · begin-trafego-activation
│                 phone-verification (OTP) · whatsapp-number-check · social-profile-lookup
│                 mark-purchase-paid (Stripe e PIX) · compliance-check · create-manual-order
                 auto-link-meta-campaigns (TG-NNNN → campanha) · live-meta-insights (cache 15 min)
                 recommendations (regras decidem, modelo redige) · suggest-copies
                 astro-tools (escopo trafeGO do Astro no painel)
                 release/ (fetch-site · extract-pdf · draft-release)
└── components/
    ├── public/   trafego-landing (wizard) · hero-claims (animação) · investment-simulator
    │              business-manager-step · wizard/ (social-account-step · social-profile-mockup
    │              official-number-step · phone-verification) …
    ├── panel/    orders-list · order-detail · support-whatsapp-fab · status-timeline
    │              next-steps-card · release-editor · access-checklist
    │              copy-compliance-badge · performance-view (frescor do dado) …
    └── preview/  preview-provider (cache pré-populado, sem rede)

src/app/router/trafego/       public/ (+ verification: startPhone, confirmPhone,
                              checkWhatsappNumber, lookupSocialProfile) · painel
                              release (get/addSource/removeSource/generate/save)
                              recommendations · accessChecklist · copies.suggest
                              admin/ (plans, orders + unlinkMetaCampaign,
                              settings + listAgencyOptions + provision*)
src/lib/rate-limit.ts         limitador por IP compartilhado (chat público e verificações)
src/http/meta/graph-client.ts cliente Graph dos anúncios (v25, erro tipado, paginação) — spec 0122
src/http/meta/ads-account.ts  conta, token, páginas e WhatsApp para o "Testar conexão"
src/features/trafego/server/lib/meta/  order-meta-access (conta da org do pedido) · order-meta-performance
                              (visão da conta, campanhas, públicos, verba usada) · meta-read-cache (15 min)
src/features/trafego/lib/     order-meta-metrics (período, campanha do pedido, KPIs) · order-values
                              (nome do plano, regras do "Corrigir valores")
src/app/router/trafego/       performance (budget · overview · breakdown) · admin/correct-values
src/features/integrations/lib/ meta-connection-check · meta-integration-access (quem mexe na integração)
src/features/trafego/lib/complement.ts  regras do complemento (janela, devido, número TG-NNNN-Cn, trava) — 0123
src/features/trafego/server/lib/service-fee-complement.ts  cálculo diário (passo no fim de sync-meta-ads-kpis),
                              trava da org, complementos do pedido
src/app/router/trafego/admin/complements.ts  complements.{list,send,cancel} · setOutsideCampaigns
src/features/admin/components/trafego/complements-card.tsx  cartão "Complementos" do admin
src/features/trafego/components/panel/  service-fee-section ("Taxa sobre o gasto real") · billing-lock-banner
src/http/meta/ads-builder.ts  escrita do construtor (criar/atualizar objeto, cidade, posts do IG, imagem, árvore) — 0124
src/features/trafego/lib/campaign-builder/  build-meta-payloads (fonte única dos campos) · builder-rules
src/features/trafego/server/lib/campaign-builder/  builder-access (guarda) · builder-context (leituras)
                              builder-actions (rascunho, publicar) · builder-edits (pausar, verba, fim, público, anúncio)
src/app/router/trafego/campaign-builder.ts  campaignBuilder.{access,context,suggest,searchCities,
                              listInstagramPosts,createDraft,publish,discardDraft,update,replaceAd}
src/features/trafego/components/panel/campaign-builder/  aba "Publicar" (wizard, lista, edição)
src/features/trafego/server/lib/astro-meta-tools.ts  Astro do painel com a Meta pelo MCP oficial (spec 0125):
                              números das campanhas do pedido e propostas de pausar, retomar e verba
src/http/meta/ads-mcp-client.ts · src/features/astro-meta-ads/  cliente e guardas do MCP oficial da Meta
src/app/api/checkout/trafego/ checkout público (cria o card e o briefing)
src/app/api/trafego/webhook/  webhook dedicado
src/app/api/trafego/assistant/ chat público (OpenAI, ferramentas de leitura)
src/inngest/functions/trafego/ purchase-paid · order-requested · order-status-changed
                               release-generate (lê fontes e redige o Release)
src/inngest/functions/crons/   trafego-kanban-drift-sweep · trafego-pix-pending-sweep
src/inngest/functions/trafego/  asaas-payment-event (webhook do Asaas, fora do request)
                               sync-meta-ads-structure (vincula TG-NNNN)
src/lib/email/                 trafego-purchase-confirmation · trafego-status-update
src/features/admin/components/trafego/ orders-table · order-detail · public-link-card
                                       create-manual-order-dialog (pedido avulso, spec 0116)
src/features/admin/components/trafego/settings/ ajustes em /admin/trafego/settings (7 seções)
src/features/admin/lib/trafego-settings-form.ts   estado do formulário de ajustes, fora da UI
instrumentation.ts             registra o subscriber do kanban
src/features/astro/server/orchestrator.ts  toolScope "trafego" (só as tools do pedido)
src/app/api/astro/chat/route.ts            isenta Stars quando appScope === "trafego"
```

## 6. Configuração necessária

| Item | Onde | Sem isso |
| --- | --- | --- |
| `STRIPE_TRAFEGO_WEBHOOK_SECRET` | `.env.local` + Stripe Dashboard | **Webhook responde 500** (fail-closed) |
| Org da agência | `/admin/trafego/planos` → Ajustes | Sem financeiro, sem métricas, sem opções nos selects |
| **Tracking de operação** | Ajustes → Operação → "Criar tracking TrafeGO" | Sem card; kanban não move pedido |
| **Formulário Briefing TrafeGO** | Ajustes → Briefing → "Criar formulário" | Card sem o ícone de formulário |
| **Instância WhatsApp** (META_CLOUD) no tracking de operação | app de tracking | Comprovante não cai no card; avisos só por e-mail |
| **Templates** `trafego_ativacao` / `trafego_status` (UTILITY, pt_BR) | Meta + Ajustes → Avisos | Fora da janela de 24 h o WhatsApp não sai |
| **Template** `trafego_codigo` (AUTENTICAÇÃO, pt_BR, 1 parâmetro) | Meta + Ajustes → Avisos | Verificação do WhatsApp no wizard não sai para quem nunca falou conosco |
| **Instância Uazapi** (org da agência ou tracking de operação) | app de tracking | Botão "Verificar" do número da API Oficial some |
| **Chave PIX** (+ titular, banco, validade) | Ajustes → PIX manual | Sem ela **e** sem gateway Asaas, a opção PIX não aparece no wizard |
| **Asaas** (`ASAAS_API_KEY`, `ASAAS_ENV`, `ASAAS_WEBHOOK_TOKEN`) | `.env` — **não** pelo `/admin/payments` | PIX cai no fluxo manual: chave estática e comprovante conferido à mão |
| `OPENAI_API_KEY` | `.env.local` + host | O chat da landing responde 503 |
| `ANTHROPIC_API_KEY` (ou integração ANTHROPIC na org da agência) | `.env.local` + host | A segunda camada da checagem de políticas não roda; fica só a determinística |
| **Integração Meta com página + IG Business** na org da agência | app de integrações | Preview da conta do cliente no wizard some |
| **Integração Meta (token manual) na org do cliente**, de preferência o token do usuário do sistema da Órbita com a conta e a página do cliente atribuídas, marcada "gerenciada pela Órbita" | Satélites da org do cliente → Meta → "Testar conexão" | Desempenho no modo antigo: só a campanha vinculada, lida pela conta da agência |
| **Business ID** da Órbita | Ajustes → Agência | Pedido de acesso de parceiro sem o ID |
| **Régua de cobrança ativa** (de preferência marcada padrão) na org da agência | app Payment → Cobranças | "Enviar cobrança" do complemento recusa |
| Token da org do cliente com `ads_management`, `pages_manage_ads`, `pages_read_engagement`, `pages_show_list` e a página com **WhatsApp ligado** (+ tarefa de conteúdo para ler os posts) | Satélites → Meta → "Testar conexão" | A aba "Publicar" mostra o motivo e não deixa criar |
| **Conta + categorias** ("STRIPE", "Cliente TrafeGO", "Repasse verba") | app Payment na org da agência + Ajustes → Financeiro | Lançamentos sem conta/categoria |
| Participantes do tracking | app de tracking | Gestor não vê os cards |

Migration da Fase A: `prisma/migrations/20260912150000_trafego_operacao_kanban` (aditiva). Depois
de aplicar: `pnpm db:generate`, bump de `SCHEMA_VERSION` (em `src/lib/prisma.ts`) e o ritual da
regra 11.

### Por que o webhook é fail-closed

Sem `STRIPE_TRAFEGO_WEBHOOK_SECRET` o endpoint responde 500 e não processa nada — validar evento de
trafeGO com o secret do better-auth aceitaria evento de outro produto. Mesmo guard do
`/api/stars/webhook`. Dedupe via `claimStripeEvent`/`releaseStripeEvent` (`src/lib/stripe.ts`).

## 7. Roadmap

| Fase | Escopo | Status |
| --- | --- | --- |
| 0008-1..3 | Venda ponta a ponta, materiais, desempenho | ✅ |
| 0008-4 | Suporte: thread ✅ · notificação da equipe ✅ · recuperação de carrinho ⬜ (E-3, decisão pendente) | 🚧 |
| **0009-A** | Tracking de operação, card ↔ pedido, briefing no card, avisos WhatsApp + e-mail, financeiro com conta/categoria, `ACCOUNT_REVIEW`, materiais automáticos, Google Ads no checkout | ✅ código · ✅ migration · config: conferir |
| **0009-B4** | Chat público do Astro na landing: ferramentas só de leitura (simular preço, checar política, estimar início, contato), limite por IP, sem persistir conversa | ✅ código |
| **0009-B3** | Políticas de publicidade (base curada + prescreen determinístico + checagem por modelo) e prazo realista em dias úteis reconhecido antes do pagamento | ✅ |
| **0009-B2** | PIX manual: escolha no passo Contato, chave + referência `TGP-xxxx`, comprovante pelo WhatsApp, "Confirmar PIX" na aba trafeGO do card do lead, cron de validade, caminho único de confirmação com o Stripe | ✅ código · ✅ migration · config: conferir |
| **0009-B1** | Verificações do wizard: WhatsApp por código, conta do Instagram/Facebook com preview em mockup, número na API Oficial com aquecimento explicado; hero animado em 6 passos; telefone obrigatório | ✅ código · ✅ migration · config: conferir |
| 0009-B | Completa | ✅ |
| **0009-C** | Vínculo automático da campanha por nome (`TG-NNNN`) no cron da estrutura Meta, leitura ao vivo dos KPIs com cache de 15 min e selo de frescor no painel | ✅ |
| **0009-D** | Astro no painel com escopo `trafego` e isento de Stars, Release montado a partir de site/PDF, recomendações por regras duras, copies sugeridas com selo de política, checklist de acessos | ✅ |
| **0009-E** | Criativos extras cobrados no checkout, link de perfil no lugar dos arquivos, limite de criativos incluídos configurável | ✅ |
| **0021** | Captura do lead no passo Contato do wizard e aviso aos admins | ✅ |
| **0116** | Pedido avulso criado pela equipe para quem pagou fora da landing | ✅ |
| **0010-B** | Cupom no financeiro e no `amountMismatch`, sem migration (desconto lido do Stripe) | ✅ |
| **0122** | Base Meta pelos Satélites, Desempenho pela conta do cliente, "Corrigir valores" | ✅ código |
| **0123** | Cobrança só do serviço, complemento pelo gasto real, trava e wizard da org logada | ✅ código · ✅ migration (dev) |
| **0124** | Owner/admin cria, publica e edita campanha de WhatsApp pelo painel | ✅ código · ⬜ teste real na conta |
| **0125** | Astro gerencia a conta pelo MCP oficial da Meta (sai o "MCP" de mentira); no painel, só as campanhas do pedido | ✅ código · ⬜ teste real (token com `ads_mcp_management`) |
| **0126** | Painel sem abas (anúncio, verba e CTR/CPC/CPM de cara), setup único de R$ 450 por empresa e criativo analisado pelo Astro no wizard e no painel | ✅ código · ⬜ migration `20261031120000` no dev · ⬜ teste no navegador |
| **0127** | Limite de anúncios **no ar ao mesmo tempo** por faixa de verba (até R$ 500 → 3, até R$ 2.000 → 5, acima → 8); troca livre; extra com valor fixo, liberado pela equipe no admin | ✅ código · ⬜ teste real de publicar com limite |
| **0128** | Nota de qualidade 0–100 por anúncio e conjunto (classificações da Meta + indicadores contra a média do mesmo objetivo), "Aprendendo"/"Dados insuficientes", popover nos indicadores vermelhos com correção e duplicação pelo Astro, taxa de conversa e origem no Órbita (mensagem inicial, funil, tags, leads) | ✅ código · ⬜ período de teste interno (`TRAFEGO_QUALITY_SCORE_PUBLIC`) · ⬜ teste de escrita na sandbox |
| **0129** | Passo a passo do `/trafego` guiado pelo criativo: com a Meta conectada começa pelo criativo; o Astro lê o criativo e os últimos 90 dias da conta (`server/lib/meta/account-context.ts`) e sugere tipo, objetivo, público, dois textos e verba; avisos por campo em regra fixa (`lib/wizard-guardrails.ts`) e lista de avisos abertos antes de pagar | ✅ código · ⬜ teste logado ponta a ponta com IA |
| **0130** | Botão "Gere com IA" (texto, título e mensagem inicial), guia das regras da Meta, região obrigatória, "Copiar prompt para o Claude" no admin e "Precisa de aprovação" no painel (recomendação = evento do histórico com aprovação) | ✅ código · ⬜ migration `20261102120000_trafego_approval_and_ai_token_scopes` em produção · ⬜ teste logado |
| **0131** | trafeGO no MCP do ÓRBITA para a equipe (chave da IA externa com escopo `trafego`, só admin do sistema): listar o que precisa de ação, ler o pedido, roteiro de publicação, números por anúncio, enviar recomendação, vincular campanha e nota interna | ✅ código · ⬜ migration `20261102120000_trafego_approval_and_ai_token_scopes` (junto com a da 0130) em produção · ⬜ teste com chave real |
| **0132** | O Claude avalia o pedido completo (rotina a cada 2 h pelo MCP do ÓRBITA), o cliente libera ("Aprovado, publicar" ou "Avaliar melhorias e aprovar") e o Claude publica pelo MCP da Meta, sem token no ÓRBITA. Status existentes + 4 colunas no pedido; avaliação = recomendação da 0130. Flag `TRAFEGO_CAMPAIGN_REVIEW` | ✅ código · ⬜ migration (junto com a da 0130/0131) em produção · ⬜ rotina ligada · ⬜ teste com pedido real |
| **0138** | "Toda a conta de anúncios" no painel (`/trafego/painel/conta`): todas as campanhas da conta da org, inclusive as criadas fora do trafeGO, com conjuntos e anúncios ao abrir | ✅ código · ⬜ teste com conta real |
| **0022** | PIX pelo Asaas: cobrança nominal com CPF/CNPJ na trilha PIX, QR na tela, webhook dedicado com `asaas-access-token` fail-closed e valor relido da API, confirmação pelo `markTrafegoPurchasePaid` | ✅ código · ✅ migration · config: conferir |

## 8. Changelog

| Data | Mudança |
| --- | --- |
| 2026-10-30 | **Spec 0125 — Astro com o MCP oficial da Meta**. O "MCP" de mentira (`src/lib/meta-mcp/client.ts` e `server-spawn.ts`, env `META_MCP_SERVER_CMD`) saiu, junto com as três ações de escrita que fingiam executar e cobravam Stars. O Astro usa o servidor oficial `https://mcp.facebook.com/ads` com o token dos Satélites e a conta da org sempre injetada pelo servidor; leitura direta, escrita só por cartão de confirmação, ativação mostra a verba, Stars só depois que a Meta confirma. "Testar conexão" diz se o Astro pode gerenciar (`ads_mcp_management` + conta liberada pela Meta). No painel do trafeGO o Astro lê as campanhas do pedido e propõe pausar, retomar e mudar a verba, com a guarda da aba Publicar. Sem migration, cron ou env nova. |
| 2026-10-31 | **Spec 0126 — painel enxuto, setup único e criativo com o Astro**. O detalhe do pedido perdeu as 7 abas: abre com a verba destinada × usada, os números somados e um cartão por anúncio (prévia, gasto, conversas, CTR, CPC, CPM), lidos com `level=ad` (`server/lib/meta/order-ads-performance.ts`, `trafego.performance.ads`). Andamento, "Sobre a empresa" (briefing + Release), "Mais números da conta", Suporte e "Publicar e editar" ficam em gavetas (`panel/order-panel-sheet.tsx`). Sem conta Meta conectada, um aviso só ("Nossa equipe está configurando…"). O cliente vê 4 estados (`ORDER_CLIENT_STATUS_LABEL`) e não "ativa" mais o pedido: saiu `trafego.activateOrder`. Acessos viraram tarefa da equipe no admin (`trafego.admin.orders.updateAccessChecklist`). Setup: R$ 450 uma vez por empresa (`TRAFEGO_SETUP_BRL_CENTS`, `server/lib/setup-fee.ts`); as faixas valem só no WhatsApp Oficial. Criativo: passo "Criativo" no wizard de quem já é cliente e cartão no painel antes de ir ao ar; o navegador tira até 4 quadros (`utils/creative-frames.ts`), o Astro (Claude Haiku com visão) dá nota, veredito e itens de política, técnico e força (`server/lib/creative-review.ts`, `trafego.creativeReview.analyze`, 5 Stars depois da resposta), e a análise fica em `TrafegoCreative.astroReview`. Migration aditiva `20261031120000_trafego_creative_astro_review`. Sem cron. |
| 2026-10-31 | **Spec 0127 — anúncios no ar ao mesmo tempo**. `maxCreatives` passa a ser o limite de anúncios rodando juntos nas campanhas do pedido (`lib/creative-limits.ts`), definido pela faixa de verba no checkout. Publicar e retomar pelo painel recusam quando passaria do limite (`assertRunningAdsLimit`); trocar anúncio não conta. Envio de arquivos vira teto técnico de 20. Admin: "Anúncios ao mesmo tempo" no pedido (`trafego.admin.orders.setRunningAdsLimit`). O campo "criativos incluídos" dos ajustes deixou de ser usado (coluna sai em migration separada). Sem migration. |
| 2026-10-31 | **Spec 0128 — nota de qualidade e correção pelo Astro**. `lib/quality-score.ts` (pesos: custo por conversa 30, CTR 20, CPC 15, CPM 10, classificações da Meta 25; na média vale 70%), `lib/quality-diagnosis.ts` (causa e correção por indicador), média de comparação por objetivo (`readAccountBenchmarks`), `learning_stage_info` do conjunto para "Aprendendo — avalie a partir de", taxa de conversa (conversas ÷ cliques) e origem no Órbita por anúncio (`ad-lead-origin.ts`, pelo `Lead.metaAdId`). Ações: `trafego.campaignBuilder.analyzeAdForFix` (5 Stars, `trafego_ad_fix`) e `applyAdFix` (troca ou duplica pausado, `builder-quality-fix.ts`). Nota só para admin do sistema até `TRAFEGO_QUALITY_SCORE_PUBLIC=true`. Sem migration. |
| 2026-10-31 | **Spec 0129 — passo a passo guiado pelo criativo**. Membro com Meta conectada começa em "Criativo" (pula as telas de conta). `trafego.creativeReview.analyze` com `withGuidance` devolve também `guidance` (objetivo, tipo, público, 2 textos), na mesma cobrança de 5 Stars; `trafego.creativeReview.accountSummary` (custo por conversa médio e mínimo diário da conta) alimenta a verba sugerida e os avisos. Resumo da conta: média, 5 anúncios com menor custo por conversa e seus textos, idade e gênero mais baratos, reprovados (cache de 15 min). Sugestão só preenche campo que o cliente não mexeu (`use-wizard-astro-suggestions.ts`). `fetchAdsInsightsDetailed` ganhou `breakdowns`. Sem migration. |
| 2026-11-02 | **Spec 0130 — pedido completo, prompt e aprovação**. `lib/publish-prompt.ts` (prompt em regra fixa, sem token; barra sem criativo ou texto), `trafego.admin.orders.buildPublishPrompt` (link do criativo assinado por 24 h) e `sendForApproval` (evento com `requiresApproval`, substitui o anterior e avisa o cliente por WhatsApp), `trafego.approvals.approve` (só dono/admin da org; grava uma vez) e `permission`. `trafego.creativeReview.suggestCopy` (2 Stars, `trafego_copy_suggestion`). Migration: 4 colunas em `trafego_order_event`. |
| 2026-11-02 | **Spec 0131 — trafeGO no MCP do ÓRBITA**. `/api/mcp` registra `trafego_*` só para chave com escopo `trafego`, conferindo a cada chamada o escopo e o admin do sistema do dono (limite de 120 chamadas por hora por chave). Ferramentas: `trafego_list_orders`, `trafego_get_order`, `trafego_get_publish_brief`, `trafego_get_ad_insights`, `trafego_send_recommendation`, `trafego_link_meta_campaign`, `trafego_add_team_note`. Nada mexe na Meta nem em dinheiro. Coluna `scopes` em `external_ai_access_tokens`. |
| 2026-11-02 | **Spec 0132 — avaliação do Claude antes de publicar** (versão do pedido). Colunas `review_requested_at`, `review_fingerprint`, `review_fixes` e `review_notes` em `trafego_order`. Pedido em "Materiais enviados" vai sozinho para `IN_REVIEW` (`transitionTrafegoOrder`); avaliação leva a `SCHEDULED` ou `CHANGES_REQUESTED` e cria a recomendação da 0130; "Aprovado, publicar" é o aprovar da 0130; "Avaliar melhorias e aprovar" grava as melhorias no pedido (`order-review-actions.ts`). MCP: `trafego_list_review_queue`, `trafego_get_order_for_review`, `trafego_review_order`, `trafego_mark_published`. Admin: aprovar à mão e marcar como publicado. A primeira versão, sobre a campanha criada com token, foi removida antes de ir para produção. Rotina em `docs/trafego-rotina-avaliacao.md`. |
| 2026-11-10 | **Spec 0138 — conta de anúncios inteira**. Rota `/trafego/painel/conta` (`panel/account-explorer/`), abas no topo do painel (`panel-view-tabs.tsx`). Procedures `trafego.account.campaigns`, `campaignAds` e `breakdown`, todas pela integração da org (`resolveOrderMetaAccess`). Campanhas: Insights por campanha + estrutura (`server/lib/meta/account-campaigns.ts`). Detalhe: `getCampaignAdsPerformance` reaproveita a montagem do detalhe do pedido (`buildAdsPerformance`), conferindo que a campanha é da conta conectada. Conjuntos ganharam números somados. Sem migration, cron ou env. |
| 2026-10-30 | **Token da Meta com passo a passo nos Satélites** (spec 0125). O login com Facebook não serve para o Astro enquanto o app da Órbita não tiver Acesso Avançado em `ads_mcp_management`; o cliente gera o token de um usuário do sistema (função Funcionário) e segue os passos na tela. |
| 2026-10-30 | **Spec 0124 — campanha de WhatsApp pelo painel**. Aba "Publicar" para owner/admin, com guarda no servidor (papel, `canCreate`, fase do pedido, complemento vencido). Passos: página e WhatsApp, público (cidade + raio, idade ≥ 18, sugestão pelo conjunto antigo com menor custo por conversa), anúncio por **post do Instagram** (ou imagem dos Materiais com copy), verba total e data de fim, revisão. O rascunho nasce **pausado** (campanha `OUTCOME_ENGAGEMENT` com orçamento total e `LOWEST_COST_WITHOUT_CAP`, conjunto `WHATSAPP`/`CONVERSATIONS`, botão `WHATSAPP_MESSAGE`); falha no meio arquiva o que nasceu. Publicar ativa os três níveis e leva o pedido a RUNNING. Editar: pausar, verba, fim, público e trocar anúncio (novo + antigo pausado). Regra nova de política "atributos pessoais". Guia `trafego.publish` do Astro. Sem migration, cron ou env nova. **Revoga a decisão "clique do cliente não publica"** das specs 0008, 0009 e 0010. |
| 2026-10-30 | **Spec 0123 — cobrança só do serviço**. Checkout cobra taxa (30%, mínimo R$ 150) + setup + extras; a verba sai da cobrança e é paga à Meta. Colunas `adBudgetPaidToMeta` (pendência e pedido) e `metaCampaignIdsOutsideService` (migration `20261030200000_trafego_service_only_billing`). Financeiro sem repasse de verba no modelo novo. Complemento calculado num passo no fim do cron diário `sync-meta-ads-kpis`, como rascunho `TG-NNNN-Cn`; cartão "Complementos" no admin; "Taxa sobre o gasto real" no Desempenho; complemento enviado e vencido trava "Nova campanha" e a criação pelo painel. Wizard `?nova=1`: membro sem pedido contrata na org ativa; com a Meta testada, BM e "vinculados" vêm como Sim e o passo Contato é pulado. Termos `2026-10-30`. |
| 2026-10-30 | **Spec 0122 — base Meta pelos Satélites, Desempenho real e "Corrigir valores"**. Cliente Graph único para os anúncios (`src/http/meta/graph-client.ts`, v25.0): token só no cabeçalho, `appsecret_proof`, tempo limite e erro tipado (token vencido, permissão, limite da Meta). O token da Meta passa a ser cifrado no banco e mascarado no navegador, e é lido por `readMetaAccessToken`. Só owner/admin mexe na integração; com "gerenciada pela Órbita", só admin do sistema. "Testar conexão" nos Satélites mostra conta, página, WhatsApp, permissões e validade do token. O Desempenho lê a conta da integração da org do pedido: KPIs como no Gerenciador (conversas iniciadas, custo por conversa, CPM, frequência), gráfico diário, campanhas com selo "deste pedido" e públicos. A verba usada conta só as campanhas com o código do pedido no nome. Admin ganha "Corrigir valores" antes de ir ao ar, com histórico, ajustando o financeiro quando o dinheiro ainda não andou. Sem migration, cron ou env nova. |
| 2026-10-27 | **Correções do backlog de 2026-09-17**: cupom chega ao financeiro com valor líquido e deixa de marcar `amountMismatch` (P-9); referência PIX gravada com a unicidade do banco, sem 500 em colisão (P-1); limite de tentativas no checkout por IP e por e-mail (P-2); consulta pública da compra com e-mail mascarado e token só para quem tem o `session_id` do Stripe (P-3); estorno parcial e disputa viram evento interno + aviso aos admins (P-4, P-6); estorno total cancela os lançamentos no financeiro, nos dois gateways (P-5); `computeTrafegoPrice` → `computeLegacyPlanPrice` (P-7); ativação usa o hook (E-4). Criativos extras passam a entrar na receita. |
| 2026-10-27 | **Pedido avulso (spec 0116)**: a equipe cria pelo `/admin/trafego` o pedido de quem pagou fora da landing, escolhendo empresa, canal, valores e PIX/Cartão. Sem migration. Nasce em "Análise da conta" e segue o pós-criação de sempre; lançar no financeiro é opcional. |
| 2026-10-02 | **Painel do cliente no padrão celular primeiro** (`docs/apps-mobile-playbook.md`), só interface: título uma vez (barra de cima sem nome), topo com ícone redondo e a seção atual como título no celular; números sempre à vista, mesmo zerados (verba nos anúncios, total investido, no ar, precisam de você; no pedido: verba, já gasto, taxa e total); filtros em pílulas que rolam e busca em pílula na lista; menu de baixo no pedido com Campanhas · Materiais · Andamento · Desempenho; texto do anúncio editado em gaveta de baixo no celular (janela no computador); "Confirmar PIX" da equipe em gaveta no celular; selos de status em tokens (`ORDER_STATUS_STYLE`); "Verba usada" aparece desde R$ 0,00; atalho do WhatsApp sobe acima do menu de baixo. Componentes novos: `panel-page-header`, `panel-stat-grid`, `order-card`, `order-detail-header`, `order-status-notices`, `copy-card`, `copy-editor-dialog`, `copy-editor-fields`, `release-fields`; filtros em `lib/order-filters.ts`. |
| 2026-09-18 | **PIX pelo Asaas (spec 0022)**: a trilha PIX deixa de depender de comprovante. O checkout emite cobrança nominal no Asaas com `externalReference` = id da pendência, e a tela mostra QR e copia-e-cola em vez da chave estática. Como a API exige documento para cadastrar pagador, o wizard passa a pedir **CPF/CNPJ apenas em quem escolheu PIX** — o cartão não vê o campo. O webhook é endpoint próprio (`/api/trafego/asaas/webhook`), separado do de Stars: valida o header `asaas-access-token` **fail-closed** e, validado o token, **relê a cobrança na API** em vez de confiar no valor do corpo — token prova quem mandou, releitura prova quanto. Fora isso responde 200 quase sempre, porque o Asaas interrompe a fila após 15 falhas seguidas. A confirmação entra pelo `markTrafegoPurchasePaid` de sempre, então idempotência e aviso de duplicidade vêm de graça. Estorno e chargeback **notificam** e param aí. Gateway desligado em `/admin/payments` devolve tudo ao PIX manual, sem deploy. |
| 2026-09-13 | **Fase D da 0009 — inteligência no painel**: o Astro do painel passa a ter escopo próprio (`toolScope: "trafego"`) com dez ferramentas do próprio pedido e **nenhuma da plataforma** — o cliente trafeGO não é membro e não pode ver leads, orgs nem automações — e fica **isento de Stars** (a taxa de serviço cobre; ele não tem saldo e não deveria precisar ter). O **Release** nasce das fontes que o cliente aponta: site e PDF são lidos de fato (fetch com bloqueio de IP privado, `pdf-parse` sob import dinâmico), Instagram e Facebook ficam como referência porque raspar violaria os termos; a redação roda no Inngest, um passo por fonte, e o resultado é **rascunho** — só vira insumo de copy e recomendação depois que o cliente salva. As **recomendações** são decididas por regras duras em código (verba mínima por dia e plataforma, formato por objetivo, destino × pixel) e o modelo só redige em cima do veredito — número inventado por modelo viraria conselho diferente a cada refresh. Copies ganham `suggest` (três ângulos distintos, `SUGGESTED_BY_NASA`, nunca já selecionadas) e selo de política por variação. Nova aba **Acessos** com o Business ID de parceiro para copiar — nunca pedimos senha. |
| 2026-09-13 | **Fase C da 0009 — KPIs sem digitação**: o cron que espelha a estrutura da Meta passa a ler `TG-NNNN` no nome da campanha e preencher o vínculo sozinho, **sem nunca sobrescrever** um vínculo existente; duas campanhas com o mesmo código não vinculam nada e notificam o admin. Quando ainda não há snapshot, o painel busca ao vivo na Marketing API com cache de 15 minutos por pedido (falha também é cacheada, para não repetir chamada quebrada) e **nunca grava snapshot** — a origem do dado aparece na tela como "ao vivo · há N min" ou "dados de ontem". |
| 2026-09-12 | **Fase A da 0009**: status `ACCOUNT_REVIEW`; `transitionTrafegoOrder` como único caminho de status; tracking de operação com `statusColumnMap` e subscriber do kanban; card nasce no checkout com telefone normalizado; formulário "Briefing TrafeGO" preenchido automaticamente; avisos ao cliente por WhatsApp (template) + e-mail a cada fase; `MATERIALS_SUBMITTED` automático; financeiro com conta/categoria e receita = taxa + setup; fluxo autenticado com os mesmos efeitos; cron de divergência; botão de WhatsApp no painel; tela de ajustes com provisionamento; Google Ads/`SEARCH` aceitos no checkout; playbook do gestor. |
| 2026-09-12 | **Fase B da 0009 concluída — chat público**: o Astro atende na landing, no canto inferior direito. Ferramentas **só de leitura e puras** (`simular_investimento`, `checar_politicas`, `estimar_inicio`, `contato_da_equipe`) — nada toca o banco, porque o endpoint é público e sem sessão; não importa `src/features/astro`, cujas ferramentas escrevem na org. Recebe o que o cliente já preencheu no formulário, para responder preço sem perguntar de novo. Limite de 20 mensagens por IP por minuto, conversa não persistida (LGPD), e escopo travado em tráfego pago. |
| 2026-09-12 | **Fase B-3/B-4 da 0009 — políticas e prazo**: base curada de regras de Meta, Google e WhatsApp em `lib/ad-policies/` (fontes com data de revisão), com verificação determinística que roda **no browser e no servidor com o mesmo código** — o aviso que o cliente vê é o que decide o checkout. Uma segunda camada por modelo (Claude Haiku, saída estruturada) pega o que o dicionário não pega e **nunca rebaixa** o determinístico. BLOCKED (remédio sob prescrição, vape, arma, aposta, promessa de emagrecimento com prazo) não passa pelo checkout automático e oferece o gestor; WARNING pede reconhecimento. Copies salvas no painel também são checadas. O **prazo** virou tela própria: duas perguntas mudam a conta em dias úteis, e data desejada anterior à realista exige reconhecimento — agora cláusula dos termos. |
| 2026-09-12 | **Fase B-2 da 0009 — PIX manual**: o cliente escolhe PIX no passo Contato e recebe chave, valor e uma referência curta (`TGP-4K2M`) para citar no comprovante; o botão abre o WhatsApp da equipe com a mensagem pronta e a tela troca sozinha quando o pagamento é confirmado. A equipe confirma pela aba **trafeGO** no card do lead, olhando o comprovante que chegou na conversa ao lado — admin do sistema ou participante do tracking. Stripe e PIX passam pelo mesmo `markTrafegoPurchasePaid`, cujo claim atômico resolve a corrida (cartão depois de PIX confirmado gera aviso de duplicidade). Cobrança vencida vira `EXPIRED` por cron, mas continua confirmável. |
| 2026-09-12 | **Fase B-1 da 0009**: telefone obrigatório e verificado por código de 6 dígitos (template `trafego_codigo`, fail-open); Meta Ads pergunta o @ do Instagram/página e mostra o perfil num mockup de celular via Business Discovery da agência; WhatsApp Oficial pergunta se já há número na API, confere o número e explica o aquecimento progressivo de volume — sem número, o setup passa a cobrir a aquisição; frase do hero virou animação de 6 passos (estática com `prefers-reduced-motion`); termos atualizados (setup por canal, criativo à parte, volume definido pela Meta). |
| 2026-09-12 | Webhook fail-closed no secret dedicado; teto de R$ 500.000 na verba; dedupe de evento compartilhado. |
| 2026-09-11 | Simulador por faixa; pergunta sobre BM com setup; marcas; "Falar com um gestor"; Google Ads no catálogo; Termos e Privacidade com opt-in; cards 1:1; prova social; fundo animado; rodapé; logo; mobile. |
| 2026-08-31 | Fases 1–3 da 0008 implementadas. |
