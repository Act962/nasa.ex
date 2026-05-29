# Plano — Sync bidirecional de autenticação NASA ↔ NERP

> Replicar **conta (User/Account)** e **organização (Organization/Member)** entre NASA e NERP no momento da criação, **nos dois sentidos**, em background, best-effort.

## Branches criadas

| Repo | Caminho | Branch |
| --- | --- | --- |
| NASA | `/home/dev/Documentos/nasa.ex` | `feature/tracking-sync-auth-nerp-20260529` |
| NERP | `/home/dev/Documentos/nerp-2` | `feature/sync-auth-nasa-20260529` |

## Decisões fechadas
- **Direção:** bidirecional total (cria em qualquer lado → replica no outro).
- **Canal:** credencial de **sistema** (chave master app↔app, HMAC), separada do consent S2S por-org (que é amarrado a uma org e não serve no sign-up, onde ainda não há org).
- **Consistência:** best-effort assíncrono — a criação local nunca falha se o outro lado cair.
- **Escopo:** `User`, `Account`, `Organization`, `Member`.

## Por que é viável (já verificado nos dois repos)
- Ambos: better-auth + Prisma + Postgres + `cuid()`. **Nenhum sobrescreve o hash de senha** → ambos usam scrypt (default) → `Account.password` replicado loga no outro lado **sem reset**.
- `Organization` dos dois só exige `name` + `slug` (resto opcional/default) → replicar org é trivial.
- HMAC já validado e idêntico nos dois (`nerp-2/src/lib/nasa-s2s-verify.ts:84` ↔ `src/http/nerp/sign.ts`).

## Mecanismo
1. **Emitir na criação** — hooks do better-auth (`user/account.create.after`, `organizationHooks.afterCreateOrganization/afterAddMember`) **só enfileiram** um evento; `try/catch`, nunca lançam.
2. **Processar em background** — NASA: Inngest (retry/backoff). NERP: outbox + processador (não tem Inngest).
3. **Receber via Prisma cru** — o endpoint inbound faz `upsert` com o **mesmo `id`**. Escrita crua **não dispara** hooks do better-auth → **não há eco** → loop resolvido pela arquitetura. **Invariante: o caminho inbound NUNCA usa APIs do better-auth.**
4. **Identidade/ordem** — propaga `id` (cuid); inbound garante `User` antes de `Account`, `Organization` antes de `Member`.

---

## Passos — Lado NASA (`nasa.ex`)

> Padrões do projeto: hooks oRPC client em `src/features/<dom>/hooks/`; lógica de domínio em `src/features/<dom>/`; `pnpm db:migrate` (nunca `db push`).

1. **Credencial de sistema + crypto/sign compartilhado**
   - Reusar `src/http/nerp/sign.ts` (HMAC). Criar `src/features/sync/lib/system-cred.ts` lendo `SYNC_SHARED_SECRET` / `SYNC_API_KEY`.
2. **Endpoint inbound** `src/app/api/sync/nerp/route.ts`
   - Verifica HMAC (helper `verifyNerpSync`, espelho de `nasa-s2s-verify.ts`, com `request.clone().text()`).
   - Roteia por tipo (`user|account|org|member`) → `upsert` via **Prisma cru** (`prisma.user.upsert`, etc.) por `id`.
   - Trata colisão de `email`/`slug` com `id` diferente → loga e pula.
3. **Cliente outbound** `src/http/sync-nerp/client.ts`
   - Espelho de `src/http/nerp/client.ts`, mas assinando com a credencial de **sistema**. Métodos: `upsertUser/upsertAccount/upsertOrg/upsertMember`. Base: `NERP_SYNC_BASE_URL`.
4. **Funções Inngest** `src/inngest/functions/sync/replicate-{user,account,org,member}-to-nerp.ts`
   - `inngest.createFunction({ id, retries: 5 }, { event: "sync/<x>.upsert" }, ...)` → `step.run` chamando o cliente outbound. Registrar em `src/app/api/inngest/route.ts`.
5. **Hooks emit** em `src/lib/auth.ts`
   - Adicionar a `databaseHooks`: `user.create.after`, `account.create.after` → `inngest.send("sync/user.upsert" | "sync/account.upsert")`.
   - Em `organization({...})`: `organizationHooks.afterCreateOrganization`, `afterAddMember` → `inngest.send(...)`. Todos com `try/catch`.
