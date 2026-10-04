# Planner (NASA Planner) — visão geral

> Fonte de verdade do domínio. Atualize junto com qualquer mudança em `src/features/nasa-planner/`, `src/app/router/nasa-planner/`, `src/inngest/functions/nasa-planner/` ou nos modelos `NasaPlanner*` / `MetaPublishAccount`.
> Specs: [0057 — publicação confiável e Stories](../specs/nasa-planner/0057-publicacao-confiavel-e-stories.md) · [0058 — calendário, aprovação e multi-cliente](../specs/nasa-planner/0058-planner-v2-calendario-aprovacao-multicliente.md) · [0059 — Comments por post](../specs/nasa-planner/0059-planner-comments-por-post.md) · [0060 — disparo de WhatsApp e Facebook](../specs/nasa-planner/0060-planner-disparo-whatsapp-e-facebook.md).

## 1. O que é

Central de conteúdo das redes sociais: roteiro → criação → aprovação → programação → publicação → métricas. Cada **cliente é uma org** com o próprio Instagram/Facebook nos Satélites; quem é membro de várias orgs vê, cria, aprova e programa tudo num calendário só.

## 2. Telas

| Rota | O que mostra |
|---|---|
| `/nasa-planner` | Calendário v2 (Semana/Mês, filtros de cliente/tipo/status, horários sugeridos, painel Metas/Momentos/Rascunhos/Aprovação, criador). Estado na URL: `view`, `date`, `orgs`, `types`, `status`, `panel`, `post`. |
| `/nasa-planner/planners` | Lista de planners (marca, campanhas, mapas mentais). |
| `/nasa-planner/[plannerId]` | Planner antigo (brand kit, campanhas, mapas, kanban de posts). |
| `/nasa-planner/calendario`, `/campanhas/[id]`, mapa mental | Campanhas e mapas (sem mudança na v2). |

Componentes v2: `src/features/nasa-planner/components/v2/` — `planner-home`, `calendar-toolbar`, `week-view`, `month-view`, `mobile-agenda`, `calendar-post-chip`, `side-panel`, `post-composer` (+ `composer-script-step`, `composer-creation-step`, `review-panel`, `composer-schedule-step`).

## 3. Status do post

`IDEA → DRAFT → PENDING_APPROVAL ⇄ CHANGES_REQUESTED → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED | FAILED`

- Editar mídia/legenda/tipo de um post APPROVED ou SCHEDULED volta para DRAFT e o tira do horário (`reopenPostAfterEdit`).
- Programar exige APPROVED quando a aprovação é obrigatória (`NasaPlanner.requiresApproval`; nulo = obrigatória em org com mais de um membro).
- `posts.update` só aceita status IDEA/DRAFT/PENDING_APPROVAL/APPROVED; programar e publicar têm rotas próprias.

## 4. Permissões (multi-cliente)

`src/features/nasa-planner/server/cross-org.ts` — chave `nasa-planner` da matriz de Permissões:

| Ação | Exige |
|---|---|
| ver | `canView` |
| criar/editar/enviar para aprovação | `canCreate` |
| aprovar/pedir ajustes | `canApprove` (ação especial do Planner na matriz) |
| programar/publicar/metas/horários/pilares | `canEdit` ou `canApprove` |

Toda escrita usa a org **do post** (`assertPostAccess`), nunca a org ativa. Leituras cruzam `listPlannerOrganizations` (orgs do usuário com `canView`).

## 5. Publicação (spec 0057)

- **Contas**: `MetaPublishAccount` (IG Business e página FB por org, token **cifrado** com `src/lib/crypto.ts`). Gravadas pelo OAuth da Meta (`integrations/oauth-finalize.ts`) e pelo backfill (`nasa-planner/backfill-publish-accounts`, disparo manual no Inngest). Sem conta cadastrada, cai no config legado do `PlatformIntegration` META.
- **Fluxo único**: `src/features/nasa-planner/server/publishing/publish-workflow.ts` — claim por `scheduleVersion` (idempotência), plano sem token (`resolve-targets.ts`), container → espera de processamento com `step.sleep` → publish, grava `externalIgPostId`/permalink na hora, `NasaPlannerPublishAttempt` por passo, Stars (`planner_post_publish`) só no sucesso.
- **Formatos**: Instagram IMAGE, CAROUSEL (imagens e vídeos), REELS, **STORIES** (imagem e vídeo); Facebook foto, Reel (`/video_reels`), Story de foto (`/photo_stories`) e de vídeo (`/video_stories`). Carrossel no Facebook sai como foto única.
- **Depois de publicar** (`runAfterPublished`): liga a automação do Comments do post (best-effort).
- **Programar** (`server/scheduling.ts`): incrementa `scheduleVersion` e manda `nasa-planner/post.scheduled` (dorme até a hora). Reprogramar/desprogramar só muda a versão — a execução antiga acorda e não consegue o claim.
- **Regras de formato**: `publishing/validate-post.ts` (mesma função no criador, no agendamento e no MCP).

