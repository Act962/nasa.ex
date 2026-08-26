# Evolução Arquitetural — Auditoria, Arquitetura Alvo e Roadmap

> **Regra de manutenção (CLAUDE.md item 19):** este documento é a **fonte de verdade** da evolução
> arquitetural e o canal de acompanhamento entre sessões. Sempre que criar algo em `src/modules/`,
> alterar as regras de fronteira (`.dependency-cruiser.js`), mexer no CI (`.github/workflows/`), na
> configuração de testes, ou concluir/reordenar uma fase do roadmap, **atualize este arquivo na
> mesma sessão** — tabela de status, roadmap, decisões e changelog sincronizados com o código.
> Espelha as regras 10 (NASA Route) e 14 (WhatsApp Oficial).

**Documentos satélite:**

- [`seguranca-auditoria-2026-08.md`](seguranca-auditoria-2026-08.md) — registro de vulnerabilidades com checklist de correção (o que a Fase 0 executa)
- [`testes-estrategia.md`](testes-estrategia.md) — pirâmide de testes, cobertura, CI e quality gates

---

## Status

| | |
| --- | --- |
| Fase em andamento | **Fase 0 — Contenção e baseline** ⬜ não iniciada. Fechar as vulnerabilidades anônimas (S1–S4 são horas de trabalho cada), auditar escopo de organização em ~190 procedures, subir CI mínimo |
| Fase anterior | **Auditoria completa** ✅ (2026-08-18) — diagnóstico sobre `f67796d2`, sem alteração de código |
| Bloqueio ativo | 🔴 **5 falhas exploráveis anonimamente em produção.** Ver [`seguranca-auditoria-2026-08.md`](seguranca-auditoria-2026-08.md). Precedem qualquer trabalho de arquitetura |
| Escopo travado | Piloto profundo (`form`) + regras automatizadas de fronteira. **Não** é migração ampla dos 65 domínios |
| Arquitetura alvo | **Hexagonal seletivo** — Ports & Adapters aplicado só ao núcleo dos módulos críticos; não Clean Architecture ampla |
| Em aberto | Split Fastify (`api.nasaex.com`) — recomendação é **adiar e inverter a ordem planejada**; ver §5.5 |

---

## 1. Contexto

O projeto cresceu de CRM de leads para super-app em 1.843 commits (535 nos últimos 3 meses, ~6,4/dia,
~4 devs reais). A velocidade foi alta e a estrutura não acompanhou.

Baseline medida em 2026-08-18 (`f67796d2`):

| Métrica | Valor |
| --- | ---: |
| Linhas úteis em `src/` (sem `generated/`) | **536.511** |
| Arquivos `.ts`/`.tsx` | 3.651 |
| Features em `src/features/` | **65** |
| Procedures oRPC (`src/app/router/`) | **925** arquivos / ~1.027 handlers |
| Route handlers (`src/app/api/`) | 73 |
| Models Prisma / enums / índices | **240** / 92 / 392 |
| Migrations | 181 (2025-11-06 → 2026-08-17) |
| Chamadas `prisma.<model>.` | **8.877** em 1.242 arquivos |
| Abstrações de repositório | **0** |
| Ciclos de dependência entre features | **27** |
| `console.*` | **724** (434 error / 160 warn / 126 log) |
| Testes automatizados | **0** |
| Pipelines de CI | **0** |

O objetivo **não é aplicar Clean Architecture por estética**. É aumentar confiabilidade,
testabilidade e capacidade de evolução sem interromper o funcionamento atual.

---

## 2. Decisões travadas

| # | Decisão | Racional |
| --- | --- | --- |
| D1 | **Segurança primeiro.** Fase 0 é contenção, não setup de ferramenta | Vulnerabilidade anônima explorável por `curl` precede dívida estrutural. Segurança tem fim definido (~3 semanas); arquitetura é contínua |
| D2 | **Piloto profundo + regras automatizadas** — um módulo migrado ponta a ponta + linter de fronteira com baseline decrescente | Com 4 devs e 6,4 commits/dia, migração ampla morre no meio e deixa duas arquiteturas coexistindo |
| D3 | **Hexagonal seletivo**, não Clean Architecture ampla | §5.1. A maior parte do sistema é CRUD legítimo; use case sobre CRUD é cerimônia |
| D4 | **Piloto = `form`** | 4 specs escritas (86 KB de CA prontos pra virar teste), incidente com causa raiz documentada, entrada pública, superfície delimitada. §9.2 |
| D5 | **`tracking-chat` é o último candidato**, não o primeiro | In-degree 48, participa de 7 ciclos. Piloto ali exigiria desatar o grafo antes da primeira linha de domínio |
| D6 | Fluxos críticos: **Actions/Workspace, Leads/Kanban, Formulários públicos, WhatsApp** | Definidos pelo dono do produto |
| D7 | **Regra automatizada > disciplina manual** | O que não é verificável pelo CI não sobrevive a três sprints. Há 291 `eslint-disable` no repo provando isso |
| D8 | **Nada de mock de Prisma** — integração contra Postgres real | Mock de ORM testa o mock. Container é barato e pega constraints, cascatas, transações, `Decimal`, pgvector |

---

## 3. Diagnóstico

### 3.1 As quatro camadas conceituais, hoje

**Domínio** — existe, mas disperso e sem fronteira. Nenhum arquivo é domínio puro. As regras vivem
inline nos handlers: cálculo de `order` com `Decimal` (`status/create.ts:28-41`), política de edição
de resposta (`features/form/lib/can-edit-response.ts`, 204 linhas — um dos raros casos isolados),
placement de lead (`features/form/server/lib/resolve-and-place-lead-for-form.ts`), permissões
efetivas (`features/payment/lib/permissions.ts`). Ilhas corretas num mar de lógica embutida em I/O.

**Aplicação** — não existe como camada. O caso de uso *é* a procedure: 925 arquivos onde parse,
autorização, regra e persistência dividem o mesmo escopo léxico.

**Infraestrutura** — onipresente, sem indireção. 8.877 chamadas `prisma.<model>.`. Busca por
`interface *Repository`, `Port`, `dataAccess` retorna **vazio**.

**Interface** — **quatro caminhos paralelos ao dado, sem regra de qual usar:**

