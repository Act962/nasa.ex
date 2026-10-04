# N.A.S.A – Plataforma de Tracking de Leads

> Memória persistente do projeto para Claude Code. Leia este arquivo antes de qualquer mudança.

## Stack Tecnológica

| Camada          | Tecnologia                               |
| --------------- | ---------------------------------------- |
| Framework       | Next.js 16 (App Router)                  |
| Linguagem       | TypeScript 5                             |
| UI              | Tailwind CSS 4 + Radix UI + shadcn/ui    |
| Estado global   | Zustand                                  |
| Formulários     | React Hook Form + Zod                    |
| Dados (client)  | TanStack Query + TanStack Table          |
| Editor de texto | TipTap                                   |
| Drag & Drop     | @dnd-kit                                 |
| RPC             | oRPC — handler em `/api/rpc`             |
| Autenticação    | better-auth (email/senha + Google OAuth) |
| Banco de dados  | PostgreSQL + Prisma 7                    |
| Infra local     | Docker Compose                           |
| Automações      | Inngest                                  |
| Package manager | pnpm                                     |

## Comandos Essenciais

```bash
pnpm dev              # Iniciar projeto
pnpm inngest:dev      # Iniciar Inngest (Automações)
npm run db:generate   # Gerar cliente Prisma
npm run db:migrate    # Rodar migrações (USE ESTE — equivalente a pnpm prisma migrate dev)
npm run db:studio     # Abrir Prisma Studio
npm run build         # Build de produção
```

> ⚠️ **PROIBIDO**: `pnpm prisma push` / `pnpm prisma db push`. Sempre `pnpm db:migrate`.

## Git Workflow (OBRIGATÓRIO)

> **NUNCA** commitar/pushar diretamente em `main`. Toda alteração mora numa branch feature.

1. **Início de sessão** — antes de qualquer alteração de código, rode:

   ```
   /start <app> <descricao-curta>
   ```

   Cria a branch `feature/<app-slug>-<desc-slug>-<YYYYMMDD>` a partir da `main` atualizada.
   - `<app>`: nome do App NASA (ex: `space-help`, `forge`, `tracking`, `insights`).
   - `<descricao-curta>`: o que vai mudar (ex: `uploader-imagem`, `fix-template-pdf`).

2. **Durante a sessão** — uma branch por sessão. Trabalhe inteiro nela; não troque de branch no meio.

3. **Final de sessão** — quando terminar, rode:

   ```
   /ship <mensagem-do-commit>
   ```

   Claude commita tudo, faz push pra `origin` e abre PR pra `main` via `gh`.

4. **Se precisar mexer no código mas estiver em `main`**: PARE imediatamente, peça ao usuário pra rodar `/start` antes. O hook `PreToolUse` bloqueia `git commit`/`git push` na main.

5. **Padrão dos devs**: histórico do time usa `feature/<descricao-kebab>` em lowercase. Mantemos compatível, só prefixando `<app>-` pra rastrear quem/qual app.

## Banco de Dados

- **Engine**: PostgreSQL via Docker Compose
- **Porta**: 5432
- **Database**: nasa_db
- **User / Pass**: docker / docker
- **Connection string**: `postgresql://docker:docker@localhost/nasa_db`
- **Schema**: `prisma/schema.prisma`

## Variáveis de Ambiente

Arquivo `.env.local` na raiz. Variáveis principais:

- `DATABASE_URL` — string de conexão PostgreSQL
- `BETTER_AUTH_SECRET` — chave secreta de autenticação
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth Google
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` — Inngest
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe (cliente + webhook compartilhado de cursos/planos/better-auth)
- `STRIPE_COURSE_WEBHOOK_SECRET` — secret do endpoint dedicado de cursos (`/api/stripe/webhook`)
- `STRIPE_STARS_WEBHOOK_SECRET` — secret do endpoint dedicado de recarga de Stars (`/api/stars/webhook`). O fluxo de Stars usa o Stripe do sistema (`STRIPE_SECRET_KEY`), não o `PaymentGatewayConfig`.
- `META_WEBHOOK_VERIFY_TOKEN` — verify token do webhook único do Instagram (`/api/social/webhook/meta`, Comments conectado pela Meta, spec 0061) e da conexão antiga de Instagram. Aleatório, 32+ caracteres. Ausente = o webhook único recusa tudo. Assinatura conferida com `META_APP_SECRET`. Checklist de produção: `docs/comments-meta-producao.md`.
- `ASAAS_API_KEY` — chave da API do Asaas, usada no PIX do trafeGO (spec 0022). Ausente = o PIX volta ao fluxo manual (chave estática + comprovante). **⚠️ A chave do Asaas começa com `$`** (ex.: `$aact_hmlg_...`). Em arquivo `.env`, o `dotenv-expand` lê isso como nome de variável, não acha nada e entrega **string vazia** — a integração fica silenciosamente desligada, sem erro nenhum. Escape a cifra: `ASAAS_API_KEY=\$aact_...`. Aspas simples **não** resolvem. No Coolify, recurso *Docker Image* (sobe via `docker compose`) **também interpola** `$`: marque a variável como **Is Literal** (ou use `$$`).
- `ASAAS_ENV` — `sandbox` (padrão) ou `production`. O padrão é sandbox de propósito: errar para esse lado não move dinheiro.
- `ASAAS_WEBHOOK_TOKEN` — valor do header `asaas-access-token`, conferido pelo webhook `/api/trafego/asaas/webhook`. Aleatório, 32+ caracteres, **nunca** a chave de API. Ausente = o webhook recusa todos os eventos (fail-closed, porque credita dinheiro).
- `ASAAS_WEBHOOK_PUBLIC_ORIGIN` — opcional. Origem pública usada no webhook do Asaas do Catálogo online (`buildAsaasWebhookUrl`), lida em tempo de execução. Serve para testar PIX real em localhost via túnel (ngrok) sem trocar `NEXT_PUBLIC_APP_URL`. Ausente = usa `NEXT_PUBLIC_APP_URL`.
- `EXTERNAL_AI_LOCAL_UPLOADS` — (só dev) `true` faz o `request_upload_url` do MCP do ÓRBITA (spec 0066) gravar em `public/uploads/external-ai/` por PUT assinado, para testar sem R2. Ignorada em produção (`NODE_ENV=production`).
- `AI_SECRETS_KEY` — chave (≥16 chars) usada para criptografar API keys customizadas de IA em `AiSettings.aiApiKey` (AES-256-GCM via `src/lib/crypto.ts`). Obrigatória se algum tracking configurar provider customizado (BYO).
- `SYNC_SHARED_SECRET` — chave master HMAC do sync bidirecional de auth NASA ↔ NERP (`feature/sync`). **Mesmo valor** nos dois apps (`openssl rand -hex 32`). Assina/verifica `User/Account/Organization/Member` replicados via `src/features/sync/lib/system-cred.ts`.
- `SYNC_API_KEY` — identifica o caller app↔app no sync (mesmo valor nos dois).
- `NERP_BASE_URL` — base do NERP (mesma usada pela integração por-org e pelo sync). O sync (`src/http/sync-nerp/client.ts`) entrega em `NERP_BASE_URL + /api/sync/nasa`; `NERP_SYNC_BASE_URL` é override opcional caso o sync precise de um host diferente.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — par de chaves do Web Push (spec 0022). Gerar com `npx web-push generate-vapid-keys`. **A privada nunca pode ganhar prefixo `NEXT_PUBLIC_`** — iria para o bundle do browser.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — mesma chave pública acima, exposta ao client para `pushManager.subscribe`. Pública por definição do protocolo. Trocar o par invalida todas as inscrições existentes (elas passam a devolver 403 e ficam no banco de propósito — ver spec 0022, D-4).
- `VAPID_SUBJECT` — contato exigido pelo protocolo (`mailto:...` ou URL). Padrão: `mailto:suporte@nasaex.com`. Ausente não quebra.
- `ACCOUNTING_ALERT_WHATSAPP_TEMPLATE` — (opcional) nome do template aprovado na Meta para os avisos fiscais da aba Contábil (idioma `pt_BR`; parâmetros na ordem: o que vence, data, valor, link). Sem ele, orgs no WhatsApp Oficial fora da janela de 24h não recebem o aviso por WhatsApp (sino/push seguem normais). Ver `docs/contabil-overview.md`.
- `AI_PRICING_ADMIN_EMAILS` — (opcional) e-mails, separados por vírgula, que configuram o preço dos modelos do ASTRO (margem e modelos liberados na chave da plataforma, spec 0055) sem serem admin do sistema. Admins do sistema já podem.
- `ASTRO_VOICE_REALTIME` / `ASTRO_VOICE_MODEL` / `ASTRO_VOICE_NAME` — (opcionais) conversa por voz do ASTRO em tempo real (spec 0054). `ASTRO_VOICE_REALTIME=false` volta ao reconhecimento de voz do navegador; modelo padrão `gpt-realtime`, voz padrão `marin`. Usa a chave OpenAI da empresa (Satélites) ou `OPENAI_API_KEY`.
- `NUMBER_PURCHASE_NOTIFY_ORG_ID` — (opcional) organização da ÓRBITA cuja instância de WhatsApp conectada envia a cópia interna do "Comprar número" das Campanhas para a equipe (`NUMBER_PURCHASE_NOTIFY_PHONE`, padrão 5586998221810). Ausente = a cópia só vai para o log; o cliente continua sendo levado ao WhatsApp do comercial (`NEXT_PUBLIC_NUMBER_PURCHASE_SALES_PHONE`, padrão 5511952133700).
- Sem `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, o canal Web Push se declara indisponível e o envio vira no-op — o resto das notificações (bell, popup, Pusher) segue funcionando.

