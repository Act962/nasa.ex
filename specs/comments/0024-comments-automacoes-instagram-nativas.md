---
id: 0024
titulo: Migrar automações de Instagram do comments-app para dentro do NASA
dominio: comments
status: em-revisao
autor: João Gabriel
criada: 2026-09-24
atualizada: 2026-09-24
branch: claude/comments-app-migration-bba122
pr:
peso: completa
---

# 0024 — Migrar automações de Instagram do comments-app para dentro do NASA

---

## 1. Contexto

O **comments-app** (`C:\Users\Dev\Desktop\comments-app`) é um SaaS Next.js
separado que conecta o Instagram e responde automaticamente a comentários e DMs
por palavra-chave. Ele será **descontinuado**. Não há usuário em produção, então
não existe migração de dados — é adição limpa.

Hoje o NASA **já expõe** um app "COMMENTS" no hub, mas ele é apenas um **proxy
S2S**: 2.281 linhas em `src/features/comments/`, `src/app/router/comments/` e
`src/http/comments/` que assinam HMAC e chamam procedures tRPC do comments-app
remoto. Quando o comments-app sair do ar, esse app quebra inteiro.

Três limitações do comments-app que motivam reescrever em vez de portar 1:1:

1. **Match global por organização.** `matchKeyword(text, organizationId)`
   (`src/actions/webhook/index.ts`) varre *todas* as keywords de *todas* as
   automações ativas da org, ordena por tamanho e devolve a primeira que casa.
   O filtro por post (`getKeywordPost`) só roda **depois**. Com duas automações
   na mesma org, a keyword de uma pode sequestrar o comentário da outra.
2. **Só "contém".** Não há exclusão ("não contém"), não há "qualquer
   comentário", não há modo exato.
3. **Resposta pública única.** `Listerner.commentReply` é um texto fixo; repetir
   a mesma frase em todos os comentários é padrão reconhecível de bot.

O ManyChat — referência funcional pedida — resolve os três: alvo do post
(específico / todos / próximo), gatilho por keywords **contém** + **não contém**
+ **qualquer comentário**, e resposta pública sorteada de uma lista.

## 2. Objetivo

As automações de comentário e DM do Instagram rodam **nativamente** dentro do
NASA, escopadas por organização, sem nenhuma dependência do comments-app — sobre
um modelo de dados **agnóstico de rede social**, em que acrescentar um canal novo
(Facebook, WhatsApp, Telegram, TikTok) é escrever um adapter, não alterar o
domínio nem migrar tabela.

### Não-objetivos

Ficam **fora** deste PR (alguns viram fase própria — ver §11):

- **Sorteios** (`Sorteio*` do comments-app). Não entra, em nenhuma fase.
- **Stripe / planos `free|pro` do comments-app.** A cobrança do NASA é a do
  NASA; nada de `Subscription` paralela.
- **OAuth do Instagram.** Nesta fase a conexão é por **credenciais manuais**
  (decisão do time — ver D-2). OAuth vira fase futura.
- **Edição livre do grafo** — node selector, arrastar/conectar nó à mão, N
  passos encadeados, delay e condição. O PR 1 **tem canvas** (ver D-9), mas ele
  é renderizado a partir dos dados: dois nós, `Quando → Então`. O modelo de
  dados já nasce preparado para crescer.
- **Notificações próprias do comments.** Reusa a feature `notifications` do NASA.
- **Migração de dados.** Não há usuário em produção no comments-app.
- **Qualquer canal além do Instagram.** O modelo e os ports nascem genéricos
  (D-8, D-10), mas só existe um adapter: Instagram. Nenhum outro provider é
  implementado, testado ou exposto na UI.
- **Instalar runner de teste.** Os *seams* de teste ficam prontos (D-10); o
  Vitest e o `docker-compose.test.yml` seguem o roadmap de
  [`testes-estrategia.md`](../../docs/testes-estrategia.md), fora deste PR.
- **Mexer no fluxo DM → Lead existente** (`/api/integrations/instagram/webhook`).
  Ele continua como está; a automação nasce em endpoint próprio (ver D-7).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Owner/admin conecta o Instagram informando **manualmente**: Instagram Account ID, Access Token, App Secret e Verify Token. Uma conexão por organização. |
