---
id: 0010
titulo: trafeGO — painel NERP, painel do cliente, chat unificado e saldo de criativos
dominio: trafego
status: revisada
autor: Weydson / Codex
criada: 2026-09-16
atualizada: 2026-09-16
branch:
pr:
peso: completa
---

# 0010 — trafeGO: painel NERP, UX do cliente, chat unificado e saldo de criativos

> Continuação das specs [0008](0008-trafego-self-service.md) e
> [0009](0009-trafego-operacao-inteligencia.md). A venda e a operação já existem; esta fase
> integra a supervisão no NERP, reduz atrito no painel do cliente e faz a conversa do pedido
> existir no mesmo lugar em que a equipe trabalha.

## 1. Contexto

O gestor hoje precisa alternar entre o NERP e o admin da NASA para enxergar campanhas e escolher
organização/tracking. No painel, explicações extensas ocupam a tela mobile, materiais só aceitam
upload, telefones não têm máscara consistente e o cliente não enxerga claramente que o desempenho
é atualizado automaticamente. Também não há uma compra contextual de criativos extras, o suporte
usa uma conversa paralela ao tracking-chat e pedidos novos podem não ter uma Conversation pronta.

Esta fase entrega um posto de controle do trafeGO no NERP, um painel mais claro e uma única
Conversation por lead. A ponte entre os dois produtos trata dados de produção e deve falhar
fechada.

## 2. Objetivo

Permitir que a equipe supervise todos os pedidos trafeGO no NERP e configure organização/tracking;
que o cliente compreenda e opere seu painel em mobile; que adquira capacidade adicional de
criativos sem novo login; e que toda comunicação de suporte passe pela Conversation do lead usada
no tracking-chat.

### Não-objetivos

- Suportar vários objetivos distintos no mesmo pedido. `TrafegoOrder.objective` continua único;
  objetivo diferente exige nova compra no mesmo lead (CB-1 da 0009).
- Criar uma carteira em reais: saldo significa apenas `maxCreatives`.
- Criar uma nova sincronização de KPI/MCP: a leitura já é direta da Marketing API, com cache.
- Espelhar suporte em uma segunda conversa ou migrar/backfill do histórico legado.
- Enviar WhatsApp real para a mensagem de sistema criada no nascimento do pedido.
- Publicar campanhas automaticamente.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O NERP oferece a aba `TrafeGO` em `PLATAFORMA_ENTRIES`, rota `/site/trafego`, com lista, busca e KPI por `TrafegoOrderStatus`. |
| RF-2 | NASA expõe somente endpoints GET/POST da ponte em `/api/trafego/bridge/*`; NERP os consome com HMAC SHA-256 canônico `METHOD\\npath\\nbody\\ntimestamp`, API key e tolerância de relógio de cinco minutos. |
| RF-3 | A ponte usa exclusivamente `TRAFEGO_BRIDGE_SHARED_SECRET` e `TRAFEGO_BRIDGE_API_KEY`; nunca reutiliza `SYNC_SHARED_SECRET`; sem assinatura válida responde 401. O host continua `NASA_SYNC_BASE_URL`. |
| RF-4 | O NERP pode pesquisar organizações, consultar tracking/status e atualizar somente `agencyOrganizationId` e `operationsTrackingId`; a validação de pertencimento do tracking é compartilhada com as configurações NASA. |
| RF-5 | `InfoTooltip` usa `Popover` acionado por clique e guarda leitura por usuário em `TrafegoInfoTipSeen`; textos longos dos pontos de painel e wizard listados no impacto tornam-se explicações sob o ícone de informação. |
| RF-6 | Campos já preenchidos no cadastro exibem selo de proveniência, sem novo campo no banco. O checklist de acessos mantém instruções completas e usa o tooltip apenas em termos técnicos (BM, Business ID, Pixel e Parceiros). |
| RF-7 | Materiais podem ser enviados por upload e/ou por `materialsProfileLink`; só upload consome `maxCreatives`; a regra de materiais aceitos considera pelo menos um criativo ou link de perfil. |
| RF-8 | `maskPhoneBr` e `isValidPhoneBr` são reutilizados em telefone do wizard, número oficial WhatsApp, briefing e WhatsApp de suporte da configuração. |
| RF-9 | A aba de desempenho faz refetch padrão a cada cinco minutos e identifica a fonte ao vivo com “atualiza sozinho”; não cria snapshots durante a leitura. |
| RF-10 | O wizard pergunta quantidade desejada de criativos (1–20; padrão 3), mostra preço configurável, e o checkout calcula extras além de `includedCreatives`; o pedido nasce com essa quantidade como `maxCreatives`. |
| RF-11 | `TrafegoSettings` configura `includedCreatives` e `extraCreativeBrlCents`; o preço inicial confirmado é R$40,00 por criativo extra. |
| RF-12 | No limite de uploads, o painel oferece top-up autenticado via Stripe Checkout. A sessão e webhook registram `TrafegoCreativeTopUp`; o pagamento é aplicado uma única vez, incrementa `maxCreatives` em transação e cria evento informativo. |
| RF-13 | Suporte no painel escreve a mensagem inbound na `Conversation` do lead, com `viaInChat`, `source: trafego_panel`, automações inbound e o formato de mensagem já consumido por `SupportThread`. A resposta da equipe ocorre no `/tracking-chat` e chega pelo canal real. |
| RF-14 | O histórico de `TrafegoSupportMessage` não é apagado nem migrado: a listagem do cliente une as linhas legadas, somente-leitura, e as novas `Message` da Conversation, por data. A marcação local de lido é removida. |
| RF-15 | O admin troca a thread de suporte por card com link para `/tracking-chat/{conversationId}`; `getTrafegoOrderAdmin` retorna `lead.conversation.id`. Procedures e hooks exclusivos do suporte admin legado são removidos. |
| RF-16 | Ao receber `trafego/order.created`, Inngest garante lead, Conversation e uma mensagem de sistema interna; não envia WhatsApp. O reload no inbound por grafia alternativa de telefone usa `lead.id`. |
| RF-17 | O painel possui aba “Prévia” após “Materiais”, com seleção de criativo/copy e mockups de feed e story Instagram, feed Facebook e busca Google. Sem criativo e copy selecionados, mostra estado vazio. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | A migration Fase E é integralmente aditiva e única; não renomeia ou retipa dados existentes. |
| RNF-2 | Nenhum I/O de rede ocorre dentro de `$transaction`; notificações pós-top-up são best-effort. |
| RNF-3 | O claim de top-up é atômico por status `PENDING`, portanto retries de `checkout.session.completed` e `payment_intent.succeeded` não duplicam saldo. |
| RNF-4 | A ponte NASA↔NERP falha fechada e valida autenticação, assinatura e timestamp em toda rota. |
| RNF-5 | Componentes client preservam uso mobile/touch, não incluem bibliotecas de máscara novas e evitam buscar ou serializar dados duplicados. |

