# Auditoria — Cobranças de Stars

## Status atual (após esta PR)

### ✅ Já cobram Stars

| App / Feature | Procedure | Action key |
|---|---|---|
| NASA Planner — gerar post | `nasa-planner/generate-post.ts` | `ai_response_generate` |
| NASA Planner — imagem IA | `nasa-planner/generate-image-from-prompt.ts` | (custo hardcoded) |
| NASA Planner — vídeo IA | `nasa-planner/generate-video-clip.ts` | (custo hardcoded) |
| NASA Planner — publicar | `nasa-planner/publish-post.ts` | (custo hardcoded) |
| NASA Planner — agendar | `nasa-planner/schedule-post-real.ts` | (custo hardcoded) |
| NASA Command — execute | `nasa-command/execute.ts` | `ai_command_execute` |
| NASA Route — start upload | `nasa-route/.../creator-start-video-upload.ts` | (COURSE_PURCHASE) |
| Forge — criar/enviar proposta | Vários | `forge_proposal_create`, `forge_proposal_send` |
| Pages — criar página | `pages/create-page.ts` | (custo hardcoded) |
| Meta Ads — Astro tools | `ia/ai-workspace/tools/meta-ads/_shared.ts` | (custo hardcoded) |
| **Astro IA — prompt** ⭐ | `api/astro/chat/route.ts` | **`astro_prompt`** (NOVO) |
| **Insights — relatório IA** ⭐ | `insights/generate-report.ts` | **`insights_report_ai`** (NOVO) |
| **Workflow execute** ⭐ | `inngest/.../workspace-workflow-executor.ts` | **`workflow_execute`** (NOVO) |
| **NASA Route — finalizar upload** ⭐ | `nasa-route/.../creator-complete-video-upload.ts` | **`nasa_route_video_upload_complete`** (NOVO) |
| **Calendário público — ativar** ⭐ | `org/enable-calendar-share.ts` | **`calendar_share_enable`** (NOVO) |

⭐ = adicionados nesta PR.

### ⏳ NÃO cobram ainda (TODO fase 2)

Quando for plugar, basta importar `chargeStarsByAction` e chamar antes
da operação cara. O admin pode definir o custo em `/admin/stars > Regras`
sem precisar mexer no código.

| Feature | Path provável | Action key sugerida | Custo sugerido |
|---|---|---|---|
| Linnker — criar página | `pages/create-page.ts` (já cobra, mas verificar) | `linnker_page_create` | 2★ |
| Forms — publicar formulário | `forms/*` | `form_publish` | 2★ |
| Forms — receber resposta com lead | `forms/public/*` | `form_response_with_lead` | 1★ |
| AI image generation (genérico) | múltiplos | `ai_image_generate` | 3★ |
| Workspace — bulk import | `workspace/import-csv-*` | `workspace_bulk_import` | 5★/100 rows |
| N-Box — file upload (R2) | `nbox/upload-*` | `nbox_file_upload` | proporcional |
| NASA Route — finish video por tamanho | `creator-complete-video-upload.ts` | `nasa_route_video_size_*` | dinâmico |
| Public report sharing | `insights/saved-reports/save-report.ts` | `report_public_share` | 0★ (já permitido) |
| Tracking — import leads CSV | `tracking/*` | `lead_import_batch` | 1★/lead |
| Stars — gateway checkout | `stars/create-gateway-checkout.ts` | n/a (não cobra) | — |

## Como o sistema funciona

1. **Catálogo global** em `AppStarCost` (categoria `"action"`). Cada linha = uma regra
   com `appSlug` (chave da ação), `monthlyCost` (custo em ★), `displayName` (label).
2. **Admin edita** em `/admin/stars > Regras`. CRUD completo via UI.
3. **Procedure cobra** chamando `chargeStarsByAction(orgId, action, { userId })`.
   - Se a regra não existe ou tem custo zero → `{ skipped: true }`, não cobra.
   - Se saldo insuficiente → `{ success: false }`, retorna erro pro client.
4. **`debitStars` é o motor** — cria `StarTransaction`, atualiza `org.starsBalance`,
   e (se `userId` passado) incrementa `MemberStarBudget.currentUsage`.

## Seed inicial

Pra popular o catálogo com as 5 novas regras desta PR + o set histórico
(`DEFAULT_STAR_RULES`):

```bash
pnpm exec ts-node prisma/seed-star-rules.ts
```

Idempotente — só cria linhas que não existem.

## Próximas fases

- **Fase 2**: implementar as 10+ cobranças listadas em "NÃO cobram ainda"
- **Fase 3**: per-user budget enforcement (bloquear quando user excede sua cota)
- **Fase 4**: histórico fino por user (adicionar `userId` em `StarTransaction` via migração)
