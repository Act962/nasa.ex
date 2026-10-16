# Estado atual da arquitetura — reaferição de 2026-10-13

> Complementa [`../arquitetura-evolucao-overview.md`](../arquitetura-evolucao-overview.md), que segue
> sendo a fonte de verdade (regra 19 do `CLAUDE.md`). A auditoria original é de 2026-08-18, sobre o
> commit `f67796d2`. Este documento mede de novo, oito semanas e 314 commits depois, sobre `7ead1bb6`,
> e registra só o que mudou ou o que a primeira auditoria não viu. O diagnóstico qualitativo
> (§3 do overview) continua válido e não é repetido aqui.
>
> Nenhum arquivo de código foi alterado nesta reaferição.
>
> **Ressalva (2026-10-13, mesmo dia):** o commit medido, `7ead1bb6`, estava 71 commits atrás da
> `main` remota. Depois do merge, as medidas de fronteira são piores que as desta página: 87 features
> (eram 84), 74 pares de features mutuamente dependentes (57), maior grupo interdependente com 60
> features (56), 65 imports contra as camadas (58). Só `orpc.*` fora de hook melhorou: 690 em 312
> arquivos (726 em 321). As demais tabelas não foram refeitas; os números oficiais passam a ser os de
> `pnpm arch:features`.

## 1. Resumo

O plano de agosto está correto e quase nada dele foi executado. Enquanto isso o sistema cresceu cerca
de um quarto, todo na forma antiga. A dívida que o plano descreve não está parada: ela cresce na
mesma velocidade do produto.

| | Agosto | Hoje |
| --- | --- | --- |
| Fase 0 (contenção de segurança) | não iniciada | não iniciada: 2 de 20 itens originais fechados, e por acaso (achados durante outro trabalho) |
| Testes automatizados | 0 | 0, sem runner instalado |
| Regras de fronteira no CI | 0 | 0 (`.dependency-cruiser.js` não existe, embora a regra 19 o cite) |
| CI | não existia | existe: `next build` com checagem de tipos em todo PR |
| `src/modules/` | não existia | 1 módulo (`social`), 3,6 mil linhas, na forma alvo |
| Features novas desde a auditoria | — | 19, das quais 1 nasceu em `src/modules/` |

O que funcionou nesse período foi o que virou regra automática: a checagem de tipos caiu de 12,8 GB
para 6 GB e uma regra de ESLint impede a volta; o débito de Stars fora do ponto único virou erro de
lint. O que ficou como intenção em documento (Fase 0, "módulo novo nasce em `modules/`") não andou.
Isso confirma a decisão D7 do overview e orienta a ordem do plano em
[`migration-plan.md`](migration-plan.md).

## 2. Medidas

Comandos usados estão no §7. Onde o método difere do da auditoria original, a linha diz.

### 2.1 Tamanho

| Métrica | 2026-08-18 | 2026-10-13 | Variação |
| --- | ---: | ---: | ---: |
| Linhas não vazias em `src/` (sem `generated/`) | 536.511 | 674.051 | +26% |
| Arquivos `.ts`/`.tsx` | 3.651 | 5.300 | +45% |
| Features em `src/features/` | 65 | 84 | +19 |
| Arquivos em `src/app/router/` | 925 | 1.139 | +23% |
| `.handler(` no router | ~1.027 | 1.383 | +35% |
| Route handlers em `src/app/api/` | 73 | 98 | +34% |
| Models Prisma / enums | 240 / 92 | 329 / 174 | +37% / +89% |
| Migrations | 181 | 245 | +64 |
| Funções Inngest (`createFunction`) | 68 | 117 | +72% |
| Specs em `specs/` | 6 | 86 | +80 |

### 2.2 Qualidade e fronteiras

