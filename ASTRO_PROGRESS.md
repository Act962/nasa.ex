# ASTRO — Progresso da Implementação

> **Memória persistente entre sessões do Claude.** Sempre leia este arquivo no início de uma nova sessão e atualize-o ao final de cada bloco de trabalho. Plano de referência completo em `C:/Users/Dev/.claude/plans/crie-o-planejamento-para-piped-knuth.md`.

## Branch

`feature/astro-agentes-nasa` (criada a partir de `origin/main`).

## Resumo da Feature

ASTRO é um copiloto IA escalável dentro do app: um orquestrador que delega para sub-agentes especialistas (Closer, Task Agent, …) via tools do AI SDK. RAG via pgvector. Multi-tenant por Organization. Três superfícies: widget flutuante global, página `/home` em fullscreen (refatoração do `nasa-command-center`) e embeds contextuais (tracking-chat, lead, action, agenda, insights, planner, forms, editor).

## Decisões fechadas

- **Orquestração**: AI SDK (streamText + tools) + LangChain só para RAG (loaders/retriever).
- **Vector store**: pgvector na própria imagem do Postgres (`pgvector/pgvector:17`).
- **Schema enxuto**: 4 models — `AiAgentConfig`, `AiSession` (messages como Json), `AiKnowledge`, `AiKnowledgeChunk`.
- **Permissões**: Admin/Owner configura; todos usam; tools respeitam `userId`.
- **Transport**: Route handler `/api/astro/chat` com `streamText().toUIMessageStreamResponse()` + `useChat` do `@ai-sdk/react`. oRPC para o resto.
- **Provider LLM default**: Anthropic (Sonnet); fallback OpenAI/Google por env.

## MVP

- Orquestrador ASTRO + persistência em `AiSession`.
- Sub-agente **Closer** (sugerir resposta + tags no tracking-chat).
- Sub-agente **Task Agent** (criar Action / SubAction / Reminder / Appointment).
- Embeds: tracking-chat (footer + body) + refatoração do `/home` para fullscreen.

## Status por etapa

| # | Etapa | Status | Notas |
|---|---|---|---|
| 1 | Branch criada | ✅ | `feature/astro-agentes-nasa` |
| 2 | `ASTRO_PROGRESS.md` | ✅ | Este arquivo |
| 3 | Docker Compose → pgvector:17 | ⬜ | |
| 4 | Models Prisma | ⬜ | `AiAgentConfig`, `AiSession`, `AiKnowledge`, `AiKnowledgeChunk` |
| 5 | Migration SQL pgvector | ⬜ | `CREATE EXTENSION vector` + coluna `embedding vector(1536)` + ivfflat |
| 6 | Dependências (`pnpm add`) | ⬜ | langchain + ai-elements + loaders |
| 7 | Backbone server (`src/features/astro/server`) | ✅ | orchestrator, registry, agents (Closer, Task), tools (leads, actions, knowledge), rag (embeddings, retriever) |
| 8 | Route handler `/api/astro/chat` | ✅ | `streamText().toUIMessageStreamResponse()` com persistência em `AiSession` no `onFinish` |
| 9 | UI: AstroProvider + useAstroChat + refatorar `astro-agent.tsx` | ✅ | provider, `use-astro-context`, `use-astro-chat`, `AstroMessage`, `AstroComposer`. `astro-agent-legacy.tsx` mantido para referência visual. |
| 10 | `/home` (NASA Command Center) → modo fullscreen do ASTRO | ✅ | nasa-command-center reconectado ao orquestrador; recent-requests lê de `AiSession`; thinking-display alimentado por tool-parts reais. |
| 11 | oRPC routes (sessions / agent-config / knowledge-base) | 🟡 | sessions (CRUD) + agent-configs ok; knowledge-base falta. |
| 12 | Embed Closer no tracking-chat | 🟡 | popover `TrackingChatCopilot` no footer com botão "Aplicar" no draft. **Falta**: banner automático no body + Pusher→Inngest (Sessão 3). |
| 13 | Inngest functions (`ingest-knowledge`, `agent-trigger`) | 🟡 | stubs registrados em `/api/inngest/route.ts`; lógica real fica para Sessão 3. |
| 14 | Settings → Agentes (UI mínima) | ✅ | aba "Agentes IA" + `AgentsSection` com switch enabled + select de mode. |
| 15 | Demais embeds (lead, action, agenda, insights, planner, forms, editor) | ⬜ | pós-MVP. |

## Arquivos novos criados

### Schema / Migration
- `prisma/migrations/20260507120000_astro_agents/migration.sql`