6. **Env + doc** — `SYNC_SHARED_SECRET`, `SYNC_API_KEY`, `NERP_SYNC_BASE_URL` no `.env.local`; documentar na seção "Variáveis de Ambiente" do `CLAUDE.md`.

## Passos — Lado NERP (`../nerp-2`)

> Padrão NERP: um arquivo por procedure + `index.ts`; `pnpm prisma migrate dev`. Reusar o crypto/HMAC que **já existe** (`src/lib/nasa-s2s-crypto.ts`, `nasa-s2s-verify.ts`).

1. **Migration** — modelo `SyncOutbox` (`id`, `type`, `payload Json`, `attempts`, `nextAttemptAt`, `deliveredAt`, `createdAt`).
2. **Endpoint inbound** `src/app/api/sync/nasa/route.ts`
   - Verifica HMAC com `SYNC_SHARED_SECRET` (reusa o esquema canônico) → `upsert` via **Prisma cru** por `id`.
3. **Cliente outbound** `src/http/sync-nasa/client.ts` — assina com a credencial de sistema; base `NASA_SYNC_BASE_URL`.
4. **Hooks emit** em `src/lib/auth.ts` — mesmos pontos do NASA, mas **gravam na `SyncOutbox`** (fire-and-forget; `try/catch`).
5. **Processador da outbox** — endpoint/cron (`src/app/api/sync/outbox/route.ts` chamado por cron, ou Vercel Cron) que lê pendentes, chama o cliente outbound, marca `deliveredAt` ou agenda retry com backoff.
6. **Env** — `SYNC_SHARED_SECRET` (mesmo valor dos dois lados), `SYNC_API_KEY`, `NASA_SYNC_BASE_URL`.

---

## Ordem de execução (minimiza risco)
1. Inbound + crypto/sign nos **dois** lados (nada replica ainda).
2. Cliente outbound nos dois lados.
3. Ligar **hooks emit no NASA** → testar **NASA → NERP**.
4. Ligar **hooks emit no NERP** (+ outbox/processador) → testar **NERP → NASA**.
5. Endurecer retries, colisões e logs.

## Variáveis de ambiente (resumo)
| Var | NASA | NERP | Observação |
| --- | --- | --- | --- |
| `SYNC_SHARED_SECRET` | ✅ | ✅ | **Mesmo valor** nos dois. `openssl rand -hex 32`. Chave master — guardar bem. |
| `SYNC_API_KEY` | ✅ | ✅ | Identifica o caller app↔app. |
| `NERP_SYNC_BASE_URL` | ✅ | — | Ex.: `http://localhost:3001`. |
| `NASA_SYNC_BASE_URL` | — | ✅ | Ex.: `http://localhost:3000`. |

## Verificação end-to-end
1. NASA `:3000` + NERP `:3001`, dois Postgres (NERP em `:5433`), `pnpm inngest:dev` no NASA.
2. Sign-up no NASA → `User`+`Account` aparecem no banco do NERP com **mesmo `id`**; logar no NERP com a mesma senha.
3. Criar org no NASA → `Organization`+`Member` no NERP.
4. Repetir no sentido NERP → NASA.
5. **Loop:** criar 1 vez → exatamente 1 linha de cada lado (sem eco).
6. **Resiliência:** derrubar um lado → criação local funciona; subir → retry/outbox converge.

## Riscos / notas
- Caminho **auth-crítico** nos dois repos → todos os hooks em `try/catch` que só logam.
- `SYNC_SHARED_SECRET` é chave master (vazamento = escrita cross-app) → rotacionável.
- Skew de versão (NASA better-auth 1.6.5 vs NERP 1.4.10) → testar 1 login replicado antes de confiar em massa.
- Usuário Google: replica o `Account` (link OAuth), mas login no outro lado exige Google configurado lá.
- Race bidirecional (mesmo e-mail nos dois ao mesmo tempo): upsert idempotente por `id`; `email` unique pode rejeitar um — aceito como best-effort.
- Mudanças no NERP moram no repo do NERP (`../nerp-2`), com o fluxo de branch/migração dele.
