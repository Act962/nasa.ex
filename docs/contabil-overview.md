# Aba Contábil — visão geral do domínio

> Fonte de verdade do domínio `accounting` (CLAUDE.md, regra 23). A spec de referência é a [0051](../specs/accounting/0051-aba-contabil-fundacao.md). Atualize este documento na mesma sessão de qualquer mudança no domínio.

## 1. O que é

A aba **Contábil** fica dentro do NASA Payment (`/payment?tab=accounting`). Ela transforma o financeiro gerencial em:

- contabilidade (partidas dobradas derivadas dos lançamentos);
- apuração de tributos com memória de cálculo e guia gerada como conta a pagar;
- calendário fiscal;
- controle de documentos da empresa com **score de regularidade**;
- créditos de IBS/CBS das notas de fornecedores;
- precificação com imposto embutido;
- calculadora contábil.

Tudo é autoexplicativo: cada termo técnico tem ⓘ com explicação, base legal, link oficial e "Perguntar ao ASTRO".

**Princípios**, travados na spec 0051, §6:

1. **O `PaymentEntry` é a fonte.** O journal é reconstruído de forma idempotente a partir dele (D-1, D-2).
2. **Alíquota nunca fica fixa em código de cálculo.** Ela vem de `TaxRate`, versionada por vigência (D-3).
3. **Apurar gera uma conta a pagar.** A guia herda lembrete, régua, conciliação e WhatsApp.
4. **Glossário único** para interface, ASTRO e Space Help (D-6).

## 2. Status do roadmap

| Fase | Escopo | Status |
| --- | --- | --- |
| 1 | Fundação contábil, apuração/guias, calendário, documentos + score, cofre, créditos IBS/CBS, precificação/Forge, calculadora, avisos WhatsApp/gatilho, ASTRO | 🚧 em PR |
| 2 | Emissão de NF-e/NFS-e via API emissora (Focus NFe ou Nuvem Fiscal), NFS-e Nacional/Teresina, SEFAZ-PI, DF-e com manifestação → `TaxCredit` automático | ⬜ |
| 3 | Livro PF por usuário / IRPF: pró-labore e lucros nos dois lados, dedutíveis, carnê-leão, prévia DIRPF | ⬜ |
| 4 | Lucro Real completo: LALUR/LACS, PIS/COFINS não cumulativo pleno, SPED ECD/ECF/EFD, DCTFWeb, DEFIS | ⬜ |
| 5 | Integrações PI: certidões automáticas, DAE-PI, split payment, Open Finance, ferramentas de escrita do ASTRO | ⬜ |

## 3. Modelo de dados

Os modelos ficam na seção "ABA CONTÁBIL" do `prisma/schema.prisma`, criados pela migration `20260929200000_accounting_foundation`, que só acrescenta.

| Modelo | Papel |
| --- | --- |
| `OrganizationTaxProfile` | Regime, CNAE, anexo, Fator R, UF/município, IE/IM, funcionários, ICMS/ISS, presunções, IBS/CBS por fora, telefones de aviso, onboarding. |
| `AccountingAccount` / `AccountingMapping` | Plano de contas (padrão PME sob demanda) e o vínculo categoria/conta bancária → conta contábil. |
| `JournalEntry` / `JournalLine` | Partidas dobradas. `sourceType=PAYMENT_ENTRY` e `sourceEvent` ACCRUAL ou SETTLEMENT. |
| `TaxRate` | Alíquotas globais (org null) e sobrescritas por org, versionadas. `seedKey` torna o seed idempotente. |
| `TaxAssessment` | Apuração por tributo e período (`AAAA-MM` ou `AAAA-Tn`), com memória de cálculo. O status vai de DRAFT para CONFIRMED e depois PAID. |
| `FiscalObligation` | Calendário. O status é PENDING, DONE, OVERDUE ou NOT_APPLICABLE. |
| `TaxCredit` | Crédito de CBS/IBS (e PIS/COFINS no Real) de nota de entrada. O status é PENDING_PAYMENT, AVAILABLE, USED ou GLOSSED. |
| `ProductTaxClassification` | NCM/NBS/LC 116/cClassTrib/redução de um produto ou serviço, referenciado por `ForgeProduct`. |
| `CompanyDocument` / `CompanyDocumentRequirement` | Documento da empresa (o arquivo fica no N-Box restrito) e o ajuste do catálogo por org. |
| `CompanyCredential` / `CompanyCredentialRevealLog` / `CompanyCertificate` | Cofre cifrado (AES-256-GCM, `src/lib/crypto.ts`) e certificado A1. |
| `RegularityScoreSnapshot` | Score diário, usado no histórico. |

