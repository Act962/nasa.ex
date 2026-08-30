# Estratégia de Testes, CI e Quality Gates

> Documento satélite de [`arquitetura-evolucao-overview.md`](arquitetura-evolucao-overview.md).
>
> **Regra de manutenção:** ao adicionar um tipo de teste, mudar a configuração do runner, alterar o
> pipeline ou promover/remover um quality gate, **atualize este arquivo na mesma sessão**.

**Estado atual:** 0 testes, 0 frameworks de teste, 0 pipelines de CI. Confirmado por quatro
verificações independentes (arquivos `*.test.*`/`*.spec.*`, diretórios `__tests__`/`e2e`/`cypress`,
configs de runner, dependências do `package.json`). Não existe `.github/`, `.husky/`, nem hook em
`.git/hooks/`. 375 PRs foram revisados só por humano.

**A contradição que motiva este documento:** o CLAUDE.md item 17 determina que *"cada critério de
aceite (`CA-n`) vira ao menos um teste que cita o id no nome"*. Existem 6 specs escritas (136 KB) com
CAs numerados. **Zero podem ser cumpridos** — não há runner instalado. A regra é inexequível hoje.

---

## 1. Pirâmide

```
        E2E (Playwright)          ~12 cenários — só o que não pode quebrar
     ────────────────────
      Integração (Vitest + Postgres real)   ~60–100 — procedures, repos, webhooks
   ──────────────────────────
    Unit / Domain (Vitest, sem I/O)      centenas — regras puras, rápido
  ────────────────────────────────
   UI component — deliberadamente mínimo (§5)
```

Topo estreito **de propósito**: com 4 devs, E2E caro e lento vira suíte ignorada. A largura da base é
onde o retorno está.

---

## 2. Unitários

**Alvo: ≥90% de branch coverage em `modules/*/domain`.** As regras *são* os branches — line coverage
mente aqui.

### Testar

- **Entidades e value objects**: `PhoneNumber`, `LeadId`, invariantes de `Lead`
- **Regras puras já isoladas** (candidatos imediatos, existem hoje):
  - `features/form/lib/can-edit-response.ts` — 204 linhas de política, o melhor candidato do repo
  - `features/payment/lib/permissions.ts` — `resolveEffectivePermissions`
  - `features/form/lib/derive-response-label.ts`
  - `lib/reminder-recurrence.ts`
  - cálculo de `order` do kanban (`Decimal`) — hoje inline em `status/create.ts:28-41`
- **Use cases com ports fake** (não mock): decisão de placement, transições de status
- **Os duplicados, ao consolidá-los**: 4× `formatCurrency`, 13× `formatDate`, 4× normalização de
  telefone. **O teste é o que prova que a unificação não mudou comportamento** — sem ele, consolidar
  é risco puro (os `formatCurrency` têm contratos incompatíveis: `cents` vs reais)

### Não testar unitariamente

Seria teste de mock, sem valor:

- Procedures oRPC finas (CRUD puro) — cobertas por integração
- Adapters Prisma — o valor está em rodar contra Postgres real
- Componentes React de apresentação
- Clients HTTP externos — cobertos por contract test com servidor fake
- Código gerado (`src/generated/prisma` — 632k linhas)

---

## 3. Integração

**Princípio inegociável: nada de mock de Prisma.** Mock de ORM testa o mock. Postgres em container é
barato e pega o que importa — constraints, cascatas, transações, `Decimal`, timezone, pgvector.

### Setup

- `docker-compose.test.yml` com `pgvector/pgvector:pg17` — **mesma imagem do dev**. Paridade importa:
  o projeto usa pgvector, e mock não tem operador de vetor
- Schema via `prisma migrate deploy`, **não** `db push` — respeita a proibição do CLAUDE.md e valida
  as próprias migrations, que já tiveram aplicação manual
- **Isolamento por truncate seletivo entre casos**, não transação-por-teste: o código sob teste abre
  `$transaction` em **160 lugares**, e transação aninhada muda exatamente o comportamento que se quer
  observar
- Fixtures como **builders tipados** (`aLead().inOrg(x).build()`), não JSON estático.
  `@faker-js/faker` já é devDependency
- Seeds de teste separados de `prisma/seed.ts` (que serve o dev)
- Concorrência: bancos por worker (`nasa_test_1..N`). Se der problema, serial. Medir antes de otimizar

### O que testar