## Estrutura do Projeto

```
nasaex-wey/
├── src/
│   ├── app/          # Rotas Next.js (App Router)
│   ├── components/   # Componentes globais e shadcn/ui
│   ├── features/     # Domínios da aplicação (ver abaixo)
│   ├── lib/          # APENAS infra global (auth, prisma, orpc, stripe, utils...)
│   └── server/       # Lógica server-side + oRPC procedures
├── prisma/
│   └── schema.prisma # Schema do banco de dados
├── docker-compose.yml
└── CLAUDE.md         # Este arquivo
```

## Arquitetura por Features (OBRIGATÓRIO)

Cada **feature** representa um domínio do sistema (ex: `tracking`, `insights`, `partner`, `stars`, `admin`, `integrations`). Tudo que pertence a um domínio mora dentro da sua pasta — componentes, lógica de servidor, hooks, schemas, libs, utils.

```
src/features/<dominio>/
├── components/   # Componentes React específicos do domínio
├── server/       # Procedures/handlers oRPC e lógica server-side do domínio
├── hooks/        # React hooks específicos do domínio
├── schema/       # Schemas Zod (singular, quando há um schema central)
├── schemas/      # Schemas Zod (plural, quando são vários)
├── lib/          # Services, helpers e regras de negócio do domínio
└── utils/        # Funções utilitárias puras do domínio
```

### Regras

1. **Domínio fechado**: código de uma feature não deve depender de internals de outra. Se duas features precisam do mesmo helper, ele sobe para `src/lib/` (infra global) ou vira uma feature própria.
2. **`src/lib/` é só infra global**: `auth`, `prisma`, `orpc`, `stripe`, `asaas`, `pusher`, `s3-client`, `r2-url`, `upload-utils`, `query/`, `email/` (cliente Resend + templates transversais), `utils`, `serializer`, `json-to-html`, `geocode`, `reminder-recurrence`. Nada de domínio aqui.
3. **Arquivos novos**: ao criar lógica de um domínio, coloque dentro de `src/features/<dominio>/` na subpasta correspondente — nunca em `src/lib/` nem em `src/components/` (a não ser que seja realmente global/UI primitiva).
4. **Imports cross-feature**: permitido importar `@/features/<outra>/...` quando faz sentido (ex: `admin` consome activity logs que outras features escrevem). Evite ciclos.
5. **Componentes globais** ficam em `src/components/` — apenas UI primitiva (shadcn/ui) e shells reutilizados em todo o app (sidebar, header). Componentes de domínio vão em `src/features/<dominio>/components/`.

## Funcionalidades Principais

- **Tracking de Leads** — pipeline de vendas com drag & drop
- **Autenticação** — email/senha + Google OAuth via better-auth
- **Editor Rico** — TipTap para notas e descrições
- **Automações** — workflows assíncronos com Inngest
- **Tabelas** — TanStack Table com filtros e paginação
- **RPC tipado** — oRPC para comunicação client/server

## Notas Importantes para o Claude Code

