---
id: 0009
titulo: trafeGO — operação pelo tracking, PIX, Astro, políticas, Release e KPIs sem digitação
dominio: trafego
status: em-revisao
autor: Weydson
criada: 2026-09-12
atualizada: 2026-09-12
branch: feature/W-trafego-self-service-20260908
pr:
peso: completa
---

# 0009 — trafeGO: operação pelo tracking, PIX, Astro, políticas, Release e KPIs

> Continuação da [0008](0008-trafego-self-service.md). A 0008 entregou a **venda** (wizard →
> Stripe → conta → painel). Esta spec entrega a **operação**: o gestor trabalha num tracking, o
> cliente é avisado a cada fase, paga por PIX se quiser, conversa com o Astro antes e depois de
> pagar, é protegido das políticas das plataformas e recebe orientação sobre o que anunciar.

---

## 1. Contexto

Hoje o status do pedido (`TrafegoOrderStatus`) vive **separado** das colunas do kanban: o gestor
muda status em `/admin/trafego`, o lead da venda cai num tracking genérico sem formulário, o
cliente só recebe **um** e-mail (ativação) e nunca é avisado das fases seguintes, só existe cartão,
`MATERIALS_SUBMITTED` nunca é gravado, o fluxo autenticado não lança financeiro nem lead, o Google
Ads é oferecido no wizard mas o checkout recusa (`trafegoPlatformSchema` sem `GOOGLE_ADS`), e o
KPI depende de alguém colar o ID da campanha.

O dono quer escalar nacionalmente com gestores juniores operando via Claude Code + MCP da Meta.
Para isso a operação precisa ser um **kanban** (mesa de trabalho que um júnior entende), o cliente
precisa ser conduzido (avisos, Release, recomendações) e as proteções (políticas, prazo, termos)
precisam acontecer **antes** do dinheiro entrar.

## 2. Objetivo

O gestor opera o pedido arrastando um card no tracking "TrafeGO"; o cliente vê e é avisado a cada
fase; paga por cartão ou PIX; é alertado sobre políticas e prazo antes de pagar; recebe do Astro o
Release, recomendações e copies; e os KPIs chegam ao painel sem ninguém digitar ID.

### Não-objetivos

- Publicar campanha automaticamente no Meta/Google (a execução continua humana via Claude Code).
- Pedir senha de redes sociais do cliente (acesso é por **parceiro** no Business Manager).
- PIX automático via gateway (Asaas não valida assinatura — 0008 §2); o PIX é **manual**.
- RAG das páginas oficiais de política (o módulo de embeddings do Astro é um stub) — a base é
  **curada em código** e revisada pela equipe.
