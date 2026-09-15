---
id: 0016
titulo: Extrato bancário em PDF e conciliação pelo Astro
dominio: payment
status: em-revisao
autor: Weydson
criada: 2026-09-15
atualizada: 2026-09-15
branch: feature/W-astro-finance-tools-20260915
pr: https://github.com/Act962/nasa.ex/pull/392
peso: completa
---

# 0016 — Extrato PDF e conciliação pelo Astro (Fase 3)

---

## 1. Contexto

A conciliação bancária (spec 0013) só aceita OFX. Na prática muitos bancos e
cooperativas só entregam o extrato em PDF para PJ, ou o empresário recebe o PDF
do contador — e a aba Conciliação fica vazia. Além disso, o Astro já lê boleto
e nota fiscal (spec 0014), mas não enxerga a fila de conciliação: "concilia o
extrato de agosto" não tem tool.

Esta é a fase 3 do Astro agente financeiro (plano em `docs/ASTRO_PROGRESS.md`).
Reaproveita a proposta persistida (`propose_*` → `confirm_action`), o anexo no
chat e o resolvedor de provedor de IA barato da fase 1.

## 2. Objetivo

O usuário envia um extrato em PDF (na aba Conciliação ou no chat do Astro), vê
banco, conta, período e número de transações, confirma, e as transações entram
na mesma fila do OFX — e pelo Astro consegue listar o que falta conciliar,
aceitar sugestões em lote, criar lançamento a partir de uma transação, ignorar
e desfazer, sempre com confirmação.

### Não-objetivos