| Sinal | 2026-08-18 | 2026-10-13 | Leitura |
| --- | ---: | ---: | --- |
| Testes automatizados | 0 | 0 | Sem runner. Há 5 scripts `scripts/*-qa-check.ts` (1.035 linhas) fazendo o papel |
| `throw errors.X;` sem invocação | 228 | 272 | Piorou. 103 devolvem 500 no lugar de 404/403/400/401 (eram 90) |
| `console.*` | 724 | 1.003 | Piorou |
| `eslint-disable` | 291 | 332 | Piorou |
| `: any` / `as any` | 1.215 | 1.145 | Melhorou um pouco |
| `"use client"` | 1.250 | 1.827 | Acompanha o crescimento |
| Procedures com `.output()` | 171 (17%) | 370 (27%) | Melhorou |
| `orpc.*` fora de `hooks/` (regra 9) | 518 | 725 em 321 arquivos | Piorou em número absoluto |
| `orpc.*` dentro de `hooks/` | 785 | 1.502 | Conformidade subiu de 60% para 67% |
| Autenticadas sem menção a organização | ~175–190 | 183 | Igual. Mesma heurística do §10 do overview |
| `$transaction` (interativas) | 160 (74) | 180 (108) | Mais superfície para a regra 18 |
| Import de `next/*` ou `react` no router | 3 | 3 | Router segue independente de framework |

A contagem da regra 9 usa regex própria e pode não bater com a original linha a linha. A direção
(mais violações absolutas, proporção melhor) é o dado confiável.

### 2.3 Onde o Prisma é importado

A auditoria contou chamadas (`8.877`). Contar arquivos que importam `@/lib/prisma` é mais estável:

| Camada | Arquivos que importam o cliente |
| --- | ---: |
| `src/app/router/` | 930 de 1.139 |
| `src/features/` (só `.ts`; nenhum `.tsx`) | 523 |
| `src/inngest/` | 83 de 118 |
| `src/app/api/` | 58 |
| `page.tsx` / `layout.tsx` | 50 |
| `src/modules/` | 3, todos em `infra/` |

Nenhum componente React importa o cliente. A fronteira client/server continua intacta.

## 3. Mapa de módulos e dependências

### 3.1 Camadas reais

```
src/app/(rotas)      pages e layouts        50 falam com o Prisma direto
src/app/api          98 route handlers      58 falam com o Prisma direto
src/app/router       1.139 procedures oRPC  930 falam com o Prisma direto
src/app/middlewares  11 arquivos, 453 linhas: auth, org, permissão, stars
src/features         84 pastas              UI + lógica de servidor misturadas
src/modules          shared + social        única área com domínio, ports e adapters
src/inngest          117 funções            83 arquivos com Prisma direto
src/http             13 clients externos
src/lib              infra global
src/proxy.ts         142 linhas: cookies de UTM/parceria e domínio próprio. Sem headers de segurança
```

Arquivos de cada camada que importam cada outra (medido por `from "@/..."`):

| De ↓ / Para → | lib | features | components | router | inngest | http | modules |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| features | 1.631 | 1.194 | 1.211 | **12** | 117 | 54 | 11 |
| router | 938 | 411 | — | 13 | 26 | 76 | 4 |
| api | 74 | 61 | — | 2 | 10 | 5 | 1 |
| inngest | 84 | 78 | — | 3 | 100 | 17 | 1 |
| lib | 11 | **3** | 1 | **3** | 1 | 4 | — |
| components | 89 | **14** | 41 | — | — | — | — |
| http | 3 | **2** | — | — | — | — | — |
| modules | 4 | 1 | — | — | — | — | 9 |

Em negrito, dependências na direção errada (comprovadas):

- `src/lib/auth.ts` importa três features (`org-defaults`, `billing`, `stars`). A infra de
  autenticação conhece regras de negócio de plano e ciclo mensal.