| Alvo | Por quê |
| --- | --- |
| **Guard de tenancy** — "org A acessa recurso de org B → FORBIDDEN" | O teste mais valioso do projeto. Vira template repetível para cada procedure migrada |
| **Assinatura de webhook** — válida aceita; inválida, ausente e replay rejeitadas | Cobre S1 e S4 do registro de segurança e impede a regressão voltar |
| Procedures ponta a ponta via `call()` do oRPC (sem HTTP) | Exercita middleware + handler + banco |
| Repositórios contra schema real | Constraints e cascatas |
| Transações: efeitos pós-commit ocorrem; rollback não deixa resíduo | Cobre a Regra 18 e o bug de `logActivity` dentro de tx |

### Quando usar cada dublê

| Dublê | Usar para |
| --- | --- |
| **Nada (real)** | Postgres. Sempre |
| **Fake** (implementação em memória do port) | Repositórios em teste de use case; `Clock`; `IdGenerator` |
| **Stub** | Respostas fixas de API externa no caminho feliz |
| **Mock** (verificação de chamada) | Só quando o efeito *é* a asserção: "enfileirou o job", "publicou no Pusher" |
| **Servidor fake HTTP** | Meta/uazapi/Asaas — **inclusive timeout e 5xx**, que hoje não são tratados |

---

## 4. Characterization tests — antes de tocar em módulo crítico

O sistema não tem comportamento documentado o bastante para refatorar com segurança. Antes de alterar
qualquer módulo crítico:

1. **Enumerar os caminhos.** Para o piloto já está feito: `specs/form/0001` tem a tabela de 3 caminhos
   (lead no mesmo tracking / em outro / inexistente) que originou o incidente de 500 em produção
2. **Capturar o comportamento atual** — chamar a procedure via `call()` contra banco semeado, para
   cada caminho, gravando golden master de **valor retornado *e* estado resultante do banco**.
   `submut-response` altera lead, resposta, tags, ações e eventos de jornada — a saída sozinha não basta
3. **Congelar como teste.** O golden master documenta o que existe, **inclusive comportamento errado**.
   Bug encontrado nesse passo vira spec própria e é corrigido **em PR separado**, nunca junto da
   refatoração
4. **Refatorar**
5. **Rodar** — diferença = regressão até prova em contrário
6. **Só então avançar**

**A armadilha a evitar:** characterization test **não é** teste de aceitação. Ele preserva o passado.
Depois da migração, cada `CA-n` das specs ganha teste nomeado com o id (cumprindo finalmente a Regra 17)
e os golden masters podem ser aposentados.

---

## 5. UI — deliberadamente mínimo

**Não haverá suíte de componentes agora.** São 1.153 `.tsx` de feature; testar por testar produz
manutenção sem confiança.

Só estes justificam teste (Fase 3+, não antes):

| Componente | Por quê |
| --- | --- |
| Blocos do form builder (`features/form/components/common/blocks/*`) | Máscara, validação, condicional. **Já quebraram** |
| Kanban DnD (`features/trackings`) | Reordenação — mas **a regra de `order` deve ser testada como unidade de domínio, não via UI** |
| `properties-panel.tsx` (4.785 linhas) | Só depois de quebrado |

**Visual regression: não.** Custo e ruído altos, valor baixo num produto com UI em mudança ativa.

**Accessibility: sim, via lint** (`eslint-plugin-jsx-a11y`), não via suíte dedicada. Custo marginal zero.

---

## 6. E2E — cenários priorizados

Ordem por (risco × impacto de negócio), sobre os fluxos críticos definidos pelo dono do produto.

| # | Cenário | Por quê | Fase |
| --- | --- | --- | --- |
| 1 | **Isolamento de tenant**: usuário da org A não acessa recurso da org B | Cobre S5 na dimensão de sistema | 1 |
| 2 | Submit de formulário público → lead criado/realocado no tracking correto | Já causou 500; 4 specs escritas; entrada pública; 28 commits | 1 |
| 3 | Login (e-mail/senha + Google) e sessão de organização | Porta de entrada; nada funciona sem | 1 |
| 4 | Webhook de pagamento: assinatura inválida **rejeitada**, válida creditada | Cobre S1 — dinheiro | 1 |
| 5 | Criar lead → mover entre status no kanban → persistência | Core do produto | 2 |
| 6 | Action/Workspace: criar action, mover coluna, executar | Fluxo crítico | 2 |
| 7 | WhatsApp inbound: webhook → conversa → mensagem no chat | 51 commits, arquivo mais alterado do `api/` | 2 |
| 8 | WhatsApp outbound: enviar do chat → provider correto | Já teve incidente de configuração | 2 |
| 9 | Recarga de Stars via Stripe → saldo creditado | Dinheiro | 3 |
| 10 | Suspensão por saldo zero bloqueia procedure paga | Kill switch — falha silenciosa é cara | 3 |
| 11 | Permissões: membro sem `PaymentAccess` bloqueado no financeiro | Autorização sensível | 3 |
| 12 | Formulário: bloqueio de edição por autoria (spec 0005) | Spec de 39 KB, recém-escrita, sem teste | 3 |

