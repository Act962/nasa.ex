# Arquitetura alvo — o que a reaferição confirma e o que ajusta

> A arquitetura alvo está especificada em
> [`../arquitetura-evolucao-overview.md`](../arquitetura-evolucao-overview.md) §5 (camadas, pastas,
> tenancy) e §6 (regras R1–R10). Este documento não a repete. Registra o veredito da reaferição de
> 2026-10-13 sobre cada decisão e os ajustes propostos, todos **pendentes de aprovação**. Aprovados,
> entram no overview e este arquivo vira histórico.

## 1. Decisões mantidas

| Decisão do overview | Veredito | Evidência nova |
| --- | --- | --- |
| D3 Hexagonal seletivo, não Clean Architecture ampla | Mantida | `modules/social` funcionou com 4 pastas e uma regra. 930 procedures continuam sendo CRUD sobre Prisma; envolver todas em casos de uso seria cerimônia |
| D2 Piloto profundo + regras com baseline | Mantida, com urgência maior | Sem a catraca, o passivo cresceu 26% em 8 semanas |
| D4 Piloto de migração = `form` | Mantida | Continua tendo as specs com critérios de aceite e o incidente documentado. `submut-response.ts` tem 775 linhas e 17 imports |
| D5 `tracking-chat` por último | Mantida | 28,6 mil linhas, 21 features dependem dele e ele de 23 |
| D7 Regra automatizada > disciplina | Confirmada | As duas regras de ESLint criadas desde agosto seguraram; nenhuma intenção escrita em documento segurou |
| D8 Sem mock de Prisma | Mantida | Os scripts `*-qa-check.ts` já trabalham assim |
| §5.3 Tenancy na construção do repositório | Confirmada na prática | `createSocialRepositories(tenant)` é o único caminho para um repositório do módulo |
| §5.5 Adiar o split Fastify | Mantida | Router segue com 3 imports de `next/*`/`react` em 1.139 arquivos. Nenhum dos gatilhos ocorreu |

Sobre os padrões pedidos na missão: é um **monólito modular** com **Ports & Adapters só no núcleo dos
módulos críticos**. DDD entra apenas como vocabulário tático (entidade, value object, erro de
domínio) dentro desses módulos. Não há contexto delimitado formal, agregados nem eventos de domínio
como infraestrutura: o sistema não tem hoje onde isso se pague.

## 2. Ajustes propostos

### A1. "Código novo nasce em `modules/`" vale agora, não na Fase 3

O overview coloca essa regra na Fase 3. Das 19 features criadas desde a auditoria, uma seguiu.
Proposta: vale a partir da aprovação deste plano para todo módulo novo que satisfaça o critério de
"seletivo" do overview §5.1 (dois ou mais de: invariante de negócio; dinheiro, auth ou dados de lead;
três ou mais caminhos condicionais sobre dados de produção). CRUD novo continua como procedure fina.

Verificação: o template de PR pergunta em qual das duas formas o código novo nasceu, e a regra R7
(Prisma só em `infra/`) já cobre o que nasce dentro de `modules/`.

### A2. Camadas entre features (nova regra R11)

Hexagonal resolve o acoplamento entre regra e infraestrutura. Não resolve o acoplamento entre
features, que é o problema de 56 delas formarem um único componente conectado. Para isso basta uma
regra de direção, no espírito de monólito modular:

```
orquestradores   astro, astro-commander, nasa-command, admin, insights
      │  podem importar ↓, nunca são importados por ↓
domínios         leads, trackings, form, tracking-chat, payment, workflows, actions, ...
      │
núcleo           tour, astro-guides, stars, tags, space-point, alerts
                 não importam nenhuma feature acima
```

A classificação sai da medição, não de preferência: `tour` (importada por 23, importa 0),
`astro-guides` (30 e 2), `stars` (21 e 2), `tags` (10 e 1) e `space-point` (13 e 1) já se comportam
como núcleo. `astro`, `admin` e `insights` são consumidores por natureza e hoje são importados por
17 a 18 features cada, o que fecha os ciclos.

Aplicação por baseline: as arestas que violam hoje são congeladas e só podem diminuir. As três
violações de maior retorno são conhecidas: `logActivity` morando em `admin` (sobe para `lib` ou
`modules/shared`), o registro de ações e consultas do `astro` importando features que o importam de
volta, e `insights` hospedando componentes reutilizados.

