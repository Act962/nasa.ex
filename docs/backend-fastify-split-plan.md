# Plano: Separar o backend num serviço Fastify

> Documento de planejamento. Objetivo: deixar a ideia clara e em passos simples pra
> implementarmos depois. **Ainda não é pra codar** — é o mapa do caminho.

## 1. Por que estamos fazendo isso

Dois problemas concretos, hoje:

1. **Deploy lento** — backend e frontend moram no mesmo projeto Next. Mexer numa
   regra de backend obriga a rebuildar o frontend inteiro (63 features, React
   Compiler, libs pesadas como ffmpeg/langchain/livekit). Build longo a cada deploy.
2. **Não dá pra escalar o backend sozinho** — como é um processo só, pra aguentar
   mais carga de API a gente é obrigado a escalar o frontend junto (desperdício).

A causa dos dois é a **topologia**: está tudo grudado num processo. A solução é
**separar o backend num serviço próprio**, com deploy e escala independentes.

## 2. A ideia em uma frase

> Tirar a camada de API (oRPC) de dentro do Next e rodá-la num servidor **Fastify**
> separado, **reaproveitando exatamente o mesmo código de regras de negócio**.

O ponto-chave que torna isso barato: o nosso backend oRPC **não é acoplado ao Next**.

- Só **2 de 68 routers** importam algo de `next/*`.
- O handler de RPC já é web-standard (`Request`/`Response`).
- O contexto base é só `{ headers: Headers }`.

Ou seja: o `router` (com suas ~1.074 procedures) é praticamente "código puro" que
pode rodar em qualquer servidor Node. **Não vamos reescrever procedures.**

## 3. Por que NÃO NestJS

NestJS obrigaria a reescrever as ~1.074 procedures em controllers/decorators,
refazer a camada de autenticação e — pior — **perder a type-safety automática** que
o frontend tem hoje (o front importa o tipo do `router` e ganha tipos de input/output
de graça). Nest resolveria a escala, mas trocando uma vantagem real por meses de
reescrita.

Fastify resolve os **mesmos dois problemas** (deploy + escala) **mantendo o oRPC** e a
type-safety. Custo: dias/poucas semanas, não meses.

## 4. Como fica a arquitetura

**Hoje:**

```
┌──────────────────────────────────┐
│         Next.js (1 processo)      │
│  Frontend  +  API oRPC  +  Webhooks│  ← deploy e escala acoplados
└──────────────────┬───────────────┘
                   │
              PostgreSQL
```

**Depois:**

```
┌─────────────────┐      RPC over HTTP     ┌────────────────────────────┐
│  Next.js (front)│ ─────────────────────▶ │   API Service (Fastify)    │
│  só UI/SSR      │                        │   • o MESMO router oRPC     │
│  build pequeno  │                        │   • better-auth             │
│  deploy rápido  │                        │   • webhooks + Inngest      │
└─────────────────┘                        └──────────────┬─────────────┘
                                                          │
                                                     PostgreSQL
                                       (escala sozinho: + réplicas só na API)
```

## 5. O que move e o que fica

| Vai pro serviço Fastify | Continua no Next |
| --- | --- |
| `src/app/router/**` (todos os routers oRPC) | `src/app/**` páginas e componentes |
| `src/app/middlewares/**` (base, auth, org) | Server Components / SSR |
| `src/features/*/server/**` (lógica server) | Hooks que **consomem** `orpc.*` |
| Webhooks (`/api/**` Stripe, Asaas, Meta, OAuth) | UI inteira |
| Funções Inngest | |
| `prisma`, `better-auth`, clients (S3, stripe…) | |

> Organização escolhida: **monorepo com pnpm workspaces + Turborepo** (detalhado na
> seção 5.1). `apps/web` (Next) e `apps/api` (Fastify) compartilham um pacote
> `packages/server` com o `router` e um `packages/db` com o Prisma. O front importa
> **só os tipos** do router (continua type-safe) e o Fastify importa a implementação.

## 5.1. Estrutura do monorepo (pnpm workspaces + Turborepo)

São duas ferramentas com papéis diferentes — não se sobrepõem:

| Camada | Ferramenta | Faz o quê |
| --- | --- | --- |
| Linkar pacotes | **pnpm workspaces** | Faz `apps/web` enxergar `packages/server`. É isso que dá a type-safety compartilhada. **Já usamos pnpm.** |
| Orquestrar tasks + cache | **Turborepo** | Roda `build`/`lint`/`typecheck` em paralelo, com cache. Só rebuilda o que mudou. |

> **Turborepo roda EM CIMA do pnpm workspaces, não substitui.** O pnpm faz o link
> dos pacotes; o Turborepo só acelera builds/tasks. Dá pra começar só com pnpm
> workspaces e plugar o Turborepo depois.

**Por que o Turborepo ajuda direto na dor de deploy lento:**

- **Cache de tasks** — mexeu só na API? Não rebuilda o front (e vice-versa). Hoje
  rebuildamos tudo sempre.
- **`--filter`** — no deploy roda `turbo build --filter=api` ou `--filter=web` e
  builda só o app afetado.
- **Remote cache** — o CI reusa o build de quem não mudou. Com o front pesado que
  temos, isso corta minutos por pipeline.

**Estrutura de pastas:**

```
nasa-monorepo/
├── apps/
│   ├── web/          → Next.js (só UI/SSR)
│   └── api/          → Fastify (router oRPC + auth + webhooks + inngest)
├── packages/
│   ├── server/       → router oRPC, middlewares, lógica server das features
│   ├── db/           → schema.prisma + client Prisma gerado
│   └── shared/       → tipos/utils compartilhados front↔api
├── turbo.json        → pipeline de tasks (deps entre build/lint/typecheck)
└── pnpm-workspace.yaml
```

**Ressalva honesta:** monorepo + Turborepo resolvem **build/CI e compartilhamento de
código** — não fazem sozinhos a *separação de runtime*. A escala independente vem de
**deployar `apps/api` e `apps/web` como serviços separados** (seção 6). O monorepo só
deixa o compartilhamento do `router` ergonômico e o CI mais rápido.

> **Alternativa considerada:** Nx (mais poderoso, mais complexo) — overkill aqui.
> Turborepo é mais leve, do mesmo time do Next e integra melhor.

## 6. Passo a passo (fases)

Estratégia: **strangler** — sobe o serviço novo ao lado, valida um pedaço, e só
então move o resto. Nada de big-bang.

### Fase 0 — Montar o monorepo (pnpm workspaces + Turborepo)

- Criar `pnpm-workspace.yaml` com `apps/*` e `packages/*`.
- Mover o app Next atual pra `apps/web`.
- Extrair `src/app/router/**` + `src/app/middlewares/**` + lógica server das features
  pra `packages/server`; extrair `prisma/` pra `packages/db`.
- Ajustar imports (`@/app/router` → `@nasa/server`, etc.).
- Adicionar `turbo.json` com o pipeline (`build`/`lint`/`typecheck` e suas deps).
- Configurar `--filter` por app e (opcional) remote cache no CI.
- Definir `API_URL` por ambiente (dev/staging/prod).
- **Critério de pronto:** `apps/web` ainda builda e roda igual a hoje, só que
  importando o `router` de `packages/server`. (Ainda sem Fastify — só reorganização.)

### Fase 1 — Subir o esqueleto do Fastify

- Projeto Fastify **v5** novo (usar a major mais recente — `fastify@^5.5.0`; é o que o
  `fastify-type-provider-zod` exige como peer dep).
- Plugar o `RPCHandler` do oRPC no Fastify via adapter Node (`@orpc/server/node`).
- Servir o `router` atual em `/api/rpc`.
- Endpoint `/health`.
- **Tipagem Zod + OpenAPI desde o início** (ver 6.1.1): registrar o `ZodTypeProvider`,
  os compilers de validação/serialização e o `@fastify/swagger` + Scalar para as
  **rotas Fastify nativas** (health, webhooks). As procedures oRPC têm caminho próprio
  de doc (ver 6.1.2).

#### 6.1.1 Esqueleto Fastify v5 tipado com Zod + Scalar (rotas nativas)