---

## 7. Cobertura

**Sem meta global.** Metas por área, com sentido diferente em cada uma:

| Área | Meta | Métrica que importa de verdade |
| --- | --- | --- |
| `modules/*/domain` | **≥ 90% linhas + branches** | branch coverage — as regras *são* os branches |
| `modules/*/application` | ≥ 80% | todo caminho de erro exercitado |
| `modules/*/infra` | sem meta de linha | todo método de repositório com ≥1 teste contra Postgres real |
| Procedures migradas | sem meta de linha | **100% com teste de tenancy cross-org** ← inegociável |
| Webhooks | sem meta de linha | **100% com teste de assinatura inválida** ← inegociável |
| `src/features/**` (UI) | sem meta | nº absoluto de componentes com comportamento testado |
| E2E | sem meta | fluxos críticos verdes ÷ total mapeado (12) |

### Métricas que importam mais que percentual

| Métrica | Hoje | Alvo |
| --- | ---: | --- |
| **Cobertura de tenancy** — procedures com teste cross-org ÷ procedures que aceitam ID | 0% | 100% no escopo migrado. **É a métrica número um** |
| Rotas públicas sem auth/assinatura | ~10 relevantes | 0 |
| Ciclos entre features | 27 | monotonicamente decrescente |
| Violações de fronteira em `modules/**` | — | 0 |
| **Tempo do pipeline de PR** | — (não existe) | **< 10 min** — acima disso o time burla. É métrica de processo, não vaidade |
| **Escapes** — bugs em produção que a suíte poderia ter pego | — | decrescente. O melhor indicador da qualidade da suíte |
| Idade do teste mais lento | — | evita a suíte apodrecer |

**Cobertura não é gate nas Fases 0–1.** Com base zero, qualquer threshold ou é trivial ou bloqueia
tudo. Vira gate na Fase 3, e só em `src/modules/**`.

---

## 8. CI — GitHub Actions

### 8.1 Pipeline de Pull Request (alvo: < 10 min)

```yaml
# .github/workflows/pr.yml  (esqueleto)
jobs:
  setup:       # pnpm install --frozen-lockfile + cache (store + .next/cache)
  lint:        # eslint --max-warnings=0   ─┐
  typecheck:   # tsc --noEmit               ├─ paralelos, após setup
  arch:        # dependency-cruiser (R1–R10)┘
  unit:        # vitest run --project=unit          (sem banco)
  integration: # vitest run --project=integration   (service: pgvector/pgvector:pg17)
  build:       # next build (depende de typecheck)
  e2e-critical:# playwright, cenários 1–4, contra o build
```

- **Paralelização:** `lint`/`typecheck`/`arch`/`unit` disparam juntos após `setup`.
  `e2e-critical` roda por último e só os 4 cenários P0 — a suíte completa fica na main
- **Cache:** store do pnpm por hash do lockfile; `.next/cache` por branch; binários do Playwright.
  **Turborepo em single-package mode** por cima disso (ver §7.1 do overview) — é a alavanca mais
  direta para o alvo de 10 min, dado o `tsconfig.tsbuildinfo` de 2,1 MB
- **Banco:** service container `pgvector/pgvector:pg17`, `prisma migrate deploy` no setup
- **Secrets:** nenhum secret de produção. Chaves externas viram fakes ou `*_TEST_*`.
  **Pré-requisito: criar `.env.example`** — sem contrato de env declarado o CI não é reproduzível
- **Artifacts:** relatório do Playwright (traces só em falha), cobertura, saída do dependency-cruiser

**O primeiro CI entrega valor antes de qualquer teste existir.** `tsc --noEmit` em 536k linhas com
1.215 `any` e 291 `eslint-disable` provavelmente encontra coisa hoje. ⚠️ Rodar o typecheck é a
primeira medição da Fase 0 — o passivo é desconhecido.

### 8.2 Pipeline da main

Tudo do PR, mais:

- E2E completo (12 cenários)
- `pnpm audit` / Dependabot — **atenção ao `xlsx`**: histórico de CVE de prototype pollution e a
  versão publicada no npm está desatualizada (o mantenedor migrou para CDN próprio)