- `src/lib/ai/ideogram-client.ts` importa um helper de dentro do router do Planner.
- `src/lib/anthropic-key.ts` e `src/lib/realtime/channel-authorizers.ts` importam features.
- 14 arquivos de `src/components/` (sidebar, modais globais) importam features.
- 12 arquivos de `src/features/` importam `src/app/router/`, entre eles
  `form/server/lib/generate-actions-for-response.ts`, que está no caminho do piloto.
- `src/http/sync-nerp` e `src/http/ecosystem-sync` importam `features/sync`.

`lib/orpc.ts` importar o router é esperado: é como o client tipado nasce.

### 3.2 Grafo entre features

| Medida | Valor |
| --- | ---: |
| Imports `@/features/*` | 2.647 |
| Cruzando fronteira de feature | 1.313 (50%) |
| Arestas distintas feature → feature | 410 |
| Pares mutuamente dependentes (A importa B e B importa A) | **57** |
| Maior componente fortemente conectado | **56 das 84 features, 471 mil linhas** |

A auditoria de agosto descrevia um cluster de 9 features e 27 ciclos. O método aqui é outro (imports
estáticos, incluindo `import type`), então os números não são diretamente comparáveis. A conclusão é
que mudou de escala: não há mais um cluster ruim cercado de features isoláveis. Dois terços das
features pertencem a um único componente em que todas alcançam todas.

Hubs, por número de features que os importam e que eles importam:

| Feature | Importada por | Importa | Linhas | Leitura |
| --- | ---: | ---: | ---: | --- |
| `astro-guides` | 30 | 2 | 3.137 | Núcleo compartilhado de fato (âncoras de guia) |
| `tour` | 23 | 0 | 1.057 | Núcleo compartilhado de fato |
| `stars` | 21 | 2 | 4.499 | Núcleo compartilhado de fato (cobrança) |
| `tracking-chat` | 21 | 23 | 28.579 | Hub bidirecional, como em agosto |
| `leads` | 19 | 19 | 11.340 | Hub bidirecional |
| `astro` | 18 | 23 | 42.796 | **Novo.** 15 pares mútuos: o maior nó do grafo |
| `insights` | 18 | 10 | 23.849 | Deveria ser consumidor, é importado por 18 |
| `admin` | 17 | 11 | 19.868 | Idem. `logActivity` mora aqui |
| `trackings` | 14 | 16 | 10.677 | Hub bidirecional |
| `form` (piloto) | 7 | 11 | 24.997 | Dentro do componente; pares mútuos com `leads`, `trackings`, `tracking-chat`, `actions`, `admin` |

`astro` não existia como hub em agosto. Hoje é a maior feature (42,8 mil linhas), a mais alterada
desde a auditoria (5 dos 15 arquivos com mais commits) e tem dependência mútua com 15 outras
(`accounting`, `nasa-command`, `astro-commander`, `insights`, `nasa-planner`, entre outras). O plano
de agosto não a menciona.

### 3.3 `src/modules/` na prática

O módulo `social` valida a forma alvo com código real:

- `domain/` não importa Prisma, Zod, Next nem React (verificado por busca: zero ocorrências).
- Repositórios só existem a partir de um `TenantScope` (`createSocialRepositories(tenant)`).
- 17 arquivos de fora consomem o módulo (router, webhook, Planner, chat, um job Inngest).
- `scripts/social-accounts-qa-check.ts` troca o gateway real por um falso pelo port e roda os critérios
  da spec contra o Postgres local. É um teste de integração escrito sem runner.

Desvios pequenos: `infra/stars-ai-reply-generator.ts` importa `features/stars` (aceitável em `infra`,
mas é a única aresta módulo → feature) e `process-channel-events.ts` está na raiz do módulo, fora das
quatro pastas.

## 4. Fluxos de ponta a ponta