- Raspagem de Instagram/Facebook para o Release (não há API pública; ficam como referência).
- Reembolso automático; estorno continua manual.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Existe um tracking de operação (`TrafegoSettings.operationsTrackingId`) com colunas mapeadas 1:1 aos status do pedido (`statusColumnMap`), mais a coluna `AWAITING_PAYMENT` (antes do dinheiro). |
| RF-2 | Toda mudança de status passa por **uma** função (`transitionTrafegoOrder`) que grava o pedido, o evento com `source`, move o card e dispara os avisos. |
| RF-3 | Mover o card no kanban muda o status do pedido (origem `KANBAN`); mudar status pelo admin/cliente/sistema move o card. Sem loop. |
| RF-4 | O lead nasce no "Continuar" do wizard, na coluna "Aguardando pagamento", com telefone normalizado igual ao `wa_id` do inbound WhatsApp. |
| RF-5 | As respostas do wizard viram uma resposta do formulário "Briefing TrafeGO" no card do lead (`authorKind: LEAD`), rotulada com o código do pedido quando ele nasce. |
| RF-6 | Ao pagar (cartão ou PIX) o cliente recebe o link de ativação por **e-mail e WhatsApp**; a cada fase com copy definida (`CLIENT_STATUS_COPY`) recebe aviso por ambos. |
| RF-7 | Todo pedido nasce em `ACCOUNT_REVIEW` ("Análise da conta de tráfego"); o cliente pode subir materiais nessa fase; `MATERIALS_SUBMITTED` é gravado automaticamente quando há ≥1 criativo e ≥1 copy selecionada. |
| RF-8 | Financeiro: receita PAGA = taxa + setup, com conta e categoria configuradas; verba = conta a PAGAR pendente; roda nos três caminhos (público, autenticado, PIX). |
| RF-9 | PIX manual: chave/titular/banco em `TrafegoSettings`; referência curta `TGP-xxxx`; validade configurável (48 h); confirmação por participante do tracking ou admin; claim atômico compartilhado com o webhook Stripe. |
| RF-10 | Chat público no `/trafego` (persona Astro) abre após o wizard com resumo determinístico e botões Cartão/PIX; texto livre usa LLM com tools **só de leitura**. |
| RF-11 | Wizard: destino (SITE/LINK/WHATSAPP/INSTAGRAM + valor), público em **checklist** com "Outros" e pergunta de categoria especial, etapa **Prazo** com data realista e reconhecimento, telefone obrigatório, opt-in de WhatsApp. |
| RF-12 | Políticas: `prescreenAdContent` (determinístico) + `checkAdCompliance` (LLM estruturado) classificam OK/WARNING/BLOCKED; WARNING exige reconhecimento antes do checkout; BLOCKED impede o checkout automático. |
| RF-13 | Meta: campanha cujo nome contém `TG-NNNN` é vinculada ao pedido pelo cron de estrutura; painel lê ao vivo (cache 15 min) quando o snapshot está velho. |
| RF-14 | Painel: Astro com `toolScope: "trafego"` (Release, políticas, recomendações, status), isento de Stars para org `appScope = "trafego"`. |
| RF-15 | O WhatsApp de contato é verificado por código de 6 dígitos antes do pagamento (fail-open: sem instância, o wizard segue e o card mostra "não verificado"). |
| RF-16 | Meta Ads: o cliente informa o @ do Instagram ou a página do Facebook; o perfil é buscado na Graph API e exibido num mockup de celular com "Conta encontrada" e o selo da plataforma quando houver. |
| RF-17 | WhatsApp Oficial: o cliente diz se já tem número na API Oficial; se sim, o número é conferido; se não, o setup cobre a aquisição e a configuração, e o wizard explica o aquecimento progressivo de volume. |
| RF-18 | A frase do hero vira uma animação de seis passos, com versão estática sob `prefers-reduced-motion`. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Falha em aviso/financeiro/lead **nunca** invalida um pagamento já confirmado (best-effort fora da transação — CLAUDE.md regra 18). |
| RNF-2 | Nenhum I/O de rede dentro de `$transaction`. |
| RNF-3 | Avisos ao cliente são idempotentes por `eventId` (retry do Inngest não duplica). |
| RNF-4 | O chat público não importa `src/features/astro` (as tools de lá escrevem na org) e é limitado por IP (20 req/min). |
| RNF-5 | `pixKey` só é exposta pela procedure de escolha do PIX, nunca por `getPublicConfig`. |
| RNF-6 | Migrations aditivas; nada existente muda de tipo ou nome. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um pedido `IN_REVIEW` com card no tracking, quando o gestor arrasta o card para "Agendada", então `TrafegoOrder.status = SCHEDULED`, existe um `TrafegoOrderEvent` com `source = KANBAN`, o painel do cliente mostra "Agendada" e o cliente recebe WhatsApp + e-mail.
- [ ] **CA-2** — Dado o mesmo pedido, quando o admin muda o status para `RUNNING` em `/admin/trafego`, então o card vai para "No ar", `startedAt`/`endsAt` são preenchidos e **nenhum** evento adicional de origem `KANBAN` é criado (sem loop).
- [ ] **CA-3** — Quando o card é movido para uma coluna sem mapeamento, então o status do pedido não muda e é criado um evento interno "Card movido para coluna sem status mapeado".
- [ ] **CA-4** — Quando o card é arrastado para "Pagamento confirmado" ou "Aguardando pagamento", então nada muda no pedido (dinheiro só se confirma por Stripe/PIX).
- [ ] **CA-5** — Dado o wizard preenchido com `(86) 99822-1810`, quando o cliente clica "Continuar", então existe um lead em "Aguardando pagamento" com `phone = 5586998221810` e uma resposta "Briefing TrafeGO" no card; quando esse número envia uma imagem à instância do tracking, a mensagem cai na `Conversation` desse **mesmo** lead.
- [ ] **CA-6** — Dado um pedido com 0 criativos em `ONBOARDING`, quando o cliente sobe 1 criativo e tem 1 copy selecionada, então o status vira `MATERIALS_SUBMITTED` sozinho; em `ACCOUNT_REVIEW` só `materialsSubmittedAt` é carimbado e o status avança ao sair da análise.
- [ ] **CA-7** — Dado pagamento confirmado por PIX, então: pending `PAID`, e-mail + WhatsApp com link, `PaymentEntry` RECEBER/PAGA = taxa + setup na conta/categoria configuradas, `PaymentEntry` PAGAR/PENDENTE = verba, card em "Pagamento confirmado".
- [ ] **CA-8** — Confirmar o mesmo PIX duas vezes devolve `alreadyPaid` sem efeitos; cartão pago após PIX confirmado gera notificação de duplicidade para o admin.
- [ ] **CA-9** — PIX vencido (48 h) vira `EXPIRED` pelo cron e **ainda** pode ser confirmado.
- [ ] **CA-10** — Valor recebido ≠ valor do pedido marca `amountMismatch = true` e aparece no filtro do admin.
- [ ] **CA-11** — Ramo "clínica de emagrecimento com Mounjaro" → `BLOCKED` com link da política; sem checkout; CTA WhatsApp. "Outros: emagreça em 30 dias" → `WARNING` com reconhecimento obrigatório.
- [ ] **CA-12** — Categoria especial "imóveis" esconde gênero/idade/raio no checklist de público.
- [ ] **CA-13** — Sem BM + data desejada amanhã → data realista = hoje + 5 dias úteis; o checkout exige `startAcknowledgedAt`.
- [ ] **CA-14** — Chat: "quanto pago com R$ 1.000 sem BM?" → R$ 1.850; "posso anunciar Ozempic?" → recusa com a política; 21ª mensagem no minuto → 429.
- [x] **CA-15** — Campanha Meta `TG-0007 — Teste` é vinculada ao pedido após o cron de estrutura; duas campanhas com o mesmo código → notificação, nada vinculado. Vínculo existente nunca é sobrescrito.
- [x] **CA-16** — Painel `RUNNING` sem snapshot → `source: "live"`; no dia seguinte `source: "snapshot"`; nenhuma linha em `MetaAdsKpiSnapshot` é criada pela leitura ao vivo.
- [x] **CA-17** — Astro no painel de org trafeGO expõe só as tools do módulo trafeGO (nenhuma da plataforma) e não debita Stars nem no stake nem por token.
- [x] **CA-20D** — Site + PDF viram Release com os sete campos; Instagram e Facebook entram como referência, com observação explicando que não são lidos.
- [x] **CA-21D** — Salvar o Release atualiza o Briefing do card e refaz as recomendações; falha em qualquer um dos dois não desfaz o que o cliente salvou.
- [x] **CA-22D** — `copies.suggest` só roda com Release salvo, cria no máximo o que cabe no plano, marca `SUGGESTED_BY_NASA` e **nunca** nasce selecionada.
- [x] **CA-23D** — Copy com "resultado garantido" mostra selo de atenção com a regra, o trecho, como resolver e o link da política oficial.
- [x] **CA-24D** — Verba de R$ 300/30 dias no Meta é apontada como `below_minimum` (R$ 10,00/dia) e o formato recomendado para prospecção é vídeo.
- [ ] **CA-18** — Fluxo autenticado (`flow = "authenticated"`) também gera lead, briefing e financeiro.
- [ ] **CA-19** — Google Ads + `SEARCH` passam no checkout (fim do 422).
- [ ] **CA-20** — Pedir código no wizard envia WhatsApp com 6 dígitos; código certo marca verificado e a compra nasce com `phoneVerifiedAt`; código errado/expirado não marca; 6ª tentativa de envio no mesmo IP em 10 min → 429.
- [ ] **CA-21** — `@` de conta comercial existente mostra o mockup com foto, seguidores e "Conta encontrada"; perfil pessoal ou inexistente mostra "não encontramos" sem bloquear o avanço.
- [ ] **CA-22** — WhatsApp Oficial com "já tenho" + número ativo mostra o nome verificado; número inexistente mostra o aviso; "não tenho"/"não sei" cobra o setup e o line item do Stripe diz "Setup do número na API Oficial".
- [ ] **CA-23** — O card do gestor mostra, no Briefing, a conta social encontrada, o número na API e se o WhatsApp foi verificado.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Cliente recorrente (mesmo telefone) compra de novo com campanha `RUNNING` | Lead não muda de coluna; novo pending liga ao mesmo lead; ao virar pedido, o card passa a espelhar o pedido mais recente não-terminal e `nickname` mostra o código. |
| CB-2 | Lead do pedido foi movido para outro tracking | `transitionTrafegoOrder` não move o card (evento interno); varredura horária notifica admin em vez de puxar de volta. |
| CB-3 | Lead apagado (FK `SetNull`) | Próxima transição recria o card via `ensureTrafegoLeadForOrder`. |
| CB-4 | Card movido por workflow/Astro (caminhos que não publicam no bus) | Varredura horária: se `lead.lastStatusChangeAt < order.updatedAt` move o card; senão notifica admin. **Pedido é a autoridade.** |
| CB-5 | Meta entrega `wa_id` com 12 dígitos (sem o 9) | `normalizePhoneToMetaE164` insere o 9 nos dois lados; hardening opcional no inbound faz segunda busca antes de criar lead. |
| CB-6 | Wizard sem telefone | Fase B torna telefone obrigatório; até lá, lead dedupa por e-mail e o comprovante pode criar um segundo card (aceito na Fase A). |
| CB-7 | Template WhatsApp não aprovado / instância Uazapi | Meta sem template → tenta texto (só passa na janela de 24 h) e registra `reason`; Uazapi → texto direto. E-mail vai sempre. |
| CB-8 | Cliente pagou cartão **e** PIX | Primeiro claim vence; o segundo caminho notifica admin "cobrança duplicada — estornar". |
| CB-9 | `financeAccountId` de outra org | `updateTrafegoSettings` recusa; sem configurar, os lançamentos saem sem conta/categoria (como hoje). |
| CB-10 | Retry do Inngest em `order.status-changed` | Idempotente por `eventId`; `clientNotifiedAt` já preenchido → skip. |
| CB-11 | Coluna do mapa apagada no tracking | `statusIdForColumnKey` devolve null → transição não move card + evento interno; admin reprovisiona pelo botão (merge por nome). |
| CB-12 | Prescreen falso-positivo bloqueando venda legítima | Admin cria o pending manualmente com `complianceOverrideByUserId`; o card registra quem liberou. |
| CB-13 | Nome de campanha com dois códigos (`TG-0007 e TG-0008`) | Ignorada (ambígua) + notificação. |
| CB-14 | Leitura ao vivo com token Meta expirado | Devolve `reason: "live_unavailable"` e mantém o último snapshot; nunca lança. |
| CB-15 | Astro no painel chamado por org sem `appScope` | Escopo normal (`full`), Stars cobradas — comportamento atual preservado. |
| CB-16 | Agência sem integração Meta ou sem instância Uazapi | `getPublicConfig.verification` devolve `false` e os botões de verificar somem; o wizard segue e a equipe confere na análise da conta. |
| CB-17 | Cliente troca o telefone depois de verificar | A verificação volta para "idle" no browser; o checkout só carimba `phoneVerifiedAt` se existir prova para o número enviado. |
| CB-18 | Cliente troca de canal no meio do wizard | Conta social, número na API e checagens são zerados — cada canal pergunta a sua. |
| CB-19 | Instagram informado é perfil pessoal | Business Discovery não encontra; mockup explica que é preciso conta comercial, sem travar a compra. |