### Server (`src/features/astro/server/`)
- `agents/types.ts`, `agents/registry.ts`, `agents/closer.ts`, `agents/task-agent.ts`
- `orchestrator.ts`
- `tools/_shared/permissions.ts`
- `tools/leads/index.ts`, `tools/actions/index.ts`, `tools/knowledge/index.ts`
- `rag/embeddings.ts`, `rag/retriever.ts`
- `routes/list-sessions.ts`, `routes/get-session.ts`, `routes/delete-session.ts`
- `routes/list-agent-configs.ts`, `routes/update-agent-config.ts`
- `routes/index.ts`

### Schemas / Lib (`src/features/astro/`)
- `schemas/chat-message.ts`, `schemas/agent-config.ts`
- `lib/prompts/index.ts`

### Route handler
- `src/app/api/astro/chat/route.ts`

### Docs
- `ASTRO_PROGRESS.md`

## Arquivos modificados

- `prisma/schema.prisma` — 4 models + 2 enums + relations em Organization e User.
- `prisma/PENDING_MIGRATIONS.md` — instruções para aplicar a migration ASTRO.
- `docker-compose.yml` — imagem Postgres → `pgvector/pgvector:pg17`.
- `package.json` (via pnpm add) — `langchain`, `@langchain/community`, `@langchain/openai`, `@langchain/textsplitters`, `pdf-parse`, `mammoth`.
- `src/app/router/index.ts` — registrou `astro: astroRoutes`.

## Convenções desta feature

- Pasta raiz: `src/features/astro/`.
- **Não** colocar lógica de domínio em `src/lib/`.
- Schemas Zod em `src/features/astro/schemas/`.
- System prompts versionados em `src/features/astro/lib/prompts/`.
- Tools do servidor em `src/features/astro/server/tools/<dominio>/<acao>.ts`.
- Cada tool exporta `{ definition, handler }` para reuso entre orquestrador e Inngest.
- Permissões: extrair helpers de validação compartilhados em `src/features/astro/server/tools/_shared/`.
- Imports cross-feature são permitidos (ex: tools chamando código de `actions`, `leads`, `agenda`).

## Como retomar (próxima sessão)

1. Ler este arquivo.
2. Ler o plano: `C:/Users/Dev/.claude/plans/crie-o-planejamento-para-piped-knuth.md`.
3. `git status` + `git log --oneline -20` na branch para conferir o que já foi commitado.
4. Continuar a partir da primeira linha `⬜` da tabela acima.

### Próximos passos imediatos (Sessão 3)

A UI ligou no orquestrador. Próxima entrega foca em RAG real, trigger
automático e embeds restantes.

1. **RAG ingest real** — implementar `astro/ingest-knowledge` (Inngest stub):
   download via R2, loaders LangChain (`PDFLoader`, `DocxLoader`,
   `XlsxLoader`, `TextLoader`), `RecursiveCharacterTextSplitter` (chunkSize
   ~800, overlap ~100), `embedBatch` em lotes de 100, INSERT via `$queryRaw`
   com `embedding = $vector::vector`.
2. **Knowledge base oRPC + UI** — `astro.knowledge.{list,uploadInit,delete,
   reingest}`. UI em `Settings → Agentes IA` para anexar/listar fontes por
   agente (`AiAgentConfig.knowledgeIds`).
3. **Trigger automático Closer** — handler de mensagem nova no
   tracking-chat emite `astro/conversation.message-received`; `astroAgentTrigger`
   cria `AiSession` com `context = { scope: "trigger", conversationId }` e
   notifica via Pusher; Body do tracking-chat assina e renderiza um banner.
4. **Compose/Summarize → tools do ASTRO** — depreciar `compose-response.tsx`
   e `summerize-conversation.tsx` (manter funcionais até confirmar paridade).
5. **Embeds restantes** — lead detail, action view, agenda editor, insights
   dashboard, planner, forms, editor TipTap (vide tabela 3.7 do plano).
6. **Deletar `astro-agent-legacy.tsx`** após confirmação visual da UX nova.
7. **Deprecar `nasa-command/ai-intent.ts` + `execute-helpers/`** — auditar
   usos externos, marcar `@deprecated`, depois remover.

### Como rodar Sessão 2 localmente

```bash
# 1. Container com pgvector
docker compose down
docker compose up -d

# 2. Aplicar a micro-migration de pgvector (se ainda não foi)
pnpm prisma db execute \
  --file prisma/migrations/20260507192355_astro_pgvector/migration.sql \
  --schema prisma/schema.prisma
pnpm prisma migrate resolve --applied "20260507192355_astro_pgvector"
pnpm db:generate

# 3. Variáveis no .env.local
# OPENAI_API_KEY=...                    (embeddings — só obrigatório quando rodar RAG)
# ASTRO_DEFAULT_MODEL=claude-sonnet-4-5 (opcional)
# ASTRO_EMBEDDING_MODEL=text-embedding-3-small (opcional)

# 4. Dev
pnpm dev
# /home → ASTRO em fullscreen
# qualquer página fora do tracking-chat → widget flutuante (ícone Sparkles canto inferior direito)
# tracking-chat → botão Sparkles no footer abre Closer
# /settings/astro → aba "Agentes IA"
```

