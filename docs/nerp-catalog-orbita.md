# Catálogo online NERP → Órbita (Astro · PIX Asaas · Logística)

> Fonte de verdade da ponte "pedido do catálogo NERP → negociação no Órbita".
> Lado NERP: `nerp-2/specs/catalogo-orbita.md`.

## Fluxo

1. O cliente fecha o carrinho em `/catalogo/<loja>` no NERP, com o catálogo em modo **ORBITA**.
2. O NERP cria a `Sale` como `PENDING_APPROVAL`. A função Inngest `orbita-order-delivery` faz `POST /api/integrations/nerp/orders` no Órbita, com assinatura HMAC.
3. O Órbita:
   - encontra ou cria o lead (`source = NERP_CATALOG`) no **tracking de pedidos**;
   - cria o `CatalogOrder` e grava o resumo do pedido na conversa como mensagem **do cliente**;
   - dispara a IA pelo `firePostInboundAutomations`.
4. O NERP recebe `{ orderToken, portalUrl, whatsappUrl }`. A página de sucesso mostra dois botões: **Acompanhar e pagar meu pedido** e **Continuar no WhatsApp**.
5. O Astro (`tracking-chat-ai`) segue os critérios de fechamento: itens, entrega/endereço, CPF/CNPJ e forma de pagamento. Em seguida chama `create_pix_charge` ou `create_payment_link`.
6. A cobrança é feita na **conta Asaas da loja**. A confirmação chega por dois caminhos, e o mesmo pedido nunca é confirmado duas vezes:
   - webhook `POST /api/integrations/nerp/asaas-webhook/<orgId>`;
   - polling Inngest `nerp-catalog-watch-order-payment`, a cada 2 min por 1h e depois a cada 15 min até 24h.
7. `confirmCatalogOrderPayment`:
   - marca o pedido como `PAID`;
   - lança um `PaymentEntry` RECEIVABLE/PAID;
   - move o lead para o **tracking de logística** com `moveLeadToStage`;
   - avisa o cliente;
   - emite `nerp/catalog-order.paid`.
8. A função `nerp-catalog-sync-order-paid` chama `catalogOrder.updateStatus` no NERP. A `Sale` passa a `CONFIRMED`, com `SalePayment` e baixa de estoque.

## Valor negociado pelo atendente (spec 0103)

Para loja que vende **sem preço na vitrine** (ou que negocia valor), o valor é sempre definido por uma pessoa:

1. Pedido chega (pode vir com R$ 0). O Astro confirma itens, entrega e CPF/CNPJ.
2. Cliente mostra interesse ("quanto fica?", "quero pagar", "tem desconto?") ou o pedido está sem valor → o Astro chama `request_catalog_order_quote`: grava `quoteRequestedAt`, aplica a tag **Quer orçamento** (org, `quer-orcamento`), aplica "Aguard. atendimento" e alerta a equipe (sino/push, motivo `quote_requested`). A IA **não** é pausada.
3. Atendente abre o lead → Detalhes → **Produtos/Serviços** → **Enviar valor** (`nerp.catalogOrders.sendQuote`, permissão `lead-produtos` → Editar). Os preços já vêm da tabela do NERP (`referenceUnitPrice` e `referenceBoxPrice`/`packQty` do payload); o atendente ajusta o que negociou, informa frete, desconto e um recado. O mesmo formulário aparece na aba **Pedido** do painel Propostas e Orçamentos do chat. O servidor recalcula tudo em centavos (`computeQuotedTotals`), grava `quotedAt`/`quotedById`, zera `quoteApprovedAt`, atualiza `Lead.amount`, **reativa a IA do lead** e envia ao cliente a mensagem "Valor do seu pedido… Responda SIM para aprovar".
4. Cliente aprova → o Astro chama `approve_catalog_order_quote` (grava `quoteApprovedAt`, tag **Quer pagar**), pergunta a forma de pagamento e gera PIX ou link.
5. Pagamento, separação e entrega seguem a spec 0044, com aviso ao cliente em cada etapa (incluindo o novo aviso de **Entregue**).

**Bloqueio de cobrança** (`getChargeBlockReason`, chamado em `chargeOrder`, serve Astro e portal): sem cobrança com total ≤ 0, com orçamento pedido e sem valor, ou com valor enviado e não aprovado. Pedidos antigos (campos nulos, total > 0) não mudam. O portal esconde o "Gerar PIX", mostra "A combinar" e explica a situação.

