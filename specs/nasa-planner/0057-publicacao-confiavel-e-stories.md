---
id: 0057
titulo: Publicação confiável do Planner e Stories
dominio: nasa-planner
status: implementada
autor: Weydson
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: completa
---

# 0057 — Publicação confiável do Planner e Stories

## 1. Contexto

O Planner diz que publicou posts que nunca saíram e publica na conta errada:

- `src/inngest/functions/nasa-planner/publish-post-handler.ts` lê só os campos legados do `PlatformIntegration` (`page_access_token`, `page_id`, `instagram_account_id`), ignora `targetIgAccountId`/`targetFbPageId`, marca **PUBLISHED** mesmo sem publicar nada e nunca grava `externalIgPostId`, `externalFbPostId` nem `publishError`.
- A tela agenda por `schedule-post.ts`, que não manda evento: o post espera o cron de hora em hora (`publish-scheduled-posts.ts`, `0 * * * *`) — até 59 min de atraso. `schedule-post-real.ts` (evento com atraso) existe mas nenhuma tela usa.
- `src/app/router/integrations/oauth-finalize.ts:52` recebe o `access_token` de cada página e o descarta; só a primeira página guarda token. Toda conta IG/página além da primeira publica com o token errado ou falha.
- Story cai no caminho de imagem do feed; não existe chamada `media_type=STORIES`.
- O kanban não tem coluna FAILED: post que falha some da tela.
- Reel espera o processamento do vídeo dentro de uma única chamada — risco de timeout.

## 2. Objetivo

Todo post programado ou "publicar agora" sai na conta escolhida, no horário (≈1 min), uma única vez, com o resultado real gravado (ids, permalink ou erro legível) — incluindo Stories de imagem e vídeo.

### Não-objetivos

- Stories/Reels de página do Facebook (Fase 2, spec 0060).
- Cifrar o `accessToken` de usuário que o META `PlatformIntegration` já guarda (outra spec; meta-ads e Comments leem esse campo).
- Nova interface do calendário (spec 0058).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Tabela `MetaPublishAccount` com uma linha por conta IG Business e por página FB de cada org, token cifrado (`src/lib/crypto.ts`) e status `ACTIVE` / `NEEDS_RECONNECT` / `DISABLED`. |
| RF-2 | O OAuth da Meta grava o token de cada página selecionada em `MetaPublishAccount` (sem deixar de escrever o config legado). |
| RF-3 | Backfill único (Inngest, disparo manual) cria as contas das orgs já conectadas via `GET /me/accounts` com o `accessToken` salvo; token inválido vira `NEEDS_RECONNECT`. |
| RF-4 | Um único fluxo de publicação (`publish-workflow`) atende "publicar agora", programado, retry e varredura. |
| RF-5 | Programar manda evento com `sleepUntil(scheduledAt)`; reprogramar/desprogramar cancela o anterior (`scheduleVersion`). |
| RF-6 | Varredura a cada 5 min publica programados atrasados e reconcilia posts presos em `PUBLISHING` há mais de 20 min. |
| RF-7 | Publica IMAGE, CAROUSEL, REELS e **STORIES** (imagem e vídeo) no Instagram e foto na página do Facebook; grava `externalIgPostId`, `externalIgPermalink`, `externalFbPostId`. |
| RF-8 | Falha termina em `FAILED` com `publishError` em português e `publishErrorCode`; nunca `PUBLISHED` sem id externo. |
| RF-9 | Retry não republica a rede que já tem id externo. |
| RF-10 | Cada tentativa vira uma linha em `NasaPlannerPublishAttempt` (rede, passo, container, erro, gatilho). |
| RF-11 | Validação por formato antes de programar: Story 1 mídia (9:16 recomendado, vídeo 3–60 s); Reel vídeo 3 s–15 min; Carrossel 2–10 itens; legenda ≤ 2200 caracteres e ≤ 30 hashtags. |
| RF-12 | Saúde diária das contas: token revogado vira `NEEDS_RECONNECT` e o dono é notificado. |
| RF-13 | Stars de publicação (`planner_post_publish`) cobrados quando a publicação dá certo, não ao programar. |
| RF-14 | Kanban e calendário mostram `FAILED` com "Tentar novamente". |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Polling do processamento de vídeo com `step.sleep` (nenhum loop dentro de uma requisição). |
| RNF-2 | Concorrência por org e por conta IG (limite da Meta: 50 publicações / 24 h por conta, Stories contam). |
| RNF-3 | Token nunca sai do servidor: listagens de contas devolvem só id, nome, foto e status. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado uma org com duas contas IG, quando programo um post para cada conta, então cada um publica na conta escolhida com `externalIgPostId` e permalink gravados.
- [ ] **CA-2** — Dado um post sem destino válido, quando chega a hora, então ele termina `FAILED` com erro legível (nunca `PUBLISHED`).
- [ ] **CA-3** — Dado um post programado, quando chega `scheduledAt`, então publica em até ~1 min.
- [ ] **CA-4** — Dado um post programado e depois reprogramado, então só a versão nova publica (uma vez).
- [ ] **CA-5** — Dado que o evento programado se perdeu, então a varredura publica em até 5 min.
- [ ] **CA-6** — Dado IG publicado e FB com erro, quando tento de novo, então só o FB é refeito.
- [ ] **CA-7** — Story de imagem e Story de vídeo publicam com `media_type=STORIES`.
- [ ] **CA-8** — Token de página revogado (erro 190) marca a conta `NEEDS_RECONNECT`, sem retry infinito.
- [ ] **CA-9** — Publicação que falha não cobra Stars.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Dois gatilhos (evento + varredura) ao mesmo tempo | Claim atômico por `scheduleVersion`: só um publica. |
| CB-2 | Post editado depois de programado | Volta a DRAFT (spec 0058); a versão muda e o evento antigo não publica. |
| CB-3 | Vídeo ainda processando na Meta após 10 min | `FAILED` com "A Meta não terminou de processar o vídeo"; retry recria o container. |
| CB-4 | URL da mídia expirada antes do container | Usa URL pública do R2 (`getPublicMediaUrl`), sem expiração curta. |
| CB-5 | Org com só o config legado (sem `MetaPublishAccount`) | Usa o legado como fallback e registra aviso para reconectar. |
| CB-6 | Limite de 50/24 h atingido | `FAILED` com código de limite; retry manual depois. |
| CB-7 | Evento antigo `nasa-planner/publish.post` já na fila | Função de compatibilidade traduz para o evento novo. |
| CB-8 | Story com legenda | Legenda ignorada (API não exibe); a tela avisa antes. |

