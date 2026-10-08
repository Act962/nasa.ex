# Planner (NASA Planner) — visão geral

> Fonte de verdade do domínio. Atualize junto com qualquer mudança em `src/features/nasa-planner/`, `src/app/router/nasa-planner/`, `src/inngest/functions/nasa-planner/` ou nos modelos `NasaPlanner*` / `MetaPublishAccount`.
> Specs: [0057 — publicação confiável e Stories](../specs/nasa-planner/0057-publicacao-confiavel-e-stories.md) · [0058 — calendário, aprovação e multi-cliente](../specs/nasa-planner/0058-planner-v2-calendario-aprovacao-multicliente.md) · [0059 — Comments por post](../specs/nasa-planner/0059-planner-comments-por-post.md) · [0060 — disparo de WhatsApp e Facebook](../specs/nasa-planner/0060-planner-disparo-whatsapp-e-facebook.md) · [0063 — Kit da Marca e Astro](../specs/nasa-planner/0063-kit-da-marca-e-astro-no-planner.md) · [0064 — Planner pelo WhatsApp](../specs/nasa-planner/0064-planner-pelo-whatsapp.md) · [0065 — MCP e caixa de criações](../specs/nasa-planner/0065-mcp-e-caixa-de-criacoes.md) · [0066 — modelos de vídeo](../specs/nasa-planner/0066-modelos-de-video-pelo-claude-code.md) · [0067 — roteiro da semana](../specs/nasa-planner/0067-roteiro-da-semana.md) · [0068 — planejamento semanal em mapa mental](../specs/nasa-planner/0068-planejamento-semanal-em-mapa-mental.md) · [0070 — kits da marca por conta](../specs/nasa-planner/0070-kits-da-marca-por-conta.md) · [0071 — contas dos Satélites](../specs/nasa-planner/0071-planner-publica-pelas-contas-dos-satelites.md) · [0074 — mesmo conteúdo em várias contas](../specs/nasa-planner/0074-publicar-em-varias-contas.md).

## 1. O que é

Central de conteúdo das redes sociais: roteiro → criação → aprovação → programação → publicação → métricas. Cada **cliente é uma org** com o próprio Instagram/Facebook nos Satélites; quem é membro de várias orgs vê, cria, aprova e programa tudo num calendário só.

## 2. Telas

| Rota | O que mostra |
|---|---|
| `/nasa-planner` | Abas no topo: **Dashboard** (padrão), **Calendário** (Semana, Mês, Kanban e Roteiro; filtros de cliente/conta/tipo/status/origem; horários sugeridos; criador), **Campanhas**, **Mapas Mentais** e **Kit da Marca**. Estado na URL: `tab`, `view`, `date`, `orgs`, `contas`, `types`, `status`, `post`, `org`, `kit`. |
| `/nasa-planner/planners` | Lista de planners (marca, campanhas, mapas mentais). |
| `/nasa-planner/[plannerId]` | Planner antigo (brand kit, campanhas, mapas, kanban de posts). |
| `/nasa-planner/calendario`, `/campanhas/[id]`, mapa mental | Campanhas e mapas (sem mudança na v2). |

Componentes v2: `src/features/nasa-planner/components/v2/` — `planner-home`, `planner-dashboard`, `calendar-toolbar`, `week-view`, `month-view`, `kanban-view`, `script-table-view`, `mobile-agenda`, `calendar-post-chip`, `post-composer` (+ `composer-script-step`, `composer-creation-step`, `review-panel`, `composer-schedule-step`), `published-post-view`, `post-comments-section`. Kit da Marca em `components/brand-kit/`.

Componentes do Planner antigo (raiz de `components/` e `tabs/`), divididos por responsabilidade:

| Tela | Arquivo principal | Peças |
|---|---|---|
| Editor de mapa mental | `mind-map-editor.tsx` | `mind-map/editor-nodes.tsx` (nós e ligações), `mind-map/editor-toolbar.tsx` (barra e menu do celular), `mind-map/editor-dialogs.tsx` (card de ação e sugestões da IA), `hooks/use-mind-map-history.ts` (desfazer/refazer), `lib/mind-map/editor-graph.ts` (leituras tipadas de `node.data`) e `lib/mind-map/editor-bridge.ts` (ponte tipada nó → editor, no lugar de globais em `window`) |
| Quadro de posts | `tabs/posts-tab.tsx` | `posts-board/post-board-card.tsx`, `board-post-dialog.tsx`, `create-post-dialog.tsx`, `schedule-post-dialog.tsx`, `image-viewer-dialog.tsx`; mídia em `lib/post-media.ts` |
| Popup do Workspace | `planner-popup.tsx` | `planner-popup/popup-posts-tab.tsx`, `popup-branding-tab.tsx`, `popup-ai-config.tsx`, `popup-shared.ts` |
| Assistente de campanha | `campaign-planner-wizard.tsx` | `campaign-wizard/step-company.tsx`, `step-plan.tsx`, `step-events.tsx`, `step-assets.tsx`, `step-tasks.tsx`, `step-review.tsx`, `wizard-options.ts`; valores aceitos pelas procedures em `lib/campaign-options.ts` |

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

## 5.1 Mesmo conteúdo em várias contas do Instagram (spec 0074)

Escolher duas ou mais contas no criador cria **um post por conta** ("irmãos"), ligados por `NasaPlannerPost.publishGroupId`. O fluxo de publicação não sabe de grupo: cada irmão publica, falha, tenta de novo e cobra Stars sozinho. Tudo mora em `server/publish-group.ts`.

| Assunto | Regra |
|---|---|
| Criação | `createPostsForInstagramAccounts` (tela, MCP e Astro). De 2 a 10 contas, sem repetição, todas da mesma empresa. O Facebook fica só no primeiro irmão. |
| Conteúdo | Toda procedure que grava conteúdo ou mídia chama `syncPublishGroupContent` depois de salvar: copia campos e slides para os irmãos em sincronia e reabre os que já estavam aprovados ou programados. **Procedure nova de conteúdo precisa chamar essa função.** |
| "Diferente nesta conta" | `isGroupContentDetached`: o irmão não recebe nem envia mudanças. Ao voltar, recebe o conteúdo do grupo. |
| Publicado | Irmão publicado ou publicando nunca é alterado nem apagado pelo grupo. |
| Aprovação | `submitForApprovalWithGroup`, `approveWithGroup`, `requestChangesWithGroup`: a ação vale para o post pedido (com o aviso de sempre) e se repete em silêncio nos irmãos. O checklist da marca roda por conta. Vale também para o SIM e o AJUSTE do WhatsApp. |
| Programação | `scope: "group"` em `posts.schedule` / `unschedule` / `publishNow` age em todas as contas, com `staggerMinutes` (0 a 30) entre elas. Conta que não puder ser programada volta em `skipped`, e as outras seguem. |
| Calendário | `lib/publish-group-collapse.ts`: irmãos com o mesmo status e o mesmo dia viram um cartão com "N contas". Com o filtro **Conta** ligado, aparece o irmão da conta. |
| Grupo de um | Quando sobra um irmão só, ele volta a ser post comum (`publishGroupId` nulo). |

Duas correções de base vieram junto: o criador grava a conta que mostra marcada, e **programar confere a conta do Instagram no pedido** (`loadSchedulablePost`), não só no horário de publicar.

## 6. Procedures oRPC (`nasaPlanner.*`)

| Grupo | Procedures |
|---|---|
| `clients` | `list` (orgs + contas + permissões + contadores) |
| `calendar` | `posts`, `drafts` (fila `drafts`/`approval`), `slots`, `moments`, `share`, `getShare` |
| `posts` | `schedule`, `unschedule`, `publishNow`, `retryPublish`, `createForClient`, `approve` (v2), CRUD e mídia (todas cross-org) |
| `posts.group` | `get` (contas do grupo com status e checklist), `setAccounts`, `setDetached` |
| `approval` | `submit`, `requestChanges`, `approve`, `comment`, `listReviews` |
| `planning` | `getGoals`, `setGoal`, `upsertSlot`, `deleteSlot`, `listPillars`, `upsertPillar`, `deletePillar`, `setApprovalRequired` |
| `publishAccounts` | `list` (sem token) |

Hooks: `use-planner-calendar.ts`, `use-planner-publishing.ts`, `use-planner-approval.ts`, `use-planner-planning.ts`, `use-planner-brand-kit.ts`, `use-planner-board.ts`, `use-planner-creations.ts`, `use-planner-integrations.ts`, `use-planner-post-comments.ts`, `use-planner-weekly-script.ts`, `use-planner-weekly-mind-map.ts`; do Planner antigo: `use-nasa-planner.ts`, `use-campaign-planner.ts`, `use-planner-org-brand.ts` (marca da empresa e chave de IA do popup). `use-planner-publish-group.ts` (grupo de contas). Nenhum componente da feature chama `orpc` direto (regra 9).

