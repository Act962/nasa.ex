# N.A.S.A — Plataforma de Tracking de Leads

Uma aplicação web para gestão de organizações, funis de vendas (trackings), estágios (status) e leads, com autenticação, IA integrada, quadro Kanban com arrastar‑e‑soltar, agenda, workflows visuais, formulários, integrações WhatsApp e muito mais.

## Stacks

- **Framework:** Next.js `16` (App Router)
- **Linguagem:** TypeScript `5`
- **UI:** Tailwind CSS `4`, Radix UI, componentes `shadcn/ui`
- **Estado:** Zustand, Jotai
- **Formulários e validação:** React Hook Form + Zod
- **Dados:** TanStack Query e TanStack Table
- **Editor de texto:** TipTap
- **Drag & Drop:** `@dnd-kit`
- **Workflow visual:** `@xyflow/react` (React Flow)
- **Gráficos:** Recharts
- **Calendário:** `react-big-calendar`
- **RPC:** `orpc` (client/server) com handler em `/api/rpc`
- **Autenticação:** `better-auth` (email/senha e Google OAuth)
- **Banco de dados:** PostgreSQL + Prisma `7`
- **IA:** Vercel AI SDK (`ai`), Google AI, OpenAI, OpenRouter
- **Jobs em background:** Inngest
- **Tempo real:** Pusher
- **Armazenamento de arquivos:** AWS S3
- **E-mail:** Resend + React Email
- **WhatsApp:** Integração via UazAPI
- **Infra:** Docker Compose para Postgres

## Requisitos

- Node.js `>=22`
- pnpm (o projeto usa `pnpm-lock.yaml`)
- Docker (opcional, para banco local)

## Configuração

Instalar dependências:

```bash
pnpm install
```

Variáveis de ambiente: copie o exemplo e ajuste os valores.

- Linux/macOS:
  ```bash
  cp .examplo.env .env
  ```
- Windows (PowerShell):
  ```powershell
  Copy-Item .examplo.env .env
  ```