| RF-2 | A tela de conexão exibe a **URL do webhook** e o **Verify Token** para o usuário colar no App da Meta dele, com botão de copiar e instrução dos campos a assinar (`comments`, `messages`). |
| RF-3 | `accessToken`, `appSecret` e `verifyToken` viajam num **blob cifrado** (`SocialChannel.credentials`, AES-256-GCM via `@/lib/crypto`), com shape por provider validado por Zod. `externalAccountId` e `webhookPathToken` ficam em texto puro — são chaves de roteamento. A UI exibe segredo só como `••••1234`. |
| RF-4 | `GET` do webhook responde o `hub.challenge` quando `hub.verify_token` confere com o da conexão; caso contrário, 403. |
| RF-5 | `POST` do webhook valida `x-hub-signature-256` (HMAC-SHA256 sobre o **raw body**) contra o App Secret da conexão. Assinatura inválida ou ausente → 401, sem processar. |
| RF-6 | Todo evento é registrado antes de processar; reentrega da Meta com o mesmo id de comentário/mensagem é **descartada** (idempotência). |
| RF-7 | CRUD de automações escopado por `organizationId`: criar, renomear, listar, ativar/desativar, excluir. |
| RF-8 | Automação tem 1..N **gatilhos**. Gatilho é do tipo `COMMENT` ou `DM`. |
| RF-9 | Gatilho `COMMENT` tem alvo: **posts específicos** (1..N posts escolhidos) ou **todos os posts** da conta. |
| RF-10 | Regras de match do gatilho: `CONTAINS` (lista de palavras que **devem** aparecer, OR entre elas) ou `ANY` (qualquer comentário/mensagem). Em ambos os modos vale a lista de **exclusão**: se o texto contém qualquer palavra excluída, o gatilho **não** dispara. |
| RF-11 | Match é **case-insensitive e acento-insensitive** ("promoção" casa "PROMOCAO"). |
| RF-12 | O match roda **dentro do escopo do post**: só concorrem gatilhos cujo alvo cobre aquele `mediaId` (ou `ALL_POSTS`). Dois gatilhos elegíveis no mesmo post → vence o de maior **especificidade** (mais palavras casadas; empate → `createdAt` mais antigo). Nunca mais de uma automação responde ao mesmo comentário. |
| RF-13 | Ação de resposta privada: envia DM ao autor do comentário (`recipient: { comment_id }` para comentário; `recipient: { id }` para DM), com texto estático e até **3 botões** `web_url`. |
| RF-14 | Ação de resposta pública: responde no próprio comentário, sorteando o texto de uma **lista de variações** (1..N). Lista vazia = não responde publicamente. |
| RF-15 | Texto é quebrado em blocos de no máximo **950 bytes UTF-8**; mensagem com botões usa o template de botão com texto truncado em **640 bytes**. |
| RF-16 | Resposta por IA continua disponível (equivalente ao `SMARTAI`), porém **medida e cobrada em Stars** pelo catálogo único (spec 0020). Sem saldo → cai para o texto estático se houver, senão não responde e registra o motivo. |
| RF-17 | Cada disparo grava execução: automação, gatilho, tipo, autor, resultado (`SENT`, `SKIPPED`, `FAILED`) e erro. Contadores de DM e de resposta pública por automação. |
| RF-18 | Resposta 401/403 da Graph API marca a conexão como `NEEDS_RECONNECT`, grava a mensagem de erro e emite notificação para a organização. |
| RF-19 | O app proxy atual é **desregistrado** (fora do router e do hub), não apagado. |
| RF-20 | O editor tem duas áreas: **painel** de edição à esquerda (1 — post/reel, 2 — gatilho, 3 — resposta pública) e **canvas** `@xyflow/react` à direita mostrando `Quando → Então`. Toda escrita acontece pelo painel. |
| RF-21 | Os nós do canvas usam os mesmos componentes visuais das automações do NASA (`@/components/react-flow/base-node`, `node-status-indicator`, `@/components/workflow-node`), para o usuário reconhecer a mesma linguagem. |
| RF-22 | No PR 1 o canvas é **derivado**: posições calculadas automaticamente, sem persistir layout, sem node selector, sem criar ou conectar nó à mão. Arrastar não salva nada. |
| RF-23 | O canvas reflete o estado real da automação: gatilho sem palavra-chave, resposta vazia ou conexão quebrada aparecem como nó em estado de erro, e o botão de ativar explica o que falta. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O `POST` do webhook responde em < 2s no p95 (Meta reentrega e desativa assinaturas lentas). |
| RNF-2 | Segredo nunca aparece em log, resposta de procedure ou mensagem de erro. |
| RNF-3 | Lookup da conexão no webhook é `findUnique` por `instagramAccountId` (índice único) — constante, não varredura de JSON. |
| RNF-4 | Nenhuma chamada de rede (Graph API, IA, Pusher) dentro de `prisma.$transaction` (regra 18 do CLAUDE.md). |
| RNF-5 | A migration é aditiva: só tabelas novas, nenhum `DROP` nem `NOT NULL` em coluna existente. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado que a org não tem conexão, quando o admin salva Account ID + Token + App Secret + Verify Token, então a conexão é criada, os três segredos ficam cifrados no banco e a tela passa a exibir a URL do webhook e o verify token.
- [ ] **CA-2** — Dado uma conexão com verify token `T`, quando a Meta chama `GET <webhook>?hub.mode=subscribe&hub.verify_token=T&hub.challenge=C`, então a resposta é `200` com corpo `C` em texto puro; com token diferente, `403`.
- [ ] **CA-3** — Dado um `POST` de webhook sem `x-hub-signature-256` ou com assinatura que não bate, então a resposta é `401` e nenhuma automação é avaliada.
- [ ] **CA-4** — Dado um comentário já processado, quando a Meta reentrega o mesmo evento, então nada é enviado e a resposta é `200`.
- [ ] **CA-5** — Dado um gatilho `COMMENT` com alvo no post `P` e keyword `preço`, quando chega o comentário "qual o PREÇO?" no post `P`, então o autor recebe a DM e o comentário recebe uma resposta pública da lista.
- [ ] **CA-6** — Mesmo cenário do CA-5, mas o comentário chega em outro post `Q` não vinculado: nada é enviado.
- [ ] **CA-7** — Dado um gatilho com exclusão `["golpe"]` e keyword `preço`, quando chega "qual o preço desse golpe?", então nada é enviado.
- [ ] **CA-8** — Dado um gatilho com modo `ANY` no post `P`, quando chega qualquer comentário em `P`, então a automação dispara.
- [ ] **CA-9** — Dadas duas automações ativas na mesma org, uma com alvo no post `P` e outra no post `Q`, quando chega comentário em `P`, então **apenas** a automação de `P` responde.
- [ ] **CA-10** — Dada uma lista de 3 respostas públicas, quando 10 comentários disparam a automação, então mais de uma variação distinta é usada.
- [ ] **CA-11** — Dado um texto de 1.400 bytes UTF-8, quando é enviado, então chega dividido em blocos e nenhum bloco excede 950 bytes.
- [ ] **CA-12** — Dado um token revogado, quando a Graph API devolve 401, então a conexão fica `NEEDS_RECONNECT`, o erro é gravado e a organização recebe notificação — e o evento não é reprocessado em loop.
- [ ] **CA-13** — Dado `pnpm build` (`next build`), então o build passa sem erro de tipo com o app nativo registrado e o proxy desregistrado.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Comentário feito pelo **dono da conta** (`accountId === fromId`) | Ignorar. Sem isso a automação responde a si mesma em loop. |
| CB-2 | DM `is_echo` (eco da própria mensagem enviada) | Ignorar. |
| CB-3 | Comentário **sem texto** (só figurinha/emoji/GIF) | Modo `ANY` dispara; modo `CONTAINS` não. Texto vazio nunca casa keyword. |
| CB-4 | Comentário é **resposta a outro comentário** (thread) | Dispara normalmente na fase 1; registrar na execução que veio de thread. |
| CB-5 | Comentário **apagado** antes da resposta sair | Graph devolve erro de objeto inexistente → execução `FAILED`, sem retry. |
| CB-6 | Resposta privada fora da janela permitida pela Meta (7 dias do comentário) | Erro da Graph → `FAILED` com motivo explícito na execução; não marca a conexão como quebrada. |
| CB-7 | Usuário bloqueou DMs / não permite mensagem | `FAILED`; a resposta pública ainda é tentada. |
| CB-8 | Dois gatilhos da **mesma** automação casam o mesmo comentário | Vence o de maior especificidade (RF-12); executa **um** só. |
| CB-9 | Automação desativada entre o recebimento e o processamento | Reconferir `isActive` imediatamente antes de enviar; se desativou, `SKIPPED`. |
| CB-10 | Conexão marcada `NEEDS_RECONNECT` | Webhook continua aceitando e registrando o evento, mas não envia nada (`SKIPPED`). |
| CB-11 | Org **sem** conexão para o `instagramAccountId` do payload | `200` e descarte silencioso — pode ser webhook de outra app apontando errado. |
| CB-12 | O mesmo `instagramAccountId` já pertence a **outra** organização | Rejeitar o salvamento com erro claro; `@unique` garante no banco. |
| CB-13 | Payload com `entry.changes` de campo que não é `comments` (ex.: `mentions`, `live_comments`) | Ignorar sem erro. |
| CB-14 | A org usa **também** a integração Instagram existente (DM → Lead) com a mesma conta | Os dois caminhos coexistem e ambos agem (um cria lead, o outro responde). Sem dedupe entre sistemas nesta fase — documentado, não é bug. |
| CB-15 | Post escolhido é apagado no Instagram | A automação deixa de casar; UI mostra o post como indisponível ao recarregar a mídia. |
| CB-16 | Resposta da IA vem vazia | Cai para o texto estático se houver; senão `SKIPPED` com motivo. |
| CB-17 | Burst de comentários (viral) | Idempotência + `SKIPPED` por conexão quebrada seguram; rate limit por automação fica para a fase 2 (§11). |