### Funções Inngest

| Função | Gatilho | Papel |
|---|---|---|
| `nasa-planner-publish-post-v2` | `post.scheduled`, `post.publish-now` | Publica (programado ou agora); `onFailure` marca FAILED e avisa |
| `nasa-planner-publish-post` | `nasa-planner/publish.post` (antigo) | Repassa eventos legados para `post.publish-now` |
| `nasa-planner-publish-sweep` | `*/5 * * * *` | Publica programados atrasados e encerra PUBLISHING preso (> 20 min) |
| `nasa-planner-publish-accounts-health` | `0 9 * * *` | Checa token de cada conta; NEEDS_RECONNECT avisa owners/admins |
| `nasa-planner-backfill-publish-accounts` | `nasa-planner/backfill-publish-accounts` | Cria contas das orgs conectadas antes da spec 0057 |
| `sync-post-metrics-cron`, `refresh-meta-tokens` | crons | Sem mudança (métricas e token legado) |

## 6. Procedures oRPC (`nasaPlanner.*`)

| Grupo | Procedures |
|---|---|
| `clients` | `list` (orgs + contas + permissões + contadores) |
| `calendar` | `posts`, `drafts` (fila `drafts`/`approval`), `slots`, `moments`, `share`, `getShare` |
| `posts` | `schedule`, `unschedule`, `publish` (= `publishNow`), `publishNow`, `retryPublish`, `createForClient`, `approve` (v2), CRUD e mídia (todas cross-org) |
| `approval` | `submit`, `requestChanges`, `approve`, `comment`, `listReviews` |
| `planning` | `getGoals`, `setGoal`, `upsertSlot`, `deleteSlot`, `listPillars`, `upsertPillar`, `deletePillar`, `setApprovalRequired` |
| `publishAccounts` | `list` (sem token) |

Hooks: `use-planner-calendar.ts`, `use-planner-publishing.ts`, `use-planner-approval.ts`, `use-planner-planning.ts` (+ o antigo `use-nasa-planner.ts`).

## 6.1 Comments e WhatsApp (Fase 2)

- **Comments por post** (`server/comments-link.ts`): o post guarda `commentsAutomationId` e `commentsAutoActivate`. O painel "Comentários automáticos" (passo Programação) cria/edita uma `SocialAutomation` (COMMENT_CREATED + SPECIFIC_CONTENT) com palavras, DM (+1 botão) e respostas públicas. Antes de publicar fica desligada e sem alvo; ao publicar, o media id vira alvo e ela liga. Exige o App Comments liberado (`comments.canEdit`) e o canal do Comments na mesma conta do Instagram do post. Procedures `nasaPlanner.comments.get/save`.
- **Disparo de WhatsApp** (`server/whatsapp-broadcast.ts`): Criar → Disparo WhatsApp (clientes com número META_CLOUD). Cria a campanha na org do cliente, adiciona os leads do tracking (filtros de temperatura e etapa), grava o modelo e agenda com as mesmas validações das Campanhas. Procedures `nasaPlanner.broadcasts.templates/createScheduled` e `calendar.broadcasts`; os disparos aparecem no calendário (somem quando há filtro de tipo/status).

## 7. Modelos

`NasaPlanner` (+ `requiresApproval`), `NasaPlannerPost` (+ aprovação, roteiro, origem, `scheduleVersion`, tentativas, `commentsAutomationId`, `commentsAutoActivate`), `NasaPlannerPostReview`, `NasaPlannerContentPillar`, `NasaPlannerPublishSlot`, `NasaPlannerPublishAttempt`, `NasaPlannerCadenceGoal`, `MetaPublishAccount`. Migrations `20261004200000_planner_v2_status_values`, `20261004200100_planner_v2_base` e `20261004230000_planner_comments_link`.

## 8. Roadmap