Setup base do `apps/api` (rotas nativas: `/health`, webhooks Stripe/Asaas/Meta, e
qualquer REST novo). Stack e versões mínimas:

| Pacote | Versão | Papel |
| --- | --- | --- |
| `fastify` | `^5.5.0` | servidor (major atual) |
| `zod` | `>=4.1.5` (Zod 4) | schemas — **importar de `zod/v4`** |
| `fastify-type-provider-zod` | latest | liga Zod ao Fastify (validação + serialização + transform p/ OpenAPI) |
| `@fastify/swagger` | `>=9.5.1` | gera o documento OpenAPI a partir dos schemas Zod das rotas |
| `@scalar/fastify-api-reference` | latest | UI de referência da API em `/docs` |
| `@fastify/cors` | latest | CORS (ver 6.2.3 — com credenciais p/ auth) |

```ts
import { fastify } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { fastifySwagger } from "@fastify/swagger";
import { fastifyCors } from "@fastify/cors";
import ScalarApiReference from "@scalar/fastify-api-reference";
import { env } from "./env";

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// CORS: para o front autenticado, NÃO usar origin:true com credentials.
// Ver 6.2.3 — origem exata + credentials:true.
app.register(fastifyCors, {
  origin: [env.WEB_ORIGIN],            // https://orbita.nasaex.com
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.register(fastifySwagger, {
  openapi: {
    info: { title: "NASA API", description: "Backend NASA", version: "1.0.0" },
  },
  transform: jsonSchemaTransform,
});

app.register(ScalarApiReference, { routePrefix: "/docs" });

// Rotas nativas (cada uma é um plugin com schema Zod → vira doc automaticamente)
app.register(healthRoute);
// app.register(stripeWebhook); etc. (Fase 4)

app.listen({ port: env.PORT, host: "0.0.0.0" }).then(() => {
  console.log(`🔥 HTTP em http://localhost:${env.PORT}`);
  console.log(`🚀 OpenAPI/Scalar em http://localhost:${env.PORT}/docs`);
});
```

Cada rota nativa declara schema Zod e ganha doc + validação de graça:

```ts
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod/v4";

