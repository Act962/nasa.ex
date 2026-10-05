# App COMMENTS — Automações de redes sociais

> **Regra de manutenção:** este documento é a fonte de verdade do domínio.
> Sempre que mexer em `src/modules/social/`, `src/app/router/comments/`,
> `src/app/api/social/webhook/`, `src/features/comments/` ou nos modelos
> `Social*` do `prisma/schema.prisma`, **atualize este arquivo na mesma sessão** —
> tabelas de arquivos, roadmap (✅/🚧/⬜) e changelog sincronizados com o código.
> Espelha as regras 10 (NASA Route) e 14 (WhatsApp Oficial) do CLAUDE.md.

Spec de origem: [`specs/comments/0024-comments-automacoes-instagram-nativas.md`](../specs/comments/0024-comments-automacoes-instagram-nativas.md).

---

## 1. O que é

Automatiza resposta a **comentários** e **directs** do Instagram: quando um
evento casa as regras de um gatilho, o app manda DM ao autor e, opcionalmente,
responde publicamente no comentário.

Substitui o **comments-app** (projeto Next.js separado, descontinuado) e o proxy
S2S que o NASA mantinha para falar com ele.

**O modelo é agnóstico de rede social.** Nada no schema cita Instagram: a rede é
o valor `SocialProvider`. Acrescentar Facebook, WhatsApp ou Telegram é escrever
um adapter — não alterar domínio nem migrar tabela.

## 2. Arquitetura — Ports & Adapters

Primeiro módulo em `src/modules/`, na forma definida em
[`arquitetura-evolucao-overview.md`](arquitetura-evolucao-overview.md) §5.2.

```
src/modules/shared/
├─ domain/    DomainError · TenantScope
├─ ports/     Clock · IdGenerator · RandomPicker · Logger
└─ infra/     systemClock · cryptoRandomPicker · consoleLogger

src/modules/social/
├─ domain/       types · text-normalizer · match-rule · trigger-selection
│                message-chunker · reply-picker · automation-readiness · errors
├─ ports/        channel-gateway · inbound-translator · repositories
│                ai-reply-generator
├─ application/  handle-inbound-event · connect-channel · activate-automation
├─ infra/        instagram/{graph-channel-gateway,webhook-translator}
│                prisma-{channel,automation,event}-repository
│                credential-cipher · schemas · stars-ai-reply-generator
└─ index.ts      composition root
```

| Arquivo | Papel |
| --- | --- |
| `domain/match-rule.ts` | Avalia INCLUDE/EXCLUDE/ANY_TEXT. **Exclusão vence sempre** |
| `domain/trigger-selection.ts` | Escolhe **um** gatilho: específico > mais termos > mais antigo |
| `domain/message-chunker.ts` | Limite em **caracteres**: 1000 sem botão, 640 com botão (vira template). Conta por code point |
| `domain/reply-picker.ts` | Sorteia a variação da resposta pública |
| `domain/automation-readiness.ts` | O que falta para ativar — alimenta botão e nó vermelho |
| `application/handle-inbound-event.ts` | Caso de uso central do webhook |
| `infra/instagram/*` | **Único** ponto do módulo que conhece o formato da Meta |
| `index.ts` | Composition root — único lugar que instancia adapter |

### Adapters primários

| Rota | Papel |
| --- | --- |
| `POST/GET /api/social/webhook/instagram/[token]` | Webhook, **um endpoint por conexão** |
| `src/app/router/social-accounts/index.ts` | Contas da organização (spec 0069): listar, conectar, reconectar, desativar, reativar, reenviar inscrição, `webhookSetup` (URL + verify token, só admin), conectar pela Meta |
| `src/app/router/comments/channel.ts` | O que o Comments lê **de uma conta**: publicações e tracking de leads. Toda procedure recebe `channelId` |
| `src/app/router/comments/automations.ts` | CRUD, salvar gatilho, ativar, histórico. Listar e criar recebem `channelId` |

### UI