| # | Caminho | Ocorrências |
| --- | --- | ---: |
| 1 | `page.tsx` (RSC) → Prisma direto | **46 pages** (todo o `(admin)`, 23 públicas) |
| 2 | Route handler `api/` → Prisma direto | 49 arquivos |
| 3 | Componente client → `orpc.*` direto (viola Regra 9) | **518 call sites** / 300 arquivos |
| 4 | Componente client → hook → `orpc.*` (o único documentado) | 785 call sites |

### 3.2 O número que resume tudo

**94.506 linhas de router governadas por 306 linhas de middleware** — e **nenhum `middleware.ts`**
na raiz. Não existe camada entre a procedure e o banco, nem ponto central para aplicar política.

### 3.3 Qualidade interna

| Sinal | Valor | Leitura |
| --- | ---: | --- |
| `.output()` nas procedures | **171 / 1.008 (17%)** | 83% sem contrato de saída validado |
| `z.object` inline no router | 783 arquivos | vs. 1 arquivo de schema compartilhado |
| `throw errors.X` **sem parênteses** | **228** | Bug real — §3.4 |
| `: any` / `as any` | 1.215 | Contra a Regra 13 |
| `eslint-disable` | 291 | As poucas regras existentes são contornadas |
| TODO / FIXME | 145 | |
| `"use client"` | 1.250 (83% dos `.tsx` de feature) | App Router operando como SPA |

**Config mínima:** `tsconfig` tem `strict: true` ✅ mas sem `noUncheckedIndexedAccess`,
`noUnusedLocals`, `exactOptionalPropertyTypes`. `eslint.config.mjs` tem **zero regras custom** — nada
impede `features/a` importar internals de `features/b`. `prettier` instalado **sem config nem
script**. `@tanstack/eslint-plugin-query` instalado e não registrado. ESLint linta os 248 arquivos
gerados do Prisma.

### 3.4 Bug de alta severidade — 228 `throw errors.X;` sem invocação

No oRPC, `errors.NOT_FOUND` é uma **função** (Proxy que devolve o construtor). `throw errors.NOT_FOUND;`
lança o objeto-função, que não é `instanceof ORPCError` e cai no ramo genérico do interceptor.

| Código | Ocorrências | Efeito |
| --- | ---: | --- |
| `INTERNAL_SERVER_ERROR` | 138 | Coincide — 500 de qualquer jeito |
| `NOT_FOUND` | 52 | ❌ vira 500 |
| `FORBIDDEN` | 23 | ❌ vira 500 |
| `BAD_REQUEST` | 9 | ❌ vira 500 |
| `UNAUTHORIZED` | 6 | ❌ vira 500 |

**90 casos** devolvem 500 "Something went wrong" onde deveriam devolver 404/403/400/401 — o client
não distingue "não existe" de "falhou". Concentração: `leads` 32, `insights` 19, `admin` 17.
Correção é codemod mecânico e verificável.

### 3.5 Deriva entre documentação e código

Não é pedantismo: a Regra 17 exige testes impossíveis e o runbook de produção está quebrado. O efeito
é treinar o time a tratar a documentação como aspiracional. **Corrigir a deriva é pré-requisito para
as novas regras serem levadas a sério.**

| Documento diz | Realidade (verificada) |
| --- | --- |
| CLAUDE.md: "Procedures oRPC ficam em `src/server/`" | `src/server/` **não existe**. Estão em `src/app/router/` |
| CLAUDE.md Regra 9: oRPC só em hooks | **518 violações** (60,3% de conformidade) |
| CLAUDE.md Regra 5: só Zustand | Zustand (26) **+ Jotai** (16) + 6 Contexts globais + nuqs |
| CLAUDE.md Regra 17: "cada CA vira um teste" | **Inexequível** — não há runner instalado |
| CLAUDE.md: hook `PreToolUse` bloqueia commit na main | `.claude/settings.json` não existe — e `.claude` está no `.gitignore` |
| `docs/DEPLOYMENT.md:10`: "Copie `.env.example`" | **`.env.example` não existe** |
| `docs/DEPLOYMENT.md:40`: `psql -f prisma/migrations/MANUAL_*.sql` | **Arquivos não existem.** `scripts/apply-prod-migrations.sh` tem `set -euo pipefail` → **quebra** |
| `prisma/PENDING_MIGRATIONS.md` com alarme 🚨 ativo | Já resolvido; arquivo obsoleto induz dev novo a erro |
| CLAUDE.md: `schema(s)/` por feature | Adotado por **3 de 65** |

### 3.6 Pontos fortes — os templates que a Fase 0 vai copiar

O projeto **sabe** fazer certo. O problema é que o certo não é obrigatório em lugar nenhum.

| Arquivo | Por que é referência |
| --- | --- |
| `api/stars/webhook/route.ts:131-150` | Exige o secret **sem fallback**, com comentário explicando por que fallback seria brecha |
| `http/whats-oficial/verify-signature.ts` | HMAC sobre raw body, `timingSafeEqual`, fail-closed |
| `api/s3/upload-script-video/route.ts` | O **único** upload correto: auth + MIME + tamanho |
| `api/pusher/auth/route.ts` | Allowlist explícita de canais, com documentação de segurança inline |
| `api/health/route.ts` | `SELECT 1` com timeout de 2s, 200/503 |
| `src/http/nerp/` | Timeout configurável, erro tipado, HMAC, schemas Zod por domínio |
| `campanhas/schema/broadcast-schemas.ts` | 16 schemas compartilhados entre client e router |
| `form/public/submut-response.ts` | Padrão correto de efeitos pós-commit (`pendingLeadEvents`) |
| `specs/` | O contrato de qualidade já escrito, com o incidente que o motivou documentado |

---

## 4. Mapa de acoplamento

### 4.1 O cluster indivisível

Metade dos imports entre features cruza fronteira de domínio (538 de 1.097). Os ciclos formam um
componente fortemente conectado:

```
   ┌──────────────────────────────────────────────────────┐
   │  tracking-chat ⇄ trackings ⇄ leads ⇄ form            │
   │        ⇅              ⇅         ⇅                     │
   │  tracking-executions ⇄ triggers ⇄ workflows ⇄ editor │
   │        ⇅                                              │
   │  tracking-settings                                    │
   └──────────────────────────────────────────────────────┘
          9 features · ~103.000 linhas · 27 ciclos
```

