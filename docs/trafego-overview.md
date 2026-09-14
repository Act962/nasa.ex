# trafeGO — self-service de tráfego pago e campanhas

> Documento de referência do domínio `trafego`. Status: **venda (0008) implementada ·
> operação, PIX, chat, políticas, KPIs e inteligência (0009, Fases A–D) implementadas em
> 2026-09-12/13 · migrations pendentes de aplicação**.
> Specs: [`0008`](../specs/trafego/0008-trafego-self-service.md) (venda) ·
> [`0009`](../specs/trafego/0009-trafego-operacao-inteligencia.md) (operação, PIX, Astro, políticas,
> Release, KPIs). Playbook do gestor: [`trafego-playbook-gestor.md`](trafego-playbook-gestor.md).
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

**Modelo de cobrança**: pagamento único por campanha, calculado por um **simulador de faixas**.
O cliente escolhe a verba (mínimo R$ 300) e a taxa vem **por cima** — os 100% da verba vão para o
anúncio. Quanto maior o investimento, menor o percentual:

| Verba | Taxa | Setup da BM |
| --- | --- | --- |
| R$ 300 a R$ 500 | 50% | R$ 500 |
| R$ 501 a R$ 1.000 | 40% | R$ 450 |
| R$ 1.001 a R$ 2.500 | 35% | R$ 400 |
| R$ 2.501 a R$ 5.000 | 30% | Grátis |
| Acima de R$ 5.000 | 25% | Grátis |

O **setup da BM** é cobrado uma única vez, apenas de quem ainda não tem conta de anúncios. Cobre a
criação da BM, da página do Facebook e a correção de problemas na conta. Produção de criativo é
serviço à parte. As três parcelas aparecem separadas: na landing, no Stripe e no e-mail.

A tabela vive em `src/features/trafego/lib/pricing-tiers.ts` e é a fonte de verdade. O servidor
**sempre recalcula** a cotação no checkout. A verba é limitada entre **R$ 300 e R$ 500.000**.

## 2. Decisões travadas

| Decisão | Escolha | Porquê |
| --- | --- | --- |
| Catálogo | Meta Ads + Google Ads + WhatsApp API Oficial | Google entra como pedido executado pela equipe |
| Cobrança | Pagamento único (Stripe Checkout); PIX manual na Fase B | Reusa o eixo `PendingCoursePurchase`; Asaas não valida assinatura |
| Preço | Simulador por faixa, taxa **sobre** a verba | O cliente sabe quanto vai para o anúncio |
| Execução | **Manual pela equipe**, via Claude Code + MCP | Verba é dinheiro real; clique de cliente não publica anúncio |
| Mesa de operação | **Tracking** (não Workspace) — spec 0009 D-1 | Instância de WhatsApp e formulário se prendem ao lead/tracking |
| Fonte de verdade do status | **O pedido**; o card é espelho — D-2 | O pedido carrega `startedAt/endsAt` e consequências contratuais |
| Card por cliente | `TrafegoOrder.leadId` **não** único — D-3 | Cliente recorrente tem N pedidos no mesmo card |
| Fase inicial do pedido | `ACCOUNT_REVIEW` para todo pedido — D-6 | Conta restrita é pega antes de gastar verba |
| Financeiro | Receita = taxa + setup; verba = conta a pagar — D-5 | Somar inflaria faturamento |
| Conta do cliente | Organization própria com `appScope="trafego"` | Reusa auth/org/permissões |
| Nome do pedido | `TrafegoOrder`, nunca "campanha" | "Campanha" já nomeia `Broadcast`, `MetaAdCampaign` e `NasaCampaignPlanner` |
| Timeline | Eventos append-only com `source` | O fluxo tem voltas; a origem diz quem mexeu |
| Webhook | Endpoint próprio, fail-closed no secret | Um throw derruba o endpoint inteiro |

### Não-objetivos declarados

Publicação automática no Meta/Google · senha de redes sociais (acesso é por parceiro na BM) · PIX
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

1. **`metricsOrganizationId`** — snapshots do Meta são da org da **agência**; sem ele o painel volta
   vazio.
2. **Telefone** — `Lead.phone` precisa ser igual ao `wa_id` do inbound (`normalizeWhatsappPhoneBr`
   → `normalizePhoneToMetaE164`); senão o comprovante cria um segundo card.
3. **Verificações são fail-open** — sem instância Uazapi ou sem integração Meta na agência,
   `getPublicConfig.verification` devolve `false`, os botões somem e o wizard segue. Nunca
   bloqueiam a venda: o que não foi confirmado vira aviso no Briefing do card.