Situação do valor (`resolveQuoteState`): `no_price` · `awaiting_quote` · `awaiting_approval` · `approved` · `priced`.

Valor só muda em `RECEIVED`/`NEGOTIATING`. Com cobrança gerada (`AWAITING_PAYMENT`) é recusado: a cobrança antiga ainda poderia ser paga.

## Etapas padrão do pedido (spec 0044)

Com o padrão aplicado, o pedido vive num tracking só ("Separação e Entrega"). As colunas têm chave de sistema (`Status.systemKey`), então a loja pode renomeá-las:

| Coluna (chave) | Como o lead entra | Aviso ao cliente (portal + WhatsApp por QR) |
| --- | --- | --- |
| Novo Pedido (`catalog.new`) | Pedido chega do NERP | — (link de acompanhamento, como antes) |
| Confirmado (`catalog.confirmed`) | Cliente gera PIX/link | — |
| Pagamento confirmado (`catalog.paid`) | Asaas confirma | "Pagamento confirmado", "Você ganhou N star(s)!" (se ganhou), "Pedido enviado para separação" |
| Separado (`catalog.separated`) | Equipe arrasta | "Pedido em rota de entrega" ou, se `delivery.method` casa com /retir/i, "Pedido separado e pronto para você recolher" |
| Entregue (`catalog.delivered`) | Equipe arrasta | "Pedido entregue" ou "Pedido retirado" (spec 0103); pedido vira DELIVERED |

- Cada coluna tem uma tag SYSTEM de mesmo nome (`etapa-*`, por tracking). Ao entrar numa coluna, entra a tag dela e saem as outras tags de etapa; a jornada registra as trocas.
- Gatilho único: `handleCatalogStageEntry` (`lib/stage-flow.ts`), assinado no `eventBus` `lead.status_changed`. `moveLeadToStage`, as ferramentas do Astro/IA e o executor de automação passaram a publicar esse evento (`publishLeadStatusChanged`).
- Aviso = mensagem com `metadata.kind = "catalog_order_notice"` (`sendOrderNotice`), um por pedido e tipo (`noticeKey`); a página do pedido anima os que ainda não viu (`OrderNoticeToaster`).
- Empresa nova: o tracking "Entrega e Separação" nasce assim (0042). Empresa atual: botão **Aplicar padrão do sistema** na integração (`nerp.catalogIntegration.applyDefaultStages`) cria o que falta no tracking de logística escolhido e aponta pedidos e pós-pagamento para ele.
- Sem as chaves, segue o fluxo antigo de dois trackings.

## Área do cliente (`/pedido/<token>`, spec 0041)

App de uma rota só, com rodapé **Ofertas · Catálogo · Home · Chat · Mais** (estado local, sem rotas públicas novas: o token continua sendo a única autorização).

| Tela | Conteúdo |
| --- | --- |
| Home | Card do nível (Terra/Lua/Galaxy), pedido atual (andamento, PIX, chat/WhatsApp), cartões "comprou, ganhou" mais próximos. Pedido ainda sem cobrança (`RECEIVED`/`NEGOTIATING`) e loja com chave Asaas: botão **Gerar PIX** (`public.catalogOrder.payWithPix`, cliente informa CPF/CNPJ) |
| Ofertas | Todos os cartões de prêmio; "Próximos níveis" com os bloqueados; atalho para o catálogo |
| Catálogo | Abre `catalogUrl` do pedido (loja no NERP) |
| Chat | "Fale com a loja" em tela cheia |
| Mais | Como funciona, Minha jornada (`SpaceJourney`), Histórico de ⭐, Minhas trocas, Meus pedidos (`public.catalogOrder.customerOrders`, mesmo telefone), Meus dados (telefone mascarado), Regulamento, Ajuda |

## Canal: portal vs WhatsApp