**Não são 9 domínios. É 1 monólito com 9 pastas.** Nenhuma pode ser extraída, testada ou refatorada
isoladamente. `tracking-chat` participa de 7 ciclos, in-degree 48 — é o epicentro (daí a decisão D5).

Hubs bidirecionais (pior caso para refatorar): `actions` (34/46), `tracking-executions` (37/45),
`workspace` (32/43), `tracking-chat` (48/36).

**Anomalia direcional:** `admin` tem in-degree **46**, 2º geral. Um painel administrativo deveria ser
folha do grafo. Virou repositório de utilitários — `logActivity` (`features/admin/lib/activity-logger.ts`)
é infra global morando numa feature de UI.

**No banco o padrão se repete:** `Organization` recebe **80 relations** e `User` **73**. São os dois
god-models — regressão neles propaga por todo o schema.

**Quick wins de ciclo:** `billing↔stars`, `apps↔nerp`, `apps↔comments`, `insights↔tags`.

**Candidatas a subir para infra compartilhada** (pequenas e muito consumidas, Regra 1 do CLAUDE.md):
`tags` (2.233 linhas, in-degree 28), `space-point` (2.793, in-degree 19), `activity-logger`.

### 4.2 Duplicação semântica confirmada

| Duplicado | Ocorrências | Risco |
| --- | ---: | --- |
| `formatCurrency` | **4** | Contratos **incompatíveis** (`cents` vs reais) → divisão por 100 silenciosa |
| `formatDate` | **13** | 5 são copy-paste literal entre pages irmãs de `comments/` |
| Normalização de telefone | 4 | Canônico existe em `src/utils/format-phone.ts` e é ignorado |
| Pipelines de upload | 3+ | Comentário no código **admite** a duplicação |
| Sistemas de toast | 3 | `sonner` + `ui/toast.tsx` + `contexts/toast-context.tsx` |
| `kanban-store.ts` | 2 | Nome idêntico em `actions/lib/` e `trackings/lib/` |
| Libs de data | 3 | `dayjs` (82) + `date-fns` (56) + `@internationalized/date` (8) |
| Libs de estado global | 2 | `zustand` (26) + `jotai` (16) — Regra 5 manda só Zustand |
| Deps mortas | 2 | `convex` e `@hello-pangea/dnd` — 0 usos |

---

## 5. Arquitetura alvo

### 5.1 A escolha: Hexagonal seletivo

| Abordagem | Custo | Benefício aqui | Veredito |
| --- | --- | --- | --- |
| Clean Architecture completa (4 camadas, DTO em cada fronteira) | ~4× arquivos em 65 features; meses | Alto **só onde há regra rica**. A maior parte é CRUD | ❌ |
| Hexagonal em tudo | Médio | Uma regra só, mas ainda 65 features | ⚠️ Bom, escopo errado |
| **Hexagonal seletivo no núcleo dos módulos críticos** | Baixo por módulo | Cria o *seam* de teste exatamente onde falta confiança | ✅ |

Razões concretas:

1. **Hexagonal tem uma regra só** — domínio não importa adapter; adapters implementam ports.
   Ensinável em 10 minutos, verificável por linter. Clean tem quatro camadas e uma regra de
   dependência que vira debate de PR sobre onde mora cada DTO.
2. **O problema real é ausência de *seam*, não de camada.** Não há como testar uma regra sem subir
   Postgres, porque não existe ponto de injeção. Um port resolve isso; uma quarta camada não.
3. **A maior parte do sistema é CRUD legítimo.** `tags`, `sidebar-prefs`, `user-chat-preferences` não
   têm regra de negócio. Envolvê-los em use cases produz indireção sem retorno.
4. **oRPC já é um adapter.** A procedure é literalmente o adapter primário. Reaproveitamos a peça.

**Critério objetivo de "seletivo"** — um módulo entra no núcleo hexagonal se satisfizer **≥2** de:

- tem invariante de negócio (não é só persistir input);
- toca dinheiro, auth ou dados de lead;
- tem ≥3 caminhos condicionais sobre dados de produção (o mesmo teste da Regra 17);
- está em ≥2 ciclos de dependência;
- aparece nos hotspots de alteração do git (§9.1).

Quem não satisfaz continua procedure fina — **mas obrigatoriamente sob o guard de tenancy da Fase 0**.
Segurança é universal; camada é seletiva.

### 5.2 As camadas

```
src/modules/<módulo>/
├─ domain/        entidades, value objects, erros de domínio, regras puras
│                 ZERO imports externos. Nem Prisma, nem Zod, nem Next, nem React.
├─ ports/         interfaces: LeadRepository, MessageGateway, Clock, IdGenerator
├─ application/   use cases. Orquestram domínio + ports. Não conhecem Prisma nem HTTP.
├─ infra/         adapters: PrismaLeadRepository, MetaMessageGateway, SystemClock
└─ index.ts       composition root — único lugar que instancia adapters
```

O adapter primário continua sendo a procedure em `src/app/router/<domínio>/`, reduzida a:
validar input → resolver tenancy → chamar use case → mapear erro de domínio para `ORPCError`.

```
┌─ Presentation ───────────────────────────────────────────────────┐
│  src/app/router/*  ·  src/app/api/*  ·  src/features/*/components │
└───────────────┬──────────────────────────────────────────────────┘
                │ chama use case (nunca Prisma)
┌───────────────▼─── Application ──────────────────────┐
│  src/modules/<m>/application/*  — só depende de ports │
└───────────────┬──────────────────────────────────────┘
                │ usa                    ▲ implementa
┌───────────────▼─ Domain ──────┐   ┌────┴─ Infrastructure ─────────┐
│  src/modules/<m>/domain/*     │   │  src/modules/<m>/infra/*      │
│  puro, testável sem I/O       │   │  Prisma, HTTP, Pusher, S3     │
└───────────────────────────────┘   └───────────────────────────────┘
```

### 5.3 Multi-tenancy como invariante de primeira classe

A mudança de desenho mais importante — resolve o IDOR sistêmico na raiz.