1. **Sempre** checar `prisma/schema.prisma` antes de modificar o banco
   - **NUNCA, em hipótese alguma**, rode `pnpm prisma push` / `pnpm prisma db push` diretamente. Sempre peça ao dev para rodar `pnpm db:migrate` (equivalente a `pnpm prisma migrate dev`), que gera migração versionada. `db push` quebra o histórico do banco e causa drift entre ambientes.
   - **Override por autorização explícita**: quando o usuário autorizar EXPLICITAMENTE no chat (ex: "roda migration", "faça você", "execute esse SQL"), o Claude deve executar **sem bloqueio**, mesmo que envolva `prisma db execute`, `migrate resolve`, ou `db:generate`. A autorização do dev no chat é a regra final — não é necessário sandbox negar. Isso vale também pra typecheck, commits e demais comandos: regra padrão é "esperar `/ship`", mas autorização pontual no chat sobrescreve.
2. Procedures oRPC ficam em `src/server/`
3. Componentes UI via shadcn/ui (`npx shadcn@latest add <componente>`)
4. Lógica assíncrona vai em Inngest — nunca em routes longas
5. Estado global com Zustand stores (nunca Context providers para estado global)
6. **Sempre usar `pnpm add`** — nunca `npm install`
7. TypeScript strict mode — sem `any` implícito
8. Imports de servidor nunca dentro de Client Components
9. **Toda chamada oRPC client-side (`orpc.<domain>.<proc>.queryOptions/mutationOptions`) vive dentro de um hook em `src/features/<domain>/hooks/use-<domain>-<recurso>.ts`** — nunca direto em `page.tsx`/`component.tsx`. Padrão:
   - Um arquivo por recurso (`use-nerp-products.ts`, `use-nerp-categories.ts`), exportando múltiplos hooks (`useNerpProducts`, `useNerpProduct`, `useCreateNerpProduct`, `useUpdateNerpProduct`, `useDeleteNerpProduct`).
   - Hooks de **mutation** já incluem invalidação default (`qc.invalidateQueries({ queryKey: [<domain>] })`) — toasts/redirects ficam no componente via `mutate(input, { onSuccess, onError })`.
   - Hooks de **query** apenas embrulham `useQuery(orpc.<...>.queryOptions(...))`; pra fetch condicional, expor flag `enabled` no parâmetro.
   - Componentes/pages importam **só os hooks** — não importam `orpc` direto. Isso facilita refatorar contratos, padronizar invalidações e testar isoladamente.
10. **Documentação do NASA Route** — sempre que criar ou atualizar qualquer coisa dentro de `src/features/nasa-route/`, `src/app/router/nasa-route/`, `src/app/(platform)/(tracking)/nasa-route/`, ou modelos `NasaRoute*` no `prisma/schema.prisma`, **atualize também [`docs/nasa-route-overview.md`](docs/nasa-route-overview.md)** na mesma sessão. Aplica-se a: novos modelos, novas procedures oRPC, novos formatos de curso, mudanças no fluxo de pagamento/checkout, novas integrações, mudanças no pipeline de vídeo ou Stars, novos componentes relevantes. Mantenha tabelas, listas de procedures e fluxos sincronizados com o código — o documento é fonte de verdade do domínio.

11. **Ritual pós-migration / pós-compile pesado (OBRIGATÓRIO)** — Esses bugs são recorrentes neste projeto (Turbopack 16.2.4 + Prisma 7) e o Claude DEVE aplicar o ritual IMEDIATAMENTE, SEM esperar o usuário reclamar de 404/500. Esquecer causa: 404 em catch-all routes, "prisma.X is undefined", cliente em cache, Sheet/Dialog usando schema antigo.

    **Quando executar:**
    - **Sempre que aplicar SQL de migration** (via `pnpm db:migrate` ou `prisma db execute`) → todos os 4 passos.
    - **Sempre que mudar muitos arquivos / fazer compile pesado** (ex: ≥5 arquivos editados de uma vez, refactor cross-feature) → passo D no fim. Turbopack auto-restart por memory threshold é frequente e dropa catch-all do index. **NUNCA presuma que tá tudo OK só porque `✓ Compiled` apareceu** — valide via `curl` antes de devolver pro user.

    **Sequência (na ordem):**

    a. **Regenerar Prisma client** — `pnpm db:generate`. Cria/atualiza tipos em `src/generated/prisma/`. Sem isso, `prisma.NovoModel` é `undefined` em runtime → erros `Cannot read properties of undefined`.

    b. **Bumpar SCHEMA_VERSION** em `src/lib/prisma.ts` — incrementar a string (ex: `v28-x` → `v29-y`). O `globalForPrisma` cache de hot-reload em dev cria uma instância nova só quando a versão muda. Sem bump, Turbopack continua usando client antigo (sem os novos models) mesmo após `db:generate`.

    c. **Marcar migration como aplicada** no histórico (se aplicada via `db execute` em vez de `migrate dev`) — `INSERT INTO _prisma_migrations (...)`. Sem isso, `prisma migrate status` reporta drift e o time perde tempo investigando.

    d. **Touch nos catch-all routes** — `touch src/app/api/auth/[...all]/route.ts src/app/api/rpc/[[...rest]]/route.ts`. Bug crônico do Turbopack 16.2.4: após auto-restart por memory threshold OU compile pesado OU regen do client, rotas `[...slug]` e `[[...rest]]` saem do index e devolvem 404 silencioso. Touch força reindex.

    **Checklist final OBRIGATÓRIO:** depois do(s) passo(s), validar via `curl -sI -m 10 http://localhost:3000/<rota-afetada>` que retorna 200/307 (não 404 nem 500). **Antes de devolver controle pro user**, fazer essa validação. Se ainda falhar, sugerir reiniciar `pnpm dev` (último recurso).