- **Portal `/pedido/<token>`:** sem login; o token de 144 bits é a autorização. Mostra a linha do tempo (a etapa de logística vem do nome do `Status`), o QR/copia-e-cola do PIX ou o link, os itens e o chat com o Astro e os consultores.
- **WhatsApp:** o `wa.me` com o código do pedido faz o **cliente** iniciar a conversa. Assim não há template pago na API oficial.
- **Regra de resposta:** o bot responde no canal da última mensagem inbound (`shouldReplyInPortal`). A mensagem do pedido e as mensagens `viaInChat` vão para o portal; uma mensagem vinda do WhatsApp é respondida pelo `resolveOutboundProvider`, que funciona tanto com Uazapi quanto com Meta Cloud.
- **Link de acompanhamento na chegada do pedido:** `receiveCatalogOrder` chama `sendOrderLinkByWhatsapp`, que manda "Recebemos seu pedido #N… <link do portal>" pelo WhatsApp do tracking. Só com Uazapi (QR Code): na API oficial da Meta a mensagem livre sem o cliente ter escrito é recusada, então o envio é pulado e vale o botão "Continuar no WhatsApp". Sem instância, também é pulado. Best-effort: falha não afeta o pedido.
- **Contador do canal:** o botão "Catálogo online" da lista de conversas mostra a bolinha de leads sem resposta (`conversation.unansweredCounts` → `byChannel.CATALOG`, por `lead.source = NERP_CATALOG`). Esses leads saem da contagem e do filtro do WhatsApp, onde caíam antes porque a conversa é gravada como WhatsApp.
- **Resposta do atendente:** numa conversa de pedido do catálogo, o texto digitado no chat vai pelo portal (`isCatalogPortalConversation` em `message.create`), mesmo sem WhatsApp no tracking. O composer libera o campo de texto para leads com `source = NERP_CATALOG`; mídia e áudio continuam exigindo instância. No portal, a assinatura `*Nome*` do atendente é removida (o nome já aparece no balão) e `*negrito*`/`~riscado~` são renderizados.

## Contrato HTTP (NERP → Órbita)

`POST {NASA_SYNC_BASE_URL}/api/integrations/nerp/orders`

| Header | Valor |
| --- | --- |
| `X-Nerp-Api-Key` | `NasaIntegrationKey.apiKey` (igual a `PlatformIntegration.config.apiKey`) |
| `X-Nerp-Org-Id` | id da org no NERP |
| `X-Nerp-Timestamp` | epoch em ms (tolerância de ±5 min) |
| `X-Nerp-Signature` | `hex(HMAC-SHA256(secret, "POST\n/api/integrations/nerp/orders\n<body>\n<timestamp>"))` |

O corpo segue `src/features/nerp-catalog/schemas/order-payload.ts`: `nerpSaleId`, `saleNumber`, `customer`, `delivery`, `items[]`, `subtotal`, `shipping`, `discount`, `total` e `catalogUrl`.

Respostas:

| Código | Corpo / motivo |
| --- | --- |
| `200` | `{ orderToken, portalUrl, whatsappUrl }` — idempotente por `nerpSaleId` |
| `401` | assinatura ou chave inválida |
| `409` | `catalog_integration_inactive` |
| `400` | payload inválido |

Na volta (Órbita → NERP), a chamada é `catalogOrder.updateStatus` pelo `callNerpProcedure`, com escopo `sales:rw` e só S2S:

```
{ saleId, status: "CONFIRMED" | "CANCELED", payment?: { method, amount, gatewayPaymentId, paidAt } }
```

## Credenciais e escopos

- Em `/integrations/nerp`, o botão **Conectar** abre o consentimento do NERP. Lá a pessoa entra com Google ou com e-mail.
- A troca de código devolve `apiKey` + `secret`. O secret é **cifrado** em `config.secretEnc` (`src/features/nerp/lib/credentials.ts`). Conexões antigas com `secret` em claro continuam sendo lidas.
- Escopos novos:
  - `catalog-orders:push`: o NERP pode enviar pedidos.
  - `sales:rw`: o Órbita pode confirmar a venda.
- Integrações conectadas antes desta mudança precisam de **Reconectar**.
- A API key do Asaas e o token do webhook ficam cifrados em `NerpCatalogIntegration` (`AI_SECRETS_KEY`).
- Nenhuma variável de ambiente nova.

## Arquivos