| Fase | Status | Conteúdo |
|---|---|---|
| 1 — Base + calendário | ✅ código / 🚧 validação com conta IG real | Publicação confiável, Stories, calendário, aprovação, multi-cliente |
| 2 — Comments + WhatsApp | ✅ código / 🚧 validação | Automação do Comments por post (edição inline), disparo em massa programado pelo Planner, Reel/Story no Facebook |
| 3 — Astro + WhatsApp + em massa + IA | ⬜ | Tools `planner` do Astro e aprovação pelo WhatsApp, posts/reels em massa, reel em várias páginas, roteiro por IA dos Satélites |
| 4 — MCP do ÓRBITA + Claude Code | ✅ código (specs 0065/0066) | Servidor MCP (rascunhos, upload, envio para aprovação — sem aprovar/publicar) e skill de criação com Remotion |
| 5 — Métricas e melhor horário | ⬜ | `online_followers` → horários reais, insights por post, painel por cliente |

Conclusão sobre os MCPs da Meta (Ads Connectors, WhatsApp Business Tools MCP) e as "Instagram agent skills": publicação continua no servidor pela Graph API; a alavanca é o MCP próprio do ÓRBITA (Fase 4).

**Testar no próprio Instagram (local):** [nasa-planner-teste-local-meta.md](nasa-planner-teste-local-meta.md).

**Bloqueador de release**: App Review da Meta com Advanced Access em `instagram_content_publish`, `pages_manage_posts`, `instagram_basic`, `pages_show_list`.

## 9. Changelog