## 4. Modelo de dados e contratos

Uma migration Prisma “Fase E” adiciona:

| Modelo | Alteração |
| --- | --- |
| `TrafegoOrder` | `materialsProfileLink String? @map("materials_profile_link")`, relação `topUps` |
| `TrafegoPendingPurchase` | `desiredCreativeCount Int? @map("desired_creative_count")` |
| `TrafegoSettings` | `includedCreatives Int @default(3)` e `extraCreativeBrlCents Int @default(4000)` (R$40,00 por criativo extra, confirmado) |
| `TrafegoCreativeTopUp` | pedido, quantidade, valor, status, referências Stripe, comprador e datas; índices por pedido e sessão |
| `TrafegoTopUpStatus` | `PENDING`, `PAID`, `EXPIRED`, `CANCELLED`, `REFUNDED` |
| `TrafegoInfoTipSeen` | `userId`, `tipKey`, `seenAt`, unicidade `[userId, tipKey]` |
| `User` | relações inversas de tips vistos e top-ups |

`TrafegoCreativeTopUp` mantém `purchasedByUser` com `onDelete: Restrict`; o pedido usa cascade.
Não há mudança em `Conversation`, `Message`, `MessageChannel` ou `TrafegoSupportMessage`.

## 5. Impacto técnico

### NASA

- Extrair filtro de pedidos em `src/features/trafego/server/lib/query-orders.ts` e reutilizá-lo em
  `src/app/router/trafego/admin/orders.ts`; expor KPI admin por `groupBy(status)`.
- Criar credencial da ponte em `src/features/trafego/server/lib/bridge-cred.ts` e rotas
  `src/app/api/trafego/bridge/{orders,kpi,organizations,settings}/route.ts`, além de
  `settings/tracking-options/route.ts`.
- Extrair em `trafego-settings.ts`: `assertTrackingBelongsToOrg`,
  `listOrgTrackingsWithStatuses`, `updateTrafegoAgencyLink` e
  `searchOrganizationsForTrafegoBridge`.
- Criar `info-tips.ts`, `topup.ts`, `use-trafego-info-tips.ts`, `use-trafego-topup.ts`,
  `shared/info-tooltip.tsx` e `lib/glossary.ts`.
- Alterar `materials-submitted.ts`, `creatives.ts`, `creatives-manager.tsx`, wizard de prazo,
  schemas, `pricing-tiers.ts`, checkout e criação de pedido para quantidade contratada.