| Área | Arquivo |
| --- | --- |
| Modelos | `prisma/schema.prisma` → `NerpCatalogIntegration`, `CatalogOrder`, `LeadSource.NERP_CATALOG` |
| Entrada do pedido | `src/app/api/integrations/nerp/orders/route.ts`, `src/features/nerp-catalog/lib/{verify-nerp-request,receive-order}.ts` |
| Canal | `src/features/nerp-catalog/lib/order-channel.ts` |
| Pagamento | `src/features/nerp-catalog/lib/{order-payments,confirm-payment,integration-config}.ts`, `src/lib/asaas.ts` |
| Webhook Asaas | `src/app/api/integrations/nerp/asaas-webhook/[orgId]/route.ts` |
| Astro | `src/features/nerp-catalog/server/tools/catalog-order-tools.ts`, `lib/order-context.ts`; ligado em `tracking-chat-ai/{lib/agent,lib/context,server/tools/index}.ts` |
| Valor negociado (0103) | `src/features/nerp-catalog/lib/{order-quote,order-quote-actions}.ts`, `components/send-quote-dialog.tsx`, `hooks/use-catalog-order-quote.ts`, `src/app/router/nerp/catalog-orders/send-quote.ts`; verificação `scripts/catalog-quote-qa-check.ts` |
| Mover lead | `src/features/leads/lib/move-lead.ts` |
| Inngest | `src/inngest/functions/nerp-catalog/{watch-order-payment,sync-order-to-nerp}.ts` |
| Configuração | `src/app/router/nerp/catalog-integration/{get,upsert}.ts`, `src/features/nerp-catalog/components/nerp-hub/*` |
| Portal | `src/app/(public)/pedido/[token]/page.tsx`, `src/app/router/public/catalog-order/*`, `src/features/nerp-catalog/components/order-portal/*` |

## Checklist de ativação

1. `pnpm db:migrate` (migration `20260926120000_nerp_catalog_orders`) e em seguida o ritual do item 11 do CLAUDE.md.
2. Em `/integrations/nerp`: clicar em Conectar (ou Reconectar), escolher o tracking de pedidos (com a IA ligada) e o de logística, informar a chave Asaas e salvar. Os dois trackings precisam ter **ao menos uma etapa**: o salvamento recusa funil sem etapas, porque o pedido cairia num 500 e o NERP repetiria a entrega indefinidamente.
3. No NERP, em Catálogo → Operação, selecionar o modo **Órbita**.
4. Fazer um pedido teste com o Asaas em **sandbox** e confirmar a cobrança no painel do sandbox.

## Pendências conhecidas

- Pedido não pago não é cancelado automaticamente, nem no Órbita nem no NERP: a venda fica `PENDING_APPROVAL`.
- O frete não é calculado no servidor do NERP (`shipping = 0`).
- O chat do portal usa polling de 4s em vez de Pusher.
- O envio de mensagens pelo portal não tem limite de taxa.
- **Preço promocional (NERP):** o catálogo exibe `Product.promotionalPrice`, mas o pedido é precificado por `resolveManyPrices`, que só conhece `discountPercent` com vigência. Resultado: produto com preço promocional aparece mais barato no catálogo e entra no pedido pelo preço cheio. Unificar exige decisão de negócio, porque o resolver também precifica o PDV.
- **Cliente recorrente:** se o cliente já tem lead no tracking de logística, o pagamento avança esse lead (phone+tracking é único) e o lead do pedido novo é fechado como **ganho** (`currentAction: WON`, `statusFlow: FINISHED`, histórico e jornada), saindo de "Novos pedidos". Antes de 2026-09-29 ele ficava parado lá.
- **Valor do lead:** até 2026-09-28 o recebimento gravava `Lead.amount` em reais; o campo é em centavos. Leads de pedidos anteriores mostram valor 100× menor no card.

## Permissões
Na matriz de Configurações → Permissões há duas linhas para este módulo:

**🛒 Catálogo online (NERP)**
| Ação | Libera |
| --- | --- |
| Ver | Hub `/integrations/nerp` e pedidos do catálogo |
| Editar | Conectar o NERP e configurar trackings, WhatsApp e Asaas |
| Excluir | Desconectar a integração |

**🛍️ Lead · Produtos/Serviços**
| Ação | Libera |
| --- | --- |
| Ver | Aba Produtos/Serviços nos Detalhes do lead |
| Editar | Enviar o valor negociado de pedidos do catálogo (spec 0103) |

## Changelog