Hoje o tenant é um campo que cada query lembra (ou esquece) de filtrar, em 8.877 lugares. No schema,
só **80 de 240 models (33%)** têm `organizationId`; não há RLS no Postgres nem `$extends` global.
O isolamento é 100% aplicação, sem rede.

Alvo: **o tenant é do contexto, e o repositório não sabe operar sem ele.**

```ts
// ports/lead-repository.ts — escopo não é parâmetro opcional, é construção
export interface LeadRepository {
  findById(id: LeadId): Promise<Lead | null>;   // já escopado
  save(lead: Lead): Promise<void>;
}

// infra/prisma-lead-repository.ts
export class PrismaLeadRepository implements LeadRepository {
  constructor(private readonly tenant: TenantScope) {}      // obrigatório

  async findById(id: LeadId) {
    const row = await prisma.lead.findFirst({
      where: { id, tracking: { organizationId: this.tenant.organizationId } },
    });
    return row ? toLead(row) : null;
  }
}
```

Esquecer o filtro deixa de ser possível por omissão: sem `TenantScope` o repositório não instancia.
É a diferença entre "lembrar de filtrar" e "não conseguir não filtrar".

⚠️ **A avaliar na Fase 1:** RLS no Postgres como segunda linha de defesa. Custo alto de migração (só
33% dos models têm a coluna), mas é a única proteção que sobrevive a um bug de aplicação.

### 5.4 Estrutura de pastas — e sua evolução prevista

`src/modules/` nasce **ao lado** do que existe. Nada é movido em massa.

```
src/
├── modules/                      ← NOVO: núcleo hexagonal, só módulos migrados
│   ├── shared/
│   │   ├── domain/               DomainError, TenantScope, Result, ids
│   │   └── ports/                Clock, IdGenerator, Logger, EventPublisher
│   ├── form/                     ← PILOTO 1
│   │   ├── domain/               FormResponse, ResponseEditPolicy, ResponseLabel
│   │   ├── ports/                FormRepository, FormResponseRepository
│   │   ├── application/          submitFormResponse, savePartialResponse
│   │   ├── infra/
│   │   └── index.ts              composition root
│   └── lead/                     ← piloto 2
│       ├── domain/               Lead, LeadPlacement, PhoneNumber, regras de order
│       ├── ports/                LeadRepository, TrackingRepository, LeadEventPublisher
│       ├── application/          createLead, placeLeadInTracking, moveLeadToStatus
│       └── infra/                PrismaLeadRepository, PusherLeadEventPublisher
│
├── middleware.ts                 ← NOVO (S11): headers de segurança, request-id
├── app/router/                   procedures = adapters primários (finas, após migração)
├── app/api/                      route handlers e webhooks
├── features/                     UI por domínio — permanece, migra por oportunidade
├── components/                   só UI primitiva e shells
├── lib/                          infra global: prisma, auth, orpc, stripe, logger
├── http/                         clients externos (candidatos a virar adapters)
└── inngest/                      jobs
```

| Diretório | Responsabilidade | Proibido |
| --- | --- | --- |
| `modules/*/domain` | Regras e invariantes. Puro | Qualquer import externo |
| `modules/*/ports` | Contratos com o mundo (interfaces) | Implementação |
| `modules/*/application` | Orquestração de casos de uso | Prisma, HTTP, Next, React |
| `modules/*/infra` | Implementação dos ports | Ser importado por `application` |
| `modules/*/index.ts` | Composition root | Regra de negócio |
| `app/router` | Adapter oRPC: input → tenancy → use case → erro | Regra de negócio, Prisma (nos migrados) |
| `features/*` | UI por domínio | Prisma; oRPC fora de `hooks/` |
| `components/*` | UI primitiva e shells globais | `@/features/**`, `@/lib/orpc` |
| `lib/*` | Infra global sem domínio | Regra de negócio |

**Por que `src/modules/` e não reaproveitar `features/*/server/`:** as 12 pastas `server/` existentes
já estão acopladas a Prisma (47 de 49 arquivos em `actions/server`). Fronteira nova precisa de espaço
limpo — misturar tornaria a regra de linter inexprimível.

**Evolução prevista** (cada etapa é opcional e reversível):

```
Fase 2 (piloto)          Fase 3 (Turborepo etapa 2)      Fase 4+ (só se o split ocorrer)
─────────────────        ──────────────────────────      ──────────────────────────────
src/                     packages/                        apps/
├── modules/             ├── core/          ← ex-modules  ├── web/      Next.js
│   ├── shared/          │   ├── src/                     └── api/      Fastify
│   ├── form/            │   └── package.json  ← SEM       packages/
│   └── lead/            │       next, sem prisma         ├── core/     domínio + aplicação
├── app/                 ├── db/            ← Prisma      ├── db/       Prisma + repos
├── features/            └── ...                          └── ...
└── ...                  apps/web/          ← o app Next
```

A regra R3 (`modules/**` não importa `next/*`) existe **desde a Fase 1** justamente para tornar essa
evolução mecânica.

### 5.5 Split Fastify — recomendação: adiar e inverter a ordem

> **Status: EM ABERTO.** Havia um plano de separar a API oRPC num Fastify próprio
> (`orbita` / `api.nasaex.com`) **antes** da Clean Architecture. A auditoria recomenda o inverso.
> O documento original (`docs/backend-fastify-split-plan.md`) **não existe mais na `main`**.

O dado decisivo — acoplamento do router a Next.js, medido em 2026-08-18:

| Import Next.js em `src/app/router/` (1.008 arquivos) | Ocorrências |
| --- | ---: |
| `next/headers` | **1** |
| `next/cache` | **1** |
| `next/server` | 0 |
| `next/navigation` | 0 |
| `react` | 1 |

**O router já é ~99,8% independente de framework.** O oRPC tem adapter Node/Fastify; o contexto é
`{ headers: Headers }`, padrão web. Mover para Fastify é, na parte do router, quase troca de adapter.

E é exatamente por isso que **o split não é a alavanca**:

1. **Não desacopla nada.** O acoplamento real não é com Next — é com Prisma (8.877 call sites) e com
   a ausência de domínio. Separar processos move código acoplado para outro deploy: paga-se latência
   de rede, complexidade distribuída e observabilidade dobrada pelo mesmo grau de acoplamento.