- Estender `api/trafego/webhook/route.ts` por `metadata.kind === "trafego_topup"` e delegar a
  `server/lib/mark-topup-paid.ts`.
- Extrair `conversation-bridge.ts` de `send-client-whatsapp.ts`; reescrever `support.ts` em cima
  de Conversation/Message e adaptar o admin para link do tracking-chat.
- Registrar `inngest/functions/trafego/order-created.ts` em `api/inngest/route.ts`; corrigir
  `persist-canonical-inbound.ts` para recarregar por `lead.id`.
- Criar `components/panel/ad-mockups/` (`device-frame`, quatro mockups e `ad-preview-tab`) e inserir
  a aba no `order-detail.tsx`.

### NERP

- Adicionar credencial e cliente HTTP em `apps/web/src/lib/trafego-bridge-cred.ts` e
  `apps/web/src/http/nasa-trafego/client.ts`.
- Criar `apps/web/src/app/router/site/trafego.ts`, registrá-lo em `router/site/index.ts` e aplicar
  `requireAuthMiddleware` + `requireSiteAdminMiddleware`.
- Estender `use-site-admin.ts`, criar `site-trafego.tsx` e o wrapper
  `app/(site-admin)/site/trafego/page.tsx`; adicionar entrada a `PLATAFORMA_ENTRIES` no shell.

## 6. Critérios de aceite

- [ ] Sem credenciais da ponte, `GET /api/trafego/bridge/kpi` retorna 401; com assinatura válida,
  retorna a mesma contagem por status visível no admin NASA.
- [ ] A aba `/site/trafego` lista/busca os pedidos e permite selecionar uma organização e somente
  seus trackings válidos.
- [ ] Ao abrir uma explicação no celular e depois em outro dispositivo, o estado visto persiste.
- [ ] Com zero uploads, link de perfil e copy selecionada, o pedido é considerado com materiais
  submetidos; o link não reduz o limite de criativos.
- [ ] Os quatro campos de telefone aplicam máscara brasileira e validam com os helpers existentes.
- [ ] O painel com fonte `live` mostra “atualiza sozinho” e refaz a consulta sem criar snapshot.
- [ ] Uma compra inicial de cinco criativos quando três estão incluídos mostra a linha extra no
  Checkout e cria pedido com `maxCreatives = 5`.
- [ ] No limite, um top-up pago pela Stripe incrementa uma única vez `maxCreatives` e cria evento;
  a repetição do webhook não altera o valor novamente.
- [ ] Pedido criado dispara `trafego-order-created` com sucesso, aparece no tracking-chat com
  mensagem de sistema e não dispara WhatsApp extra.
- [ ] Mensagem enviada pelo Suporte do painel aparece na Conversation do tracking-chat; resposta da
  equipe é recebida pelo cliente no canal real; mensagens antigas continuam visíveis.
- [ ] A aba Prévia renderiza os quatro formatos a partir de criativo e copy selecionados e exibe
  estado vazio quando não existem seleções.

## 7. Casos de borda e decisões

| Caso | Resultado |
| --- | --- |
| Webhook Stripe duplicado | O primeiro `updateMany(PENDING → PAID)` vence; os demais não incrementam o pedido. |
| Cliente compra objetivo diferente | Nova compra no mesmo lead, nunca top-up do pedido atual. |
| Ordem antiga com suporte legado | A união ordenada preserva leitura; não há backfill ou drop. |
| Lead sem `leadId` ao escrever suporte | `ensureTrafegoLeadForOrder` cria/religa antes de criar Conversation. |
| Telefone inbound usa grafia alternativa | A recarga por PK do lead encontra a Conversation recém-criada. |
| Instância WhatsApp indisponível | A equipe responde no tracking-chat/in-chat; o painel não mantém uma thread alternativa. |

## 8. Operação e verificação

- Configurar nos dois repositórios o mesmo `TRAFEGO_BRIDGE_SHARED_SECRET` e
  `TRAFEGO_BRIDGE_API_KEY`, gerados fora do código; manter `NASA_SYNC_BASE_URL` no NERP.
- Após a migration única: executar `pnpm db:generate`, atualizar `SCHEMA_VERSION` em
  `src/lib/prisma.ts`, tocar catch-alls aplicáveis e validar `HEAD` do painel local.
- Para top-up local, encaminhar Stripe CLI a `/api/trafego/webhook` e verificar evento, registro de
  top-up e incremento de `maxCreatives`.

## 9. Decisão comercial confirmada

`extraCreativeBrlCents` inicia em `4000` (R$40,00 por criativo extra). O valor continua
configurável em `TrafegoSettings`, portanto alterações futuras não exigem novo deploy.