## 6. Decisões de design

### D-1 — Módulo próprio, não a engine de Workflow

- **Escolha**: tabelas e executor próprios, no núcleo hexagonal
  `src/modules/social/` (D-10). A UI segue em `src/features/comments/` e as
  procedures em `src/app/router/comments/`, como adapters.
- **Alternativas descartadas**: reusar `Workflow`/`Node`/`Connection` + `run-workflow.ts` com uma família `IG_*` de `NodeType`. Seria elegante (branch, loop e IA de graça), mas `Workflow` **não tem `organizationId`** — o escopo hoje é `trackingId`/`workspaceId`. Encaixar Instagram exigiria mudar o escopo de um modelo no caminho quente de todo inbound de lead, com a engine já em produção.
- **Consequência**: dois motores de automação no repo. Aceito conscientemente; o builder visual reusa `@xyflow/react` para o usuário não perceber a diferença. Se a fase de canvas multi-passo (§11) provar que a duplicação dói, a ponte é converter `CommentsStep` em `Node` — por isso o modelo já nasce com gatilho e ação separados.

### D-2 — Credenciais manuais agora, OAuth depois

- **Escolha**: o usuário cria o App na Meta, cola Account ID + Token + App Secret + Verify Token, e a tela entrega a URL do webhook para ele assinar `comments` e `messages`.
- **Alternativas descartadas**: (a) reusar o Meta OAuth do NASA (`oauth-finalize.ts`, que já grava `PlatformIntegration{INSTAGRAM}`) — depende de Business Manager configurado e de revisão de permissões da app central; (b) portar o Instagram Login do comments-app — traria um segundo fluxo de token com refresh para manter.
- **Consequência**: onboarding mais técnico (o cliente precisa de um App Meta próprio), porém zero dependência de review da Meta para começar a operar, e cada org isolada no seu app. Espelha o que já foi feito no **WhatsApp Oficial** (`WhatsAppInstance.meta*`), que é o precedente do projeto.

### D-3 — Match escopado por (post × gatilho), com desempate explícito