2. **Quebra a única coisa que hoje funciona bem.** A tipagem end-to-end via
   `RouterClient<typeof router>` importando o router direto é o maior ativo do projeto. Split exige
   publicar tipos como pacote ou gerar via OpenAPI.
3. **46 pages RSC + 49 route handlers falam Prisma direto.** No split, ou viram HTTP (mais lento,
   mais superfície) ou mantêm um segundo caminho ao banco — anulando o propósito.
4. **Sem testes, é a refatoração de maior risco possível.** Muda processo, transporte, sessão e
   deploy ao mesmo tempo, sem rede.
5. **4 devs, bus factor ~1–2.** Dois serviços = dois pipelines, dois deploys, dois runbooks,
   versionamento de contrato — sobre um time que hoje **não tem nem um CI**.

**Gatilhos objetivos que reabrem a discussão** (não calendário):

- segundo consumidor real da API além do app web (o sync NERP é o candidato mais provável);
- métrica comprovando necessidade de escalar API e web em proporções diferentes;
- workers de longa duração que não cabem no modelo de request do Next (hoje o Inngest cobre bem).

**A assimetria é o argumento decisivo:** fronteiras primeiro tornam o split mecânico depois (trocar o
adapter oRPC, montar o better-auth, mover as 46 pages). Split primeiro deixa as fronteiras faltando —
agora com dois deploys. **Fronteiras sem split entregam ~80% do benefício com ~10% do risco.**

⚠️ Se houver compromisso externo (contrato, roadmap comercial, dependência do NERP) exigindo
`api.nasaex.com` em data específica, esta análise muda e deve ser revista.

---

## 6. Regras arquiteturais

### 6.1 Regra de dependência

```
Domain          → não importa NADA do projeto. Sem Prisma, Zod, Next, React, oRPC.
Application     → importa Domain e Ports. Nunca Infra, nunca Presentation.
Ports           → só tipos e interfaces. Sem implementação.
Infrastructure  → importa Domain e Ports. Implementa Ports. Nunca Application.
Presentation    → importa Application e Domain (tipos). NUNCA Infra direto.
```

### 6.2 Regras verificadas por `dependency-cruiser` (bloqueiam PR)

| # | Regra | Severidade |
| --- | --- | --- |
| R1 | `modules/*/domain/**` não importa nada fora do próprio `domain/` | error |
| R2 | `modules/*/application/**` não importa `infra/`, `@/lib/prisma`, `@/app/**` | error |
| R3 | `modules/**` não importa `next/*` nem `react` (preserva a opção de split) | error |
| R4 | `app/router/**` não importa `modules/*/infra/**` (só via composition root) | error |
| R5 | Nenhum ciclo em `modules/**` | error |
| R6 | `components/ui/**` não importa `@/features/**` nem `@/lib/orpc` | error |
| R7 | `@/lib/prisma` só em `modules/*/infra/**` — **nos módulos migrados** (allowlist decrescente) | error |
| R8 | Ciclos entre `features/*` — baseline **27**, só pode cair | warn → error |
| R9 | `orpc.*` fora de `features/*/hooks/` — baseline **518**, só pode cair | warn |
| R10 | Rota nova em `app/api/**` sem auth ou validação de assinatura | error |

**R7–R9 usam baseline decrescente:** o número atual vira teto no CI. Não obriga a corrigir o legado,
mas torna **impossível piorar**. É o mecanismo que faz o plano sobreviver sem congelar o produto.

### 6.3 Convenções

| Elemento | Convenção | Exemplo |
| --- | --- | --- |
| Entidade | `PascalCase`, arquivo kebab | `domain/lead.ts` → `Lead` |
| Value object | `PascalCase` | `domain/phone-number.ts` → `PhoneNumber` |
| Use case | verbo + substantivo | `application/submit-form-response.ts` |
| Port | substantivo + papel | `ports/lead-repository.ts` → `LeadRepository` |
| Adapter | tecnologia + port | `infra/prisma-lead-repository.ts` |
| Erro de domínio | sufixo `Error`, herda `DomainError` | `LeadNotInOrganizationError` |
| Schema Zod | `features/<d>/schema/<recurso>-schemas.ts`, reusado pelo router | padrão de `campanhas/schema/` |

Nomes seguem a Regra 12 do CLAUDE.md (sem abreviações de uma letra). Comentários seguem a Regra 13
(só o "por quê" não-óbvio).

---

## 7. Ferramentas

Critério: nada que duplique o existente, nada sem dono claro.

| Ferramenta | Problema que resolve | Por que esta | Manutenção |
| --- | --- | --- | --- |
| **Vitest** | Não há runner | Mesmo esbuild/SWC do stack; `projects` separa unit/integration; resolve `@/*` do tsconfig sem config extra | Baixa |
| **Playwright** | Sem E2E | Padrão atual; trace viewer paga o custo no debug; roda no CI sem xvfb | Média |
| **dependency-cruiser** | Fronteiras não verificáveis | Único que expressa R1–R7 **e** detecta ciclos com baseline | Baixa |
| **pino** | 724 `console.*` sem estrutura | JSON estruturado, overhead baixo, redação nativa por path | Baixa |
| **PostHog Error Tracking (server)** | Erros de servidor não são rastreados | **Já instalado e pago**; `posthog-node` já é dependência; correlaciona com o client | Muito baixa |
| **@faker-js/faker** | Fixtures | **Já é devDependency** — só usar | Zero |
| **eslint-plugin-jsx-a11y** | Acessibilidade sem suíte dedicada | Custo marginal zero no lint existente | Zero |
| **Turborepo** | Pipeline lento e, depois, fronteira não-estrutural | §7.1 — adoção em duas etapas | Baixa na etapa 1 |

**Deliberadamente NÃO adotamos:**