- **2026-10-14** — Spec 0104: venda guiada com aprovação dos setores. O roteiro mora nos **Gatilhos Automáticos** (3 fluxos prontos, criados pausados pelo botão "Criar fluxos prontos" em Integrações → NERP): chegada do pedido (consultor + crédito), aprovação do valor (setores → CPF/CNPJ → valor, prazo e pontos) e pagamento/liberação (conferência dos setores → prazo novo → link). Ações novas nos Gatilhos: `SALES_APPROVAL`, `CHECK_CREDIT`, `FIND_CUSTOMER_BY_DOCUMENT`, `ROUTE_TO_CONSULTANT`, `CATALOG_ORDER_ACTION`. Modelos `SalesApprover` e `CatalogOrderApproval`; colunas de aprovação e prazo em `catalog_orders` (migration `20261014150000_catalog_sales_approvals`). Aprovadores recebem template de utilidade pelo número oficial e respondem pelos botões; a resposta não vira lead. Com aprovadores cadastrados, o "Enviar valor" vai para a aprovação (tag "Valor em aprovação") em vez de direto ao cliente; a cobrança fica bloqueada até a equipe aprovar; o pagamento dispara o gatilho "Pagamento recebido" e quita a conta a receber criada na cobrança. Crons novos: `payment-mark-overdue-receivables` e `nerp-catalog-remind-sales-approvals` (exigem Resync do Inngest). Revisão do desenho: sem contábil na 1ª rodada; esperas dentro da janela de 24h do cliente; crédito também para quem já tem consultor; cadastro do cliente novo pelo passo "Preencher formulário pela conversa" com nome, telefone, CPF e endereço do pedido já preenchidos. Etapa nova **"Em rota"** (`catalog.on_route`) entre "Separado" e "Entregue"; avisos de etapa (separado, pronto para retirar, em rota, entregue) e o link de chegada do pedido saem no WhatsApp — texto dentro da janela, template fora dela (`pedido_separado`, `pedido_pronto_retirada`, `pedido_em_rota`, `pedido_entregue`, `pedido_recebido`). Funis existentes ganham "Em rota" ao clicar em "Aplicar padrão do sistema".

- **2026-10-14** — Spec 0103: valor negociado pelo atendente e aprovado pelo cliente. Colunas `quote_requested_at`, `quoted_at`, `quoted_by_id`, `quote_approved_at` em `catalog_orders` (migration `20261014120000_catalog_order_quote`); ferramentas `request_catalog_order_quote` e `approve_catalog_order_quote`; botão "Enviar valor" na aba Produtos/Serviços; cobrança bloqueada sem valor aprovado; tags "Quer orçamento" e "Quer pagar"; aviso de pedido entregue. Script `scripts/setup-armazem-carvalho.ts` confere e monta a estrutura de uma loja.

- **2026-09-29** — Spec 0044: tracking único com etapas padrão (Novo Pedido → Confirmado → Pagamento confirmado → Separado → Entregue), tags de etapa, avisos animados no portal + WhatsApp, linha do tempo de 5 etapas e botão "Aplicar padrão do sistema". Lead reaproveitado na logística passa a levar o valor do pedido atual; hora do pagamento não vira mais meia-noite UTC.
- **2026-09-29** — Cliente gera o próprio PIX pela página do pedido (`payWithPix`), sem depender do Astro ligado no tracking. Webhook do Asaas pode apontar para um túnel via `ASAAS_WEBHOOK_PUBLIC_ORIGIN` (teste de PIX real em localhost). Removido o log `[rpc-debug]` que gravava o corpo das mutations `/api/rpc/nerp/*` (vazava a API key do Asaas).
- **2026-09-28** — Teste ponta a ponta local (NERP `main` + Órbita): `Lead.amount` passa a ser gravado em centavos; configuração recusa tracking sem etapas; atendente responde pelo portal sem WhatsApp; chat e portal renderizam `*negrito*`; o popup de escolha do WhatsApp não aparece em funil que já tem conversas; link de acompanhamento enviado pelo WhatsApp (Uazapi) assim que o pedido chega; contador próprio no botão do canal Catálogo online. No NERP (branch `feat/catalogo-orbita-ajustes-20260928`): sem a fila do Inngest, o checkout entrega o pedido direto ao Órbita.