- **Escolha**: a consulta parte do `mediaId` do comentário e só considera gatilhos daquele post ou `ALL_POSTS`. Empate resolve por especificidade, depois por antiguidade.
- **Alternativas descartadas**: manter o `matchKeyword` global por org do comments-app.
- **Consequência**: corrige o match cruzado e torna o comportamento previsível quando a org tem muitas automações — que é exatamente o estado para onde o app vai.

### D-4 — Resposta estática processa inline; resposta com IA vai para o Inngest

- **Escolha**: caminho estático (match + 1–2 chamadas Graph) executa dentro do request do webhook; caminho com IA enfileira evento Inngest e responde `200` na hora.
- **Alternativas descartadas**: (a) tudo inline, como no comments-app — a chamada de LLM coloca 2–5s dentro do webhook e viola RNF-1; (b) tudo no Inngest — atrasa a resposta pública, que é o efeito que o usuário final vê, e cria dependência de `pnpm inngest:dev` para qualquer teste local.
- **Consequência**: dois caminhos de execução; ambos passam pelo mesmo registro de idempotência, gravado **antes** de bifurcar.
- ⚠️ **Divergência na implementação (2026-09-24)**: o caminho com IA **não** foi para o Inngest — `StarsAiReplyGenerator` é chamado dentro do request do webhook, como o caminho estático. O port `AiReplyGenerator` já isola a chamada, então mover para o Inngest depois é trocar o adapter no composition root, sem tocar em `application/`. Enquanto não for movido, prompt longo pode empurrar o webhook além do RNF-1. Registrado como dívida em [`docs/comments-overview.md`](../../docs/comments-overview.md) §8.

### D-5 — Segredo cifrado, identificador em texto puro

- **Escolha**: espelhar `WhatsAppInstance`: `accessToken`, `appSecret` e `verifyToken` cifrados com `@/lib/crypto`; `instagramAccountId` em claro, `@unique`, porque é a chave de lookup do webhook.
- **Alternativas descartadas**: tudo em `PlatformIntegration.config` como JSON plano, que é o que o Meta OAuth faz hoje (e que a auditoria de 2026-08 já aponta).
- **Consequência**: depende de `AI_SECRETS_KEY` em produção. Sem a chave, salvar conexão falha com erro explícito em vez de gravar segredo em claro.

### D-6 — O proxy é desregistrado, não apagado

- **Escolha**: `src/features/comments/` (proxy) passa a `src/features/comments-remote/`, `src/app/router/comments/` a `src/app/router/comments-remote/`, ambos fora do `router/index.ts` e do hub. O caminho `/comments` e o card do hub passam a apontar para o app nativo.
- **Alternativas descartadas**: deletar as 2.281 linhas no mesmo PR — dificulta consultar como o contrato antigo funcionava enquanto o nativo amadurece.
- **Consequência**: código morto no repo por um ciclo. Remoção vira item de limpeza depois que o nativo estiver em uso.

### D-7 — Endpoint de webhook dedicado

- **Escolha**: `POST /api/comments/webhook/instagram`, separado de `/api/integrations/instagram/webhook` (DM → Lead).
- **Alternativas descartadas**: estender o endpoint existente com `entry.changes`. Ele hoje cria lead, chama Pusher, S3, round-robin e o agente de IA — caminho quente e sensível que não deve ganhar uma segunda responsabilidade nesta entrega.
- **Consequência**: o app da Meta do cliente aponta para o endpoint novo. Se a org também usar a integração central, os dois convivem (CB-14).

### D-8 — Modelo de dados agnóstico de canal

- **Escolha**: nenhum nome de tabela ou coluna cita Instagram. A rede social é um
  **valor** (`SocialProvider`), não uma estrutura. Prefixo `Social*`.
- **Alternativas descartadas**: (a) modelar `CommentsConnection` / `CommentsPost` / `instagramAccountId`, como no comments-app — cada rede nova viraria um conjunto paralelo de tabelas e um segundo executor; (b) tabela por provider com herança emulada — multiplica índice, migration e caminho de query sem ganho.
- **Consequência**: um comentário do Instagram e uma mensagem do Telegram são a
  mesma linha com `provider` diferente. O custo é que a parte específica de cada
  rede vive em `Json` validado por Zod, em vez de coluna tipada.

**Conexão e identidade**

```prisma
enum SocialProvider       { INSTAGRAM }            // FACEBOOK, WHATSAPP, TELEGRAM, TIKTOK entram aqui
enum SocialChannelStatus  { ACTIVE  NEEDS_RECONNECT  DISABLED }

model SocialChannel {
  id                String              @id @default(cuid())
  organizationId    String              @map("organization_id")
  provider          SocialProvider
  externalAccountId String              @map("external_account_id")  // IG account id — texto puro, é chave de conferência
  webhookPathToken  String              @unique @map("webhook_path_token") // 32 hex, compõe a URL do webhook (D-11)
  handle            String?                                          // @usuario
  displayName       String?             @map("display_name")
  credentials       String                                           // JSON CIFRADO (AES-256-GCM) — shape por provider
  status            SocialChannelStatus @default(ACTIVE)
  lastErrorMessage  String?             @map("last_error_message")
  lastErrorAt       DateTime?           @map("last_error_at")
  connectedById     String?             @map("connected_by_id")

  @@unique([provider, externalAccountId])   // impede duas orgs na mesma conta (CB-12)
  @@index([organizationId, provider])
  @@map("social_channels")
}

model SocialContact {                       // quem interage — base do atendimento futuro
  id             String  @id @default(cuid())
  channelId      String  @map("channel_id")
  externalUserId String  @map("external_user_id")
  username       String?
  name           String?
  avatarUrl      String? @map("avatar_url")
  firstSeenAt    DateTime  @default(now()) @map("first_seen_at")
  lastInboundAt  DateTime? @map("last_inbound_at")   // base da janela de 24h da Meta
  lastOutboundAt DateTime? @map("last_outbound_at")
  leadId         String?   @map("lead_id")           // ponte com o Tracking (Fase 4), sem migration nova

  @@unique([channelId, externalUserId])
  @@index([channelId, lastInboundAt])
  @@map("social_contacts")
}
```