| Ferramenta | Por quê |
| --- | --- |
| **Testcontainers** | `docker-compose.test.yml` + service container do GH Actions resolve com menos peças |
| **Storybook** | Sem suíte de UI planejada, vira documentação que apodrece |
| **MSW** | Só quando houver contract tests (Fase 3). Antes disso, handler fake local basta |
| **Nx** | Mesmo que Turborepo com muito mais superfície. Peso desproporcional para 1 app |
| **Stryker (mutation)** | Ótima métrica — mas sem testes não há o que mutar. Fase 4+ |
| **Sentry** | PostHog já cobre; evitar dois vendors para o mesmo fim |

**Remoções:** `convex` e `@hello-pangea/dnd` (0 usos). Consolidar as 3 libs de data em **uma** —
`date-fns` (tree-shakeable, imutável; `dayjs` tem mais usos hoje, 82 vs 56, mas a migração é mecânica
e o ganho de bundle é real). Consolidar `zustand`+`jotai` em Zustand (Regra 5 já manda isso).
Registrar ou remover `@tanstack/eslint-plugin-query`. Adicionar `src/generated/**` ao ignore do ESLint.

### 7.1 Turborepo — adoção em duas etapas

Fato verificado na documentação oficial: **Turborepo suporta single-package workspaces**, com cache
local, cache remoto e paralelização plenamente funcionais — só recursos específicos de múltiplos
pacotes ficam indisponíveis. Isso abre duas etapas com justificativas diferentes.

**Etapa 1 — single-package, Fase 1. Custo: horas. Zero arquivo movido.**

```json
{
  "tasks": {
    "lint":      { "cache": true },
    "typecheck": { "cache": true, "outputs": ["tsconfig.tsbuildinfo"] },
    "build":     { "cache": true, "dependsOn": ["typecheck"], "outputs": [".next/**", "!.next/cache/**"] },
    "test":      { "cache": true, "dependsOn": ["typecheck"] }
  }
}
```

Em single-package mode as tarefas **não** levam prefixo de pacote (`build`, nunca `app#build`) — o
prefixo é erro de configuração aqui.

Problema que resolve: o alvo de **< 10 min no pipeline de PR** é ambicioso para 536k linhas com um
`tsconfig.tsbuildinfo` de **2,1 MB**. Cache de `typecheck`/`build` entre execuções — e cache remoto
compartilhado entre CI e as máquinas dos devs — é a alavanca mais direta. Pipeline lento é burlado.

Ressalva honesta: em single-package o ganho é real mas modesto. Se após um mês o pipeline estiver
confortavelmente abaixo do alvo sem ele, esta etapa pode ser dispensada.

**Etapa 2 — extrair `packages/core`, Fase 3. Este é o argumento forte.**

Deixa de ser sobre velocidade e passa a ser sobre **arquitetura**. Quando `src/modules/` virar
`packages/core/`, a regra R3 deixa de ser convenção verificada por linter e vira **fato de resolução
de módulo**: se `packages/core/package.json` não declara `next` nem `@prisma/client`, importá-los não
é violação de lint — é **erro de build**.

É a diferença entre uma regra que alguém silencia com `// eslint-disable` (há 291 no repo) e uma que
simplesmente não compila. **Package é a forma mais forte de fronteira que existe em JavaScript** — e,
se o split ocorrer, o monorepo já é a estrutura de destino.

**Complementares, não redundantes.** A fronteira de pacote cobre R2 e R3. Não cobre R1 (pureza do
domínio *dentro* do pacote), R5 (ciclos internos) nem R8/R9 (baselines sobre `src/features/**`, que
fica fora dos pacotes). Ambos ficam.

**Por que não a Etapa 2 agora:** mover 3.651 arquivos com imports resolvidos por `@/*` produz churn
massivo, quebra `git blame` e adiciona atrito de Next.js + monorepo (`transpilePackages`, local do
`prisma generate`, resolução do Turbopack) — tudo **antes** de existir um teste que prove que nada
quebrou. A extração move ~5 mil linhas já testadas, não 536 mil não testadas.

⚠️ Cache remoto pede um backend. Vercel Remote Cache é o menor esforço; há implementações
self-hosted (Cloudflare Workers + R2, entre outras). O deploy hoje é Nixpacks, então não há assunção
de Vercel — decidir com o time.

---

## 8. Confiabilidade — itens fora de segurança

| # | Ação | Problema | Fase |
| --- | --- | --- | --- |
| R1 | Idempotency key nas funções Inngest com efeito externo | **Zero idempotência** em 68 funções com retry ativo. `step.run` protege falha *entre* steps, não *dentro* de um step após o efeito sair. Em risco: `campanhas/dispatch-broadcast` (WhatsApp duplicado), `payment/*` (cobrança), `course-public-purchase-paid` (e-mail) | 1 |
| R2 | Timeout + retry com backoff nos clients HTTP | uazapi (24 arquivos), Meta Graph (25), Meta Ads (8), Asaas, Resend, geocode **não têm timeout**. Um `fetch` pendurado prende uma das **5 conexões** do pool. Replicar o padrão de `src/http/nerp/` | 1 |
| R3 | Corrigir `logActivity` dentro de `$transaction` | `leads/create-lead-with-tags.ts:180` usa o Prisma **global** dentro da tx → espera circular → timeout 5s → 500. É a violação da Regra 18. O padrão correto **já existe** em `leads/update.ts`, `leads/delete-file.ts` e `form/public/submut-response.ts` — só não foi propagado. Varrer as 74 tx interativas | 1 |
| R4 | Validação de env no boot com Zod | **65 de 107 env vars** ausentes do `.env`, sem `.env.example`, sem validação. `src/lib/stripe.ts:24` tem `?? "sk_test_placeholder"` — sobe normal e só quebra na primeira cobrança real. `.env` tem `AI_SECRETS_KEY` e `RESEND_API_KEY` duplicados | 1 |
| R5 | Mover challenges WebAuthn de `Map` em memória | `router/payment/access.ts:52-55` — com >1 instância, registro e finalização caem em processos diferentes ⚠️ | 1 |
| R6 | Corrigir os runbooks quebrados | `.env.example`, `MANUAL_*.sql`, `apply-prod-migrations.sh`, `PENDING_MIGRATIONS.md` — §3.5 | 0 |
| R7 | Revisar `max: 5` do pool com métrica em mãos | — | 2 |