## 6. Decisões de design

### D-1 — Tracking, não Workspace
- **Escolha**: o tracking é a mesa de operação.
- **Alternativas descartadas**: Workspace (board de tarefas) — a instância de WhatsApp é 1:1 com tracking, o formulário se prende ao lead e workflows por coluna já existem.
- **Consequência**: `TrafegoSettings.salesTrackingId` continua aceito, mas a operação usa `operationsTrackingId`.

### D-2 — Pedido é a autoridade; card é espelho
- **Escolha**: em divergência, o card segue o pedido.
- **Alternativas descartadas**: "último que escreveu vence" — o pedido carrega `startedAt/endsAt` e consequências contratuais.

### D-3 — `leadId` do pedido não é único
- **Escolha**: N pedidos por lead; card espelha o pedido corrente (mais recente não-terminal).
- **Alternativas descartadas**: um lead por pedido — colide com `@@unique([phone, trackingId])` e polui o kanban.

### D-4 — Briefing como resposta `authorKind: LEAD`
- **Escolha**: as respostas foram preenchidas pelo cliente; `SYSTEM` significa "criada em branco por automação".

### D-5 — Receita = taxa + setup (não o total)
- **Escolha do dono**: a verba é repasse e fica como conta a pagar; somar inflaria faturamento.