**Automação, gatilho e regra**

```prisma
enum SocialEventType    { COMMENT_CREATED  DIRECT_MESSAGE_RECEIVED }  // MENTION, STORY_REPLY, POSTBACK… depois
enum SocialTargetScope  { ALL_CONTENT  SPECIFIC_CONTENT  NEXT_CONTENT }
enum SocialMatchKind    { INCLUDE  EXCLUDE }
enum SocialMatchOperator{ ANY_TEXT  CONTAINS  EXACT  STARTS_WITH }     // REGEX reservado
enum SocialMatchLogic   { ANY_RULE  ALL_RULES }

model SocialAutomation {
  id, organizationId, channelId, name,
  isActive Boolean @default(false), createdById, createdAt, updatedAt
  @@index([channelId, isActive])
  @@map("social_automations")
}

model SocialTrigger {
  id, automationId,
  eventType   SocialEventType
  targetScope SocialTargetScope @default(ALL_CONTENT)
  matchLogic  SocialMatchLogic  @default(ANY_RULE)
  isEnabled   Boolean           @default(true)
  config      Json              @default("{}")   // nuance específica do provider
  @@index([automationId, eventType])
  @@map("social_triggers")
}

model SocialTriggerTarget {                   // "post", "reel", "vídeo" → conteúdo
  id, triggerId, externalContentId, contentType SocialContentType,
  permalink String?, caption String?, mediaUrl String?, syncedAt DateTime?
  @@unique([triggerId, externalContentId])
  @@map("social_trigger_targets")
}

model SocialMatchRule {
  id, triggerId,
  kind     SocialMatchKind     @default(INCLUDE)
  operator SocialMatchOperator @default(CONTAINS)
  terms    String[]
  order    Int @default(0)
  @@index([triggerId])
  @@map("social_match_rules")
}
```

A tríade `kind` + `operator` + `terms` cobre os três modos do ManyChat (contém,
não contém, qualquer comentário) e já abre exato/começa-com sem migration.
Ausência de regra `INCLUDE` é lida como `ANY_TEXT`.

**Fluxo, execução e idempotência**

```prisma
enum SocialStepKind     { SEND_DIRECT_MESSAGE  REPLY_TO_COMMENT }  // WAIT, CONDITION, ADD_TAG, CREATE_LEAD, HANDOFF… depois
enum SocialInboundStatus{ RECEIVED  MATCHED  SKIPPED  FAILED }
enum SocialRunStatus    { PENDING  SENT  SKIPPED  FAILED }

model SocialFlowStep {                        // 1 passo hoje; N passos encadeados na Fase 2
  id, triggerId,
  order        Int
  kind         SocialStepKind
  config       Json    @default("{}")   // texto, botões, variações, prompt — validado por Zod
  parentStepId String?                  // null = raiz
  branchKey    String? @default("main") // saída do passo anterior
  isEnabled    Boolean @default(true)
  @@index([triggerId, order])
  @@map("social_flow_steps")
}

model SocialInboundEvent {                    // idempotência + trilha
  id, channelId, provider, externalEventId, eventType,
  externalUserId String?, externalContentId String?,
  status SocialInboundStatus @default(RECEIVED), skipReason String?,
  receivedAt DateTime @default(now())
  @@unique([provider, externalEventId])
  @@index([channelId, receivedAt])
  @@map("social_inbound_events")
}

model SocialAutomationRun {                   // espelha WorkflowRun
  id, automationId, triggerId, channelId, inboundEventId String?, contactId String?,
  status SocialRunStatus, error String?, startedAt, finishedAt DateTime?
  @@index([automationId, startedAt])
  @@map("social_automation_runs")
}

model SocialStepRun {                         // espelha WorkflowNodeRun
  id, runId, stepId String?, kind SocialStepKind, status SocialRunStatus,
  error String?, externalMessageId String?, durationMs Int?, createdAt
  @@map("social_step_runs")
}
```

Decisões embutidas, com o porquê:

- **`config Json` em vez de coluna por campo** nos passos: é o padrão que o
  projeto já usa em `Node.data Json` do editor de workflows. Um passo de
  WhatsApp e um de Instagram não têm as mesmas opções; coluna tipada forçaria
  nullable em cascata. O contrato fica num Zod discriminado por `kind`.
- **Botões e variações de resposta vivem no `config`** do passo, não em tabela
  própria — evita duas tabelas para dados que nunca são consultados fora do
  passo. O limite de 3 botões é validado no Zod.
- **Sem contadores** (`dmCount` / `commentCount` do comments-app). São derivados
  de `SocialAutomationRun`; contador denormalizado desanda e ninguém percebe.
- **Sem `Listerner`** (o typo do comments-app) e **sem `userId` legado** — a
  coluna que o comments-app deixou pendente na Fase 9 dele.