**Campos novos em modelos existentes:**

- `NBoxFolder.systemKey` e `isRestricted`;
- `ForgeProduct.taxClassificationId`;
- `ForgeSimulation.taxRateBps` e `taxRateSource`;
- `ForgeProposal.taxBreakdown`;
- `PaymentContact.taxRegime` e `stateRegistration`;
- `NodeType.COMPLIANCE_ITEM_DUE`.

## 4. Arquivos

### Libs puras (`src/features/accounting/lib/`)
| Arquivo | Conteúdo |
| --- | --- |
| `format.ts` | centavos/bps, chaves de mês e trimestre |
| `tax/types.ts`, `tax/rate-lookup.ts` | tipos do motor e seleção de alíquota vigente (a municipal vence a genérica) |
| `tax/seed/default-tax-rates.ts` | tabelas: Simples I–V, MEI, Presumido, Real, ISS Teresina, transição da Reforma 2026–2033, IRRF, INSS, FGTS, retenções |
| `tax/simples/compute-rbt12.ts`, `compute-das.ts` | RBT12 (proporcional), Fator R, alíquota efetiva, sublimite |
| `tax/mei/compute-das-mei.ts` | DAS fixo e limite anual |
| `tax/presumido/compute-presumido.ts` | IRPJ/CSLL trimestral (com adicional), PIS/COFINS/ISS mensal |
| `tax/reforma/compute-cbs-ibs.ts`, `reform-timeline.ts` | CBS/IBS com créditos e redução por cClassTrib, ano-teste, Simples por dentro ou por fora, linha do tempo |
| `tax/payroll`, `tax/withholding`, `tax/late-payment`, `tax/utilities`, `tax/regime-comparison` | pró-labore/IRRF, custo de funcionário, retenções, guia em atraso, depreciação/juros, comparativo de regimes |
| `pricing/compute-pricing.ts`, `compute-effective-rate.ts` | markup divisor, margem real, carga sobre o faturamento por regime |
| `calculator/calculator-registry.ts` | **registro único** das 15 calculadoras (campos, prefill, execução) |
| `compliance/document-catalog.ts`, `compute-regularity-score.ts` | catálogo de cerca de 45 documentos e o score |
| `fiscal-calendar/build-fiscal-calendar.ts` | obrigações por regime, com vencimento antecipado em fim de semana |
| `journal/build-entry-journal.ts` | lançamento → partidas dobradas |
| `nfe-xml/parse-fiscal-xml.ts` | NF-e/NFS-e Nacional, grupo IBSCBS (NT 2025.002) |
| `chart-of-accounts/default-chart.ts` | plano padrão e contas de sistema |
| `glossary/terms.ts` | glossário e links oficiais |

### Servidor (`src/features/accounting/server/`)
- `tax-rates/load-tax-rates.ts`: provisionamento idempotente e leitura.
- `profile/tax-profile.ts`
- `chart/chart-of-accounts.ts`
- `journal/sync-entry-journals.ts`: apaga e recria em lotes de 200.
- `journal/queue-journal-sync.ts`: chamado depois do commit em create, pay, update, parcelas, cancelamento, exclusão, conciliação e desconciliação.
- `revenue/load-revenue.ts`
- `assessments/assess-period.ts` e `confirm-assessment.ts`
- `obligations/sync-fiscal-obligations.ts`
- `compliance/load-regularity.ts`: cumprimento mensal vem de obrigações, documentos com período e cobertura de notas.
- `credits/*`
- `reports/load-ledger-reports.ts`
- (frentes paralelas: `documents/`, `credentials/`, `nbox/`, `pricing/`, `alerts/`)

### oRPC (`src/app/router/accounting/`, exposto como `orpc.accounting.*`)

| Grupo | Procedures |
| --- | --- |
| Visão geral e perfil | `overview.get`, `profile.get`, `profile.update` (onboarding → backfill do journal) |
| Calculadora e alíquotas | `calculator.context`, `calculator.run`, `rates.list` |
| Apurações | `assessments.list`, `assessments.run`, `assessments.confirm`, `assessments.reopen` |
| Calendário | `obligations.list`, `obligations.setStatus` |
| Plano de contas | `chart.list`, `chart.create`, `chart.update`, `chart.setMapping` |
| Relatórios | `reports.trialBalance`, `reports.ledger`, `reports.balanceSheet`, `reports.reprocess` |
| Regularidade | `compliance.score`, `compliance.history`, `compliance.setRequirement` |
| Demais grupos | `documents.*`, `credentials.*`, `credits.*`, `pricing.*` |