- `prisma migrate status` contra staging — detecta drift; há histórico de migrations aplicadas
  manualmente via `psql` e 3+ migrations com timestamp `000000` (criadas à mão)
- Publicação de cobertura
- Deploy

⚠️ **A reavaliar:** `pnpm build` roda `prisma migrate deploy` no build. Migration no build é frágil —
build sem banco falha e rollback fica ambíguo. Decisão própria, fora do escopo da auditoria.

### 8.3 Prettier — adotar por módulo, não de uma vez

`prettier` está instalado **sem config e sem script**, e a formatação atual diverge (há alinhamento
vertical manual de `:` em vários arquivos, ex.: `api/payments/asaas/webhook/route.ts:19-24`).

Rodar `prettier --write` global agora produz um diff gigante que polui `git blame` de todo o repo.

**Recomendado:** adotar junto com o piloto, aplicando só em `src/modules/**`, e expandir por módulo
migrado. Não vale um commit de reformatação global.

---

## 9. Quality gates

### Bloqueiam merge

Falha objetiva, sem interpretação:

| Gate | Desde |
| --- | --- |
| Erro de TypeScript | Fase 0 |
| Erro de ESLint | Fase 0 |
| Falha de build | Fase 0 |
| Rota nova em `app/api/**` sem auth ou validação de assinatura (R10) | Fase 0 |
| Falha de teste unitário ou de integração | Fase 1 |
| Violação de fronteira (R1–R7) | Fase 1 |
| Baseline de ciclos ou de Regra 9 **aumentou** (R8/R9) | Fase 1 |
| E2E P0 (cenários 1–4) falhando | Fase 2 |
| Procedure nova sem teste de tenancy | Fase 2 |
| Cobertura de `modules/*/domain` < 90% | Fase 3 |

### Não bloqueiam (avisam apenas)

Evitar burocracia sem ganho de confiabilidade:

- **Cobertura global** — número sem significado aqui
- **Vulnerabilidade de dependência** sem exploit conhecido no caminho usado
- **Tamanho de bundle** — medir por 2 meses antes de virar gate
- **Duração do E2E** — alertar, não bloquear

---

## 10. Ferramentas

| Ferramenta | Papel | Por que esta |
| --- | --- | --- |
| **Vitest** | Runner unit + integração | Mesmo esbuild/SWC do stack; `projects` separa os dois perfis; resolve `@/*` do tsconfig sem config extra. Jest é mais lento e a config ESM é dolorosa |
| **Playwright** | E2E | Padrão atual; trace viewer paga o próprio custo no debug; roda no CI sem xvfb |
| **dependency-cruiser** | Regras de fronteira R1–R10 | Único que expressa as regras **e** detecta ciclos com baseline. Roda em CI sem plugin de ESLint |
| **@faker-js/faker** | Fixtures | **Já é devDependency** — só usar |
| **eslint-plugin-jsx-a11y** | Acessibilidade | Custo marginal zero no lint que já existe |

**Não adotamos:** Testcontainers (compose + service container resolve com menos peças) · Storybook
(sem suíte de UI, vira doc que apodrece) · MSW (só na Fase 3, com contract tests) · Stryker (sem
testes não há o que mutar).

---

## 11. Ordem de implantação

| # | Passo | Fase | Depende de |
| --- | --- | --- | --- |
| 1 | CI mínimo: install + lint + typecheck + build | 0 | `.env.example` |
| 2 | `.env.example` com as 107 vars | 0 | — |
| 3 | Vitest + `docker-compose.test.yml` + primeiro teste de tenancy | 1 | 1 |
| 4 | dependency-cruiser + baselines congeladas (27 ciclos, 518 violações) | 1 | 1 |
| 5 | Testes de assinatura dos webhooks corrigidos na Fase 0 | 1 | 3 |
| 6 | Characterization tests do piloto `form` | 1 | 3 |
| 7 | Playwright + cenários 1–4 | 1 | 3 |
| 8 | Gates de teste e fronteira passam a bloquear | 1 | 3, 4 |
| 9 | Turborepo single-package (se o pipeline pedir) | 1 | 1 |
| 10 | Cenários E2E 5–8 | 2 | 7 |
| 11 | Cobertura como gate em `modules/**` | 3 | 8 |
| 12 | Contract tests das integrações externas (MSW) | 3 | 3 |

---

## Changelog

| Data | O quê |
| --- | --- |
| 2026-08-18 | Documento inicial. Pirâmide, metas de cobertura por área, 12 cenários E2E priorizados, pipeline de PR e main, quality gates faseados. Nenhuma ferramenta instalada ainda. |