## 6.1 Comments e WhatsApp (Fase 2)

- **Comments por post** (`server/comments-link.ts`): o post guarda `commentsAutomationId` e `commentsAutoActivate`. O painel "Comentários automáticos" (passo Programação) cria/edita uma `SocialAutomation` (COMMENT_CREATED + SPECIFIC_CONTENT) com palavras, DM (+1 botão) e respostas públicas. Antes de publicar fica desligada e sem alvo; ao publicar, o media id vira alvo e ela liga. Exige o App Comments liberado (`comments.canEdit`) e o canal do Comments na mesma conta do Instagram do post. Procedures `nasaPlanner.comments.get/save`.
- **Disparo de WhatsApp** (`server/whatsapp-broadcast.ts`): Criar → Disparo WhatsApp (clientes com número META_CLOUD). Cria a campanha na org do cliente, adiciona os leads do tracking (filtros de temperatura e etapa), grava o modelo e agenda com as mesmas validações das Campanhas. Procedures `nasaPlanner.broadcasts.templates/createScheduled` e `calendar.broadcasts`; os disparos aparecem no calendário (somem quando há filtro de tipo/status).

## 7. Modelos

`NasaPlanner` (+ `requiresApproval`), `NasaPlannerPost` (+ aprovação, roteiro, origem, `scheduleVersion`, tentativas, `commentsAutomationId`, `commentsAutoActivate`), `NasaPlannerPostReview`, `NasaPlannerContentPillar`, `NasaPlannerPublishSlot`, `NasaPlannerPublishAttempt`, `NasaPlannerCadenceGoal`, `MetaPublishAccount`. Migrations `20261004200000_planner_v2_status_values`, `20261004200100_planner_v2_base` e `20261004230000_planner_comments_link`. Spec 0074: `NasaPlannerPost.publishGroupId` e `isGroupContentDetached` (migration `20261007180000_planner_publish_groups`, só aditiva).

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