## 6. Decisões de design

### D-1 — Tabela própria de contas de publicação

- **Escolha**: `MetaPublishAccount` com token cifrado por conta.
- **Alternativas descartadas**: mais JSON em `PlatformIntegration.config` (não indexável para a visão multi-cliente, sem estado por conta, token trafegando junto do config).
- **Consequência**: backfill necessário; config legado continua sendo escrito para meta-ads e Comments.

### D-2 — Um fluxo, dois gatilhos

- **Escolha**: `publish-workflow` único chamado pelo Inngest (programado e "agora").
- **Alternativas descartadas**: manter `publish-post.ts` síncrono + handler separado (foi o que divergiu e gerou o bug).
- **Consequência**: "publicar agora" vira assíncrono; a tela acompanha o status `PUBLISHING`.

### D-3 — Cobrança na publicação bem-sucedida

- **Escolha**: Stars cobrados dentro do fluxo, após sucesso.
- **Alternativas descartadas**: cobrar ao programar (cobra falha e reprogramação).

## 7. Impacto

- [x] Schema / migration — `MetaPublishAccount`, `NasaPlannerPublishAttempt`, colunas de publicação em `NasaPlannerPost`, enum `PUBLISHING`.
- [x] Procedures oRPC — `schedule` (fusão com `scheduleReal`), `unschedule`, `reschedule`, `publishNow`, `retryPublish`, `publishAccounts.list`.
- [ ] Realtime
- [x] Automações (Inngest) — `publish-post`, `publish-sweep-cron`, `publish-accounts-health-cron`, backfill; saem `publish-post-handler` e `publish-scheduled-posts` (`refresh-meta-tokens` fica: renova o token legado que meta-ads e Comments leem).
- [ ] Env vars novas
- [ ] Breaking change — "publicar agora" passa a ser assíncrono.
- [x] Documentação — `docs/nasa-planner-overview.md` (novo).

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-7 | manual | Conta IG de teste com duas contas; publicar e conferir no Instagram e no banco. |
| CA-2, CA-6, CA-8, CA-9 | automatizado (quando houver runner) / manual | Mock da Graph API devolvendo erro por rede. |
| CA-3, CA-4, CA-5 | manual | Inngest dev: programar, reprogramar, cancelar o evento e esperar a varredura. |

## 9. Riscos e rollback

- **App Review da Meta**: `instagram_content_publish`, `pages_manage_posts`, `instagram_basic`, `pages_show_list` com Advanced Access. Sem isso só usuários com papel no app publicam — **bloqueador de release**.
- Migration aditiva (tabelas e colunas novas, valor de enum). Valor de enum não é removível em Postgres; o resto é reversível com `DROP`.
- Rollback: reapontar o evento `post.scheduled` para o handler antigo e reativar o cron horário.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-04 | Weydson | Criada |
| 2026-10-04 | Weydson | Aprovada e implementada (Fase 1). Programar não cancela por evento: a troca de `scheduleVersion` impede a execução antiga de publicar. |