12. **Clean Code — nomes semânticos (OBRIGATÓRIO)** — nomes de variáveis e funções devem descrever o que representam/fazem; o nome é a documentação. Nunca use abreviações de uma letra ou genéricas em código novo.

    - **Proibido**: `p`, `d`, `c`, `b`, `u`, `a`, `o`, `m`, `e`, `res`, `acc`, `tmp`, `data`/`obj` soltos, `fn`/`cb` sem contexto. Exceções consagradas: `i`/`j` em índices de loop, `_` para descarte.
    - **Padrões do projeto**:
      - Payloads de entrada → `payload` (não `p`).
      - Conversores → verbo + tipo: `toNullableDate`, `toIso` (não `d`, `iso`).
      - Booleanos → prefixo `is`/`has`/`should`: `isSignatureValid`, `hasAccount` (não `ok`).
      - Resultado de `fetch` → `response` (não `res`); corpo lido → `responseText`/`responseBody`.
      - Funções que fazem POST/IO → verbo no nome: `postSyncEntity`, `resolveBaseUrl` (não `send`, `baseUrl`).
      - Callbacks de coleção → nome do item no singular: `(user) =>`, `(account) =>`, `(cursor) =>` (não `u`, `a`, `c`).
      - Constantes de configuração → unidade/intenção explícita: `PAGE_SIZE`, `TIMEOUT_MS` (não `PAGE`).
      - Parâmetro genérico de origem/contexto → nomeie o domínio: `sourceApp` (não `source`).
    - **Ao mexer em arquivo existente**, renomeie nomes ruins que tocar (boy-scout rule) — mas mantenha o escopo da renomeação dentro do que está sendo editado, sem PRs gigantes de rename.

13. **Comentários e tipagem (OBRIGATÓRIO)**
    - **Comentários**: nunca adicione blocos massivos de comentários inline nas implementações. Permita apenas um comentário curto no topo do arquivo quando o propósito não for óbvio pelo nome. Dentro de funções/componentes, comente somente o "por quê" quando for realmente não-óbvio — sem comentar o "o quê".
    - **Tipagem**: evite `any` ao máximo nas propriedades e assinaturas de funções. Prefira tipos explícitos, `unknown` + narrowing, generics ou `Record<string, ...>`. Use `any` somente quando a origem for verdadeiramente não-tipável (ex.: integrações externas sem tipos) e, nesses casos, isole com um alias explícito (`type RawWebhookPayload = Record<string, unknown>`).

14. **Documentação do WhatsApp Oficial (Meta Cloud API)** — sempre que criar ou atualizar qualquer coisa dentro de `src/http/whats-oficial/`, `src/features/tracking-chat/lib/providers/`, o webhook oficial (`src/app/api/chat/webhook/official/`), ou modelos Prisma relacionados ao provider de WhatsApp (ex.: `WhatsAppInstance.provider`, credenciais `meta*` cifradas, novos enums `WhatsAppProvider`), **atualize também [`docs/whatsapp-oficial-overview.md`](docs/whatsapp-oficial-overview.md)** na mesma sessão. Aplica-se a: novos clients HTTP, mudanças na PORT/adapters, novo handler de webhook, mudanças no pipeline canônico de inbound, schema/migrations, env vars, decisões de roadmap, novas fases concluídas. Mantenha tabelas de arquivos, roadmap/status (✅/🚧/⬜), contrato Meta API e changelog sincronizados com o código — o documento é a fonte de verdade do domínio e o canal de acompanhamento entre sessões. Espelha a mesma regra do item 10 (NASA Route).