- **Retenção**: `SocialInboundEvent` cresce para sempre. Job de limpeza com
  janela de 30 dias entra junto (o comments-app nunca limpou `ProcessedEvent`).

### D-9 — Editor: painel guiado + canvas derivado

- **Escolha**: layout de duas colunas espelhando o ManyChat — painel de edição em passos à esquerda, canvas `@xyflow/react` à direita com dois nós (`Quando` → `Então`) montados a partir dos dados da automação. Os nós reusam `BaseNode` / `WorkflowNode` / `NodeStatusIndicator`, que já existem para o editor de workflows.
- **Alternativas descartadas**: (a) portar o editor empilhado do comments-app (coluna de cards ligados por `<Separator orientation="vertical">`, sem ReactFlow) — mais curto, mas destoa visualmente das automações do NASA e a Fase 2 exigiria refazer a tela; (b) canvas livre completo já no PR 1 (node selector, arrastar, conectar) — isso é a Fase 2 inteira antecipada: exige tabela de passos, conexões, posições persistidas e executor de grafo.
- **Consequência**: o canvas do PR 1 é **leitura** — não persiste posição e não deixa criar nó. A evolução para a Fase 2 é aditiva: ligar o handle `+` com um node selector próprio e passar a persistir `SocialFlowStep` + posições, sem reescrever a tela nem trocar os componentes de nó.

### D-10 — Ports & Adapters, na forma já travada pelo projeto

- **Escolha**: o núcleo vive em `src/modules/social/`, na estrutura definida em `docs/arquitetura-evolucao-overview.md` §5.2. A procedure oRPC e o route handler do webhook são **adapters primários**; Prisma, Graph API, IA e Pusher são **adapters secundários**.
- **Alternativas descartadas**: (a) lógica dentro de `src/features/comments/server/`, como o resto do repo — é o que produziu 8.877 chamadas diretas a Prisma e zero ponto de injeção; (b) esperar o piloto `form` (D4 do overview) para só então usar `modules/` — este módulo é **código novo**, não migração: nasce na forma alvo sem competir com o piloto, e ainda estreia o `modules/shared/` que o `form` vai reusar.

```
src/modules/social/
├─ domain/          text-normalizer · match-rule · trigger-selection
│                   message-chunker · reply-picker · errors
│                   ZERO import externo — nem Prisma, nem Zod, nem Next
├─ ports/           ChannelGateway · InboundTranslator · ChannelRepository
│                   AutomationRepository · InboundEventRepository
│                   RunRepository · ContactRepository · AiReplyGenerator
├─ application/     handleInboundEvent · connectChannel · disconnectChannel
│                   createAutomation · updateTrigger · activateAutomation
│                   listChannelContent
├─ infra/           instagram/graph-channel-gateway · instagram/webhook-translator
│                   prisma/*-repository · crypto/credential-cipher
│                   ai/stars-ai-reply-generator
└─ index.ts         composition root — único lugar que instancia adapter
```

Os dois ports que carregam a genericidade:

```ts
// ports/inbound-translator.ts — traduz payload do provider para o evento canônico
export interface InboundTranslator {
  verifySignature(rawBody: string, headers: Headers, secret: string): boolean;
  parse(payload: unknown): InboundEvent[];
}

// domain/inbound-event.ts — o tipo que o domínio conhece. Não tem "instagram" nele.
export type InboundEvent = {
  provider: SocialProvider;
  externalAccountId: string;
  externalEventId: string;
  type: SocialEventType;
  actor: { externalUserId: string; username?: string };
  text: string;
  content?: { externalId: string };
  occurredAt: Date;
};

// ports/channel-gateway.ts — tudo que se manda para fora
export interface ChannelGateway {
  sendDirectMessage(input: SendDirectMessageInput): Promise<DispatchResult>;
  replyToComment(input: ReplyToCommentInput): Promise<DispatchResult>;
  listContent(input: { cursor?: string }): Promise<Page<ContentRef>>;
}
```

**Acrescentar uma rede** = um `InboundTranslator`, um `ChannelGateway`, um valor
no enum e um registro no composition root. `domain/` e `application/` não mudam.
`src/http/whats-oficial/` vira adapter de `ChannelGateway` quase de graça.

- **Consequência**: ~25–30 arquivos pequenos onde o estilo atual do repo teria ~10. É o preço do *seam*. Em troca, `application/` e `domain/` rodam em teste sem Postgres, sem rede e sem Meta.

### D-11 — Webhook com URL por canal, não lookup por verify token

- **Escolha**: `/<...>/api/social/webhook/instagram/<webhookPathToken>`. O token de 32 hex identifica o canal; o `GET` compara o `hub.verify_token` com o da conexão daquele canal e o `POST` valida a assinatura com o App Secret dele.
- **Alternativas descartadas**: (a) procurar a conexão pelo `hub.verify_token`, como faz `/api/integrations/instagram/webhook` hoje (`config: { path: ["verify_token"], equals: token }`) — **incompatível com credencial cifrada**, porque não dá para consultar por campo cifrado, e ainda é varredura de JSON; (b) guardar hash do verify token numa coluna indexada — funciona, mas mantém a busca global quando a URL já podia dizer de quem é o evento.
- **Consequência**: a URL que o usuário cola no App da Meta é única por conexão. Ganho colateral: o `POST` não precisa de lookup por `entry.id` — o `externalAccountId` vira **conferência** (se não bate, descarta), não busca.

### D-12 — Tenancy nasce no adapter do webhook, num único ponto