### D-6 — `ACCOUNT_REVIEW` para todo pedido
- **Escolha**: a análise da conta acontece sempre, antes dos materiais (é onde se pega conta restrita). O cliente pode subir materiais em paralelo.

### D-7 — Confirmação de PIX por participante do tracking
- **Escolha do dono**: agilidade; a auditoria (`pixConfirmedByUserId`, `logActivity`) compensa.

### D-8 — Base de políticas curada em código
- **Escolha**: ruleset PT-BR com fontes e `reviewedAt`; prescreen determinístico nunca é rebaixado pelo LLM.
- **Alternativas descartadas**: RAG das páginas oficiais — o módulo de embeddings é um stub; entra quando for consertado.

### D-10 — Verificações são fail-open
- **Escolha**: nenhuma verificação bloqueia a venda; o que não foi confirmado vira aviso no card.
- **Alternativas descartadas**: exigir telefone verificado para pagar — perderia venda por instância offline, e o dinheiro é o passo mais frágil do funil.

### D-11 — Perfil social pela conta da agência (Business Discovery)
- **Escolha**: usar o IG Business da agência para consultar o perfil do cliente.
- **Alternativas descartadas**: OAuth do cliente no wizard (atrito antes de pagar) e raspagem (contra os termos e frágil).
- **Consequência**: só encontra contas Business/Creator; perfil pessoal aparece como "não encontrado" com a explicação.