15. **WhatsApp Oficial — fluxo normal via `main` (fases já integradas)** — as fases do roadmap (ver `docs/whatsapp-oficial-overview.md`) **já estão na `main`**. A branch de integração `feature/whatsapp-oficial-integration` foi aposentada; **não é mais usada**. Novas fases e ajustes do WhatsApp Oficial seguem o fluxo padrão do projeto (item Git Workflow): branch de fase nasce a partir da **`main`** atualizada (`/start`) e o PR da fase tem base **`main`** (`--base main`). Não retargete PRs para a branch de integração nem crie branches a partir dela.

16. **Visibilidade de campos no Kanban (OBRIGATÓRIO)** — todo **novo campo** exibido no card do lead (`src/features/trackings/components/lead-item.tsx`) ou na coluna (`src/features/trackings/components/status-header.tsx`) **deve** entrar no sistema de visibilidade personalizável, salvo se for realmente obrigatório (ex.: nome do lead — sempre visível). Ao adicionar um campo:

    a. **Registrar em `CARD_FIELDS`** (`src/features/trackings/lib/card-visibility.ts`) — adicionar `{ id, label, group: "card" | "column" }`. Isso automaticamente cria o toggle no Sheet "Personalizar board" (`components/modal/board-customize-sheet.tsx`), que itera sobre `CARD_FIELDS` — **não** é preciso editar o Sheet manualmente.

    b. **Envolver o render** do campo com `isFieldVisible(visibility, "<id>")` no componente correspondente (`lead-item.tsx` ou `status-header.tsx`), usando a mesma `visibility` já computada (`visibilityPreview` do tracking OU `cardConfig.cardVisibility`). Default ausente = visível (compat com trackings sem config).

    c. **Campos obrigatórios** (não-ocultáveis) ficam **fora** de `CARD_FIELDS` — não recebem toggle e renderizam sempre.

    Objetivo: nenhum campo novo pode voltar a poluir o board sem o usuário poder desligá-lo. Ver [`src/features/trackings/README.md`](src/features/trackings/README.md) para o fluxo completo.

17. **Spec Driven Development (OBRIGATÓRIO para mudanças relevantes)** — antes de implementar feature nova, mudança de schema ou bug que introduza caminho condicional sobre dados de produção, escreva a spec em `specs/<dominio>/` a partir de [`specs/TEMPLATE.md`](specs/TEMPLATE.md) e tenha-a revisada **antes** do código. Ver [`specs/README.md`](specs/README.md) para o fluxo, os dois pesos de spec (leve/completa) e a lista do que NÃO exige spec (typo, refactor sem mudança de comportamento, bump de dependência).

    **Teste decisivo**: a mudança cria um novo "depende de" sobre dados que já existem em produção? Se sim, escreva a spec — é exatamente esse tipo de mudança que gerou o 500 do submit de formulário (ver [`specs/form/0001-form-submit-lead-placement.md`](specs/form/0001-form-submit-lead-placement.md)).

    Regras de manutenção: cada critério de aceite (`CA-n`) vira ao menos um teste que cita o id no nome; divergiu da spec durante a implementação, **atualize a spec no mesmo PR** e registre no changelog dela. Spec desatualizada é pior que spec nenhuma — mente com autoridade.

18. **Transações Prisma contêm apenas escritas de banco (OBRIGATÓRIO)** — dentro de `prisma.$transaction(async (tx) => ...)` é proibido:

    - Chamar helper que usa o **cliente Prisma global** em vez do `tx` (ex.: `trackLeadEvent`, `recordLeadEvent`, `logActivity`). Rodando em outra conexão, uma query que toque linha travada pela própria transação espera por ela — que por sua vez espera a query. Espera circular resolvida só pelo timeout de 5s, virando **500**.
    - Fazer I/O de rede: `fetch`, Pusher, Inngest, envio de e-mail.

    **Padrão correto**: colete os efeitos numa lista dentro da tx (`pendingLeadEvents`, `pendingJourneyEvents`) e execute **após o commit**, best-effort — falha em efeito colateral não pode invalidar a submissão já persistida. Ver `src/app/router/form/public/submut-response.ts` como referência.

    Esse bug já custou dois PRs de correção que miravam a causa errada. Ao mexer em qualquer procedure com `$transaction`, confira essa regra antes de commitar.