- **Escolha**: `ChannelRepository.findByWebhookPathToken()` é a **única** leitura sem escopo do módulo. Ela devolve o canal **e** o `TenantScope`; todos os outros repositórios só instanciam recebendo esse escopo no construtor, conforme §5.3 do overview.
- **Alternativas descartadas**: passar `organizationId` como parâmetro em cada query — é o desenho que produziu o IDOR sistêmico apontado na auditoria, porque esquecer o filtro é sempre possível.
- **Consequência**: existe exatamente um lugar auditável onde o tenant é estabelecido a partir de uma requisição anônima. Quem revisa o PR olha uma função, não 40 queries.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`) — 10 tabelas novas + 11 enums, aditivas. Aplicada em `20260924120000_social_automations_channel_agnostic`
- [x] Procedures oRPC (novo domínio `comments` em `src/app/router/comments/`, como adapter fino)
- [x] **Estreia `src/modules/`** — cria `modules/shared/{domain,ports}` e `modules/social/`. Por isso, atualizar [`docs/arquitetura-evolucao-overview.md`](../../docs/arquitetura-evolucao-overview.md) na mesma sessão (regra 19): tabela de status, §5.4 e changelog. Não altera as decisões D2/D4 do overview — o piloto de **migração** continua sendo `form`; `social` é código novo nascendo na forma alvo
- [ ] Realtime (Pusher / event-bus)
- [x] Automações (Inngest) — só o caminho com IA (D-4)
- [ ] Env vars novas — nenhuma; usa `AI_SECRETS_KEY` e `NEXT_PUBLIC_BASE_URL` já existentes
- [x] Breaking change para clientes existentes — o app proxy `commentsApp` sai do router
- [x] Documentação obrigatória — novo `docs/comments-overview.md` nos moldes dos itens 10/14 do CLAUDE.md, com roadmap e changelog

Regras do projeto que este PR toca diretamente:

- **Regra 11** (ritual pós-migration): `pnpm db:generate` → bump `SCHEMA_VERSION` em `src/lib/prisma.ts` → touch nos catch-all → validar por `curl`.
- **Regra 9**: toda chamada oRPC client-side vive em hook (`src/features/comments/hooks/use-comments-*.ts`).
- **Regra 18**: nenhuma chamada de rede dentro de `$transaction`.
- **Regra 12**: nada de `p`, `d`, `res` — `payload`, `response`, `comment`, `trigger`.

## 8. Plano de testes

Não há runner de teste instalado no projeto (ver CLAUDE.md, item 20) — a
verificação **deste PR** é manual + build, e o portão é `pnpm build` verde.

O que D-10 muda é o que fica **possível** no dia em que o Vitest entrar
(etapa 3 do roadmap de [`testes-estrategia.md`](../../docs/testes-estrategia.md)),
sem reescrever nada:

| Camada | Como testa | Cobre |
| --- | --- | --- |
| `domain/` — `match-rule`, `text-normalizer`, `message-chunker`, `reply-picker`, `trigger-selection` | Vitest puro, sem I/O, milissegundos | CA-5 a CA-11 |
| `application/handleInboundEvent` | Vitest com **fakes** dos ports (in-memory), nunca mock de Prisma (D8 do overview) | CA-4, CA-9, CA-12, CB-1..CB-10 |
| `infra/prisma/*` | Integração contra Postgres real (`docker-compose.test.yml`) | unicidades, cascatas, escopo de tenant |
| `infra/instagram/*` | Servidor HTTP fake — inclusive timeout e 5xx | erro de token, janela expirada |
| Adapter oRPC / webhook | Integração | CA-1, CA-2, CA-3 |

Dois ports existem **por causa** do teste: `Clock` e `RandomPicker` — sem eles,
CA-10 (variação sorteada) e as regras de janela não seriam determinísticas.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Salvar conexão; conferir no Prisma Studio que os 3 campos estão cifrados e o Account ID em claro |
| CA-2 | manual | `curl -s "<webhook>?hub.mode=subscribe&hub.verify_token=<T>&hub.challenge=abc123"` → `abc123`; token errado → 403 |
| CA-3 | manual | `curl -X POST` sem header de assinatura → 401 |
| CA-4 | manual | Repetir o mesmo POST assinado duas vezes; só um envio na tabela de execuções |
| CA-5..CA-10 | manual | Payloads salvos em `src/features/comments/fixtures/` (espelha `src/http/whats-oficial/jsons/webhooks/`), postados com assinatura válida |
| CA-11 | manual | Texto longo com acentos; conferir número de blocos e bytes por bloco |
| CA-12 | manual | Token inválido proposital; conferir `NEEDS_RECONNECT` + notificação |
| CA-13 | automatizado | `pnpm build` |

Validação de rota obrigatória antes de devolver a sessão (regra 11):
`curl -sI -m 10 http://localhost:3000/api/comments/webhook/instagram` e
`.../api/rpc` devolvendo 200/307/405 — nunca 404.

## 9. Riscos e rollback

| Risco | Mitigação |
| --- | --- |
| Automação responde em loop (bot conversando consigo) | CB-1 e CB-2 são a primeira linha do handler, antes de qualquer consulta |
| Resposta duplicada por reentrega da Meta | `CommentsProcessedEvent` gravado **antes** de qualquer envio |
| Segredo vazando em log | RNF-2; `last4()` na UI; nunca logar a conexão inteira |
| Webhook lento derruba a assinatura na Meta | D-4 tira a IA do caminho síncrono; RNF-1 |
| Quebrar o DM → Lead existente | D-7: endpoint separado; o route atual não é tocado |
| `AI_SECRETS_KEY` ausente em produção | Salvar conexão falha explícito em vez de gravar em claro; checar antes do deploy |

> ⚠️ **Achado operacional (2026-09-24), anterior a esta spec**: o banco de
> desenvolvimento local tem **drift** — `20260915170000_sei_integration` consta
> como *failed* e três migrations foram alteradas depois de aplicadas. Nesse
> estado, `pnpm db:migrate` só oferece **resetar o banco e perder os dados**.
> Por isso esta migration foi aplicada pelo caminho do item 11 do CLAUDE.md
> (`migrate diff` → `db execute` → `migrate resolve --applied`), sem tocar no
> drift. Resolver o `sei_integration` é trabalho separado e afeta todo mundo
> que rodar `db:migrate` nesta máquina.

**Rollback**: a migration é aditiva (só `CREATE TABLE`), então o rollback de
código é suficiente — reverter o PR devolve o proxy ao router e as tabelas novas
ficam órfãs e inertes. Nenhum dado existente é alterado ou removido.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-24 | João Gabriel | Criada — análise do comments-app, decisões D-1..D-8, escopo do PR 1 e roadmap §11 |
| 2026-09-24 | João Gabriel | D-9 + RF-20..RF-23: editor é painel guiado + canvas `@xyflow` derivado. Não-objetivo corrigido: o excluído é a edição livre do grafo, não o canvas |
| 2026-09-24 | João Gabriel | **Implementado.** Migration `20260924120000`, módulo `src/modules/social`, webhook por conexão, router `comments` nativo, editor painel+canvas, proxy desregistrado. Duas divergências registradas: IA roda dentro do request (ver D-4) e o job de limpeza de `SocialInboundEvent` ficou como dívida. Doc do domínio: `docs/comments-overview.md` |
| 2026-09-24 | João Gabriel | Modelo reescrito como **agnóstico de canal** (`Social*`, D-8) e núcleo movido para `src/modules/social/` em Ports & Adapters (D-10), conforme §5.2/§5.3 de `arquitetura-evolucao-overview.md`. Novas decisões D-11 (webhook por canal) e D-12 (tenancy num ponto só). §8 ganhou o mapa de testes por camada; §11 ganhou a Fase 3.5 (outros canais) |

---

## 11. Evolução planejada (fora do PR 1)

Registrado aqui para não se perder — cada linha vira spec própria quando for a vez.

### Fase 2 — Paridade visual com o ManyChat

| Ideia | Nota |
| --- | --- |
| Ligar a edição do grafo no canvas que o PR 1 já entrega | Handle `+` + node selector próprio, `CommentsStep` e posições persistidas — o visual do nó não muda (D-9) |
| Delay entre passos ("espere 1 min e mande o link") | Requer Inngest (`step.sleep`) |
| Quick replies (postback), além dos 3 botões `web_url` | Exige tratar o postback de volta no webhook |
| Condição no fluxo ("se o usuário clicou, então…") | Reusa a avaliação de condição de `workflow-context.ts` |
| Alvo "**próximo** post publicado" | Assinar `media` no webhook e vincular na publicação |
| Follow-up automático (sem resposta em X h → nova DM) | Janela de 24h da Meta limita |

### Fase 3 — Conexão e operação

| Ideia | Nota |
| --- | --- |
| OAuth do Instagram (substitui credencial manual) | Decidir entre reusar o Meta OAuth do NASA e o Instagram Login |
| Renovação automática de token + aviso de expiração | O comments-app fazia com `refreshToken`; recuperar |
| Múltiplas contas IG por organização | Hoje `organizationId @unique` — cai quando vier |
| Rate limit por automação (proteção em post viral) | Espelhar `Workflow.maxRunsPerHour` |
| "Responder só uma vez por pessoa" / cooldown por autor | Tabela de participação por `fromId` |
| Blacklist de usuários e de palavras | |

### Fase 3.5 — Outros canais (o que D-8 e D-10 já habilitam)

Cada linha é **um translator + um gateway + um valor de enum**. Sem migration,
sem tocar em `domain/` nem em `application/`.

| Canal | Nota |
| --- | --- |
| Facebook Messenger / comentários de Página | Mesma Graph API; o adapter é quase o mesmo do Instagram |
| WhatsApp | `src/http/whats-oficial/` já existe e vira `ChannelGateway` direto |
| Telegram | Bot token; webhook mais simples que o da Meta |
| TikTok / YouTube | Comentários; dependem da API pública de cada um |

### Fase 4 — Integração com o resto do NASA

| Ideia | Nota |
| --- | --- |
| **Comentário vira Lead no Tracking** | O diferencial real contra o ManyChat: o `/api/integrations/instagram/webhook` já sabe criar lead; reaproveitar |
| Disparar um Workflow do NASA a partir da automação | Ponte para a engine principal (ver D-1) |
| Enviar formulário / proposta / agenda pelo DM | Reusa os nós `SEND_FORM`, `SEND_PROPOSAL`, `SEND_AGENDA` |
| Métricas no Insights (disparos, resposta, conversão) | `CommentsExecution` já nasce com os dados |
| Respostas com variáveis (`{{username}}`) | `interpolate()` de `workflow-context.ts` |
| Teste/preview da automação sem publicar | Espelha o `dry-run-button` do Workflow |
| Gatilhos de **story reply** e **menção** | Campos `mentions` e `messaging` do webhook |