## 5. Arquivos

```
specs/trafego/0008-*.md · 0009-*.md              specs (venda · operação)
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
│                 mark-purchase-paid (Stripe e PIX) · compliance-check
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
src/app/api/checkout/trafego/ checkout público (cria o card e o briefing)
src/app/api/trafego/webhook/  webhook dedicado
src/app/api/trafego/assistant/ chat público (OpenAI, ferramentas de leitura)
src/inngest/functions/trafego/ purchase-paid · order-requested · order-status-changed
                               release-generate (lê fontes e redige o Release)
src/inngest/functions/crons/   trafego-kanban-drift-sweep · trafego-pix-pending-sweep
                               sync-meta-ads-structure (vincula TG-NNNN)
src/lib/email/                 trafego-purchase-confirmation · trafego-status-update
src/features/admin/components/trafego/ orders-table · order-detail · plans-manager · settings-form
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
| **Chave PIX** (+ titular, banco, validade) | Ajustes → PIX manual | A opção PIX não aparece no wizard; só cartão |
| `OPENAI_API_KEY` | `.env.local` + host | O chat da landing responde 503 |
| `ANTHROPIC_API_KEY` (ou integração ANTHROPIC na org da agência) | `.env.local` + host | A segunda camada da checagem de políticas não roda; fica só a determinística |
| **Integração Meta com página + IG Business** na org da agência | app de integrações | Preview da conta do cliente no wizard some |
| **Business ID** da Órbita | Ajustes → Agência | Pedido de acesso de parceiro sem o ID |
| **Conta + categorias** ("STRIPE", "Cliente TrafeGO", "Repasse verba") | app Payment na org da agência + Ajustes → Financeiro | Lançamentos sem conta/categoria |
| Participantes do tracking | app de tracking | Gestor não vê os cards |

Migration da Fase A: `prisma/migrations/20260912150000_trafego_operacao_kanban` (aditiva). Depois
de aplicar: `pnpm db:generate`, bump de `SCHEMA_VERSION` (já em `v61-trafego-operacao-kanban`) e o
ritual da regra 11.

### Por que o webhook é fail-closed

Sem `STRIPE_TRAFEGO_WEBHOOK_SECRET` o endpoint responde 500 e não processa nada — validar evento de
trafeGO com o secret do better-auth aceitaria evento de outro produto. Mesmo guard do
`/api/stars/webhook`. Dedupe via `claimStripeEvent`/`releaseStripeEvent` (`src/lib/stripe.ts`).

## 7. Roadmap

| Fase | Escopo | Status |
| --- | --- | --- |
| 0008-1..3 | Venda ponta a ponta, materiais, desempenho | ✅ |
| 0008-4 | Suporte: thread ✅ · notificação da equipe ✅ · recuperação de carrinho ⬜ | 🚧 |
| **0009-A** | Tracking de operação, card ↔ pedido, briefing no card, avisos WhatsApp + e-mail, financeiro com conta/categoria, `ACCOUNT_REVIEW`, materiais automáticos, Google Ads no checkout | ✅ código · ⬜ migration/config |
| **0009-B4** | Chat público do Astro na landing: ferramentas só de leitura (simular preço, checar política, estimar início, contato), limite por IP, sem persistir conversa | ✅ código |
| **0009-B3** | Políticas de publicidade (base curada + prescreen determinístico + checagem por modelo) e prazo realista em dias úteis reconhecido antes do pagamento | ✅ código · ⬜ migration |
| **0009-B2** | PIX manual: escolha no passo Contato, chave + referência `TGP-xxxx`, comprovante pelo WhatsApp, "Confirmar PIX" na aba trafeGO do card do lead, cron de validade, caminho único de confirmação com o Stripe | ✅ código · ⬜ migration/config |
| **0009-B1** | Verificações do wizard: WhatsApp por código, conta do Instagram/Facebook com preview em mockup, número na API Oficial com aquecimento explicado; hero animado em 6 passos; telefone obrigatório | ✅ código · ⬜ migration/config |
| 0009-B | Completa | ✅ |
| **0009-C** | Vínculo automático da campanha por nome (`TG-NNNN`) no cron da estrutura Meta, leitura ao vivo dos KPIs com cache de 15 min e selo de frescor no painel | ✅ código · ⬜ migration |
| **0009-D** | Astro no painel com escopo `trafego` e isento de Stars, Release montado a partir de site/PDF, recomendações por regras duras, copies sugeridas com selo de política, checklist de acessos | ✅ código · ⬜ migration |

## 8. Changelog

| Data | Mudança |
| --- | --- |
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