**Observabilidade** (Fase 1): `pino` com **request id** propagado via `AsyncLocalStorage` (Node 22, sem
dependência nova) e para o Inngest no payload do evento, ligando request → job → efeito. Redação por
**allowlist, não denylist** — denylist sempre esquece um campo. Contexto padrão em toda linha:
`requestId`, `organizationId`, `userId`, `procedure`, `durationMs`.

**Nunca nos logs:** telefone, e-mail, nome de lead, conteúdo de mensagem, body de requisição,
tokens/API keys, dados de cartão, credenciais Meta/Stripe, conteúdo de resposta de formulário.

**Métricas que valem para este projeto:** latência p50/p95/p99 por procedure (expõe as pesadas de
`insights`); **uso do pool Prisma** (com `max: 5` e clients sem timeout, é o alerta mais provável de
disparar primeiro); fila/duração/falha por função Inngest; consumo de STARs por org;
**tentativas bloqueadas de acesso cross-tenant** e **assinaturas de webhook rejeitadas** — devem ser
~0, qualquer subida é investigação imediata.

**Tracing: baixa prioridade.** O SDK OTel já está no processo (serve só telemetria de LLM hoje), então
habilitar instrumentação HTTP/Prisma é barato — mas com um único serviço, tracing distribuído resolve
pouco que log correlacionado por `requestId` não resolva. Reavaliar se o split ocorrer.

**O teste do desenho** — a observabilidade só está pronta se este roteiro funcionar:

1. Alerta chega com `requestId`, `organizationId`, procedure e categoria
2. Buscar por `requestId` devolve a linha do tempo completa, sem PII
3. O erro traz stack, input **redigido** e versão do deploy
4. Se envolveu job: o id do evento Inngest liga request → job → efeito
5. Se envolveu integração: log do client tem status, duração e id de correlação do provider
6. Reproduzir: input redigido + cenário viram teste de integração — **a investigação termina com um
   teste, não com um hotfix**

Se algum passo falhar na primeira investigação real, a observabilidade está incompleta e volta ao backlog.

---

## 9. Roadmap

### 9.1 Hotspots do git — onde os testes valem mais

Arquivos mais alterados nos últimos 6 meses, cruzados com risco:

| Arquivo | Commits | Risco |
| --- | ---: | --- |
| `src/features/trackings/components/lead-item.tsx` | 53 | UI core do kanban |
| `src/app/api/chat/webhook/route.ts` | **51** | 762 linhas, auth por token no body |
| `src/lib/prisma.ts` | 43 | 37 linhas — churn do hack `SCHEMA_VERSION` |
| `src/app/router/leads/{get-many,update}.ts` | 41 | Coração do CRM, tenancy crítico |
| `src/features/insights/components/tracking-dashboard.tsx` | 35 | |
| `src/app/router/form/public/submut-response.ts` | **28** | Público; causou o incidente da spec 0001 |

### 9.2 Por que o piloto é `form`

| Critério | `form` | `leads` | `tracking-chat` | `actions/workspace` |
| --- | --- | --- | --- | --- |
| Specs escritas (CA prontos p/ virar teste) | **4 (86 KB)** | 0 | 1 | 0 |
| Histórico de falha documentado | **sim, com causa raiz** | não | não | não |
| Entrada pública não autenticada | **sim** | não | webhook | não |
| Superfície delimitada | **sim** (1 procedure + 2 libs) | média | não (23k linhas) | não |
| Ciclos que participa | 4 | 3 | **7–9** | 3 |
| Hotspot de git | 28 commits | 41 (2 arquivos) | 51 (webhook) | 19 |
| Domínio extraído reaproveitável | **sim** (Lead/Placement serve o piloto 2) | sim | não | parcial |

### 9.3 Fases

| Fase | Status | Escopo | Critério de conclusão |
| --- | --- | --- | --- |
| **Auditoria** | ✅ **2026-08-18** | Diagnóstico completo sobre `f67796d2`; nenhuma alteração de código | Este documento + os dois satélites |
| **0 — Contenção e baseline** | ⬜ | **S1–S4 primeiro** (horas cada): webhook Asaas, `s3/delete`, `upload-local`, webhooks Meta. Depois S5–S15: uploads, `external/new-lead`, `new-nasa-*`, `[rpc-debug]`, codemod dos 228 `throw`, `middleware.ts`, sanitização, rate limit. **S6** (guard de tenancy + auditoria de ~190 procedures) é o item longo. CI mínimo (install/lint/typecheck/build). `.env.example` + runbooks (R6). Corrigir a deriva do CLAUDE.md. Rodar `tsc --noEmit` e medir o passivo | Nenhuma rota pública muta estado sem auth ou assinatura; nenhuma procedure aceita ID sem verificar organização; nenhum log de payload de cliente; CI bloqueia PR com erro de tipo ou lint; `.env.example` existe e os runbooks funcionam |
| **1 — Fundação** | ⬜ | Vitest (`projects` unit/integration) + Postgres de teste. `src/modules/shared/`. dependency-cruiser R1–R10 + baselines congeladas. pino + requestId + PostHog error tracking server-side. **Characterization tests do piloto** (antes de qualquer refatoração). R1–R5 da §8. Turborepo etapa 1 se o pipeline pedir. E2E cenários 1–4 | `pnpm test` roda unit e integração no CI; violação de fronteira bloqueia PR; um erro de produção é investigável pelo roteiro da §8; golden masters do piloto verdes |
| **2 — Piloto `form`** | ⬜ | `src/modules/form/` completo. `submut-response.ts` (776 linhas) reduzida a adapter fino. Extrair `Lead`/`LeadPlacement` para `modules/lead/domain`. Cada `CA-n` das specs 0001/0002/0005/0006 vira teste nomeado com o id. **Documentar o processo** — é o que torna o piloto replicável | `modules/form` sem import de Prisma/Next fora de `infra/`; `domain/` ≥90% de branch; golden masters passando sem alteração; toda procedure de form com teste cross-org; roteiro de migração escrito |
| **3 — Expansão dirigida** | ⬜ | Ordem: `lead` → `actions`/`workspace` → `payment`/`stars` → `tracking-chat` (**último**). Turborepo etapa 2 (`packages/core`) quando piloto e 2º módulo estiverem estáveis. Em paralelo: consolidar duplicados com teste como prova, quebrar ciclos fáceis, subir `tags` e `activity-logger` para infra, remover deps mortas, Prettier por módulo | 3 dos 4 fluxos críticos com domínio extraído; ciclos < 15; E2E 1–8 verdes; `packages/core` sem `next` nem `@prisma/client` no `package.json` |
| **4 — Hardening** | ⬜ | Gates completos; cobertura como gate em `modules/**`; contract tests de integrações externas; RLS avaliado; performance com baseline; mutation testing (opcional); **reavaliar o split Fastify** contra os gatilhos da §5.5 | — |

