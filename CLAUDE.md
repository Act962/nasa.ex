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
- `AI_SECRETS_KEY` — chave (≥16 chars) usada para criptografar API keys customizadas de IA em `AiSettings.aiApiKey` (AES-256-GCM via `src/lib/crypto.ts`). Obrigatória se algum tracking configurar provider customizado (BYO).
- `SYNC_SHARED_SECRET` — chave master HMAC do sync bidirecional de auth NASA ↔ NERP (`feature/sync`). **Mesmo valor** nos dois apps (`openssl rand -hex 32`). Assina/verifica `User/Account/Organization/Member` replicados via `src/features/sync/lib/system-cred.ts`.
- `SYNC_API_KEY` — identifica o caller app↔app no sync (mesmo valor nos dois).
- `NERP_BASE_URL` — base do NERP (mesma usada pela integração por-org e pelo sync). O sync (`src/http/sync-nerp/client.ts`) entrega em `NERP_BASE_URL + /api/sync/nasa`; `NERP_SYNC_BASE_URL` é override opcional caso o sync precise de um host diferente.

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

## Obsidian

Vault: `NASA Agents` em `/Users/weydsonlima/Documents/NASA Agents/`
Nota principal: `CLAUDE.md` no vault (cópia desta documentação + contexto extra)