| Arquivo | Papel |
| --- | --- |
| `features/social-accounts/components/instagram-accounts-page.tsx` | Página Satélites › Instagram (`/integrations/instagram`): cabeçalho, números (contas, ativas, automações, limite), um cartão por conta e a lateral com as formas de conectar |
| `features/social-accounts/components/social-account-card.tsx` | Cartão de uma conta: estado, ID, token, automações, apps que a usam e as ações (abrir no Comments, ver webhook, trocar credencial, reenviar inscrição, desativar/reativar) |
| `features/social-accounts/components/social-accounts-manager.tsx` | A mesma lista de cartões embutida em outra tela — hoje, a aba Integrações do Comments |
| `features/social-accounts/components/instagram-connect-guide-dialog.tsx` | Popup passo a passo com prints da Meta (spec 0047). Sem conta-alvo adiciona uma conta; com conta-alvo troca a credencial ou reabre no passo do webhook |
| `features/social-accounts/lib/instagram-connect-guide.{ts,json}` | Os 25 passos do guia: fases, prints, alvo da seta, dicas. `n` nomeia o arquivo do print, então passo novo usa o próximo número livre em vez de renumerar |
| `features/comments/components/comments-account-select.tsx` | Seletor da conta em uso, no topo do Comments (`?conta=<channelId>`) |
| `features/comments/components/automations-list.tsx` | Lista e criação, da conta selecionada |
| `features/comments/components/automation-editor.tsx` | Painel guiado em 3 passos |
| `features/comments/components/automation-canvas.tsx` | Canvas `@xyflow` derivado dos dados |
| `features/comments/components/runs-panel.tsx` | Histórico — responde "por que não respondeu?" |
| `features/comments/hooks/use-comments-*.ts` | Toda chamada oRPC do Comments (regra 9); `useSelectedCommentsAccount` resolve a conta em uso |
| `features/social-accounts/hooks/use-social-accounts.ts` | Toda chamada oRPC das contas conectadas |

Rotas: `/comments` e `/comments/automations/[id]`.

## 3. Banco

10 tabelas, 11 enums — migration `20260924120000_social_automations_channel_agnostic`.

| Tabela | Papel |
| --- | --- |
| `social_channels` | Conexão por org. `credentials` cifrado; `webhook_path_token` roteia o webhook |
| `social_contacts` | Quem interage. `last_inbound_at` = janela de 24h; `lead_id` = ponte futura |
| `social_automations` | Nome, ativo, canal |
| `social_triggers` | Tipo de evento, escopo de conteúdo, lógica de match |
| `social_trigger_targets` | Conteúdo observado (post/reel/vídeo) |
| `social_match_rules` | `kind` × `operator` × `terms` |
| `social_flow_steps` | Passos. `parent_step_id`/`branch_key` prontos para fluxo encadeado |
| `social_inbound_events` | Idempotência: `@@unique([provider, external_event_id])` |
| `social_automation_runs` | Execução — espelha `WorkflowRun` |
| `social_step_runs` | Passo executado — espelha `WorkflowNodeRun` |

Sem contadores denormalizados: `sentCount` é derivado dos runs.

## 4. Segurança

| Ponto | Decisão |
| --- | --- |
| Credenciais | `accessToken`, `appSecret`, `verifyToken` cifrados (AES-256-GCM, `AI_SECRETS_KEY`). UI só vê `••••1234` |
| Assinatura | `x-hub-signature-256` sobre o **raw body**, `timingSafeEqual`, fail-closed |
| Handshake | `hub.verify_token` comparado ao da conexão daquele token de URL |
| Tenancy | `findByWebhookPathToken` é a **única** leitura sem escopo; dela nasce o `TenantScope` |
| Conta duplicada | `@@unique([provider, external_account_id])` impede duas orgs na mesma conta |
| Papel | Conectar/desconectar exige owner ou admin |
| Desconectar | **Desativa, não apaga.** `SocialAutomation`/`SocialContact`/`SocialInboundEvent` cascateiam do canal — deletar a linha destruía a configuração do usuário. Também preserva o `webhook_path_token`, mantendo válida a URL já registrada na Meta |
| Várias contas por organização | Spec 0069 (revoga a D-13 da 0024). A chave de uma conta é `(provider, externalAccountId)`: conectar atualiza a linha dela ou cria outra, e nunca toca nas demais. Nenhuma leitura devolve "a conta da organização" — toda operação recebe `channelId`, conferido contra a organização da sessão. Reconectar não troca a conta de uma linha (token de outra conta é recusado), que era a origem do bug da D-13 |

## 5. Configuração pelo usuário

### 5.0 Um clique — pelo Instagram já conectado na Meta (spec 0061) ✅

Se a empresa já conectou a Meta nos Satélites (mesmo login do Tráfego e do Planner), o card
"Conectar Instagram" mostra **Usar @conta**. Um clique e pronto — sem app próprio, token, chave
secreta ou webhook. O mesmo botão aparece no painel **Comentários automáticos** do Planner.