**Acesso:** herda o whitelist do Payment (`requirePaymentAccess`). Cofre e pasta restrita exigem ADMIN ou OWNER.

### Inngest
- `accounting-journal-sync` (evento `accounting/journal.sync`, concorrência 1 por org)
- `accounting-journal-backfill` (evento `accounting/journal.backfill`)
- `accounting-nightly` (03:30): reconcilia os lançamentos alterados em 26h, obrigações e snapshot do score
- `detect-compliance-due` (08:00): avisos e gatilho

### Interface
`src/features/accounting/components/accounting-tab.tsx` (subaba em `?sub=`). As seções são:

- `overview`
- `documents`
- `profile`
- `assessments`
- `credits`
- `pricing`
- `calendar`
- `calculator`
- `chart`
- `reports`
- `reform`

Componentes compartilhados: `shared/fiscal-term-hint.tsx` (ⓘ) e `shared/calculation-memo.tsx`.

## 5. Fluxos

**Lançamento → contabilidade.** O service do financeiro faz o commit e chama `queueJournalSync`. O Inngest executa `syncEntryJournals`, que resolve as contas em três passos:

1. mapeamento da categoria;
2. conta padrão pelo tipo;
3. conta de sistema.

Em seguida grava ACCRUAL e SETTLEMENT.

**Apuração → guia.** `assessments.run(AAAA-MM)` grava DRAFT por tributo. Depois `assessments.confirm` cria um `PaymentEntry PAYABLE` em "Impostos e taxas" e vincula a obrigação. Quando o pagamento é feito, o cron noturno ou a sincronização marca a apuração como PAID e a obrigação como DONE.

**Crédito.** Uma NF de entrada (XML ou extração por IA) cujo destinatário é o CNPJ da org gera `TaxCredit PENDING_PAYMENT`. Com a despesa paga, o crédito vira AVAILABLE e abate a CBS/IBS na apuração.

**Score.**
- Documentos de validade: vencido vira EXPIRED; vencendo em até 30 dias ainda conta como em dia.
- Itens mensais: avaliados nos últimos 3 meses fechados desde o onboarding. Um mês em aberto zera o item.
- "Não se aplica" tira o item do score.

## 6. Validação

1. `pnpm tsx scripts/accounting-qa-check.ts`: 39 casos (CA-1, 2, 4–24).
2. Aplicar a migration: ver o ritual da regra 11 e a memória sobre o drift do Neon (`db execute` + `migrate resolve`).
3. Na interface:
   1. Concluir o perfil fiscal. Conferir que o backfill roda no Inngest dev e que o balancete fecha (CA-3).
   2. Apurar o mês passado, confirmar e ver a guia em Despesa.
   3. Subir uma CND e ver a validade lida pela IA e o score subir.
   4. Com um usuário sem acesso, `/nbox` não mostra a pasta restrita (CA-25).
   5. No cofre, revelar pede passkey e grava log (CA-26).
   6. No Forge, o simulador abre com a alíquota do perfil (CA-27).
   7. Rodar `detect-compliance-due` no Inngest dev (CA-28).
   8. Anexar XML de fornecedor a uma despesa, pagar e reapurar (CA-29).

## 7. Itens a confirmar na fonte oficial

A lista está na spec 0051, §9. Na interface, as linhas de `TaxRate` com `needsVerification` aparecem com o selo ⚠.

## 8. Changelog

| Data | Mudança |
| --- | --- |
| 2026-09-29 | Fase 1 criada (spec 0051). |
| 2026-09-29 | ASTRO cobre a aba inteira: 20 tools de leitura (`src/features/astro/server/tools/accounting/`, nomes em `tool-names.ts`), incluindo visão geral (`server/overview/load-accounting-overview.ts`, mesmo serviço do router), apurações gravadas, documentos cadastrados, fornecedores/despesas sem nota, balancete/balanço, linha do tempo da Reforma, tabelas de alíquota e link da subaba (`lib/accounting-sections.ts`). A subaba aberta vai ao contexto do ASTRO (`paymentSubTab`), e pergunta fiscal pula as consultas em código e o classificador de verbos (`astro/queries/accounting-question.ts`). |