### D-12 — Setup do WhatsApp Oficial usa a mesma tabela de faixas da BM
- **Escolha**: no canal WhatsApp, `needsSetup` passa a depender de ter número na API, não de ter BM.
- **Consequência**: quem já tem número não paga setup; o line item do Stripe muda de nome conforme o canal.

### D-9 — Kanban → pedido via `eventBus`, pedido → kanban via `prisma.lead.update` direto
- **Escolha**: o lado do pedido nunca publica no bus, então o subscriber nunca se reentra.

### D-13 — Regras duras decidem, modelo só redige

As recomendações (verba mínima por dia, formato por objetivo, destino × pixel) são decididas em
`lib/recommendation-rules.ts`, funções puras. O modelo recebe o veredito pronto e escreve o texto.
O inverso — pedir ao modelo que julgue — daria conselho diferente a cada refresh para o mesmo
pedido, e o cliente compararia com o que leu ontem. Sem `OPENAI_API_KEY`, a recomendação continua
existindo com a redação padrão.

### D-14 — Release é rascunho até o cliente salvar

`releaseGeneratedAt` marca o que o modelo escreveu; `releaseSavedAt`, o que uma pessoa conferiu.
Só o segundo alimenta copies sugeridas e recomendações. Texto gerado a partir de um site que
ninguém leu não pode virar anúncio pago no nome do cliente.

### D-15 — Redes sociais não são lidas

Instagram e Facebook ficam guardados como referência para o gestor abrir na mão. A Meta não expõe
conteúdo de perfil de terceiro por API e raspar violaria os termos — justamente os termos que este
produto promete ao cliente que respeita.

### D-16 — Astro do painel não debita Stars