export const healthRoute: FastifyPluginAsyncZod = async (app) => {
  app.route({
    method: "GET",
    url: "/health",
    schema: {
      response: { 200: z.object({ status: z.literal("ok"), uptime: z.number() }) },
    },
    handler: async () => ({ status: "ok" as const, uptime: process.uptime() }),
  });
};
```

> **Atenção (Fase 4):** webhooks Stripe/Asaas/Meta precisam do **corpo cru** pra
> validar assinatura — nessas rotas, desligar o parser e ler o buffer; o schema Zod
> documenta a forma do payload, mas a validação de assinatura roda no raw body antes.

#### 6.1.2 Doc das procedures oRPC (caminho separado — importante)

O `@fastify/swagger`/`jsonSchemaTransform` **só enxerga rotas Fastify nativas** que
declaram `schema`. O `RPCHandler` do oRPC é um **catch-all opaco** — as ~1.074
procedures **não aparecem** no Scalar montado em 6.1.1. Para documentá-las existe o
gerador **nativo do oRPC** (`@orpc/openapi`), que lê o `router` e os schemas Zod das
procedures:

```ts
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { router } from "@nasa/server";

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(router, {
  info: { title: "NASA RPC", version: "1.0.0" },
});
// servir em /rpc/spec.json e apontar um segundo Scalar pra ele
```

> **Decisão pendente (não bloqueia a PoC):** queremos doc OpenAPI das procedures oRPC
> além das rotas nativas? Opções:
> 1. **Só rotas nativas** (health/webhooks) via `@fastify/swagger` — mais simples,
>    cobre o que não é oRPC. Recomendado pra Fase 1.
> 2. **+ Spec do oRPC** via `@orpc/openapi` num endpoint separado (`/rpc/docs`) —
>    documenta as procedures sem reescrever nada. Plugar quando houver demanda de doc
>    externa/consumidores não-TypeScript. O front **não precisa** disso (já tem
>    type-safety importando o tipo do `router`).

### Fase 2 — Autenticação (a parte mais delicada)

- Montar o handler do **better-auth** no Fastify.
- Resolver **sessão cross-origin**: hoje front e API ficam no mesmo domínio; ao
  separar (`orbita.nasaex.com` ↔ `api.nasaex.com`), o cookie de sessão precisa de
  `domain`/`sameSite`/`secure` configurados pra valer nos dois. **Esse é o maior
  risco técnico do projeto** — validar cedo.
- Configurar **CORS** (origem do front liberada, credenciais habilitadas).

#### 6.2.1 Decisão tomada: subdomínio no mesmo root (`api.nasaex.com`)

> ✅ **DECIDIDO:** front em **`orbita.nasaex.com`** ↔ API em **`api.nasaex.com`** —
> ambos subdomínios do mesmo root (`nasaex.com`). Topologia de cookie de baixo risco:
> `crossSubDomainCookies` com `domain: ".nasaex.com"` + `sameSite: "lax"`. **Não**
> vamos usar cookie de 3ª parte (`sameSite: "none"`/`partitioned`) nem domínios-raiz
> distintos.

Por que essa escolha (registro da decisão): a dificuldade do cookie depende da
topologia de domínio. As opções consideradas:

| Cenário | Exemplo | Dificuldade | Mecanismo | Decisão |
| --- | --- | --- | --- | --- |
| **Mesmo root domain** | front `orbita.nasaex.com` ↔ API `api.nasaex.com` | Baixa | `crossSubDomainCookies` + `sameSite: "lax"` | ✅ **escolhido** |
| Domínios distintos | front `nasaex.com` ↔ API `nasa-api.io` | Alta | `sameSite: "none"` + `secure` + `partitioned` (cookie de 3ª parte) | ❌ evitado |
| Mesma origem via proxy | `orbita.nasaex.com` + `orbita.nasaex.com/api/*` | Baixa | sem cross-origin, mas exige proxy na borda | ❌ não necessário |

> Cookie de terceira-parte (`sameSite: "none"`) está sendo progressivamente bloqueado
> por Safari/Chrome (Privacy Sandbox); exige `Partitioned` (CHIPS) e mesmo assim é
> frágil. O subdomínio evita essa classe inteira de problema.

#### 6.2.2 Config do better-auth (servidor, em `packages/server`/`apps/api`)

Montar o handler no Fastify (catch-all `/api/auth/*`), convertendo headers Node ↔ Web:

```ts
import Fastify from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "@nasa/server/auth";

const fastify = Fastify();

fastify.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const headers = fromNodeHeaders(request.headers);
    const req = new Request(url.toString(), {
      method: request.method,
      headers,
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    });
    const response = await auth.handler(req);
    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(response.body ? await response.text() : null);
  },
});
```

Config do `betterAuth` para o nosso caso (`api.nasaex.com`):

```ts
export const auth = betterAuth({
  baseURL: process.env.API_URL,          // https://api.nasaex.com
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: ".nasaex.com",             // root domain — vale p/ orbita.* e api.*
    },
    // sameSite "lax" basta entre subdomínios do mesmo root; não precisa "none"
    defaultCookieAttributes: { secure: true, sameSite: "lax" },
  },
  trustedOrigins: ["https://orbita.nasaex.com"],
});
```

Se um dia fosse inevitável usar **domínios distintos** (não é o caso — registro só por
contexto), os atributos do cookie mudariam para:

```ts
advanced: {
  defaultCookieAttributes: {
    sameSite: "none",      // obrigatório p/ cookie cross-site
    secure: true,          // "none" só funciona sobre HTTPS
    partitioned: true,     // CHIPS — novos browsers exigem p/ cookie de 3ª parte
  },
},
```

> `crossSubDomainCookies` **só resolve subdomínios** (deriva o `domain` do `baseURL`).
> Não cobre domínios totalmente diferentes — por isso o caminho distinto cai em
> `sameSite: "none"`/`partitioned`.

#### 6.2.3 CORS no Fastify (precisa aceitar credenciais)

A API precisa devolver `Access-Control-Allow-Credentials: true` e refletir a origem
exata do front (não pode ser `*` quando há credenciais):

```ts
import cors from "@fastify/cors";

await fastify.register(cors, {
  origin: ["https://orbita.nasaex.com"], // origem exata do front; "*" é proibido com credentials
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
});
```

#### 6.2.4 Cliente (front em `apps/web`) — enviar o cookie

Tanto o `authClient` quanto o `RPCLink` do oRPC precisam mandar credenciais
cross-origin (`credentials: "include"`):

```ts
// authClient
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,   // https://api.nasaex.com
  fetchOptions: { credentials: "include" },
});

// RPCLink do oRPC
const link = new RPCLink({
  url: `${process.env.NEXT_PUBLIC_API_URL}/api/rpc`,
  fetchOptions: { credentials: "include" },
});
```

> **Checklist de validação cedo (Fase 2/3):** login real num browser → cookie
> `better-auth.session_token` setado com `Domain=.nasaex.com`; refresh mantém sessão;
> `auth.api.getSession({ headers })` no Fastify resolve o usuário; chamada oRPC
> autenticada (ex.: `stars`) passa ponta a ponta. Testar em **Safari** também (é o
> mais agressivo com cookie cross-site).

### Fase 3 — PoC ponta a ponta

- Apontar o `RPCLink.url` do front pra `API_URL/api/rpc`.
- Testar **1 domínio real** logado (ex.: `stars` ou `forge`) ponta a ponta.
- Confirmar que a type-safety continua de pé (front compila importando o tipo do router).
- Medir tempo de deploy do front isolado vs antes.

### Fase 4 — Webhooks e Inngest

- Mover webhooks pro Fastify. **Atenção ao raw body**: Stripe/Asaas/Meta validam
  assinatura no corpo cru — em Fastify, desligar o parser JSON nessas rotas
  específicas e ler o buffer cru.
- Mover/registrar as 66 funções Inngest no serviço API.
- Atualizar URLs dos webhooks nos painéis (Stripe, Asaas, Meta).

### Fase 5 — Resolver acoplamentos com Next

- Os **2 routers** que importam `next/*`
  (`ia/ai-workspace/tools/create-action.ts` e
  `space-station/check-station-access.ts`): trocar `next/headers` & cia por
  equivalente vindo do `context`. Trivial.

### Fase 6 — Cortar pra produção

- Deploy dos dois serviços separados.
- Front com build enxuto (só UI) → deploy rápido.
- API escala sozinha (réplicas independentes).
- Monitorar e remover o código de API antigo do Next.

## 7. Pontos de atenção (onde mora o risco)

1. **Cookie de sessão cross-origin** (better-auth) — o item nº 1. Validar na Fase 2/3.
   A topologia de domínio (subdomínio vs domínio distinto, ver 6.2.1) define a config
   inteira: subdomínio usa `crossSubDomainCookies` + `sameSite: "lax"` (baixo risco);
   domínio distinto cai em `sameSite: "none"`/`secure`/`partitioned` (cookie de 3ª
   parte, sujeito a bloqueio de browser). **Preferir subdomínio.**
2. **Raw body nos webhooks** — Stripe/Asaas quebram se o corpo for parseado. Config
   por rota no Fastify.
3. **CORS + credenciais** — front precisa mandar cookie (`credentials: "include"` no
   `authClient` e no `RPCLink`); API precisa aceitar a **origem exata** com
   `Access-Control-Allow-Credentials: true` (`origin: "*"` é proibido com credenciais).
   Ver 6.2.3/6.2.4.
4. **Variáveis de ambiente** — hoje compartilhadas; separar quais vão pra cada serviço
   (a maioria das secrets vai pra API).
5. **Migrations** — continuam saindo do schema Prisma único; decidir qual serviço roda
   `migrate deploy` no deploy (provável: a API).

## 8. O que NÃO muda (importante pro time)

- **Zero reescrita de procedures** — o `router` é o mesmo.
- **Type-safety end-to-end continua** — o front segue importando o tipo do router.
- **Prisma, schema e banco** — idênticos.
- **better-auth** — mesmo lib, só re-hospedado.

## 9. Resultado esperado

- Deploy do frontend **rápido** (build só de UI).
- Deploy do backend **independente** do front.
- Backend **escala sozinho** (mais réplicas só na API conforme a carga).
- Sem perder a produtividade/type-safety atuais.

## 10. Próximo passo sugerido

Começar pela **PoC das Fases 1→3** (esqueleto Fastify + auth + 1 domínio logado),
porque ela prova o ponto de maior risco (cookie cross-origin) antes de a gente
comprometer o resto. Quando formos implementar, rodar `/start api separar-backend-fastify`.

## 11. Clean Architecture, SOLID e testes (faseamento)

> Decisão de **sequenciamento**, não de "se". Queremos Clean Architecture (use-cases,
> repositories, domain, adapters) + SOLID + testes (unit/integração/e2e). O ponto aqui
> é **quando** — e a resposta é: **não junto com a migração.**

### 11.1 Por que NÃO fazer junto com a separação

A premissa central deste plano é **"zero reescrita de procedures"** (seção 8). Clean
Architecture é, por definição, **reescrever** a lógica que hoje mora dentro das
procedures e dos `features/*/server` para use-cases + repositórios. Acoplar as duas
coisas transforma uma migração de **dias/semanas** numa refatoração de **meses** —
exatamente o custo que recusamos ao descartar o NestJS (seção 3).

**Regra:** são dois projetos distintos. Primeiro separa (procedures intactas), depois
refatora.

### 11.2 Ordem recomendada

1. **Primeiro — a separação (Fases 0→6), procedures como estão.** Entrega os dois
   ganhos reais (deploy + escala) com risco baixo, sem tocar na lógica de negócio.
2. **Depois — Clean Architecture incremental, por domínio (strangler de novo).** Com o
   split estável em produção, refatorar **um domínio de cada vez**, começando pelos de
   maior dor de manutenção — nunca os 68 routers de uma vez.

A Fase 0 já é o primeiro passo da separação core/infra: `packages/server` (lógica) já
nasce separado de `packages/db` (Prisma). E a procedure oRPC é uma fronteira
naturalmente boa — na arquitetura alvo ela vira o **adapter fino** que delega pro
use-case. O caminho é compatível e gradual, sem big-bang.

### 11.3 Arquitetura alvo (quando for a hora, por domínio)

```
packages/server/src/<domínio>/
├── domain/          → entidades, value objects, regras puras (sem Prisma, sem oRPC)
├── application/     → use-cases (orquestram domínio + repos via interface)
├── infra/           → repos Prisma, clients (S3/Stripe), adapters concretos
└── http/            → procedure oRPC = adapter fino: valida input (Zod) → chama use-case
```

**SOLID na prática (o que de fato separa core de infra):** o use-case depende de uma
`interface Repository` (porta), não do Prisma. A implementação Prisma mora em `infra` e
é injetada (DIP). É isso que destrava o teste unitário sem banco e a manutenção.

### 11.4 Testes — não tratar como bloco único

Parte dos testes **vale puxar pra cedo** (independe da Clean Architecture); outra parte
**vem junto da refatoração**:

| Tipo | Quando | Por quê |
| --- | --- | --- |
| **E2E do cookie cross-origin** (auth) | **Fase 2/3 — cedo** | É o teste que prova o risco nº 1 da migração. Tem que existir já. |
| **Integração de fumaça** (`RPCHandler` + 1 procedure autenticada ponta a ponta) | **Fase 3 — cedo** | Garante que o adapter Fastify + oRPC + auth fecha o circuito. |
| **Unitários de use-case/domain** | **Junto da Clean Arch (11.2, passo 2)** | Só fazem sentido com a lógica extraída em use-cases puros (repos fakeados). Testar procedure que ainda chama Prisma direto = mock frágil, baixo valor. |
| **Integração de repositório** (repo Prisma contra banco de teste) | Junto da Clean Arch | Valida a impl concreta da porta depois que a interface existe. |

> **Resumo:** e2e/integração **da migração** vêm cedo (Fase 2/3); unitários **do core**
> vêm com a Clean Architecture. Não bloquear a separação esperando a suíte completa.