- Credencial: token de página copiado de `MetaPublishAccount` (`authMode: "META_LOGIN"`, `pageId`).
- Gateway: `MetaLoginInstagramChannelGateway` (graph.facebook.com) — DM em `/{page-id}/messages`,
  resposta pública em `/{comment-id}/replies`, inscrição em `/{page-id}/subscribed_apps`.
- Eventos: webhook único da plataforma, `/api/social/webhook/meta`, **ou** o webhook antigo
  `/api/integrations/instagram/webhook` (a Meta aceita uma URL por objeto; os dois repassam ao
  Comments via `processMetaCommentsWebhook`). Canal achado pelo `entry.id`.
- Reconectar a Meta nos Satélites atualiza o token do canal (`refreshMetaLinkedCommentsChannel`).
- O que o dono do app de produção precisa fazer uma vez: [`comments-meta-producao.md`](comments-meta-producao.md).

### 5.1 Passo a passo — app próprio do cliente

Feita pelo guia **"Conectar Instagram passo a passo"** (spec 0047), com print
de cada tela da Meta. Resumo dos 24 passos:

1. **Criar o app** — Criar aplicativo → caso de uso *Gerenciar mensagens e conteúdo no Instagram* (filtro Business Messaging) → sem portfólio → Criar (a Meta pede a senha do Facebook). **O nome não pode conter "Instagram"**.
2. **Ligar o Instagram** — Personalizar o caso de uso → *Add all required permissions*.
3. **Publicar** — Configurações do app → Básico: URL de privacidade (`/privacidade` da ÓRBITA) + categoria → Publicar. **Sem publicar, a Meta não entrega webhook.**
4. **Liberar a conta** — Funções → Adicionar pessoas → *Testador do Instagram* → aceitar em instagram.com → Configurações → Apps e sites → Convites do testador.
5. **Chaves** — ID da conta (embaixo do @, começa com 1784 — **não** o "ID do app do Instagram"), Gerar token (login + Permitir), Chave secreta do app **do Instagram**.
6. **Conectar** — o popup envia as três chaves e um verify token gerado pela ÓRBITA. O token é conferido contra a Graph API antes de salvar.
7. **Webhook** — colar URL de callback e verify token no bloco *3. Configurar webhooks* → Verificar e salvar (se falhar, tentar de novo: na 1ª tentativa real falhou e na 2ª passou). `comments` e `messages` já vêm assinados.

Prints: `public/guides/instagram-comments/`, gerados por
`python3 scripts/guides/prepare-whatsapp-guide.py <pasta> --guide src/features/social-accounts/lib/instagram-connect-guide.json --out public/guides/instagram-comments`.
Tirados do app de teste "ÓRBITA GUIA COMMENTS" (ID 1143172268148079) com a conta @orbitahub.plataforma.

> ⚠️ Assinar os campos no painel diz apenas **quais** eventos o app quer — não faz a
> conta entregar nada. É preciso inscrever o app na conta
> (`POST /{ig-user-id}/subscribed_apps?subscribed_fields=comments,messages`). O
> `connectChannel` faz isso automaticamente desde 2026-09-24; conexões anteriores
> se resolvem com o botão **Reativar recebimento** no card da conta. Sintoma de
> quem está sem inscrição: a verificação da URL responde 200 e **nenhum POST**
> chega depois. Mesmo papel de `src/http/whats-oficial/subscribe-app.ts`.

Env: `AI_SECRETS_KEY` e, para montar a URL do webhook, `NEXT_PUBLIC_BASE_URL` (ou
`NEXT_PUBLIC_APP_URL`). A conexão pela Meta (5.0) usa ainda `META_APP_SECRET` (assinatura) e
`META_WEBHOOK_VERIFY_TOKEN` (verificação) — sem as duas, o webhook único recusa tudo.

> A URL mostrada na tela resolve nesta ordem: **env** → **headers da requisição**
> (`x-forwarded-host`/`x-forwarded-proto`, preenchidos pelo proxy) → `localhost`.
> `NEXT_PUBLIC_*` é congelada no build: se o deploy não receber a variável como
> build arg, o valor sai `undefined` no bundle e variável de runtime não
> conserta. O fallback por header garante a URL correta mesmo nesse caso. A env
> tem precedência porque é o único jeito de apontar o webhook para um túnel
> enquanto se navega em `localhost`.

## 6. Coexistência com a integração Instagram existente

