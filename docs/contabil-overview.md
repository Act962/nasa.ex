# Aba Contábil (NASA Payment): visão geral

> Documento vivo da camada contábil e fiscal do financeiro. Última revisão: 2026-09-28 (Etapa 1, só documentação).
>
> **Regra de manutenção (CLAUDE.md, item 21):** sempre que alterar qualquer coisa em `src/features/accounting/`, `src/app/router/accounting/` ou nos modelos contábeis do `prisma/schema.prisma`, **atualize este arquivo na mesma sessão**. Status, arquivos, roadmap e changelog precisam ficar sincronizados com o código.
>
> - Plano de origem: [`docs/contabil-plano.md`](contabil-plano.md).
> - Spec da Fase 1: [`specs/accounting/0040-aba-contabil-fundacao.md`](../specs/accounting/0040-aba-contabil-fundacao.md). Onde o plano e a spec divergem, **vale a spec** (§6, D-1 a D-10).

---

## 1. Objetivo

Reduzir ao mínimo a dependência de contador. O NASA passa a:
- apurar os impostos (Simples/MEI, Presumido e, parcialmente, Real) com memória de cálculo;
- gerar as guias como despesa;
- aproveitar os créditos de IBS/CBS das notas de fornecedores;
- precificar com o imposto certo;
- medir a regularidade documental da empresa.

A Reforma Tributária (EC 132/2023, LC 214/2025) é tratada como dado versionado em `TaxRateTable`.

## 2. Estado atual

| Item | Status |
| --- | --- |
| Etapa 1: plano, spec 0040, este documento, regra 21 | ✅ em revisão |
| Etapa 2: schema + seed, journal, motor fiscal, calculadora, subabas básicas | ⬜ |
| Etapa 3: N-Box restrito, documentos, score, cofre | ⬜ |
| Etapa 4: créditos + precificação no Forge | ⬜ |
| Etapa 5: avisos, `COMPLIANCE_ITEM_DUE`, ASTRO, Reforma, Space Help | ⬜ |

Os itens em aberto nas tabelas e nos links estão em [spec 0040 §8.2 e §8.3](../specs/accounting/0040-aba-contabil-fundacao.md) (marcados [VERIFICAR]).

## 3. Arquitetura

- **Fonte:** o `PaymentEntry` continua sendo a fonte de verdade. O journal é **derivado depois do commit** e idempotente por `(sourceType, sourceId)` (spec D-1).
- **Motor fiscal:** funções puras em `src/features/accounting/lib/tax/` e `lib/pricing/`, que recebem as linhas da `TaxRateTable` como parâmetro.
- **Guias:** a apuração começa em DRAFT. Ao confirmar, vira `PaymentEntry PAYABLE` e herda lembretes, régua, conciliação e WhatsApp.
- **Glossário:** `lib/glossary/terms.ts` é a fonte única dos textos usados no `FiscalTermHint`, no ASTRO e no Space Help.
- **Acesso:** reaproveita `requirePaymentAccess`. Cofre e pasta restrita exigem ADMIN ou OWNER.

## 4. Mapa de arquivos

_Preencher a cada etapa._

| Caminho | Papel |
| --- | --- |
| `docs/contabil-plano.md` | Plano original (histórico, não editar) |
| `specs/accounting/0040-aba-contabil-fundacao.md` | Spec da Fase 1 |

## 5. Modelos Prisma

_Preencher na Etapa 2._ Previstos:
- `OrganizationTaxProfile`, `AccountingAccount`, `AccountingMapping`, `JournalEntry`/`JournalLine`;
- `TaxRateTable`, `TaxAssessment`, `FiscalObligation`, `TaxCredit`, `ProductTaxClassification`;
- `CompanyDocumentType`, `CompanyDocument`, `CompanyCredential`, `CompanyCredentialRevealLog`, `RegularityScoreSnapshot`, `ComplianceAlertDispatch`;
- colunas novas em `ForgeSimulation`, `ForgeProposal`, `PaymentContact` e `NBoxFolder`.

## 6. Procedures oRPC

_Preencher na Etapa 2 (`src/app/router/accounting/`)._

## 7. Roadmap

| Fase | Escopo | Status |
| --- | --- | --- |
| 1 | Fundação, guias, créditos, precificação, regularidade (spec 0040, Etapas 1–5) | 🚧 |
| 2 | Emissão de NF-e/NFS-e por API emissora + captura DF-e | ⬜ |
| 3 | Livro PF / IRPF | ⬜ |
| 4 | Lucro Real e obrigações acessórias (LALUR/LACS, SPED) | ⬜ |
| 5 | Integrações do Piauí, certidões automáticas, split payment, Open Finance | ⬜ |

## 8. Decisões e porquês

Resumo da spec 0040, §6:
- **D-1:** o journal é derivado depois do commit, porque os services de entries não têm `tx` interativo.
- **D-3:** o dedup do cron fica em `ComplianceAlertDispatch`, porque `WorkflowScheduleClaim` e `detect-expenses-due-today` não existem.
- **D-4:** o escopo do ASTRO fica no `AppToolPack.systemPrompt`, porque o sistema de personas não existe.
- **D-5:** só existe o `COMPLIANCE_ITEM_DUE`, e cerca de 12 arquivos precisam ser tocados.
- **D-6:** o filtro de restrição do N-Box fica em `get-items.ts` e em `get-folders.ts`.
- **D-7:** `COMPANY_VAULT_KEY` própria para o cofre.

## 9. Variáveis de ambiente

| Variável | Uso | Etapa |
| --- | --- | --- |
| `COMPANY_VAULT_KEY` | Chave do cofre de credenciais e do certificado A1 (fallback: `AI_SECRETS_KEY`) | 3 |

## 10. Validação local

_Preencher a cada etapa com o roteiro (migration, ritual da regra 11, telas, `curl`)._

## 11. Changelog

| Data | Mudança |
| --- | --- |
| 2026-09-28 | Criado (Etapa 1): plano no repositório, spec 0040 em revisão, regra 21 no CLAUDE.md. |
