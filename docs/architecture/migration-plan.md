# Plano de migração incremental

> Detalha, etapa por etapa, o roadmap de
> [`../arquitetura-evolucao-overview.md`](../arquitetura-evolucao-overview.md) §9.3, com a ordem
> revista pela reaferição de 2026-10-13 ([`current-state.md`](current-state.md)).
>
> **Status:** ordem aprovada em 2026-10-13. **Etapa 1 implementada na branch, aguardando PR** (o job
> `unit` ainda não é exigido na proteção da `main`). Etapa 2 implementada na mesma branch. Etapas 3 a 10
> não iniciadas.

| Etapa | Status |
| --- | --- |
| 1. Runner + testes de regras puras | 🚧 Código pronto: Vitest 5, 166 testes em 12 arquivos, verdes localmente; job `unit` no `ci.yml`. Falta: PR, ver o job verde no GitHub, exigir o job na proteção da `main`. Quatro comportamentos suspeitos registrados em [`testing-strategy.md`](testing-strategy.md) §6 |
| 2. Catraca de fronteiras | 🚧 Código pronto: `.dependency-cruiser.js` (R1–R7, 1 violação conhecida na baseline), `scripts/arch/` (R8, R9, R11 com baseline), job `arch` no `ci.yml`, regra de ESLint para Prisma em `modules/`, template de PR. Falta: ver o job verde no GitHub, exigir na proteção da `main`, revisar a classificação das camadas (R11) e decidir sobre `CODEOWNERS` |
| Correção fora do plano | ✅ Lembrete mensal em mês curto (spec 0090). Reparo dos dados de produção pendente |
| 3. Contenção de segurança | 🚧 S1, S2 e S4 em código, com teste unitário das regras ([spec 0091](../../specs/integrations/0091-rotas-anonimas-exigem-credencial.md)). Falta: implantar seguindo o roteiro da spec (começa em `log-only`), conferir com `curl` em homologação, S7 e S6 aguardam decisão sobre como autenticar integradores |
| 4. Integração com Postgres real | 🚧 Código pronto: `docker-compose.test.yml`, projeto `integration` no Vitest, suporte em `tests/integration/support/` (truncate, builders, sessão), job `integration` no `ci.yml`. 44 testes: as quatro rotas da etapa 3, o molde de isolamento entre empresas e os 8 scripts de QA das specs executados contra o banco de teste. As 254 migrations aplicam limpas em banco vazio. Falta: ver o job verde no GitHub e exigi-lo na `main`; converter os scripts de QA em testes nativos (hoje rodam como processo, um teste por script); teste de arquitetura exigindo `TenantScope` nos repositórios |
| 5. Erros de negócio que viram 500 | 🚧 Primeira parte: os 169 `throw errors.INTERNAL_SERVER_ERROR;` foram invocados (79 arquivos). O status HTTP não muda (já era 500); a mensagem que o cliente recebe passa de "Internal server error" para "Something went wrong". O job `arch` passa a impedir ocorrência nova de `throw errors.X;`. Restam 101 (65 `NOT_FOUND`, 23 `FORBIDDEN`, 8 `BAD_REQUEST`, 6 `UNAUTHORIZED`, menos um caso de teste), que mudam o status HTTP e aguardam aprovação |
| 6 a 10 | ⬜ |

## 1. O que muda em relação ao roadmap de agosto

O roadmap põe a contenção de segurança (Fase 0) antes de qualquer ferramenta. Em oito semanas a Fase 0
não começou e o código cresceu 26% na forma antiga. Três mudanças de ordem, cada uma com argumento
novo:

1. **Runner de testes e catraca de fronteiras vêm primeiro (etapas 1 e 2).** Custam de dois a três
   dias, não tocam código de produção e são pré-requisito do próprio critério da Fase 0 ("corrigido,
   com teste"). A decisão D1 (segurança primeiro) continua valendo no que importa: as correções S1 a
   S4 começam na etapa 3, em paralelo, assim que houver onde escrever o teste.
2. **A regra "código novo nasce em `modules/`" passa a valer na aprovação**, não na Fase 3
   ([`target-state.md`](target-state.md), ajuste A1).
3. **E2E com Playwright sai da fundação** e vai para depois do piloto. Os riscos dos cenários 1 a 4
   são cobertos por testes de integração, mais baratos para um time de duas pessoas.

## 2. Priorização

Nota de 1 (baixo) a 3 (alto). Ordem = maior ganho com menor risco e esforço.

| Etapa | Criticidade | Risco de regressão | Ganho de testabilidade | Esforço | Ordem |
| --- | :-: | :-: | :-: | :-: | :-: |
| 1. Runner + testes de regras puras | 3 | nenhum | 3 | 1 | 1 |
| 2. Catraca de fronteiras | 3 | nenhum | 1 | 1 | 2 |
| 3. Contenção S1, S2, S4, S7 com teste | 3 | 1 | 1 | 1 | 3 (paralela à 4) |
| 4. Integração com Postgres real + scripts de QA | 3 | nenhum | 3 | 2 | 3 |
| 5. Erros de negócio que viram 500 | 2 | 2 | 1 | 1 | 5 |
| 6. Caracterização do submit de formulário | 3 | nenhum | 3 | 2 | 6 |
| 7. Piloto `form` | 3 | 3 | 3 | 3 | 7 |
| 8. Guard de tenancy em lotes | 3 | 2 | 2 | 3 | 8 (paralela à 7) |
| 9. Inversões de infra e ciclos fáceis | 1 | 1 | 2 | 2 | 9 |
| 10. Segundo módulo e investigação do `astro` | 2 | 3 | 3 | 3 | 10 |

## 3. Etapas

### Etapa 1 — Runner de testes e primeira suíte unitária

| | |
| --- | --- |
| **Problema** | Zero testes e nenhum runner. Nada do que vem depois é verificável |
| **Arquivos** | Novos: `vitest.config.ts`, `*.test.ts` ao lado dos 7 arquivos puros e de `modules/social/domain/` (lista em [`testing-strategy.md`](testing-strategy.md) §3). Alterados: `package.json` (devDependency e scripts `test`, `test:unit`), `tsconfig.json` (excluir `**/*.test.ts` do build), `.github/workflows/ci.yml` (job `unit`) |
| **Objetivo** | Existir um lugar onde uma regra de negócio é executada sem banco nem framework, e o CI falhar quando ela quebra |
| **Alterações** | Instalar Vitest; projeto `unit`; escrever os testes de caracterização; job no CI em paralelo ao `next-build` |
| **Riscos** | Teste entrar na checagem de tipos do build e encarecê-la (regra 24). Mitigação: exclusão no `tsconfig` e conferir o tempo de `Finished TypeScript` no CI antes e depois |
| **Testes** | A própria suíte. Provar o gate: um PR de rascunho com uma asserção quebrada tem de ficar vermelho |
| **Conclusão** | `pnpm test` verde local e no CI; job `unit` exigido na proteção da `main`; tempo de build sem regressão; `testes-estrategia.md` e overview atualizados (regra 19) |
| **Rollback** | Reverter o PR. Nenhum arquivo de produção é alterado |

### Etapa 2 — Catraca de fronteiras

| | |
| --- | --- |
| **Problema** | Nada impede a dívida de crescer: +207 chamadas `orpc.*` fora de hook e +19 features na forma antiga em 8 semanas |
| **Arquivos** | Novos: `.dependency-cruiser.js`, baseline de violações conhecidas, `.github/CODEOWNERS`, `.github/pull_request_template.md`. Alterados: `package.json` (script `arch`), `ci.yml` (job `arch`), `eslint.config.mjs` (Prisma proibido em `modules/*/{domain,application,ports}`) |
| **Objetivo** | R1–R6 bloqueiam PR; R7–R9 e R11 não podem piorar |
| **Alterações** | Configurar as regras do overview §6.2; gerar a baseline com as violações de hoje; job `arch` |
| **Riscos** | Falso positivo travar PR legítimo; `dependency-cruiser` lento em 5.300 arquivos. Mitigação: uma semana com R7–R11 em modo aviso antes de bloquear; medir o tempo do job e, se passar de 3 minutos, restringir o escopo a `src/modules`, `src/features` e `src/app/router` |
| **Testes** | PR de rascunho com `import prisma` em `modules/social/domain/` tem de falhar; outro criando um ciclo novo entre duas features tem de falhar |
| **Conclusão** | Job `arch` exigido; baseline versionada; número oficial de ciclos publicado no overview, substituindo o do script descartável |
| **Rollback** | Remover o job do CI. Nenhum arquivo de produção é alterado |
| **Decisão necessária** | Classificação das features nas três camadas da R11 |

### Etapa 3 — Contenção de segurança com teste

Um PR por item. Podem andar em paralelo à etapa 4.

| | |
| --- | --- |
| **Problema** | Rotas anônimas que creditam Stars (S1), apagam arquivos (S2), mudam status de compra e injetam mensagens (S4), criam leads em qualquer empresa e registram dados pessoais em log (S7) |
| **Arquivos** | `src/app/api/payments/asaas/webhook/route.ts`, `src/app/api/s3/delete/route.ts` e seus 4 chamadores, `src/app/api/integrations/{facebook,instagram}/webhook/route.ts`, `src/app/api/domain-providers/[provider]/webhook/route.ts`, `src/app/api/external/new-lead/route.ts` |
| **Objetivo** | Nenhuma rota pública muda estado sem sessão ou assinatura. Extrair as verificações para funções puras testáveis, no molde de `src/http/whats-oficial/verify-signature.ts` |
| **Alterações** | Checklist de cada item em [`../seguranca-auditoria-2026-08.md`](../seguranca-auditoria-2026-08.md) |
| **Riscos** | Rejeitar webhook legítimo por configuração errada do segredo e parar de creditar pagamento real. Mitigação: 24 horas em modo só-registro contando quantas requisições seriam rejeitadas, depois fail-closed |
| **Testes** | Por rota: assinatura válida processa; inválida, ausente e corpo adulterado rejeitam sem efeito; replay é idempotente. S1: valor divergente rejeita. S2: sem sessão e sessão de outra empresa rejeitam |
| **Conclusão** | `curl` anônimo contra homologação devolve 401/403 nas rotas tratadas; item marcado no registro de segurança com o PR |
| **Rollback** | Variável de ambiente por rota que volta ao modo só-registro, sem novo deploy de código |
| **Decisões necessárias** | Como cada integrador externo de `external/new-lead` e `new-nasa-*` será autenticado (são contratos com terceiros); janela do modo só-registro |

### Etapa 4 — Integração com Postgres real

| | |
| --- | --- |
| **Problema** | Os testes de integração que existem são scripts manuais contra o banco de desenvolvimento |
| **Arquivos** | Novos: `docker-compose.test.yml`, projeto `integration` no `vitest.config.ts`, utilitários de teste (truncate, builders), 5 arquivos de teste convertidos de `scripts/*-qa-check.ts`. Alterado: `ci.yml` (job `integration` com service container `pgvector/pgvector:pg17`) |
| **Objetivo** | Casos de uso e procedures rodam contra o schema real, no CI, com `prisma migrate deploy` |
| **Alterações** | Banco de teste; converter os scripts mantendo os ids `CA-n` no nome dos testes (cumpre a regra 17); primeiro teste cross-org ("empresa A pede recurso da empresa B → recusado"), que vira o molde da etapa 8; teste de arquitetura exigindo `TenantScope` nos repositórios de `modules/` |
| **Riscos** | `migrate deploy` das 245 migrations lento ou quebrado em banco vazio (há migrations aplicadas à mão no histórico). Mitigação: é exatamente o que o teste precisa revelar; se quebrar, corrigir antes de seguir |
| **Testes** | Os próprios. Conferir que os 5 scripts convertidos passam com as mesmas asserções |
| **Conclusão** | Job `integration` verde e exigido; scripts antigos removidos; pipeline de PR abaixo de 10 minutos além do build |
| **Rollback** | Remover o job; os scripts continuam no histórico do git |

### Etapa 5 — Erros de negócio que viram 500

| | |
| --- | --- |
| **Problema** | 272 `throw errors.X;` sem invocação; 103 devolvem 500 no lugar de 404/403/400/401 |
| **Arquivos** | Os arquivos de `src/app/router/` com as 272 ocorrências; `src/app/middlewares/base.ts` (mensagem de `BAD_REQUEST`); `eslint.config.mjs` |
| **Objetivo** | Contrato de erro correto e regra de lint que impede a volta |
| **Alterações** | Codemod `throw errors.X;` → `throw errors.X();`; regra `no-restricted-syntax` |
| **Riscos** | **Muda contrato público**: telas que hoje tratam qualquer falha como erro genérico passam a receber 404/403. Algum componente pode depender do 500 (por exemplo, retry automático do TanStack Query que não repete em 4xx). Mitigação: lotes por domínio, começando pelos 169 `INTERNAL_SERVER_ERROR` (sem mudança de status), depois `leads`, `insights`, `admin` |
| **Testes** | Um teste de integração por domínio alterado: recurso inexistente devolve `NOT_FOUND`, não 500 |
| **Conclusão** | `grep` devolve 0; lint bloqueia a forma antiga |
| **Rollback** | Reverter o lote |
| **Decisão necessária** | Aprovar a mudança de status HTTP dos 103 casos |

### Etapa 6 — Caracterização do submit de formulário

| | |
| --- | --- |
| **Problema** | `submut-response.ts` (775 linhas, 28 commits em 6 meses, origem do incidente da spec 0001) não tem comportamento registrado |
| **Arquivos** | Novos: testes e golden masters. Nenhum arquivo de produção, salvo se for preciso um ponto de injeção para os efeitos externos |
| **Objetivo** | Rede de proteção do piloto |
| **Alterações** | Roteiro em [`testing-strategy.md`](testing-strategy.md) §5 |
| **Riscos** | Golden master instável por ids e datas. Mitigação: normalização antes de comparar. Achar bug durante a captura: registrar o comportamento atual, abrir spec própria, não corrigir aqui |
| **Testes** | Rodar a suíte 20 vezes seguidas sem falha intermitente |
| **Conclusão** | Todos os caminhos enumerados nas specs 0001, 0002, 0005 e 0006 têm golden master verde; lista de comportamentos suspeitos entregue para decisão |
| **Rollback** | Remover os testes |

Em PR separado, mesma janela: corrigir `leads/create-lead-with-tags.ts:180` (`logActivity` com cliente
global dentro de transação, regra 18) e varrer as 108 transações interativas atrás do mesmo padrão.

### Etapa 7 — Piloto `form`

Estrangulamento em cinco passos. Cada um é um PR que mantém os golden masters verdes sem alterá-los.

| Passo | O que faz | Reversão |
| --- | --- | --- |
| 7a | Criar `src/modules/form/domain/` com as regras já puras e a parte de política de `can-edit-response`. Os caminhos antigos em `features/form/lib/` viram reexportação | Apagar o módulo; reexportações voltam a ser os arquivos |
| 7b | `ports/` (`FormRepository`, `FormResponseRepository`, e de `shared`: `ActivityLog`, `EventPublisher`, `RealtimePublisher`) e `infra/` com adapters Prisma que exigem `TenantScope`, reaproveitando as queries atuais sem reescrevê-las | Apagar; nada consome ainda |
| 7c | `application/submit-form-response.ts`: o corpo do handler vira caso de uso que recebe ports e devolve o resultado mais a lista de efeitos pós-commit | Apagar; nada consome ainda |
| 7d | Trocar o handler pelo adapter fino atrás de uma flag de ambiente, com o caminho antigo intacto. Uma semana em produção com os dois disponíveis | Desligar a flag |
| 7e | Remover o caminho antigo, a flag e as reexportações sem consumidor. `save-partial-response.ts` segue o mesmo roteiro | Reverter o PR |

| | |
| --- | --- |
| **Problema** | Regra de negócio crítica presa a um handler que importa 17 módulos |
| **Objetivo** | Primeiro módulo **migrado** na forma alvo e, principalmente, o roteiro escrito para repetir |
| **Riscos** | Regressão em entrada pública. Mitigação: golden masters, flag, uma semana de convivência. `placeLead` pertence ao domínio de leads: no piloto fica como port (`LeadPlacement`) implementado pelo código atual, sem migrar `leads` junto |
| **Testes** | Unitários do domínio (meta: 90% de branches); caso de uso com ports falsos; cada `CA-n` das quatro specs com teste nomeado; cross-org em toda procedure de `form` |
| **Conclusão** | `modules/form` sem Prisma nem Next fora de `infra/` (job `arch`); golden masters inalterados; handler abaixo de 80 linhas; `docs/architecture/` com o roteiro de migração de um módulo |
| **Rollback** | Por passo, na tabela acima |

### Etapa 8 — Guard de tenancy em lotes

| | |
| --- | --- |
| **Problema** | 183 procedures autenticadas sem conferência de empresa (S5) |
| **Arquivos** | `src/app/middlewares/` (guard novo), procedures por domínio. Primeiro lote, destrutivas já confirmadas: `form/delete.ts`, `leads/delete-file.ts`, `status/create.ts`; depois leitura: `conversation/get.ts`, `status/list-status-simple.ts`, `column/get-many.ts` |
| **Objetivo** | Recurso pedido por ID sempre conferido contra a empresa da sessão |
| **Alterações** | Script de classificação das 183 (escopada por empresa, por usuário, pública intencional, vulnerável); revisão humana; guard reutilizável; correção por domínio |
| **Riscos** | Bloquear uso legítimo: usuário em várias empresas, admin de sistema, parceiro com acesso delegado. Mitigação: uma semana registrando o que seria negado antes de negar, por lote |
| **Testes** | Cross-org para cada procedure corrigida, no molde da etapa 4 |
| **Conclusão** | Heurística do overview §10 devolve só as classificadas como "por usuário" ou "pública intencional", listadas num arquivo de exceções versionado |
| **Rollback** | Guard por lote volta ao modo só-registro por variável de ambiente |

### Etapa 9 — Inversões de infra e ciclos fáceis

Mover `logActivity` de `features/admin` para infra compartilhada (atrás do port `ActivityLog`);
tirar de `src/lib/auth.ts` os imports de `billing`, `stars` e `org-defaults` (registro de ganchos na
inicialização); quebrar os pares `billing↔stars`, `apps↔nerp`, `insights↔tags`; derivar o
`SCHEMA_VERSION` de `src/lib/prisma.ts` do hash do schema para acabar com os 33 commits de bump.
Cada item é um PR pequeno, protegido pelo job `arch` (a baseline tem de cair) e revertido isoladamente.

### Etapa 10 — Segundo módulo e `astro`

`lead` (placement e ordenação no kanban), aproveitando o port `LeadPlacement` criado no piloto, segue
o roteiro escrito na etapa 7. Para `astro`, primeiro uma investigação de leitura, sem código, que
valide ou descarte a inversão por registro proposta em [`target-state.md`](target-state.md) A3.
Planejamento detalhado só depois do piloto concluído: detalhar agora seria adivinhar.

## 4. Riscos do plano e mitigação

| Risco | Probabilidade | Mitigação |
| --- | --- | --- |
| O plano parar de novo, como parou de agosto a outubro | Alta | Etapas 1 e 2 cabem em três dias e passam a trabalhar sozinhas depois de instaladas. Cada etapa entrega valor mesmo se a seguinte nunca vier |
| Duas arquiteturas convivendo para sempre | Média | Aceito por desenho: só módulo crítico migra. A catraca garante que o legado não cresce |
| Time de duas pessoas sem folga para refatorar | Alta | Nenhuma etapa congela o produto. As etapas 7 e 8 são feitas em lotes pequenos entre entregas |
| Pipeline lento ser burlado | Média | Meta de 10 minutos além do build; medir a cada etapa; Turborepo só se a medição pedir |
| Baseline afrouxada para um PR passar | Média | `CODEOWNERS` no arquivo de regras e na baseline |
| Regressão no submit público durante o piloto | Média | Golden masters, flag, semana de convivência |
| Correção de segurança derrubar integração de terceiro | Média | Modo só-registro antes de bloquear; reversão por variável de ambiente |

## 5. Critérios objetivos de sucesso

| Critério | Hoje | Após etapas 1–4 | Após etapa 8 |
| --- | ---: | ---: | ---: |
| Jobs de CI exigidos para merge | 1 (build) | 4 (build, unit, arch, integration) | 4 |
| Regras críticas testáveis sem I/O | 0 arquivos com teste | 8 ou mais | domínio de `form` com 90% de branches |
| Rotas públicas que mudam estado sem credencial | 7 ou mais | 0 nas tratadas (S1, S2, S4, S7) | 0 |
| Procedures que aceitam ID com teste cross-org | 0 | 1 (molde) | 100% das classificadas como vulneráveis |
| Violações de R1–R6 em `src/modules/` | não medido | 0, bloqueado | 0 |
| Ciclos entre features | 74 pares mútuos (57 no commit auditado) | congelado | decrescente |
| `orpc.*` fora de hook | 690 (726 no commit auditado) | congelado | decrescente |
| `throw errors.X;` | 101 (eram 272 no commit auditado) | congelado pelo job `arch` | 0 |
| Módulos migrados na forma alvo | 0 (`social` nasceu nela) | 0 | 1 (`form`) |
| Golden masters do piloto alterados durante a migração | — | — | 0 |

## 6. Primeira etapa recomendada

**Etapa 1.** É a única que não depende de nenhuma decisão em aberto, não altera comportamento, é
revertida apagando um PR, e sem ela nenhuma outra tem como provar que funcionou. Estimativa: um a
dois dias, incluindo o job no CI.

## 7. Decisões que dependem de você

1. Aprovar a ordem revista (runner e catraca antes das correções de segurança, que seguem em paralelo
   a partir da etapa 3).
2. Aprovar os ajustes A1 a A4 de [`target-state.md`](target-state.md), em especial a classificação
   das features em camadas.
3. Etapa 3: como autenticar os integradores externos de `external/new-lead` e `new-nasa-*`.
4. Etapa 5: aceitar a mudança de status HTTP em 103 casos.
5. Quantas instâncias do app rodam em produção (item aberto 1 do overview). Define a urgência dos
   desafios WebAuthn em memória e se o limite de requisições precisa ser persistente.