- Extrato de cartão de crédito (fatura) — continua fora da conciliação.
- CSV/XLSX de extrato.
- Chunking automático de extrato longo: acima do limite, o usuário divide o PDF.
- Mudar a pontuação das sugestões (`score-match.ts`) ou persistir sugestões.
- Importação automática por e-mail (fase 5, spec 0018).
- WhatsApp com escrita (fase 6, spec 0019).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Um extrato em PDF anexado (`PaymentAttachment`) é lido por IA (`generateObject`, PDF como file part, provedor por `resolveExtractionModels`, com fallback de provedor e de texto) e vira `NormalizedStatement` com `source: PDF_UPLOAD`. |
| RF-2 | Cada transação do PDF recebe `externalId = "pdf:" + sha256(accountId|postedDate|direction|amountCents|normalizedMemo|occurrenceIndex)`, onde `occurrenceIndex` é a posição entre linhas idênticas do mesmo extrato. |
| RF-3 | A inspeção (sem escrita) mostra banco, conta do extrato, período, nº de transações, totais e a conta cadastrada sugerida, pela mesma regra do OFX (conta → banco → única conta). |
| RF-4 | A importação usa `ingestStatement` (idempotência por `@@unique([organizationId, accountId, externalId])`), vincula o anexo ao `PaymentStatementImport`, muda o `kind` do anexo para `EXTRATO` e renomeia no padrão da spec 0014 (data de referência = fim do período, contato = banco). |
| RF-5 | Extrato com mais de 400 transações é recusado com mensagem pedindo pra dividir o PDF. |
| RF-6 | Quando o extrato traz saldo inicial e final e a soma das movimentações não fecha, a importação segue com aviso `BALANCE_MISMATCH`. |
| RF-7 | Tools do Astro: `inspect_bank_statement`, `propose_statement_import`, `list_unreconciled_transactions` (com sugestões), `propose_reconciliation`, `propose_reconciliation_batch`, `propose_entry_from_transaction`, `propose_ignore_transaction`, `propose_unmatch_transaction`. Toda escrita passa por proposta confirmada. |
| RF-8 | Executores: `payment.statement.import`, `payment.tx.reconcile`, `payment.tx.reconcile_batch`, `payment.tx.create_entry`, `payment.tx.ignore`, `payment.tx.unmatch`. |
| RF-9 | A aba Conciliação aceita `.pdf` no upload manual (sobe como anexo → inspeção → importação) e mostra badge "PDF" nas transações de origem PDF. |
| RF-10 | A lógica das procedures de extrato sai de `src/app/router/payment/statements.ts` para serviços em `src/features/payment/server/statements/`; os handlers viram wrappers. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Importar PDF cobra `astro_finance_statement_pdf` (10★) **na importação** (confirmação no Astro, "Confirmar importação" na tela). Inspeção não cobra. Reimportar o mesmo arquivo na mesma conta não cobra. |
| RNF-2 | O caminho OFX mantém contrato e comportamento: mesmas mensagens de erro, mesma sugestão de conta, mesma idempotência. Mudanças de contrato são só aditivas (`source`, `starsCharged`, `attachmentId` opcional). |
| RNF-3 | Nada de I/O fora de banco dentro de `$transaction` (regra 18): cobrança, leitura do R2, IA, activity log e renomeação acontecem fora. |
| RNF-4 | Toda tool passa por `assertPaymentToolAccess`: inspeção/listagem `entries.view`; importação e criar lançamento `entries.create`; conciliar, ignorar e desfazer `entries.edit`. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um PDF de extrato anexado, quando o Astro chama `propose_statement_import`, então o card mostra banco, conta do extrato, período, nº de transações e a conta cadastrada sugerida (com o motivo).
- [ ] **CA-2** — Dada a proposta, quando o usuário confirma, então as transações nascem com `source: PDF_UPLOAD`, o `PaymentStatementImport` aponta o anexo, e o anexo passa a `kind: EXTRATO` com nome `AAAA-MM-DD_EXTRATO_<banco>.pdf`.
- [ ] **CA-3** — Dado um PDF já importado numa conta, quando é importado de novo na mesma conta (mesmo anexo ou reenvio do mesmo arquivo), então `imported = 0` e nada é duplicado.
- [ ] **CA-4** — Dado um extrato com dois lançamentos idênticos (mesmo dia, sentido, valor e histórico), quando importado, então os dois viram transações distintas.
- [ ] **CA-5** — Dada uma fila com sugestões de scores variados, quando `propose_reconciliation_batch({ minScore })` é confirmada, então só transações com score ≥ `minScore` e não ambíguas são conciliadas.
- [ ] **CA-6** — Dado um extrato cuja conta declarada difere da conta vinculada ao destino, quando a importação é proposta ou executada, então é recusada com a mesma mensagem do OFX.
- [ ] **CA-7** — Dado um extrato com mais de 400 movimentações, quando inspecionado ou importado, então a resposta pede para dividir o PDF e nada é gravado.
- [ ] **CA-8** — Dado um PDF, quando inspecionado e proposto, então nenhuma Star é debitada; quando confirmado, 10★ são debitadas uma única vez.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | PDF escaneado (sem texto) | Vai como arquivo ao modelo (vision); fallback de texto não se aplica. |
| CB-2 | Provedor recusa PDF como arquivo | Tenta o texto extraído (`pdf-parse`) no mesmo provedor, depois o próximo; aviso registra o fallback. |
| CB-3 | Nenhuma chave de IA | `no_api_key` apontando /integrations; nada cobrado. |
| CB-4 | Mesmo arquivo enviado de novo (anexo novo) | A leitura é copiada do anexo anterior com o mesmo `fileHash` — ids idênticos, sem nova chamada à IA. |
| CB-5 | Extrato sem saldo inicial | Sem conferência de soma; aviso `BALANCE_UNVERIFIED`; saldo do extrato não é gravado na conta. |
| CB-6 | Soma não fecha | Aviso `BALANCE_MISMATCH`; importa; saldo não é gravado na conta. |
| CB-7 | Linha com data inválida ou valor zero | Ignorada com aviso `INVALID_TRANSACTION` (severity error). |
| CB-8 | Número da conta no PDF com/sem agência ou dígito | Casamento por dígitos e sufixo (≥ 4 dígitos) contra `ofxAccountId`. |
| CB-9 | Importar PDF numa conta sem `ofxAccountId` | Aceita; o PDF **não** grava `ofxBankId/ofxAccountId` na conta (só o OFX grava). |
| CB-10 | Saldo de Stars insuficiente na confirmação | `insufficient_stars`; nada importado. |
| CB-11 | Lote com item que ficou inválido entre proposta e confirmação | Item falha com mensagem; os demais são conciliados; resumo mostra quantos falharam. |
| CB-12 | Lote com mais de 100 pendentes | Analisa as 100 mais recentes e avisa. |
| CB-13 | Anexo que não é OFX nem PDF | `unsupported`. |
| CB-14 | Extrato longo que estoura o limite de saída do modelo | Falha de leitura com mensagem pedindo pra exportar por período menor. |
| CB-15 | `read_financial_document` chamado num extrato já lido como extrato | A extração de documento sobrescreve o cache do extrato (formatos diferentes); a próxima inspeção relê. |

## 6. Decisões de design

### D-1 — PDF entra pela mesma porta (`NormalizedStatement`)

- **Escolha**: adaptador `pdf/parse-pdf-statement.ts` que entrega o mesmo
  `NormalizedStatement` do OFX; `ingestStatement`, `suggestMatches` e
  `applyPaymentToEntry` não mudam.
- **Alternativas descartadas**: tabela própria para transações de PDF (duas
  filas); pedir à IA para casar com lançamentos (não conferível, caro).
- **Consequência**: tudo que já funciona para OFX (sugestão, lote, desfazer)
  funciona para PDF.

### D-2 — Leitura grátis, cobrança na importação

- **Escolha**: a inspeção lê e guarda em `PaymentAttachment.extraction`
  (`kind: "BANK_STATEMENT"`) sem cobrar; `importStatementFromAttachment` cobra
  10★ antes de gravar, só para PDF e só se o arquivo ainda não entrou naquela
  conta. A mesma regra vale na tela e no Astro.
- **Alternativas descartadas**: cobrar na leitura (o usuário pagaria por um
  arquivo errado antes de ver o resumo); cobrar só no Astro (a tela viraria
  leitura por IA grátis).
- **Consequência**: leitura sem importação é custo de IA sem receita — aceito,
  mitigado pelo cache por `fileHash`.