`/api/integrations/instagram/webhook` (DM → Lead no Tracking) segue com a mesma lógica; desde a
spec 0061 ele também repassa o lote ao Comments (best-effort, nunca derruba o fluxo de leads), para
que contas conectadas pela Meta funcionem com a URL que já estiver no app.
São mundos separados: aquele usa o App Meta central do NASA via OAuth; este usa
o App do próprio cliente. Se a mesma conta estiver nos dois, ambos agem — um
cria lead, o outro responde. Sem dedupe entre sistemas nesta fase.

## 7. Roadmap

| Fase | Item | Status |
| --- | --- | --- |
| 1 | Modelo agnóstico + migration | ✅ |
| 1 | Núcleo hexagonal (domain/ports/application/infra) | ✅ |
| 1 | Webhook com assinatura e idempotência | ✅ |
| 1 | Conexão por credenciais manuais | ✅ |
| 1 | Match contém / não contém / qualquer | ✅ |
| 1 | Alvo todas as publicações ou específicas | ✅ |
| 1 | DM com até 3 botões + resposta pública sorteada | ✅ |
| 1 | Resposta por IA cobrada em Stars | ✅ |
| 1 | Editor painel + canvas derivado | ✅ |
| 1 | Histórico de execuções | ✅ |
| 1 | Guia passo a passo com prints para conectar (spec 0047) | ✅ |
| 1 | Job de limpeza de `social_inbound_events` | ⬜ |
| 1 | Resposta com IA fora do request (Inngest) | ⬜ |
| 2 | Canvas editável, passos encadeados, delay, condição | ⬜ |
| 2 | Quick replies (postback) | ⬜ |
| 3 | Conectar com a conexão da Meta, um clique (spec 0061) | ✅ |
| 3 | Rate limit por automação · cooldown por autor | ⬜ |
| 3.5 | Facebook, WhatsApp, Telegram | ⬜ |
| 4 | Comentário e DM viram conversa no tracking-chat (spec 0062) | ✅ |

## 8. Dívidas conhecidas

- **`SocialInboundEvent` cresce sem limite** — o job de limpeza ainda não existe.
- **IA roda dentro do request do webhook.** A spec previa Inngest para esse
  caminho (D-4); ficou como dívida para não segurar a entrega. Com prompt longo,
  pode passar do tempo confortável de resposta à Meta.
- **`social_contacts.lead_id` não é FK** e ninguém escreve nele ainda.
- **Passo "permissão de publicar" do guia está sem print** (spec 0069, RF-9).
  O texto cita `instagram_business_content_publish`; falta conferir o rótulo
  exato no painel da Meta e capturar o print no app de teste.
- **Permissões do token não são conferidas.** A conta conecta mesmo sem a
  permissão de publicar; a conferência entra com a publicação pelo Planner
  (etapa 3 da spec 0069).
- **`MetaPublishAccount` segue em paralelo** como fonte de publicação do
  Planner. A convergência com `SocialChannel` é a etapa 3.
- O proxy antigo segue no repo, desregistrado, em `src/app/router/comments-remote/`
  e `src/http/comments/`.

## 9. Changelog