### Próximos passos imediatos (Sessão 2)

A fundação backend está pronta e commitada. **A próxima sessão deve focar em UI**, na ordem:

1. **Aplicar a migration localmente** (`docker compose down && up -d`, depois seguir Opção B em `prisma/PENDING_MIGRATIONS.md`).
2. **Refatorar `src/features/astro/components/astro-agent.tsx`** (78KB) — substituir motor simulado por `useChat({ api: '/api/astro/chat' })`. Sugestão: criar `astro-chat.tsx` novo e fazer o `astro-agent.tsx` virar shell que monta `<AstroChat mode="full"/>`. Documentação útil:
   - `useChat` do AI SDK 6 com transport custom para enviar `sessionId`/`context`/`pinnedAgentKey` no body.
   - Estado: `useAstroContext` lendo `usePathname()` para mapear rota → `{ orgId, leadId, ... }`.
3. **Criar `AstroProvider`** em `src/features/astro/components/astro-provider.tsx` (Context com `sessionId`, `mode`, `pinnedAgentKey`, route-context). Envolver em `platform-providers.tsx`.
4. **Refatorar `nasa-command-center`** (`src/features/nasa-command/`):
   - `nasa-command-center.tsx` → shell com `<AstroChat mode="fullscreen"/>` decorado pela casca visual existente (welcome-screen, star-field, rotating-example, example-library, model-selector).
   - `command-input.tsx` → input do `useChat`.
   - `thinking-display.tsx` → renderiza tool-calls reais das message parts.
   - `recent-requests.tsx` → consumir `orpc.astro.sessions.list` + ao clicar, hidratar via `orpc.astro.sessions.get`.
   - **Deprecar** `src/app/router/nasa-command/ai-intent.ts` + helpers (capacidades já estão como tools).
5. **Embed Closer no tracking-chat**:
   - `src/features/tracking-chat/components/footer-chat.tsx` → botão "ASTRO" + toggle "Copiloto automático".
   - `src/features/tracking-chat/components/body.tsx` → banner de sugestão.
   - Embeds passam `pinnedAgentKey: "closer"` + `context: { conversationId, leadId, trackingId }`.
6. **Inngest functions**: `src/inngest/astro/ingest-knowledge.ts` (RAG ingest) e `astro/agent-trigger.ts` (modo TRIGGER do Closer). Registrar em `src/inngest/functions.ts`.
7. **knowledge-base** (oRPC): `upload-init`, `list`, `delete`, `reingest` — UI Settings → Agentes.

### Pontos de cuidado para Sessão 2

- A imagem do Postgres mudou; sem rodar `docker compose up` o `pgvector` não existe e a migration falha em `CREATE EXTENSION vector`.
- `OPENAI_API_KEY` precisa estar em `.env.local` para embeddings — caso contrário `embed()` lança. Adicionar `ASTRO_DEFAULT_MODEL` (opcional).
- Os agentes têm `enabled` default `true` mesmo sem row em `AiAgentConfig` — `loadAgentEnabledMap` já faz fallback.
- AI SDK v6 (`ai@^6.0.103`): `convertToModelMessages`, `stopWhen`, `toUIMessageStreamResponse({ onFinish })` são as APIs corretas. `generateText` retorna `text` direto.
- `useChat` do `@ai-sdk/react` v3: importar do `@ai-sdk/react`, configurar transport `DefaultChatTransport({ api: '/api/astro/chat', body: () => ({ sessionId, context, pinnedAgentKey }) })`.

## Pontos de atenção

- ⚠️ **Nunca** commitar em `main` (hook bloqueia). Sempre nesta branch.
- ⚠️ Não duplicar lógica que já existe em `src/app/router/ia/*`, `src/app/router/nasa-command/*`, `src/features/astro/lib/`. Auditar antes de criar tool nova.
- ⚠️ `AiSession.messages` é `UIMessage[]` do AI SDK, não modelo customizado.
- ⚠️ Embeddings via OpenAI `text-embedding-3-small` (1536 dim). `OPENAI_API_KEY` deve estar em `.env.local`.
- ⚠️ `pgvector` não tem suporte direto no Prisma — coluna `embedding` é adicionada via SQL manual e queries de retrieval usam `$queryRaw` com `Prisma.sql`.

## Dúvidas/decisões pendentes

(use esta seção para anotar qualquer ponto que surgir e precisar de input do usuário)

- (nenhuma no momento)