### D-3 — Id sintético determinístico com índice de ocorrência

- **Escolha**: `sha256(accountId|postedDate|direction|amountCents|normalizedMemo|occurrenceIndex)`,
  com o histórico normalizado (sem acento, minúsculo, só alfanumérico, 80
  caracteres).
- **Alternativas descartadas**: hash do arquivo + posição (reimportar um PDF
  de período sobreposto duplicaria tudo); sem índice (dois lançamentos
  idênticos no mesmo dia colapsariam em um — CA-4).
- **Consequência**: idempotência depende da IA ler o mesmo histórico; por isso
  a leitura é cacheada por `fileHash` (CB-4). Extratos de períodos sobrepostos
  lidos em arquivos diferentes podem duplicar se a IA ler o histórico diferente
  — risco aceito e documentado.

### D-4 — Saldo e ids da conta só vêm de fonte exata

- **Escolha**: `statementBalanceCents` só é gravado do PDF quando saldo inicial
  + movimentações = saldo final; `ofxBankId/ofxAccountId` da conta só são
  gravados por OFX.
- **Consequência**: um dígito lido errado não contamina o saldo da conta nem
  quebra o casamento exato do próximo OFX.

### D-5 — Limite de 400 transações

- **Escolha**: o prompt manda parar na 401ª; acima de 400 a importação é
  recusada pedindo pra dividir.
- **Alternativas descartadas**: chunking por página (várias chamadas, ordem e
  índice de ocorrência entre chunks ficam frágeis).
- **Consequência**: o limite prático pode ser menor no `gpt-4o-mini` (16k
  tokens de saída); nesse caso a leitura falha e o fallback tenta o próximo
  provedor (CB-14).

### D-6 — Handlers viram wrappers; contrato só cresce

- **Escolha**: serviços `import-statement.ts`, `inspect-statement.ts`,
  `list-transactions.ts`, `reconcile-transaction.ts`,
  `create-entry-from-transaction.ts`, `ignore-transaction.ts`,
  `unmatch-transaction.ts` com resultado `{ ok } | StatementFailure`; o
  handler traduz `not_found` → `NOT_FOUND` e o resto → `BAD_REQUEST`. O PDF da
  tela usa as procedures existentes com `attachmentId` opcional — nenhuma
  procedure nova.
- **Consequência**: Astro e tela executam exatamente o mesmo código.

## 7. Impacto

- [x] Schema / migration — `PaymentBankTxSource += PDF_UPLOAD` (`payment_bank_tx_source_pdf_upload`)
- [x] Procedures oRPC — `payment.statements.import`/`inspect` aceitam `attachmentId`; saídas ganham `source` (e `starsCharged` no import); `transactions.list` ganha `source`. Aditivo.
- [ ] Realtime
- [ ] Automações (Inngest)
- [ ] Env vars novas — reusa `ASTRO_FINANCE_EXTRACT_PROVIDER`/`ASTRO_FINANCE_EXTRACT_MODEL`
- [ ] Breaking change
- [x] Documentação — `docs/ASTRO_PROGRESS.md`, `docs/STARS_OVERVIEW.md`, regra `astro_finance_statement_pdf` em `src/data/star-rules.ts` + seed

## 8. Plano de testes

O projeto não tem runner de teste (CLAUDE.md, item 20). Verificação manual:

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Anexar extrato PDF no `/home`, pedir "importa esse extrato"; conferir o card |
| CA-2 | manual | Confirmar; checar `payment_bank_transactions.source`, `payment_statement_imports.attachment_id` e o anexo em Documentos |
| CA-3 | manual | Importar o mesmo PDF duas vezes (mesmo anexo e reenvio); segunda = 0 novas, sem débito de Stars |
| CA-4 | automatizável (lógica pura) | `buildNormalizedPdfStatement` com duas linhas idênticas → dois `externalId` distintos |
| CA-5 | manual | Fila com sugestões 60/85/95; `minScore: 80` concilia só as de 85 e 95 |
| CA-6 | manual | Conta com `ofxAccountId` de outro número; proposta e tela recusam |
| CA-7 | automatizável (lógica pura) | Extração com 401 transações → `too_many_transactions` |
| CA-8 | manual | Conferir `StarTransaction` após inspeção (nada) e após confirmação (10★) |
| RNF-2 | manual | Importar um OFX real do Nubank e do BB antes/depois: mesmos números, mesmas mensagens |

## 9. Riscos e rollback

- Migration aditiva (valor de enum). Rollback do enum no Postgres exige recriar
  o tipo; alternativa é deixar o valor e reverter o código.
- Qualidade da leitura em extratos longos e em bancos com layout em colunas:
  mitigado por aviso de soma, badge "PDF" na fila e confirmação obrigatória.
- Rota `/api/rpc` sem `maxDuration` estendido: leitura de PDF grande pode passar
  do timeout da plataforma em produção.
- Regra `astro_finance_statement_pdf` precisa existir em `AppStarCost`; sem ela a
  cobrança é pulada em silêncio.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-15 | Weydson | Criada |
