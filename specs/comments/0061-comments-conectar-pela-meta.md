---
id: 0061
titulo: Conectar o Comments com a conexão da Meta (um clique)
dominio: comments
status: implementada
autor: Weydson + Claude
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: completa
---

# 0061 — Conectar o Comments com a conexão da Meta (um clique)

## 1. Contexto

Hoje o Comments (spec 0024/0047) só conecta por um passo a passo manual: o cliente cria um app "Instagram API com login do Instagram" na Meta, gera o token, copia a chave secreta do app, inventa um verify token, cola tudo no ÓRBITA e ainda configura o webhook no painel da Meta. O guia leva uns 15 minutos e depende de telas da Meta que mudam — é o ponto em que o cliente desiste.

O mesmo cliente já conectou a Meta nos Satélites (login do Facebook do ÓRBITA) para Tráfego e Planner. Esse login pede `instagram_manage_messages`, `pages_manage_metadata`, `pages_messaging` e, com `META_PUBLISH_SCOPES_ENABLED`, `instagram_manage_comments`. O token de página guardado em `MetaPublishAccount` (spec 0057) já consegue responder comentário e mandar DM pela Graph API do Facebook.

## 2. Objetivo

Quem já conectou a Meta liga o Comments com um clique, sem token, chave secreta nem webhook para configurar.

### Não-objetivos

- Remover o passo a passo manual — continua como alternativa (contas sem a conexão da Meta, ou quem prefere app próprio).
- Migrar automaticamente canais manuais existentes.
- Mais de uma conta de Instagram por empresa no Comments (continua uma conexão por org — spec 0024 D-13).
- App Review da Meta (ação do dono do app de produção, fora do código).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `comments.channel.metaAccounts` lista as contas IG Business da conexão da Meta da org (`MetaPublishAccount` ativas), com `@`, foto e se a plataforma está pronta para receber eventos. |
| RF-2 | `comments.channel.connectWithMeta` conecta o canal do Comments usando o token de página da conta escolhida (ou a única). Valida o token contra a Graph API antes de salvar e inscreve a página nos eventos. |
| RF-3 | Credenciais do canal ganham `authMode` (`INSTAGRAM_LOGIN` padrão, `META_LOGIN`) e `pageId`. Canais antigos continuam válidos sem migração. |
| RF-4 | Canal `META_LOGIN` usa um gateway sobre `graph.facebook.com`: DM/resposta privada em `/{page-id}/messages`, resposta pública em `/{comment-id}/replies`, mídias em `/{ig-id}/media`, inscrição em `/{page-id}/subscribed_apps`. |
| RF-5 | Webhook único da plataforma `/api/social/webhook/meta`: verificação com `META_WEBHOOK_VERIFY_TOKEN`, assinatura com `META_APP_SECRET`, roteamento pelo `entry.id` (id da conta IG) para o canal `META_LOGIN` dono dessa conta. |
| RF-6 | Reconectar a Meta nos Satélites atualiza o token do canal `META_LOGIN` da org e o reativa. |
| RF-7 | Tela do Comments e painel "Comentários automáticos" do Planner mostram o botão "Usar @conta conectada na Meta" quando há conta disponível e o canal não está conectado. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Webhook fail-closed: sem `META_APP_SECRET` ou `META_WEBHOOK_VERIFY_TOKEN`, recusa tudo. |
| RNF-2 | Nenhum token sai do servidor; o token continua cifrado (`encryptSecret`). |
| RNF-3 | Sem migration (credenciais já são um blob JSON cifrado). |

## 4. Critérios de aceite

