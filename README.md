# N.A.S.A — Plataforma de Tracking de Leads

Uma aplicação web para gestão de organizações, funis de vendas (trackings), estágios (status) e leads, com autenticação, pesquisa avançada e quadro Kanban com arrastar‑e‑soltar.

## Stacks

- Framework: Next.js `16` (App Router)
- Linguagem: TypeScript `5`
- UI: Tailwind CSS `4`, Radix UI, componentes `shadcn/ui`
- Estado: Zustand
- Formulários e validação: React Hook Form + Zod
- Dados: TanStack Query e TanStack Table
- Editor de texto: TipTap
- Drag & Drop: `@dnd-kit`
- RPC: `orpc` (client/server) com handler em `/api/rpc`
- Autenticação: `better-auth` (email/senha e Google OAuth)
- Banco de dados: PostgreSQL + Prisma `7`
- Infra: Docker Compose para Postgres

## Requisitos

- Node.js `>=20`
- Docker (opcional para banco local)
- NPM (o projeto usa `package-lock.json`)

## Configuração

- Instalar dependências:
  ```bash
  npm install
  ```
- Variáveis de ambiente: copie o exemplo e ajuste os valores.
  - Linux/macOS:
    ```bash
    cp .examplo.env .env
    ```
  - Windows (PowerShell):
    ```powershell
    Copy-Item .examplo.env .env
    ```
  - Campos do `.env`:
    - `DATABASE_URL` — string de conexão Postgres
    - `BETTER_AUTH_SECRET` — segredo aleatório
    - `BETTER_AUTH_URL` — base URL da aplicação (ex.: `http://localhost:3000`)
    - `NEXT_PUBLIC_BASE_URL` — base URL pública do cliente (ex.: `http://localhost:3000`)
    - `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` — credenciais OAuth (opcional)

## Banco de Dados

- Subir Postgres com Docker:
  ```bash
  docker-compose up -d
  ```
  O serviço expõe `5432` e cria o banco `nasa_db` com usuário/senha `docker`.
- Definir `DATABASE_URL` (exemplo local):
  ```
  postgresql://docker:docker@localhost/nasa_db
  ```
- Gerar cliente Prisma e aplicar migrações em desenvolvimento:
  ```bash
  npm run db:generate
  npm run db:migrate
  ```
- Opcional: abrir Prisma Studio:
  ```bash
  npm run db:studio
  ```

## Execução

- Ambiente de desenvolvimento:
  ```bash
  npm run dev
  ```
- Produção (build e start):
  ```bash
  npm run build
  npm run start
  ```
  O `build` executa `prisma generate` e `prisma migrate deploy` antes de compilar.

## Scripts úteis

- `npm run dev` — inicia o servidor Next em modo dev
- `npm run build` — gera build de produção e aplica migrações (deploy)
- `npm run start` — inicia a aplicação em produção
- `npm run lint` — roda o ESLint
- `npm run db:generate` — gera o cliente Prisma
- `npm run db:migrate` — migrações em desenvolvimento
- `npm run db:studio` — UI do banco via Prisma Studio

## Como Usar

- Acessar `http://localhost:3000`.
- Criar conta e entrar:
  - Email/Senha e opcionalmente Google OAuth.
- Criar organização:
  - Acesse a área de organizações e crie sua org para habilitar recursos.
- Criar tracking (funil):
  - Defina nome e descrição do funil da organização.
- Definir status (colunas do Kanban):
  - Crie estágios e ordene conforme seu processo.
- Adicionar leads:
  - Crie leads, edite dados, associe ao tracking e status.
- Organizar no Kanban:
  - Arraste cartões entre colunas para alterar estágio/ordem.
- Tags em leads:
  - Crie e associe tags para classificação.
- Motivos de ganho/perda:
  - Configure razões e marque o resultado dos leads.
- Pesquisa e tabela:
  - Use a busca e tabela para filtrar, paginar e analisar.

## Estrutura de Pastas (resumo)

- `src/app` — páginas, layouts e rotas API (Next App Router)
- `src/app/api/auth` — endpoints de autenticação
- `src/app/api/rpc` — handler RPC (`orpc`)
- `src/app/router` — rotas RPC de domínio (leads, trackings, status, tags, reasons)
- `src/components` — UI e componentes de aplicação
- `src/lib` — auth, cliente/query, prisma, utilitários
- `prisma/` — schema, migrações e configuração
- `public/` — assets estáticos

## Endpoints e RPC

- RPC: `POST /api/rpc` — expõe as rotas definidas em `src/app/router`
- Auth: `GET|POST /api/auth/*` — handlers do `better-auth`

## Notas de Autenticação

- Email/senha e Google estão configurados; defina `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` para ativar o login social.
- Ajuste `BETTER_AUTH_URL` e `NEXT_PUBLIC_BASE_URL` para o ambiente (dev/prod).

## Licença

- Uso interno/demonstrativo. Ajuste conforme sua necessidade.