| Data | Mudança |
| --- | --- |
| 2026-10-05 | **`social_channels.brand_kit_id`** (spec 0070): qual Kit da Marca do Planner os posts da conta usam; nulo = kit padrão da empresa. O módulo `social` só transporta o campo (`ChannelSummary.brandKitId`); quem lê e grava é o Planner (`features/nasa-planner/server/brand-kit/brand-kits.ts`). O cartão da conta mostra o kit e leva à aba do Planner para trocar |
| 2026-10-05 | **Contas do Instagram em página própria** (`/integrations/instagram`) no lugar do popup dos Satélites: cabeçalho com números, um cartão por conta (`social-account-card.tsx`, também usado na aba Integrações do Comments) e lateral com as formas de conectar. O cartão ganhou "Abrir no Comments" (abre com a conta selecionada) e os selos dos apps que usam a conta. `?connect=INSTAGRAM` redireciona para a página |
| 2026-10-05 | **Várias contas do Instagram por empresa, conectadas pelos Satélites** (spec 0069). Revoga a D-13 da spec 0024: `ChannelRepository` perde `findForTenant`/`findWithCredentials` e ganha `listForTenant`, `findById`, `findWithCredentialsById` e `findByExternalAccountId` — não existe mais leitura de "a conta da empresa". `connect` passa a ser por `(provider, externalAccountId)` e **não toca nas outras contas** (a limpeza de "órfãs" foi removida: com várias contas ela apagaria contas legítimas); `reconnectChannel` troca a credencial de uma conta sem nunca trocar a conta da linha; teto de 20 contas (`MAX_CHANNELS_PER_PROVIDER`). Conexão saiu de `comments.channel.*` para o novo router `socialAccounts.*` e a tela virou a feature `src/features/social-accounts/` (guia, lista de contas, conectar pela Meta), usada pelo cartão do Instagram dos Satélites e pela aba Integrações do Comments. O cartão "Instagram DM" dos Satélites perdeu o formulário genérico. No Comments: seletor de conta (`?conta=`), automações/execuções/publicações por conta, tracking de leads por conta, sem "Trocar conta". No chat, as mensagens do Instagram gravam `metadata.instagram.channelId` e a resposta sai pela conta que recebeu (conversa antiga cai na conta mais antiga). No Planner, a automação do post usa a conta do post. Guia ganhou o passo da permissão de publicar (sem print). Sem migration. Conferência: `scripts/social-accounts-qa-check.ts` (21 asserções); telas: `scripts/social-accounts-qa-seed.ts` |
| 2026-10-04 | **Instagram no tracking-chat** (spec 0062): todo comentário e DM de conta conectada pela Meta vira mensagem na conversa do lead (`@usuario`, tag Instagram, um lead por pessoa) no tracking escolhido em Integrações (`social_channels.lead_tracking_id`); comentário mostra o card do post, DM o rótulo "Mensagem no Direct do Instagram"; respostas da automação aparecem como enviadas (`handleInboundEvent` devolve `deliveries`); responder no chat com o comentário selecionado publica naquele comentário (`sendInstagramFromChat`). Ponte por observador em `processChannelEvents`; webhook antigo deixa de criar lead de DM para contas `META_LOGIN` |
| 2026-10-04 | **Conectar pela Meta em um clique** (spec 0061): `authMode`/`pageId` nas credenciais (sem migration), gateway graph.facebook.com, webhook único `/api/social/webhook/meta` + repasse no webhook antigo, procedures `channel.metaAccounts`/`channel.connectWithMeta`, botão no card e no Planner, token atualizado ao reconectar a Meta. Testado no app ÓRBITA TESTE 2026 com @weydsonlima |
| 2026-09-29 | **Guia "Conectar Instagram passo a passo"** (spec 0047): popup com 24 passos e prints reais da Meta no lugar do formulário solto; verify token gerado pela ÓRBITA; nova procedure `channel.webhookSetup`. O stepper do WhatsApp virou o módulo compartilhado `src/features/meta-guide/` |
| 2026-09-24 | **Trocar de conta passou a funcionar.** `connect` criava uma linha nova quando o `external_account_id` mudava — o unique é `(provider, account)`, então não havia colisão — e as leituras, que pegam a linha mais antiga da organização, seguiam devolvendo a conta anterior: a UI dizia "conectada" e mostrava a conta errada, sem como sair dela. Agora a troca reaproveita a linha canônica (preserva automações, histórico e a URL na Meta), remove linhas órfãs de tentativas anteriores e desativa as automações que apontavam para publicações da conta antiga, informando quantas |
| 2026-09-24 | Credencial recusada passou a ser sinalizada pelo `DispatchResult.authError` do gateway (status 401/403) em vez de regex sobre o texto do erro, que marcaria a conexão como quebrada em qualquer mensagem contendo "token" |
| 2026-09-24 | Publicação escolhida volta a mostrar miniatura: o editor descartava `contentType`/`mediaUrl` ao carregar e gravava o vazio por cima no save seguinte. `TriggerTarget` passou a carregar os campos de apresentação, e a miniatura cai para ícone por tipo quando a URL da Meta expira |
| 2026-09-24 | Limite de texto passou de bytes (950) para **caracteres** (1000 sem botão / 640 com botão) — medir bytes roubava caracteres em português. Botões deixaram de ser descartados em silêncio no salvar: viraram lista clicável com diálogo de edição, validação de título e URL, e `https://` automático |
| 2026-09-24 | `disconnect` passou a **desativar** (`status = DISABLED`) em vez de deletar: a cascata do canal apagava automações, gatilhos, respostas e histórico, e trocava o `webhook_path_token`, invalidando a URL na Meta. Novo `channel.reactivate` religa e reinscreve |
| 2026-09-24 | `connectChannel` passou a inscrever o app nos eventos da conta (`subscribed_apps`) e o card ganhou **Reativar recebimento**. Sem isso a conta nunca entregava evento — descoberto no primeiro teste real |
| 2026-09-24 | Criado. Migração do comments-app para módulo nativo: 10 tabelas, núcleo hexagonal em `src/modules/social`, webhook por conexão, editor com canvas derivado. Proxy S2S desregistrado |