A org trafeGO tem `appScope = "trafego"`: o cliente contratou tráfego, não a plataforma. Ele não
tem saldo de Stars e não deveria precisar comprar para tirar dúvida sobre a própria campanha — a
taxa de serviço já cobre. A isenção vale para o stake e para a cobrança por token.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`) — aditivo, 4 migrations (uma por fase)
- [x] Procedures oRPC — novas (`ops.*`, `public.createPendingPurchase`, `public.choosePix`, `admin.settings.provision*`, `release.*`, `recommendations.*`) e assinatura de `admin.settings.update`
- [x] Realtime (event-bus) — novo subscriber `lead.status_changed`; payload ganha `actorUserId`
- [x] Automações (Inngest) — `trafego/order.status-changed`, `trafego/order.created`, crons `trafego-kanban-drift-sweep`, `trafego-pix-pending-sweep`, `trafego/release.generate`
- [x] Env vars — `OPENAI_API_KEY` (existe), `ANTHROPIC_API_KEY` (existe)
- [ ] Breaking change — não
- [x] Documentação obrigatória — `docs/trafego-overview.md`; `docs/whatsapp-oficial-overview.md` se template com botão

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1..4 | manual | Arrastar card / mudar no admin; conferir `trafego_order_event.source`, painel, WhatsApp/e-mail |
| CA-5 | manual | Wizard com o número da equipe; enviar imagem; conferir `Conversation.leadId` |
| CA-6 | manual | Subir criativo + copy; conferir status/`materials_submitted_at` |
| CA-7..10 | manual | Escolher PIX; "Confirmar PIX" como participante; conferir `payment_entries` e card |
| CA-11..13 | manual | Wizard com os textos citados |
| CA-14 | manual | Chat público |
| CA-15..16 | manual | Criar campanha com o código; rodar `sync-meta-ads-structure`; painel |
| CA-17 | manual | Painel de org trafeGO: conferir tools expostas e ausência de débito em `star_transactions` |
| CA-20D..21D | manual | Painel → aba Release: site + PDF, gerar, salvar; conferir `release_saved_at`, Briefing do card e `recommendations` |
| CA-22D..23D | manual | Painel → Materiais → "Sugerir com o Astro"; editar copy com "resultado garantido" |
| CA-24D | automático | `recommendation-rules.ts` — funções puras, verificadas na implementação |
| CA-18..19 | manual | Fluxo autenticado; wizard Google |

## 9. Riscos e rollback

- Migrations são aditivas e reversíveis por `DROP COLUMN`/`DROP TYPE` (o valor de enum
  `ACCOUNT_REVIEW` não pode ser removido sem recriar o tipo — deixar).
- Rollback funcional: desligar `clientNotificationsEnabled`, limpar `operationsTrackingId` (o
  subscriber ignora tudo) e remover o passo de auto-link do cron.
- Risco: template WhatsApp reprovado → só e-mail até aprovar. Risco: falso-positivo de política →
  override manual pelo admin.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-12 | Weydson | Criada a partir do plano aprovado (Fases A–D). |
| 2026-09-12 | Weydson | + RF-15..18, CA-20..23, CB-16..19 e D-10..12: verificação de WhatsApp por código, conta social com preview, número na API Oficial com aquecimento e hero animado. |
| 2026-09-12 | Weydson | Chat público (RF-10, CA-14) implementado — sem os botões de pagamento, que ficaram no passo Contato do wizard. **Fase B completa.** |
| 2026-09-12 | Weydson | Políticas (RF-12, CA-11) e prazo realista (RF-11, CA-13) implementados. O prazo virou tela própria (04B), sub-tela de Negócio. |
| 2026-09-12 | Weydson | PIX manual implementado (RF-9, CA-7..10, CB-8). Ajuste ao plano: a escolha de pagamento vive no passo Contato, não num chat — o chat público (RF-10) continua pendente. |
| 2026-09-13 | Weydson | **Fase C implementada** (RF-13, CA-15..16): auto-link por `TG-NNNN` no cron de estrutura e leitura ao vivo com cache de 15 min. |
| 2026-09-13 | Weydson | **Fase D implementada** (RF-14, CA-17): Astro com escopo `trafego` e isento de Stars, Release, recomendações, copies sugeridas e checklist de acessos. Divergências do plano: (a) a aba de acessos e o Release viraram **abas próprias** do painel, não seções da aba Materiais — o cliente entra no painel para uma coisa de cada vez; (b) o Release lê as fontes num **step do Inngest por fonte**, para que um PDF ilegível não derrube a leitura do site; (c) `release.get` devolve `partnerBusinessId` e `supportWhatsapp` das settings, evitando uma segunda query só para a aba Acessos. + CA-20D..24D e D-13..16. |