19. **Documentação da evolução arquitetural** — sempre que criar ou alterar qualquer coisa em `src/modules/`, nas regras de fronteira (`.dependency-cruiser.js`), no CI (`.github/workflows/`), na configuração de testes (`vitest.config.*`, `playwright.config.*`, `docker-compose.test.yml`), ou ao concluir/reordenar uma fase do roadmap, **atualize também [`docs/arquitetura-evolucao-overview.md`](docs/arquitetura-evolucao-overview.md)** na mesma sessão — tabela de status, roadmap, decisões e changelog sincronizados com o código. Espelha as regras 10 (NASA Route) e 14 (WhatsApp Oficial).

    Documentos satélite, com a mesma obrigação: [`docs/seguranca-auditoria-2026-08.md`](docs/seguranca-auditoria-2026-08.md) (ao corrigir um item da auditoria, marque o status e registre o PR — **não apague o item**) e [`docs/testes-estrategia.md`](docs/testes-estrategia.md) (ao mudar runner, pipeline ou quality gate).

    **Antes de propor arquitetura, teste ou CI neste projeto, leia o overview.** Ele registra decisões já travadas — arquitetura alvo (Hexagonal seletivo, não Clean Architecture ampla), escopo (piloto `form`, não migração ampla) e o que foi deliberadamente descartado, com o porquê. Repropor algo já descartado sem novo argumento custa tempo do time.

20. **Deriva conhecida entre este arquivo e o código** — auditoria de 2026-08-18 encontrou divergências ainda não corrigidas. Enquanto não forem, **confie no código, não neste documento**, nestes pontos: procedures oRPC estão em `src/app/router/` (não em `src/server/`, que não existe); a Regra 9 tem 518 violações; a Regra 5 convive com Jotai além de Zustand; a Regra 17 é **inexequível** (não há runner de teste instalado); `.claude/settings.json` não existe (o hook `PreToolUse` descrito no Git Workflow não está ativo); `.env.example` e `prisma/migrations/MANUAL_*.sql` referenciados em `docs/DEPLOYMENT.md` não existem — `scripts/apply-prod-migrations.sh` quebra por causa disso. Lista completa em [`docs/arquitetura-evolucao-overview.md`](docs/arquitetura-evolucao-overview.md) §3.5. Corrigir a deriva é item da Fase 0.

21. **Guias do Astro na tela (OBRIGATÓRIO)** — o Astro ensina a usar a plataforma destacando botões e campos reais (spec [0046](specs/astro/0046-astro-guia-na-tela.md)), em vez de prints que envelhecem. Para isso continuar funcionando sozinho:

    a. **Botão ou campo relevante de tela nova** ganha âncora: registre em `GUIDE_ANCHORS` (`src/features/astro-guides/lib/anchors.ts`) com uma descrição curta e use `data-guide={GUIDE_ANCHORS.<chave>.id}` no componente.

    b. **Funcionalidade nova** ganha guia em `ASTRO_GUIDES` (`src/features/astro-guides/lib/registry.ts`): passos apontando para as âncoras, `topicPattern` com o assunto do pedido e, se houver artigo no Space Help, `spaceHelp` para o botão "Me mostre na tela" aparecer nele.

    c. **Ao mover, renomear ou remover** um componente com `data-guide`, rode `pnpm guides:check` — ele falha se algum guia ficou apontando para âncora que não existe mais.

    d. **Ação que termina um guia** (salvar lead, criar tracking) chama `emitTourResult({ kind: GUIDE_RESULT_KINDS.<tipo>, href? })` de `@/features/tour/store` no `onSuccess`. O `kind` diz o que foi feito: sem ele, qualquer ação encerraria qualquer guia (spec [0048](specs/astro/0048-astro-guia-em-outros-apps.md)). `pnpm guides:check` falha se um passo espera um tipo que nenhuma tela emite.

    e. **Guias por app** moram em `src/features/astro-guides/lib/guides/<app>.ts`. No `ASTRO_GUIDES`, assuntos mais específicos vêm antes (enviar/publicar antes de criar; Forge e Chat antes do Tracking).