Campos do `.env`:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão Postgres |
| `BETTER_AUTH_SECRET` | Segredo aleatório para autenticação |
| `BETTER_AUTH_URL` | Base URL da aplicação (ex.: `http://localhost:3000`) |
| `NEXT_PUBLIC_BASE_URL` | Base URL pública do cliente (ex.: `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Credencial OAuth Google (opcional) |
| `GOOGLE_CLIENT_SECRET` | Credencial OAuth Google (opcional) |
| `AWS_ACCESS_KEY_ID` | Chave de acesso AWS S3 |
| `AWS_SECRET_ACCESS_KEY` | Segredo AWS S3 |
| `AWS_REGION` | Região AWS S3 |
| `AWS_BUCKET_NAME` | Nome do bucket S3 |
| `INNGEST_EVENT_KEY` | Chave de eventos Inngest |
| `INNGEST_SIGNING_KEY` | Chave de assinatura Inngest |
| `PUSHER_APP_ID` | App ID Pusher |
| `PUSHER_KEY` | Chave pública Pusher |
| `PUSHER_SECRET` | Segredo Pusher |
| `PUSHER_CLUSTER` | Cluster Pusher |
| `NEXT_PUBLIC_PUSHER_KEY` | Chave pública Pusher (cliente) |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Cluster Pusher (cliente) |
| `RESEND_API_KEY` | API Key do Resend para envio de e-mails |

## Banco de Dados

Subir Postgres com Docker:

```bash
docker-compose up -d
```

O serviço expõe `5432` e cria o banco `nasa_db` com usuário/senha `docker`.

Definir `DATABASE_URL` (exemplo local):

```
postgresql://docker:docker@localhost/nasa_db
```

Gerar cliente Prisma e aplicar migrações em desenvolvimento:

```bash
pnpm db:generate
pnpm db:migrate
```

Popular banco com dados de exemplo (seed):

```bash
pnpm db:seed
```

Abrir Prisma Studio (opcional):

```bash
pnpm db:studio
```

## Execução

Ambiente de desenvolvimento:

```bash
pnpm dev
```

Todos os serviços em paralelo (Next + Inngest):

```bash
pnpm dev:all
```

Setup inicial completo (migrate + generate + install):

```bash
pnpm dev:setup
```

Produção (build e start):

```bash
pnpm build
pnpm start
```

O `build` executa `prisma generate` e `prisma migrate deploy` antes de compilar.

## Scripts úteis

| Script | Descrição |
|---|---|
| `pnpm dev` | Inicia o servidor Next em modo dev |
| `pnpm dev:all` | Inicia Next + Inngest em paralelo via mprocs |
| `pnpm dev:setup` | Migração, geração do cliente Prisma e install |
| `pnpm build` | Build de produção (gera cliente + aplica migrações) |
| `pnpm start` | Inicia a aplicação em produção |
| `pnpm lint` | Roda o ESLint |
| `pnpm inngest:dev` | Inicia o Inngest Dev Server |
| `pnpm db:generate` | Gera o cliente Prisma |
| `pnpm db:migrate` | Migrações em desenvolvimento |
| `pnpm db:seed` | Popula o banco com dados iniciais |
| `pnpm db:studio` | UI do banco via Prisma Studio |

## Funcionalidades

- **Organizações:** Crie e gerencie organizações; cada org isola seus dados.
- **Trackings (funis):** Defina funis de vendas com nome, descrição e configurações de IA.
- **Status (Kanban):** Crie estágios, ordene-os e visualize no board com drag & drop.
- **Leads:** Crie, edite e acompanhe leads com temperatura, responsável, tags, arquivos e histórico.
- **Kanban:** Arraste cartões entre colunas; suporte a ordenação por posição, criação ou última modificação.
- **Tags:** Crie e associe tags coloridas para classificação de leads.
- **Motivos de ganho/perda:** Configure razões e marque o resultado dos leads.
- **Ações (tarefas):** Crie ações e sub-ações vinculadas a leads, com responsáveis e participantes.
- **Contatos:** Gerenciamento de contatos associados a leads.
- **Agenda:** Calendário de compromissos com disponibilidade e responsáveis.
- **Formulários:** Construa formulários de captura de leads integrados ao tracking.
- **Insights:** Painel analítico com métricas e gráficos do funil.
- **Workflows:** Editor visual de automações (React Flow) com nós e conexões.
- **Conversas:** Chat integrado com histórico de mensagens por lead.
- **WhatsApp:** Integração via UazAPI para instâncias WhatsApp por organização.
- **IA:** Assistente de IA nos trackings (Google AI, OpenAI, OpenRouter) via Vercel AI SDK.
- **Arquivos:** Upload e gestão de arquivos por lead via AWS S3.
- **E-mail:** Envio transacional via Resend com templates React Email.
- **Jobs:** Tarefas em background e workflows assíncronos via Inngest.
- **Tempo real:** Notificações e atualizações ao vivo via Pusher.
- **Pesquisa e tabela:** Filtragem, paginação e análise de leads em visão tabular.

## Estrutura de Pastas (resumo)

```
src/
├── app/
│   ├── (auth)/          # Páginas de login e cadastro
│   ├── (home)/          # Landing page
│   ├── (platform)/
│   │   ├── (orgs)/      # Gestão de organizações
│   │   └── (tracking)/  # Área principal: kanban, leads, agenda, insights, forms, settings
│   ├── api/
│   │   ├── auth/        # Endpoints de autenticação (better-auth)
│   │   ├── rpc/         # Handler RPC (orpc)
│   │   ├── inngest/     # Handler de jobs Inngest
│   │   ├── s3/          # Endpoints de upload S3
│   │   └── workflows/   # Endpoints de workflows
│   ├── middlewares/     # Middlewares RPC (auth, base)
│   └── router/          # Rotas RPC por domínio (leads, trackings, status, tags, reasons, agenda, etc.)
├── components/          # UI e componentes de aplicação
├── lib/                 # Auth, cliente orpc, prisma, utilitários
└── generated/           # Cliente Prisma gerado
prisma/
├── schema.prisma        # Schema do banco de dados
└── migrations/          # Histórico de migrações
public/                  # Assets estáticos
```

## Endpoints e RPC

- **RPC:** `POST /api/rpc` — expõe as rotas definidas em `src/app/router`
- **Auth:** `GET|POST /api/auth/*` — handlers do `better-auth`
- **Inngest:** `GET|POST /api/inngest` — handler de jobs em background
- **S3:** `POST /api/s3` — geração de URLs pré-assinadas para upload

## Rotas RPC disponíveis

`leads`, `trackings`, `status`, `tags`, `reasons`, `org`, `insights`, `agenda`, `conversation`, `message`, `integrations`, `ia`, `form`, `widgets`, `workflow`, `rodizio`

## Notas de Autenticação

- Email/senha e Google OAuth estão configurados; defina `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` para ativar o login social.
- Ajuste `BETTER_AUTH_URL` e `NEXT_PUBLIC_BASE_URL` para o ambiente (dev/prod).

## Licença

Uso interno/demonstrativo. Ajuste conforme sua necessidade.