| Fluxo | Caminho | Observação |
| --- | --- | --- |
| Tela autenticada | componente → hook → `orpc.*` → `/api/rpc` → middlewares → handler → Prisma | 33% das chamadas pulam o hook |
| Página pública ou admin | `page.tsx` (RSC) → Prisma | 50 arquivos, sem procedure no meio |
| Webhook | `app/api/**/route.ts` → Prisma, Inngest, Pusher | Validação de assinatura depende de cada rota (§5) |
| Trabalho assíncrono | `inngest.send` → função → Prisma e clients HTTP | 117 funções; "idempotency" aparece em 13 linhas do repo |
| Submit de formulário (piloto) | `router/form/public/submut-response.ts` (775 linhas) | Importa 17 módulos: Prisma, Inngest, `logActivity`, event bus de alertas, realtime de leads, pontos, jornada |
| Módulo `social` | router → composition root → use case → ports → adapters | Único fluxo com ponto de troca de dependência |

Autenticação é better-auth; autorização é uma cadeia de middlewares oRPC por procedure
(`requiredAuthMiddleware` em 784 arquivos, `requireOrgMiddleware` em 436). Erros usam o mapa de
`base.ts`, cuja mensagem padrão de `BAD_REQUEST` ainda é "You are being ratee limited".

## 5. Segurança: o que continua aberto

Reverificado por leitura dos arquivos em `7ead1bb6`. Detalhes e checklist em
[`../seguranca-auditoria-2026-08.md`](../seguranca-auditoria-2026-08.md).

| Item | Estado em 2026-10-13 |
| --- | --- |
| S1 webhook Asaas de Stars | Aberto. O handler não lê nenhum header; `payment.value` não é comparado ao valor esperado |
| S2 `DELETE /api/s3/delete` | Aberto. Sem sessão. **Em uso** por 4 arquivos, então a correção é proteger, não remover |
| S3 `POST /api/upload-local` | Aberto. Aceita SVG por MIME e por extensão. **Em uso** por 9 arquivos |
| S4 webhooks Meta e domínio | Facebook: aberto. `domain-providers`: aberto, muda status de compra e dispara Inngest sem credencial. Instagram: a assinatura é repassada só ao ramo de comentários; o ramo de mensagens diretas processa sem conferir |
| S5 isolamento entre empresas | Aberto. As seis procedures citadas seguem só com `requiredAuthMiddleware` |
| S6 `new-nasa-partial` / `new-nasa-total` | Fechado em 2026-10-16 (spec 0112): exige login e usa o e-mail da sessão |
| S7 `external/new-lead` | Parcial em 2026-10-16 (spec 0112): sem `console.log`, corpo validado, coluna conferida, origem registrada. Ainda sem credencial |
| A1 `throw errors.X;` | Piorou: 272 |
| A2 headers de segurança | Aberto. `src/proxy.ts` existe e não define nenhum |
| A3 uploads S3 | Aberto |
| A4 validação de env | Aberto. `"sk_test_placeholder"` segue em `src/lib/stripe.ts:26` |
| M5 desafios WebAuthn em `Map` | Aberto |
| S8, A7, M6 | Fechados |

Isso responde o item aberto 8 do overview: `s3/delete` e `upload-local` estão em uso.

## 6. Problemas classificados

Todos os itens abaixo são comprovados por leitura ou medição, exceto os marcados como hipótese.