22. **Tipo do cliente Prisma em parâmetros (OBRIGATÓRIO)** — função que aceita "cliente global ou transação" recebe `Prisma.TransactionClient` (ou `Pick<Prisma.TransactionClient, ...>`); se precisa de `$transaction`, recebe `AppPrismaClient` de `@/lib/prisma`. **Proibido**: o tipo público `PrismaClient` em anotações, união com o cliente, `Omit`/`Pick` de `typeof prisma`. Esses padrões fazem o TypeScript comparar os ~300 models estruturalmente — um único arquivo custava 63 s e a checagem de tipos passava de 12 GB, derrubando o build. O ESLint barra; os genéricos fixos em `src/lib/prisma.ts` não podem ser removidos. Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §0.1.

23. **Documentação da aba Contábil** — sempre que criar ou alterar qualquer coisa em `src/features/accounting/`, `src/app/router/accounting/`, `src/inngest/functions/accounting/`, nos modelos contábeis do `prisma/schema.prisma` (seção "ABA CONTÁBIL") ou nas tabelas de alíquotas (`lib/tax/seed/default-tax-rates.ts`), **atualize também [`docs/contabil-overview.md`](docs/contabil-overview.md)** na mesma sessão. Espelha as regras 10, 14 e 19. Regras do domínio: alíquota **nunca** fixa em código de cálculo (vem de `TaxRate`, versionada por vigência); a contabilidade é **derivada** do `PaymentEntry` (nunca escriturada em paralelo); toda explicação de termo técnico vem do glossário (`lib/glossary/terms.ts`) — novo rótulo técnico na aba exige `FiscalTermHint`; mudança em motor fiscal exige caso novo em `scripts/accounting-qa-check.ts` citando o `CA-n` da spec 0051.

24. **Build leve e deployável (OBRIGATÓRIO)** — o `next build` roda **fora da VPS**, sem banco e sem segredos: no CI de PR (`next build` direto no runner) e na imagem Docker do deploy (GitHub Actions → GHCR → Coolify). Em 2026-09-30 a checagem de tipos chegava a 12,8 GB e derrubava o deploy; hoje fica em ~6 GB e 96 s. Para não regredir:

    a. **Nada que exija variável de ambiente ou rede no import do módulo.** Na coleta de páginas o build carrega os módulos das rotas; cliente criado no topo do arquivo que lança erro sem chave (Resend) ou sem config (Pusher sem cluster) quebra o build. Crie sob demanda ou com placeholder, como `src/lib/stripe.ts` e `src/lib/email/resend.ts`.

    b. **`NEXT_PUBLIC_*` nova** é embutida no bundle **no build**: adicione ao secret `NEXT_PUBLIC_ENV` do GitHub (senão chega `undefined` no browser em produção, sem erro). Se ela for lida no import de algum módulo, adicione também um placeholder em `.github/ci-public.env` — o CI de PR não recebe secrets.

    c. **Página que consulta o banco no build** (`generateStaticParams`, `revalidate` com prerender) envolve a consulta em `try/catch` e degrada (ex.: `generateStaticParams` devolve `[]`). O build não tem banco.

    d. **Scripts e seeds avulsos** ficam em `scripts/` ou `prisma/`, que estão fora da checagem de tipos (rodam via `tsx`). Em `src/` eles entram no build — um seed sozinho custava 65 s.

    e. **Tipos do Prisma**: regra 22. É a causa principal de memória na checagem de tipos.

    f. **Lib pesada só de servidor** (SDK de IA, AWS, parsers, binários nativos) entra em `serverExternalPackages` no `next.config.ts`.

    g. **Medir antes de aceitar regressão.** O log do CI mostra `Finished TypeScript in Ns` (referência: ~96 s frio, ~18 s com cache). Passou de ~3 min, ou o build pediu mais memória: rode **Actions → Typecheck diagnostics**, que aponta os arquivos mais caros, antes de aumentar heap ou runner.

    h. **Migration nova roda no boot do container** (`docker/entrypoint.sh`) a cada deploy. Migration quebrada impede o container novo de subir (a versão anterior segue no ar, mas o deploy trava) — revise o SQL antes do merge.

    Detalhes, números e armadilhas do Coolify em [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §0 e §0.1; pipeline em [`docs/testes-estrategia.md`](docs/testes-estrategia.md) §8.0.

## Obsidian

Vault: `NASA Agents` em `/Users/weydsonlima/Documents/NASA Agents/`
Nota principal: `CLAUDE.md` no vault (cópia desta documentação + contexto extra)