A lista exata de quem fica em cada camada é decisão do time e precisa de revisão antes de virar
regra. A proposta acima é o ponto de partida.

### A3. `astro` entra no plano

Ausente do overview por ter crescido depois. É o maior nó do grafo e o mais alterado. A direção
recomendada, **a validar com leitura do código antes de qualquer etapa**: inverter a dependência. Em
vez de `astro` importar 23 features para montar ações e consultas e ser importado de volta por 18,
cada feature registra o que oferece num contrato pequeno (o mesmo desenho de `GUIDE_ANCHORS`, que já
funciona), e `astro` consome o registro. Não é etapa imediata; está no plano como investigação.

### A4. Ports para os efeitos colaterais que todo fluxo crítico usa

O piloto vai precisar deles e `social` já mostrou o padrão com `Clock` e `RandomPicker`. Em
`modules/shared/ports`, criados quando o primeiro caso de uso precisar e não antes:

| Port | Hoje é | Usado por |
| --- | --- | --- |
| `ActivityLog` | `logActivity` em `features/admin` | 178 arquivos, 135 deles no router |
| `EventPublisher` | `inngest.send` direto | 17 arquivos do router |
| `RealtimePublisher` | Pusher e `features/leads/realtime` | leads, chat, board |

Esses ports também materializam a regra 18: o caso de uso devolve a lista de efeitos e o adapter os
executa depois do commit.

### A5. O que não muda

Nenhuma migração em massa, nenhuma pasta renomeada, nenhuma camada nova para CRUD. `features/*`
continua sendo onde mora a UI. `src/app/router` continua sendo o adapter de entrada.

### A6. Considerado e adiado: core substituível (troca de ORM ou de framework)

Discutido em 2026-10-13 e **adiado por decisão do dono do produto**: o Prisma fica, e trocar ORM ou
framework não é objetivo agora. Também fica para o futuro a separação da API em serviço próprio
(overview §5.5). Não entram no plano: tipos de negócio próprios fora dos módulos migrados, baseline
para imports de `@/generated/prisma` (481 arquivos hoje, 89 deles componentes de tela) e a extração
de `packages/core`. A opção continua preservada sem custo extra pelas regras R1 a R3 dentro de
`src/modules/`. Reabrir só com motivo concreto para trocar de ORM ou de framework.

## 3. Governança

Tudo abaixo é verificável por máquina. Documentação sozinha não segura, como o §1 mostra.

| Mecanismo | O que impede | Onde | Etapa do plano |
| --- | --- | --- | :-: |
| `dependency-cruiser` com R1–R6 como erro | `domain/` importar Prisma, Next, Zod; `application/` importar `infra/`; ciclo dentro de `modules/` | job `arch` no CI | 2 |
| Baseline decrescente (`--ignore-known`) para R7–R9 e R11 | Novo ciclo entre features, novo `orpc.*` fora de hook, nova aresta contra a direção das camadas | job `arch` | 2 |
| ESLint `no-restricted-syntax` para `throw errors.X;` | A forma sem invocação voltar depois do codemod | lint | 5 |
| ESLint `no-restricted-imports` de `@/lib/prisma` em `modules/*/{domain,application,ports}` | Atalho para o banco fora de `infra/` | lint | 2 |
| Teste de arquitetura em Vitest | Toda classe `Prisma*Repository` em `modules/` exige `TenantScope` no construtor | job `unit` | 3 |
| Teste cross-org obrigatório | Procedure que aceita ID sem conferir a empresa | job `integration` | 3 em diante |
| `CODEOWNERS` em `src/modules/` e `.dependency-cruiser.js` | Baseline ser afrouxada sem revisão | GitHub | 2 |
| Template de PR | Código novo com regra de negócio fora de `modules/`; spec e teste do `CA-n` | GitHub | 2 |
| Proteção da `main` exigindo os jobs | Merge com gate vermelho | GitHub | 1 |

Registro de decisões: a tabela "Decisões travadas" do overview §2 já funciona como log de ADRs e é
lida antes de qualquer proposta (regra 19). Recomendo manter esse formato e não abrir um diretório de
ADRs separado: seria um segundo lugar para a mesma informação.

Revisão de código: com dois autores concentrando 96% dos commits, revisão cruzada obrigatória só
funciona em `src/modules/` e nas regras de fronteira. No resto, os gates automáticos são a revisão.