| # | Problema | Severidade | Impacto | Risco de regressão ao corrigir | Esforço | Prioridade |
| --- | --- | --- | --- | --- | --- | :-: |
| P1 | Rotas anônimas que movem dinheiro, apagam arquivos ou criam dados (S1, S2, S4, S6, S7) | Crítica | Perda financeira e de dados | Baixo: cada correção é local | Horas por rota | 1 |
| P2 | Zero testes e nenhum runner | Crítica | Toda mudança é verificada à mão; a regra 17 é inexequível | Nenhum (só adiciona) | 1 a 2 dias para o primeiro teste rodar no CI | 1 |
| P3 | Nenhuma regra de fronteira automatizada; a dívida cresce com o produto | Alta | +19 features na forma antiga em 8 semanas | Nenhum com baseline | 1 dia | 1 |
| P4 | Isolamento entre empresas depende de cada procedure lembrar (S5), 183 candidatas | Crítica | Vazamento entre clientes (LGPD) | Médio: guard errado bloqueia uso legítimo | 1 a 2 semanas, em lotes | 2 |
| P5 | 103 erros de negócio viram HTTP 500 (`throw errors.X;`) | Alta | Cliente não distingue "não existe" de "falhou" | Médio: muda o status visto pelo front | 1 dia com codemod | 2 |
| P6 | Regra de negócio dentro de handlers de 500 a 2.400 linhas, sem ponto de troca | Alta | Regra crítica só testável com banco, fila e realtime de pé | Alto sem testes de caracterização | Semanas por módulo | 3 |
| P7 | 56 features num único componente conectado | Alta | Nenhuma feature central pode ser extraída ou testada isolada | Médio | Contínuo | 3 |
| P8 | `astro` como hub bidirecional de 42,8 mil linhas, fora do plano | Alta | O nó mais alterado do sistema é o mais acoplado | Alto | A definir | 3 |
| P9 | Infra importando domínio (`lib/auth.ts` → 3 features; `admin` hospedando `logActivity`) | Média | Impede extrair `lib` e cria ciclos | Baixo | Dias | 4 |
| P10 | Helper com cliente global dentro de transação (`leads/create-lead-with-tags.ts:180`, regra 18) | Alta | 500 por espera circular até o timeout | Baixo | Horas, mais varredura das 108 transações interativas | 2 |
| P11 | Funções Inngest sem chave de idempotência | Alta (hipótese: nenhum incidente registrado) | Mensagem ou cobrança duplicada em retry | Baixo | Dias | 4 |
| P12 | Clients HTTP sem timeout: 261 `fetch(` para 35 usos de `signal` | Média (hipótese quanto ao efeito no pool) | Requisição presa segura conexão | Baixo | Dias | 4 |
| P13 | `src/lib/prisma.ts` é o arquivo mais alterado do repo (33 commits em 8 semanas) por causa do `SCHEMA_VERSION` | Baixa | Conflito de merge constante | Baixo | Horas (derivar a versão do hash do schema) | 5 |
| P14 | 353 de 366 commits dos últimos 3 meses vêm de 2 pessoas | Organizacional | Qualquer plano que dependa de muitas mãos não fecha | — | — | — |

Correção ao overview: `features/form/lib/can-edit-response.ts` é citado como regra isolada e melhor
candidato a teste unitário. O arquivo importa `@/lib/prisma`. A política é pura, o carregamento dos
dados não. Os arquivos realmente sem I/O estão listados em [`testing-strategy.md`](testing-strategy.md).

## 7. Como reproduzir

```bash
# tamanho
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -not -path 'src/generated/*' | wc -l
grep -cE '^model ' prisma/schema.prisma

# sinais (acrescentar: --include=*.ts --include=*.tsx --exclude-dir=generated)
grep -rnE "throw errors\.[A-Z_]+;" src | wc -l
grep -rE "console\.(log|error|warn|info|debug)\(" src | wc -l
grep -rE "\borpc\.[a-zA-Z]" src | grep -vE "/hooks/|src/lib/|src/app/router" | wc -l

# candidatas a falha de isolamento (mesma heurística do overview §10)
grep -rl "requiredAuthMiddleware" src/app/router --include=*.ts \
  | xargs grep -LE "requireOrgMiddleware|organizationId|orgId|org\.id" | wc -l
```

O grafo entre features (§3.2) foi calculado por um script descartável que lê `from "@/features/<x>"`
em cada arquivo e roda Tarjan. A etapa 2 do plano troca esse script pelo `dependency-cruiser`, que
passa a ser a medida oficial.

Não foram executados nesta reaferição: `pnpm lint` (o passivo de ESLint segue desconhecido, e o CI
não roda lint), `tsc` e `next build` (o CI já os roda em todo PR).