- [x] **CA-1** — Dado org com Meta conectada e Comments desconectado, quando o admin clica "Usar @conta", então o canal fica ATIVO com `authMode=META_LOGIN` e a página inscrita nos eventos.
- [x] **CA-2** — Dado canal `META_LOGIN`, quando chega um comentário no webhook único com assinatura válida, então a automação do post dispara (DM + resposta pública).
- [x] **CA-3** — Dado assinatura inválida ou env ausente, então o webhook único responde 401/403 e nada é processado.
- [ ] **CA-4** — Dado canal manual (`INSTAGRAM_LOGIN`), então tudo segue igual (rota por token, app secret próprio).
- [ ] **CA-5** — Dado reconexão da Meta nos Satélites, então o token do canal `META_LOGIN` é trocado e o status volta a ATIVO.
- [ ] **CA-6** — Dado evento de conta conectada por login manual chegando no webhook único, então é ignorado (é de outro app).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Org sem Meta conectada | Botão não aparece; passo a passo manual continua. |
| CB-2 | Meta conectada sem `instagram_manage_comments` (prod sem App Review) | Conecta, mas a resposta pública falha com erro da Meta; o run fica FAILED com a mensagem e o canal NÃO vai para "reconectar" por isso (erro de permissão ≠ token inválido só quando a Meta devolve 190). |
| CB-3 | Conta IG já conectada em outra org | `ChannelAlreadyTakenError` (unique `provider+externalAccountId`). |
| CB-4 | Org tinha canal manual e conecta pela Meta | Reaproveita a linha (D-13 da 0024), troca credenciais; URL antiga deixa de valer porque `appSecret` vazio reprova a assinatura. |
| CB-5 | Mais de uma conta IG na conexão da Meta | O usuário escolhe; sem escolha, erro pedindo para escolher. |
| CB-6 | Inscrição da página falha | Conecta mesmo assim e avisa (mesmo padrão do connect manual). |
| CB-7 | `entry.id` sem canal | 200 sem processar (a Meta não deve reentregar). |
| CB-8 | Comentário do próprio dono | Ignorado (`handle-inbound-event` já faz). |

## 6. Decisões de design

### D-1 — Copiar o token de página para o canal em vez de referenciar `MetaPublishAccount`
O gateway é montado de forma síncrona a partir do canal, no caminho quente do webhook. Referenciar exigiria uma consulta a mais por evento e acoplaria o módulo `social` ao Planner. O custo (token duplicado) é pago com RF-6: reconectar a Meta atualiza o canal.

### D-2 — Webhook único da plataforma, roteado por `entry.id`
No login do Facebook, a assinatura é do **app** (um app secret só), então uma URL por conexão não traz segurança extra e obrigaria configurar a Meta a cada cliente. O roteamento por `externalAccountId` é seguro porque o unique `(provider, externalAccountId)` garante um dono só. Canais manuais seguem na rota por token (app de cada cliente).

### D-3 — Sem migration
`credentials` já é JSON cifrado com shape por provider (0024 D-8). `authMode` ausente = `INSTAGRAM_LOGIN`.

### Alternativa descartada — "Instagram Login" OAuth do ÓRBITA
Exigiria um segundo login (instagram.com) e outro App Review. O login do Facebook já existe e já é pedido por Tráfego/Planner.

## 7. Plano de implementação

- `src/modules/social/infra/instagram/meta-login-channel-gateway.ts` (gateway graph.facebook.com).
- `src/modules/social/infra/schemas.ts`, `domain/types.ts`: `authMode`, `pageId`.
- `src/modules/social/index.ts`: escolhe o gateway pelo `authMode`. `src/modules/social/process-channel-events.ts`: roda as automações, usado pelas rotas.
- `src/features/comments/server/meta-webhook.ts`: `processMetaCommentsWebhook`, chamado pelo webhook único e pelo webhook antigo `/api/integrations/instagram/webhook` (a Meta aceita uma URL por objeto).
- `src/app/api/social/webhook/meta/route.ts` (novo) e lookup por conta em `prisma-channel-repository.ts`.
- `src/features/comments/server/meta-login-channel.ts`: listar contas, conectar, atualizar token.
- `src/app/router/comments/channel.ts`: `metaAccounts`, `connectWithMeta`.
- `oauth-finalize.ts`: chama a atualização do token (RF-6).
- UI: `channel-connect-card.tsx`, `comments-automation-panel.tsx` (Planner).
- Docs: `docs/comments-overview.md`, `docs/comments-meta-producao.md`, `docs/nasa-planner-teste-local-meta.md`.

## 8. Produção (checklist do dono do app Meta)

Ver [`docs/comments-meta-producao.md`](../../docs/comments-meta-producao.md).

## 9. Changelog

- 2026-10-04 — criada e implementada; testada no app de teste ÓRBITA TESTE 2026 (publicado) com comentário real no Reel do @weydsonlima: DM com botão e resposta pública enviadas. Achado: app não publicado não recebe webhook real nenhum.