**Regra de expansão (Fase 3):** módulo novo **nasce em `modules/` desde o dia 1**. Módulo existente
migra quando (a) precisar de mudança relevante, ou (b) causar incidente. **Ninguém migra código
estável só para migrar.**

---

## 10. Verificação

**Fase 0:**

```bash
# nenhuma procedure aceita ID sem escopo — deve cair para ~0
grep -rl "requiredAuthMiddleware" src/app/router --include="*.ts" \
  | xargs grep -L "requireOrgMiddleware\|organizationId\|orgId" | wc -l

# nenhum throw sem invocação
grep -rn "throw errors\.[A-Z_]*;" src/app/router | wc -l          # esperado: 0

# nenhum log de payload
grep -rn "rpc-debug\|console.log(json)" src/app/api | wc -l       # esperado: 0
```

E, manualmente contra staging: as quatro rotas de S1–S4 devem devolver 401/403 a um `curl` sem
credencial. CI verde num PR de teste; `tsc --noEmit` sem erros.

**Fase 1:** `pnpm test` roda e passa; PR com import proibido em `modules/` é bloqueado; provocar um
erro em dev e percorrer o roteiro da §8 até o teste de reprodução.

**Fase 2:** golden masters do `form` verdes antes e depois da refatoração (diferença = regressão);
submit público E2E nos 3 caminhos da spec 0001; `depcruise` sem violação em `modules/form`.

**Contínuo** — métricas que importam mais que percentual de cobertura:

| Métrica | Hoje | Alvo |
| --- | ---: | --- |
| Procedures com teste cross-org ÷ procedures que aceitam ID | 0% | 100% no escopo migrado |
| Rotas públicas sem auth/assinatura | ~10 relevantes | 0 |
| Ciclos entre features | 27 | monotonicamente decrescente |
| Violações de fronteira em `modules/**` | — | 0 |
| Tempo do pipeline de PR | — (não existe) | < 10 min |
| Escapes (bugs que a suíte poderia ter pego) | — | decrescente |

---

## 11. Itens abertos / precisa ser validado

| # | Item | Por que importa | Status |
| --- | --- | --- | --- |
| 1 | Topologia de deploy (nº de instâncias) | Define severidade do WebAuthn em memória, do pool `max: 5` e do rate limit in-memory | ⬜ |
| 2 | Inventário completo de IDOR | 6 confirmados por leitura; ~184 candidatos não lidos individualmente | ⬜ |
| 3 | `api/s3/proxy-svg` — sanitização e SSRF | Não verificado | ⬜ |
| 4 | Os 7 `dangerouslySetInnerHTML` que dependem de sanitização upstream | Não verificado | ⬜ |
| 5 | `PAYMENT_MASTER_HASH` — uso; ausente do `.env` | **Resolvido**: era backdoor de resgate do PIN do módulo financeiro. Removido do código pela [spec 0007](../specs/payment/0007-acesso-financeiro-por-whitelist.md), que eliminou o PIN. Nenhuma env var nova; a antiga deixou de ser lida | ✅ |
| 6 | Compromisso externo com `api.nasaex.com` | Se houver data contratada, revisar §5.5 | ⬜ |
| 7 | Resultado de `tsc --noEmit` hoje | **Respondido em 2026-08-26**: passa limpo (exit 0, zero erros) sobre a branch da spec 0007. Passivo de tipos é zero. Ressalva para o CI: precisa de heap acima do default do Node — com 4 GB o processo morre por OOM (`exit 134`), o que se disfarça de "sem erros" se o exit code não for checado. Rodar como `NODE_OPTIONS=--max-old-space-size=12288 tsc --noEmit` e **falhar o job pelo exit code** | ✅ |
| 8 | `s3/delete` e `upload-local` ainda são usadas? | Define se a correção é *fix* ou *remoção* | ⬜ |
| 9 | O orquestrador usa `/api/health`? | Health check pode estar inerte | ⬜ |
| 10 | Backend do cache remoto do Turborepo | Deploy é Nixpacks, não Vercel — §7.1 | ⬜ |
| 11 | Migrations rodam no `build` de produção | Build sem banco falha; rollback ambíguo. Decisão própria, fora do escopo da auditoria | ⬜ |
| 12 | RLS no Postgres como 2ª linha de defesa | Só 33% dos models têm `organizationId` — custo alto, avaliar na Fase 1 | ⬜ |

Nenhum destes invalida o plano — as Fases 0 e 1 são corretas independentemente. Mas **2, 3 e 4 podem
acrescentar itens à Fase 0**.

---

## 12. Changelog

| Data | O quê |
| --- | --- |
| 2026-08-26 | Item aberto **5** (`PAYMENT_MASTER_HASH`) resolvido pela [spec 0007](../specs/payment/0007-acesso-financeiro-por-whitelist.md): o acesso ao módulo financeiro passou a ser determinado só pela whitelist, o PIN próprio e o OTP por WhatsApp foram desativados e o backdoor saiu do código. O item **1** (topologia de deploy) segue aberto e ficou mais relevante — a fase de biometria depende dele, porque os desafios WebAuthn ainda vivem em memória. Item aberto **7** também respondido: `tsc --noEmit` passa limpo, mas só com heap ampliado — ver a ressalva de CI na linha do item. |
| 2026-08-18 | Auditoria técnica completa sobre `f67796d2`. Diagnóstico, arquitetura alvo (Hexagonal seletivo), regras R1–R10, roadmap em 5 fases e documentos satélite de segurança e testes. Recomendação de **adiar o split Fastify e inverter a ordem** registrada em §5.5. Turborepo adotado em duas etapas (§7.1). Nenhuma alteração de código. |