- 2026-10-07 — **Mesmo conteúdo em várias contas do Instagram** (spec 0074, seção 5.1): seleção múltipla de contas no criador, um post por conta ligado por `publishGroupId`, conteúdo sincronizado entre as contas com a opção "diferente nesta conta", aprovação por grupo (checklist por conta), programação de todas as contas com intervalo opcional, falha e nova tentativa por conta, Stars por conta publicada e cartão único no calendário. MCP (`create_draft` com `instagramAccounts`) e Astro (`instagramHandles`) criam o grupo. Correções de base: o criador grava a conta que mostra, e programar recusa post do Instagram sem conta válida. Conferência: `scripts/planner-publish-group-qa-check.ts` (35 asserções, rodada no banco local em 2026-10-07). Publicação real em duas contas depende de teste manual (CA-9 a CA-11).
- 2026-10-07 — **Limpeza do Planner antigo** (sem mudança de tela): os quatro arquivos gigantes foram divididos (`mind-map-editor` 1586 → 942 linhas, `planner-popup` 1314 → 173, `posts-tab` 968 → 178, `campaign-planner-wizard` 771 → 298; peças na tabela da seção 2); as 36 chamadas diretas de `orpc` em componentes foram para hooks; os `any` da feature saíram (o editor de mapa mental deixou de usar globais em `window`); `tabs/settings-tab.tsx` (sem uso) foi apagado; os apelidos `posts.publish` e `posts.scheduleReal` saíram do router (ficam `publishNow` e `schedule`). A tipagem expôs três defeitos: o painel do planner antigo contava cards por status que não existem (`TODO`/`DONE` → `PENDING`/`COMPLETED`) e o ponto de "campanha concluída" comparava `"completed"` em minúsculas — ambos **corrigidos**; o "Compartilhar calendário" do planner antigo nunca mostra link, porque `calendar.share` devolve só o token e não há página pública que o receba — **segue em aberto**.
- 2026-10-05 — **Planejamento semanal em mapa mental** (spec 0068): aba Mapas Mentais com **Planejar a semana** (mapa `weekly` montado do roteiro: dia → posts, com o tema do dia); novos nós **card de conteúdo** (`postNode`, lê o post na hora) e **link** (`linkNode`); visões **Mapa | Lista** (Lista padrão no celular, menu de baixo próprio); **Criar conteúdos** (cards novos viram pautas, com opção de o Astro escrever roteiro e legenda), **Atualizar com o roteiro** e **Organizar**. Peças em `components/mind-map/*` e `lib/mind-map/*`; `mindMaps.create` aceita `weekly` e nós iniciais. **Celular nas telas do Planner**: barra do calendário em 3 linhas com filtros que rolam, tema do dia na agenda, Kanban com colunas que encaixam, Roteiro em cartões, janelas como gaveta de baixo.
- 2026-10-05 — **Revisão com prévia e capa do Reel**: o passo "Revisão" do criador (`v2/review-panel.tsx`) ganhou a coluna "Como vai ficar no Instagram" (mesmo `PostPreview` do post publicado, com `isReviewing`: Reel em pé, com capa, som e controles) e o bloco da legenda. `v2/reel-cover-picker.tsx` define a capa do Reel a partir de um quadro do vídeo (canvas → imagem → `thumbnail`, que a publicação já envia como `cover_url`) ou de uma imagem enviada; aparece na criação e na revisão. Em desenvolvimento, `/api/upload-local` aceita vídeo (até 200 MB) para testar Reel sem R2.
- 2026-10-04 — **Roteiro da semana** (spec 0067): `NasaPlannerPost.objective` (Objetivo / Gatilho; o `cta` já existia) e `NasaPlannerWeekdayTheme` (tema fixo por dia da semana e cliente — etiqueta acima do dia na Semana, `planning.listWeekdayThemes/setWeekdayTheme`); **+ Criar → Conteúdo (roteiro da semana)** cola o texto e o Astro separa por dia sem reescrever (`planning.parseWeeklyScript` → `server/weekly-script.ts`), criando pautas (`IDEA`, rótulo "Pauta"); filtro **Conteúdo** (pautas do período com Criar/Abrir) e visão **Roteiro** (semana em tabela, segunda a domingo). MCP e Astro leem `weekdayThemes`; `create_draft` aceita `objective`/`cta`. Guia `planner.weekly-script`.
- 2026-10-05 — **Instagram do Planner vem só das contas dos Satélites** (spec 0071). `listPublishAccounts` devolve as contas de `SocialChannel` (qualquer forma de conexão) para Instagram e `MetaPublishAccount` só para páginas do Facebook. A publicação, as métricas e os comentários do post usam o port `ContentPublisher` do módulo `social` (`server/publishing/instagram-channels.ts`); o token nunca entra no plano do Inngest. Post sem conta escolhida só publica se a empresa tem uma única conta. `http/meta/planner-graph.ts` ficou só com Facebook. Calendário ganhou o filtro **Conta** (`?contas=`) e o @ da conta no cartão do post quando o cliente tem mais de uma. Conferência: `scripts/planner-publish-accounts-qa-check.ts`. Publicação real pelo token do app do Instagram ainda depende de teste manual (CA-1, CA-2, CA-7).
- 2026-10-05 — **Vários Kits da Marca por empresa, vinculados à conta do Instagram** (spec 0070). O kit **padrão** não mudou de lugar (`Organization.brand*` + planner padrão + `BrandKitAsset` sem kit) e segue sendo a marca de Configurações → Marca; kits **adicionais** moram na tabela nova `brand_kits`, com os materiais em `brand_kit_assets.brand_kit_id`. Cada conta do Instagram aponta para um kit (`social_channels.brand_kit_id`, nulo = padrão) e o post herda o kit da conta em que vai sair, resolvido na hora por `getBrandKitForPost` — vale para o "Gerar com o Astro", o checklist de aprovação (palavras proibidas) e o criador de conteúdo, que mostra "Kit: …". `getBrandKit(organizationId, brandKitId?)` devolve o mesmo formato nos dois casos. Aba Kit da Marca ganhou a lista de kits (criar vazio ou copiando textos/cores/fontes do padrão, renomear, apagar) e a troca de kit por conta (owner e admin). Astro do chat e MCP (`get_brand_kit`, `list_clients`) aceitam o @ da conta e listam os kits. Teto de 20 kits adicionais. Migration `20261005120000_brand_kits`, só aditiva. Conferência: `scripts/brand-kits-qa-check.ts` (21 asserções). O **Kit da Marca virou aba** do Planner (`?tab=kit`, com `org` e `kit` na URL); `/nasa-planner/kit` redireciona.
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