- 2026-10-04 — **Roteiro da semana** (spec 0067): `NasaPlannerPost.objective` (Objetivo / Gatilho; o `cta` já existia) e `NasaPlannerWeekdayTheme` (tema fixo por dia da semana e cliente — etiqueta acima do dia na Semana, `planning.listWeekdayThemes/setWeekdayTheme`); **+ Criar → Conteúdo (roteiro da semana)** cola o texto e o Astro separa por dia sem reescrever (`planning.parseWeeklyScript` → `server/weekly-script.ts`), criando pautas (`IDEA`, rótulo "Pauta"); filtro **Conteúdo** (pautas do período com Criar/Abrir) e visão **Roteiro** (semana em tabela, segunda a domingo). MCP e Astro leem `weekdayThemes`; `create_draft` aceita `objective`/`cta`. Guia `planner.weekly-script`.
- 2026-10-04 — **Abas no topo** do `/nasa-planner`: **Dashboard** (padrão: números gerais dos clientes do filtro, distribuição por status, "Precisa de você", Momentos, Metas da semana, clientes e contas, atividades recentes — `dashboard.summary`), **Calendário** com **Semana | Mês | Kanban** (Kanban por status em `calendar.board`, 30 por coluna, filtro **Origem** Todas/IA/equipe; arrastar só Rascunho/Ajuste → Aguardando aprovação = enviar, e Aprovado → Programado = programar no horário pretendido ou abrir o post para escolher), **Campanhas** e **Mapas Mentais** (telas antigas no planner padrão da empresa ativa; o seletor "Cliente" troca a empresa ativa, porque essas procedures são presas a `context.org`) e link para o **Kit da Marca**. Saiu o painel lateral (Metas/Momentos/Rascunhos/Aprovação/Criações): Rascunhos e Aprovação viraram colunas, Criações virou o filtro Origem + selo no card, "Trouxe de outra IA?" foi para o menu **+ Criar**. `clients.list` devolve `defaultPlannerId`. Guias `planner.*` apontam para `?tab=calendar`.
- 2026-10-04 — **Fase C, etapa 2** (spec 0066), **sem AWS**: o Claude Code do cliente renderiza a arte no próprio computador e entrega pelo MCP. Pacote Remotion `orbita-remotion` (fonte em `templates/orbita-remotion/`, fora do typecheck/lint; zip em `public/skills/orbita-planner/orbita-remotion.zip`, gerado por `scripts/planner/build-remotion-templates.sh`) com `PostReel`, `StoryFrame`, `CarouselSlide` e `FeedPost` por props; nova tool `get_video_templates` (link + `brand` do Kit: nome, @ do Instagram, paleta, logo branco, fontes do Google Fonts); skill atualizada; link "Baixar modelos de vídeo" em Satélites → IA externa. Dev sem R2: `EXTERNAL_AI_LOCAL_UPLOADS=true` faz o `request_upload_url` devolver PUT assinado (HMAC, 1 h) para `/api/mcp/upload` → `public/uploads/external-ai/` (desligado em produção). Testado: Reel renderizado com o Kit da ÓRBITA, enviado, anexado e mandado para aprovação. **Ao mudar os modelos, rode o script do zip.** Remotion Lambda (botão "Gerar vídeo" dentro do ÓRBITA) fica para depois.
- 2026-10-04 — **Fase C, etapa 1** (spec 0065): **MCP do ÓRBITA** em `/api/mcp` (Streamable HTTP sem estado, chave Bearer `orb_live_…` por empresa gerada em Satélites → IA externa; só o hash no banco, `external_ai_access_tokens`) com 9 tools — list_clients, get_brand_kit, list_calendar, list_open_slots, create_draft, attach_media, request_upload_url, submit_for_approval, get_review_feedback (nenhuma aprova/programa/publica); skill `public/skills/orbita-planner/SKILL.md`; aba **Criações** no painel lateral (MCP/Astro/WhatsApp/origem marcada) com Revisar/Descartar e upload de criação de outra IA (ChatGPT, Gemini, Midjourney, Canva). Etapa 2: ver spec 0066 (sem AWS).
- 2026-10-04 — **Fase B: Planner pelo WhatsApp** (spec 0064): Astro no WhatsApp ganha o pacote `planner` também sem financeiro; pedir post → cartão com roteiro/legenda/hashtags/quando → SIM cria e envia para aprovação; "Ajustar …" refaz a proposta; aprovadores com número vinculado recebem a prévia (Inngest `nasa-planner/approval.whatsapp-notify`) e respondem SIM (aprova; programa se der) ou AJUSTE: motivo. Confirmação por texto (botões da Uazapi não chegam ao aparelho). Canal do bot com `sendMedia`; tool `planner_search_posts`.
- 2026-10-04 — **Fase A da criação de conteúdo** (spec 0063): **Kit da Marca** em `/nasa-planner/kit` por cliente (logos em 5 variações em `Organization.brandLogoVariants`, paleta/fontes/voz em `Organization`, frases/proibidas/hashtags/CTAs no planner padrão, fundos/produtos/materiais/referências na nova `brand_kit_assets`), medidor de 9 itens (`lib/brand-kit-completeness.ts`, regra única); **Novo conteúdo** com vários formatos (um rascunho por formato) e **Gerar com o Astro** pela IA do Astro (`resolvePrimaryModel`, sem Pollinations/DALL-E/Ideogram/Flux; cobra `astro_prompt` só na chave da plataforma) — kit incompleto desliga o botão e o servidor recusa; **pacote `planner` do Astro** (calendário, rascunhos/aprovações, detalhes e números do post, status do kit; criar rascunhos e programar por proposta confirmada); guias `planner.brand-kit` e `planner.astro-generate`. Upload do kit: R2; em desenvolvimento cai no `/api/upload-local` se o R2 recusar.
- 2026-10-04 — **Editar e apagar** comentários e respostas da própria conta na seção Comentários (`posts.instagramComments.editOwn`). A Meta não edita comentário nem permite curtir pela API: "Editar" publica o texto novo no mesmo lugar e só depois apaga o antigo (se publicar falhar, o antigo fica); o horário muda e a tela avisa.
- 2026-10-04 — Seção **Comentários** no post publicado (`v2/post-comments-section.tsx`): lista paginada com respostas e etiqueta da automação do Comments, responder em público ou por DM (resposta privada), ocultar/mostrar e apagar. Procedures `posts.instagramComments.{list,reply,setHidden,delete}` → `server/publishing/post-comments.ts`; toda ação confere na Meta que o comentário é do post. Ler exige `view`; agir exige `schedule`. Em produção depende de `instagram_manage_comments` (App Review). A Meta não libera lista de quem curtiu ou visualizou.
- 2026-10-04 — Post publicado ganhou tela própria (`v2/published-post-view.tsx`): curtidas, comentários e alcance/reproduções/visualizações lidos na hora da Meta (`posts.metrics` → `getPlannerPostMetrics` → `getIgMediaMetrics`), legenda publicada, "Atualizar números" e o celular com a mídia que a Meta devolve (a que foi ao ar). Story, Reel e Comments pela Meta (spec 0061) testados de verdade.
- 2026-10-04 — Primeira publicação real (feed no @weydsonlima) pelo app de teste em modo desenvolvimento; permissões de publicar/comentários atrás de `META_PUBLISH_SCOPES_ENABLED`; guia de teste local.
- 2026-10-04 — Fase 2 (specs 0059/0060): Comments por post com ativação ao publicar, disparo de WhatsApp pelo calendário (multi-cliente), disparos no calendário, Reel e Story na página do Facebook.
- 2026-10-04 — Fase 1 (specs 0057/0058): contas de publicação cifradas, fluxo único de publicação com Stories, varredura de 5 min, saúde das contas, aprovação com histórico e checklist de marca, calendário multi-cliente com Semana/Mês, horários sugeridos, painel lateral e criador em passos.
