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

## Canal: portal vs WhatsApp

- **Portal `/pedido/<token>`:** sem login; o token de 144 bits é a autorização. Mostra a linha do tempo (a etapa de logística vem do nome do `Status`), o QR/copia-e-cola do PIX ou o link, os itens e o chat com o Astro e os consultores.
- **WhatsApp:** o `wa.me` com o código do pedido faz o **cliente** iniciar a conversa. Assim não há template pago na API oficial.
- **Regra de resposta:** o bot responde no canal da última mensagem inbound (`shouldReplyInPortal`). A mensagem do pedido e as mensagens `viaInChat` vão para o portal; uma mensagem vinda do WhatsApp é respondida pelo `resolveOutboundProvider`, que funciona tanto com Uazapi quanto com Meta Cloud.

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
| Mover lead | `src/features/leads/lib/move-lead.ts` |
| Inngest | `src/inngest/functions/nerp-catalog/{watch-order-payment,sync-order-to-nerp}.ts` |
| Configuração | `src/app/router/nerp/catalog-integration/{get,upsert}.ts`, `src/features/nerp-catalog/components/nerp-hub/*` |
| Portal | `src/app/(public)/pedido/[token]/page.tsx`, `src/app/router/public/catalog-order/*`, `src/features/nerp-catalog/components/order-portal/*` |

## Checklist de ativação

1. `pnpm db:migrate` (migration `20260926120000_nerp_catalog_orders`) e em seguida o ritual do item 11 do CLAUDE.md.
2. Em `/integrations/nerp`: clicar em Conectar (ou Reconectar), escolher o tracking de pedidos (com a IA ligada) e o de logística, informar a chave Asaas e salvar.
3. No NERP, em Catálogo → Operação, selecionar o modo **Órbita**.
4. Fazer um pedido teste com o Asaas em **sandbox** e confirmar a cobrança no painel do sandbox.

## Pendências conhecidas

- Pedido não pago não é cancelado automaticamente, nem no Órbita nem no NERP: a venda fica `PENDING_APPROVAL`.
- O frete não é calculado no servidor do NERP (`shipping = 0`).
- O chat do portal usa polling de 4s em vez de Pusher.
- O envio de mensagens pelo portal não tem limite de taxa.

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
