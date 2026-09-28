---
id: 0040
titulo: Aba Contábil no financeiro — fundação contábil, guias, créditos, precificação e regularidade
dominio: accounting
status: em-revisao
autor: Weydson
criada: 2026-09-28
atualizada: 2026-09-28
branch: claude/blissful-knuth-o3bk9j
pr:
peso: completa
---

# 0040 — Aba Contábil: fundação (Fase 1)

> Plano de origem: [`docs/contabil-plano.md`](../../docs/contabil-plano.md). Acompanhamento: [`docs/contabil-overview.md`](../../docs/contabil-overview.md).
> Esta spec **corrige** o plano onde ele cita código que não existe. Veja a §6, D-1 a D-9. Quando plano e spec divergirem, **vale a spec**.

---

## 1. Contexto

O NASA Payment registra receitas e despesas (`PaymentEntry`, com competência e caixa separados), mas não tem camada contábil nem fiscal. Hoje cada imposto é calculado fora do sistema, pelo contador, e o sistema só recebe o valor da guia digitado à mão. As consequências:

- **Preço sem imposto.** O "Impostos (%)" do simulador do Forge é digitado à mão e **não é salvo**: `taxRate` só existe em `useState` (`src/features/forge/components/simulator/simulation-builder.tsx:158`), e `buildPayload` e `simulator-schema.ts` não têm esse campo. Uma proposta pode sair sem imposto, e ninguém percebe.
- **Crédito perdido.** A leitura de NF (`src/features/payment/schemas/financial-document-extraction.ts`) só pega o valor total. Sem itens nem tributos destacados, o crédito de IBS/CBS, que é não cumulativo (LC 214/2025), fica inviável.
- **Regularidade invisível.** Nenhum lugar mostra quais certidões, alvarás e guias estão em dia. Uma CND vencida só aparece quando a empresa perde uma licitação.
- **Vencimentos fiscais sem aviso**, apesar de já existirem sino, push e WhatsApp (`dispatchAlert` e `sendOrganizationWhatsAppText`).

O objetivo é **depender o mínimo possível de contador**, cobrindo Simples/MEI, Lucro Presumido e (parcialmente) Lucro Real, e ficando compatível com a Reforma Tributária (EC 132/2023, LC 214/2025).

## 2. Objetivo

A organização configura o perfil fiscal uma vez. A partir daí, o NASA apura o imposto do mês com a memória de cálculo, gera a guia como despesa a pagar, mostra o crédito de IBS/CBS aproveitável, precifica produtos e propostas com o imposto correto e mede a regularidade documental. Tudo isso se explica sozinho, com o termo, a base legal, o link oficial e o ASTRO.

### Não-objetivos

- **Emissão de NF-e/NFS-e** e captura DF-e: ficam para a Fase 2, com spec própria.
- **Livro PF / IRPF**: Fase 3.
- **Lucro Real completo** (LALUR/LACS definitivos, PIS/COFINS não cumulativo, SPED ECD/ECF/EFD): Fase 4. Nesta fase o Real tem só razão, balancete e um LALUR em rascunho.
- **Consulta ou emissão automática de certidões e integração SEFAZ-PI**: Fase 5.
- **Ferramentas de escrita do ASTRO.** Na Fase 1 o ASTRO só lê e simula.
- **Split payment real.** Ele depende de a API do Comitê Gestor ser publicada.
- **Substituir o contador em obrigações assinadas** (ECD/ECF com responsável técnico). O sistema prepara e avisa, mas não transmite.
- **Refatorar os services de `payment/server/entries/*`** para transação interativa (ver D-1).
- **Corrigir a falta de auth em `/api/s3/upload`.** O problema é pré-existente e será registrado em `docs/seguranca-auditoria-2026-08.md`. Os documentos restritos usam uma rota nova e autenticada.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `OrganizationTaxProfile` 1:1 com a Organization: regime (MEI/SIMPLES/PRESUMIDO/REAL), CNAEs, anexo do Simples, IE/IM, município IBGE, UF, data de abertura, folha dos últimos 12 meses (Fator R) e a opção por IBS/CBS fora do Simples. |
| RF-2 | Plano de contas `AccountingAccount` em árvore, com código referencial SPED e seed de um plano PME. `AccountingMapping` liga uma `PaymentCategory` ou `PaymentBankAccount` a uma conta analítica. |
| RF-3 | `JournalEntry`/`JournalLine` derivados de `PaymentEntry`, com rebuild idempotente por `(sourceType, sourceId)`, disparado depois do commit, e backfill (D-1). |
| RF-4 | Relatórios: balancete, razão por conta e balanço, além de uma "DRE contábil" ao lado da DRE atual (`router/payment/reports.ts`), que continua como está. |
| RF-5 | `TaxRateTable` versionada por vigência (`validFrom`/`validTo`), com `sourceUrl` e `verifiedAt` em cada linha. Nenhuma alíquota fica fixa no código. |
| RF-6 | Motor fiscal com funções puras em `src/features/accounting/lib/tax/`: DAS do Simples (RBT12, alíquota efetiva, Fator R, anexo), DAS-MEI, IRPJ/CSLL do Presumido (trimestral, com adicional de 10%), PIS/COFINS cumulativos, ISS e CBS/IBS com redução por `cClassTrib` e créditos. |
| RF-7 | `TaxAssessment`: a apuração começa em DRAFT com `memoriaCalculo`. Ao confirmar, gera um `PaymentEntry` PAYABLE (a guia) e liga o `paymentEntryId`. `FiscalObligation` forma o calendário. |
| RF-8 | `TaxCredit`: nasce PENDING_PAYMENT a partir de uma NF de entrada anexada (XML primeiro, IA como alternativa) e passa a AVAILABLE quando a despesa vinculada é paga. É idempotente por `[organizationId, accessKey, tax]`. |
| RF-9 | A extração de documento ganha os blocos opcionais `taxes` e `items[]`, sem quebrar os consumidores atuais. |
| RF-10 | `ProductTaxClassification` (NCM/NBS/LC 116/cClassTrib/CST/redução/município do ISS), ligada a `ForgeProduct.taxClassificationId`. |
| RF-11 | O simulador do Forge preenche "Impostos (%)" a partir de `compute-effective-rate`, com a opção de trocar para manual, e salva `taxRateBps` e `taxRateSource`. A proposta grava `taxBreakdown` sem remover as linhas atuais. |
| RF-12 | Glossário único (`lib/glossary/terms.ts`) e `<FiscalTermHint termId>` em todo rótulo técnico. "Perguntar ao ASTRO" chama `openAstroWidget(term.astroPrompt)`. |
| RF-13 | Pacote ASTRO `accounting` em `APP_TOOL_PACKS`, só de leitura, com o prompt de escopo em `astro/lib/prompts/accounting.ts`. |
| RF-14 | Alertas `accounting.*` no `alert-catalog.ts` e cron diário com dedup por slot. Canais: sino, push e WhatsApp, todos depois do commit. Gatilho de workflow `COMPLIANCE_ITEM_DUE`. |
| RF-15 | Documentos da empresa: pasta de sistema restrita no N-Box, `CompanyDocumentType` (catálogo seed), `CompanyDocument`, leitura por IA de tipo/número/emissão/validade/CNPJ e alerta de CNPJ divergente. |
| RF-16 | Score de Regularidade como função pura, com snapshot diário (`RegularityScoreSnapshot`). |
| RF-17 | Cofre `CompanyCredential`, cifrado, com step-up WebAuthn para revelar e log de auditoria. O certificado A1 fica cifrado, e a validade é lida do certificado. |
| RF-18 | Calculadora única (subaba + botão flutuante 🧮). Todas as contas vêm das funções puras de RF-6 e de `lib/pricing/`, e todo resultado traz a memória de cálculo, a base legal e a vigência. |
| RF-19 | Aba "Contábil" no `payment-page.tsx` com as subabas do plano (§10). As chamadas oRPC ficam em `accounting/hooks/use-accounting-*.ts` (regra 9). |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O acesso reaproveita `requirePaymentAccess(resource, action)` (`src/app/middlewares/payment-access.ts`). Cofre e pasta restrita exigem `PaymentRole` ADMIN ou OWNER. |
| RNF-2 | Transações Prisma só com escritas (regra 18). Journal, alertas, WhatsApp, Inngest e IA rodam depois do commit, best-effort. |
| RNF-3 | Valores em centavos (`Int`) e alíquotas em basis points (`Int`). Nada de `Float` para dinheiro. |
| RNF-4 | Funções puras sem Prisma e sem I/O, testáveis por `scripts/accounting-qa-check.ts` (`pnpm tsx`), com um caso por CA-n (não há runner, regra 20). |
| RNF-5 | Todo número fiscal exibido mostra a vigência da tabela usada e o aviso "estimativa, confira a base legal". |
| RNF-6 | Um segredo cifrado nunca volta ao client, a não ser pela procedure de revelação, que é auditada. O `.pfx` fica cifrado no R2, não em coluna. |

## 4. Critérios de aceite

### Schema e perfil fiscal
- [ ] **CA-1**: Dada uma org sem perfil, quando o usuário salva o wizard do Perfil fiscal com regime SIMPLES e CNAE de serviço, então existe exatamente um `OrganizationTaxProfile` para ela, e o wizard sugere o anexo a partir do CNAE (a sugestão pode ser editada).
- [ ] **CA-2**: A migration `accounting_foundation` é **aditiva**: nenhuma coluna existente é removida nem vira obrigatória. As colunas novas em `ForgeSimulation`, `ForgeProposal`, `PaymentContact` e `NBoxFolder` são opcionais ou têm default.
- [ ] **CA-3**: O seed cria o plano de contas PME com contas sintéticas e analíticas, e rodar o seed duas vezes não duplica nada (upsert por `code`).

### Journal
- [ ] **CA-4**: Dado um `PaymentEntry` PAYABLE mapeado para uma conta de despesa, quando ele é criado e depois pago, então há `JournalEntry` com Σ `debitCents` = Σ `creditCents`: na competência, D despesa / C fornecedores; no pagamento, D fornecedores / C banco.
- [ ] **CA-5**: Rodar `rebuildJournalForSource` N vezes para o mesmo `sourceId` resulta no mesmo conjunto de linhas (idempotência).
- [ ] **CA-6**: Uma falha no rebuild **não** faz o create, o pay ou o update do `PaymentEntry` falhar. O pagamento persiste, e o sweep noturno reconstrói o journal depois.
- [ ] **CA-7**: O balancete do período fecha (total de débitos = total de créditos), e o saldo da conta banco no balancete bate com o `PaymentBankAccount` quando todas as entradas estão mapeadas.
- [ ] **CA-8**: Um lançamento sem `AccountingMapping` cai em uma conta transitória "A classificar" e aparece numa lista de pendências. Ele nunca é descartado em silêncio.

### Motor fiscal (casos numéricos na §8.1)
- [ ] **CA-9**: `computeDas` devolve a alíquota efetiva e o valor do caso R-1 (anexo III, Fator R ≥ 28%).
- [ ] **CA-10**: `computeDas` devolve o caso R-2 (a mesma empresa com Fator R < 28%, tributada no anexo V).
- [ ] **CA-11**: `computeIrpjCsllPresumido` devolve os casos R-3 (trimestre sem adicional) e R-4 (com adicional de 10%). `computePisCofinsCumulativo` devolve PIS e COFINS de R-3.
- [ ] **CA-12**: `computeCbsIbs` para 2026 devolve o caso R-5: CBS 0,9% e IBS 0,1%, marcados como informativos, com compensação sobre PIS/COFINS. Para o Simples em 2026 o resultado é "dispensado".
- [ ] **CA-13**: Com um `TaxCredit AVAILABLE` na competência, `computeCbsIbs` abate o crédito do débito (R-6), e o valor nunca fica negativo (o excedente vira saldo credor).
- [ ] **CA-14**: As funções recebem as linhas de `TaxRateTable` como parâmetro. Trocar a linha vigente muda o resultado sem mudança de código, e uma data fora de qualquer vigência gera um erro explícito (`RATE_NOT_FOUND`).
- [ ] **CA-15**: Confirmar um `TaxAssessment` DRAFT cria **um** `PaymentEntry` PAYABLE com o valor e o vencimento da guia. Confirmar de novo não cria um segundo (unique `[organizationId, tax, period]` e `paymentEntryId` preenchido).

### Créditos
- [ ] **CA-16**: `parseNfe(xml)` extrai a chave de acesso, o emitente, os itens (NCM, CFOP, CST/cClassTrib, valor) e os totais de ICMS/PIS/COFINS/IBS/CBS de um XML fixture com o grupo IBSCBS (NT 2025.002).
- [ ] **CA-17**: Anexar o XML a uma despesa não paga cria `TaxCredit` PENDING_PAYMENT. Pagar a despesa muda para AVAILABLE. Anexar o mesmo XML de novo não duplica.
- [ ] **CA-18**: Uma despesa paga sem NF anexada, em categoria marcada como geradora de crédito, aparece em "crédito perdido" e dispara `accounting.credit_missing_invoice` uma única vez por slot.
- [ ] **CA-19**: Os consumidores atuais do schema de extração (Astro `tools/finance/documents.ts`, inbox, anexos) continuam funcionando com um documento sem `taxes`/`items`.

### Glossário e ASTRO
- [ ] **CA-20**: Todo `termId` usado na aba existe em `terms.ts` (conferido por script), e todo termo tem `plainExplanation`, `legalBasis`, ao menos um link e `astroPrompt`.
- [ ] **CA-21**: Clicar em "Perguntar ao ASTRO" num `FiscalTermHint` dispara `openAstroWidget` com o `astroPrompt` do termo, e o widget abre com o prompt preenchido.
- [ ] **CA-22**: O pacote `accounting` aparece em `listAppToolPacks()` e expõe só ferramentas de leitura. À pergunta "quanto vou pagar de DAS este mês?" o ASTRO responde chamando `simulate_das`, com a base legal na resposta.

### Precificação e Forge
- [ ] **CA-23**: Uma simulação nova abre com "Impostos (%)" = alíquota efetiva do perfil (`taxRateSource = PROFILE`). Trocar para manual e salvar persiste `taxRateBps` e `taxRateSource = MANUAL`, e ao recarregar o valor salvo continua lá.
- [ ] **CA-24**: As simulações existentes, sem `taxRateBps`, abrem como estão hoje (default 0, MANUAL), sem erro.
- [ ] **CA-25**: A proposta convertida grava `taxBreakdown` estruturado e mantém as linhas atuais de imposto. As propostas antigas, sem `taxBreakdown`, continuam renderizando.
- [ ] **CA-26**: A calculadora de markup devolve o caso R-7, e "aplicar na simulação" atualiza o preço da simulação aberta.
- [ ] **CA-27**: "Produtos & Preços" lista produtos sem classificação e propostas cuja alíquota difere da efetiva em mais de 0,5 ponto percentual.

### Avisos
- [ ] **CA-28**: O cron diário gera `accounting.obligation_due_soon` para uma obrigação que vence em D-5, D-1 e D0, e `obligation_overdue` depois do vencimento. Rodar o cron duas vezes no mesmo slot não envia de novo (unique em `ComplianceAlertDispatch`).
- [ ] **CA-29**: Com o WhatsApp da org configurado, o aviso sai por `sendOrganizationWhatsAppText`. Sem WhatsApp, o sino e o push continuam, e a falha não interrompe o cron.
- [ ] **CA-30**: Um workflow com gatilho `COMPLIANCE_ITEM_DUE` filtrado por tipo "guia" é executado para uma guia vencendo, e **não** é executado para um documento vencendo.

### N-Box, documentos, score e cofre
- [ ] **CA-31**: Um usuário sem `PaymentAccess` ADMIN/OWNER não vê a pasta "Documentos da empresa" nem os itens dela em `nbox.folders.getMany`, `nbox.items.getMany` e no diálogo do `SEND_NBOX`.
- [ ] **CA-32**: Um item restrito não pode ser marcado como público: a procedure recusa com erro tipado.
- [ ] **CA-33**: Subir o PDF de uma CND preenche a sugestão de tipo, número, emissão e validade. Se o CNPJ do documento for diferente do da org, aparece um alerta e a gravação exige confirmação.
- [ ] **CA-34**: `computeRegularityScore` devolve o caso R-9: com 1 mês de guia em aberto o score cai, e depois do pagamento volta.
- [ ] **CA-35**: Um item EXPIRING_SOON conta como OK no score e gera alerta. Um item crítico EXPIRED gera o aviso de "impedimento".
- [ ] **CA-36**: Revelar uma `CompanyCredential` exige asserção WebAuthn válida de uma credencial do `PaymentAccess` do usuário e grava `CompanyCredentialRevealLog`. Sem a asserção, o erro é 403 e o segredo não sai.
- [ ] **CA-37**: Separar o `nbox-explorer.tsx` não muda o comportamento do `/nbox` (checagem manual: criar pasta, subir, mover, excluir).

### Calculadora
- [ ] **CA-38**: Cada calculadora devolve os casos R-1 a R-8, e todo resultado inclui a memória de cálculo com a vigência da tabela usada.
- [ ] **CA-39**: A calculadora de guia em atraso devolve o caso R-8, com multa limitada a 20%, e os juros Selic entram como dado (entrada ou tabela), nunca fixos no código.
- [ ] **CA-40**: O botão flutuante 🧮 abre o Sheet com o contexto da subaba (por exemplo, a apuração aberta já preenche RBT12 e a receita do mês).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Org sem `OrganizationTaxProfile` abre a aba | Estado vazio com CTA para o wizard. Apuração, preço efetivo e ferramentas do ASTRO devolvem `TAX_PROFILE_MISSING` em vez de calcular com zero |
| CB-2 | `PaymentEntry` em categoria sem mapeamento | Vai para a conta transitória "A classificar" (CA-8) |
| CB-3 | `PaymentEntry` pago parcialmente (spec 0023) | Journal gera uma linha de baixa por pagamento parcial, nunca pelo total |
| CB-4 | `PaymentEntry` cancelado ou excluído depois do journal | Rebuild remove as linhas daquele `sourceId`. Se o período estiver com apuração CONFIRMED, marca a apuração como "desatualizada" e não altera a guia |
| CB-5 | Parcelas/recorrência | Cada parcela é um `sourceId` próprio |
| CB-6 | RBT12 com menos de 12 meses (empresa nova) | Proporcionalização do art. 18 §2º da LC 123 **[VERIFICAR]**: receita média × 12 |
| CB-7 | RBT12 acima de R$ 4,8 mi ou do sublimite de ICMS/ISS | O cálculo avisa sobre o desenquadramento e o recolhimento por fora, sem calcular silenciosamente com a última faixa |
| CB-8 | Anexo IV / V sem folha informada | O Fator R é tratado como desconhecido, e o sistema pede a folha em vez de assumir 0 |
| CB-9 | Mesma NF anexada a duas despesas | Um único `TaxCredit` (unique `accessKey`+`tax`). A segunda anexação só referencia o crédito |
| CB-10 | NF de fornecedor do Simples | O crédito segue a regra do regime do fornecedor (`PaymentContact.taxRegime`). Sem regime cadastrado, o crédito fica PENDING e aparece no checklist |
| CB-11 | Despesa paga e depois estornada | O `TaxCredit` volta para PENDING_PAYMENT. Se já estiver USED numa apuração confirmada, vira GLOSSED e aparece como pendência |
| CB-12 | Data de competência fora de qualquer vigência da `TaxRateTable` | `RATE_NOT_FOUND` explícito (CA-14) |
| CB-13 | Duas confirmações simultâneas da mesma apuração | O unique em `[organizationId, tax, period]` e o update condicional `status = DRAFT` garantem uma única guia |
| CB-14 | Cron roda duas vezes (retry do Inngest) | Dedup por `ComplianceAlertDispatch` (CA-28) |
| CB-15 | Documento sem validade (contrato social) | `recurrence = ONE_TIME`, e o documento fica OK enquanto existir |
| CB-16 | Documento não aplicável (CNDT numa empresa sem funcionários) | Não entra no denominador do score |
| CB-17 | Usuário perde o `PaymentAccess` ADMIN | Na próxima consulta, a pasta restrita e o cofre somem, e os presigned URLs já emitidos expiram pelo TTL |
| CB-18 | `AI_SECRETS_KEY` ausente ou trocada | Criar credencial falha com erro claro. Revelar uma credencial cifrada com outra chave devolve "não foi possível decifrar", sem 500 genérico (ver D-7) |
| CB-19 | PDF de documento ilegível para a IA | O documento é salvo sem extração, com os campos manuais, sem bloquear o upload |
| CB-20 | Proposta antiga sem `taxBreakdown` | Renderiza pelas linhas atuais (CA-25) |

## 6. Decisões de design

### D-1: o journal é derivado depois do commit e não "no mesmo tx"
- **Escolha:** `rebuildJournalForSource(sourceType, sourceId)` apaga e recria as linhas daquela origem numa `$transaction` própria, só com escritas. É disparado depois do commit pelos services de entries (evento Inngest `accounting/journal.rebuild`), com backfill e sweep noturno. Em `create-entry.ts` o ponto natural é o `runPostCreateEffects`, que já roda depois do `$transaction`.
- **Alternativa descartada:** chamar `post-from-payment-entry.ts` "no `tx` dos services", como diz o plano. **Esse `tx` não existe.** `create-entry.ts` usa `$transaction([...])` em forma de array, e `pay-entry.ts`/`update-entry.ts` fazem `update` direto, sem transação. Seria preciso refatorar três services financeiros em produção, criando um "depende de" novo sobre o fluxo de pagamento. O usuário escolheu esta opção em 2026-09-28.
- **Consequência:** o journal fica **eventualmente consistente**. Relatórios mostram o "último rebuild" e apontam pendências. O pagamento nunca falha por causa do journal (CA-6).

### D-2: não existe service de cancelamento
- `payment/server/entries/*` só tem `create`, `pay`, `update`, `generate-installments` e `query`. O cancelamento é mudança de status em `update-entry.ts`, e os ganchos de rebuild ficam nesses services.

### D-3: dedup do cron em tabela própria
- **Escolha:** `ComplianceAlertDispatch` com `@@unique([organizationId, itemKey, slot])` e `createMany({ skipDuplicates: true })`. Só quem inseriu dispara o alerta.
- **Descartado:** reaproveitar `WorkflowScheduleClaim`/`SCHEDULE_TRIGGER` e copiar `detect-expenses-due-today.ts`. **Nenhum dos três existe no código.** O cron usa como base `src/inngest/functions/crons/detect-overdue.ts` e `payment/goal-daily-check.ts` (cron diário) e é registrado no serve do Inngest.

### D-4: sem "persona ACCOUNTING"
- **Escolha:** o escopo do ASTRO sai do próprio `AppToolPack` (`{ appSlug, read, write, systemPrompt }` em `astro/server/tools/app-packs.ts`), com o prompt em `astro/lib/prompts/accounting.ts`, espelhando `finance.ts`. `write` fica vazio na Fase 1.
- **Descartado:** `astro-commander/lib/personas.ts` e `defaultTools`, que **não existem**. Criar um sistema de personas está fora do escopo.

### D-5: `NodeType` novo entra direto como `COMPLIANCE_ITEM_DUE`
- **Escolha:** um único gatilho com filtro por tipo (obrigação, documento, guia, nota do mês). O `FISCAL_OBLIGATION_DUE` nunca é criado.
- **Consequência:** um valor novo de `NodeType` mexe em cerca de 12 arquivos, não 3: o enum Prisma, `src/config/node-components.ts`, `tracking-executions/lib/node-options.ts`, `components/agent-node-forms.tsx`, `components/agent-node.tsx`, `inngest/functions/agent-workflow-triggers.ts`, `inngest/utils.ts`, `workflows/lib/agent-executor-registry.ts`, `validate-node.ts`, `run-workflow.ts`, `editor/components/step-by-step-container.tsx` e `router/workflow/update-is-active.ts` (mais `update.ts`/`delete.ts`). O modelo a seguir é o `PAYMENT_RECEIVED`.

### D-6: o filtro de restrição no N-Box fica nos itens, não só nas pastas
- O diálogo do `SEND_NBOX` (`tracking-executions/components/send-nbox/dialog.tsx`) lista **itens** por `nbox.items.getMany` e não tem seletor de pasta. O filtro precisa estar em `router/nbox/get-items.ts` **e** em `get-folders.ts`.

### D-7: chave do cofre
- **Escolha:** `encryptSecret`/`decryptSecret` de `src/lib/crypto.ts`, com uma **chave própria** `COMPANY_VAULT_KEY` (≥ 16 chars) documentada no CLAUDE.md. Se a variável não existir, cai em `AI_SECRETS_KEY` com aviso no log.
- **Descartado:** usar só `AI_SECRETS_KEY`, que acoplaria a rotação da chave de IA às senhas de portais fiscais.
- **Consequência:** o `src/lib/crypto.ts` lê a chave fixa de `AI_SECRETS_KEY`, com salt `nasa-ai-secrets-v1` e cache de módulo. Vai ser preciso um overload pequeno (`encryptSecret(plain, { keyEnv, salt })`), e as chamadas atuais não mudam.

### D-8: alíquota é dado, e todo dado tem fonte
- Toda linha de `TaxRateTable` e todo link do glossário carregam `sourceUrl` e `verifiedAt`. Linhas com `verifiedAt` nulo aparecem na UI como "não verificada". Os valores marcados [VERIFICAR] nesta spec entram no seed com o comentário `// VERIFICAR` e são listados no PR.

### D-9: alerta e categoria de alerta
- `AlertCategory` e `AppKey` (`alert-catalog.ts`) não têm valor para finanças. Adicionar `ACCOUNTING` aos dois.

### D-10: nomes reais dos campos existentes
- `PaymentContact.document` (e não `cpfCnpj`) e `contactType` como string (`CUSTOMER`/`SUPPLIER`/`BOTH`). Centro de custo é `PaymentCostCenter`, e `JournalLine.costCenterId` aponta para ele.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`): migration aditiva `accounting_foundation`, mais uma migration para o `NodeType` na etapa de avisos
- [x] Procedures oRPC: novo `src/app/router/accounting/`, mais alterações em `router/forge/simulations.ts` e `router/nbox/get-*.ts`
- [ ] Realtime (Pusher / event-bus)
- [x] Automações (Inngest): rebuild do journal, backfill, sweep, cron de compliance, snapshot do score e gatilho `COMPLIANCE_ITEM_DUE`
- [x] Env vars novas: `COMPANY_VAULT_KEY` (D-7)
- [ ] Breaking change para clientes existentes: não (CA-2, CA-19, CA-24, CA-25)
- [x] Documentação obrigatória: `docs/contabil-overview.md` (regra 21, nova), CLAUDE.md (env var) e `docs/seguranca-auditoria-2026-08.md` (`/api/s3/upload`)

### Ordem de implementação (uma etapa por sessão, mesma branch e mesmo PR)

| Etapa | Escopo | CA |
| --- | --- | --- |
| 1 | Esta spec, o plano no repositório, o overview e a regra 21 | — |
| 2 | Schema completo + seed, journal (D-1), motor fiscal, calculadora, Perfil/Apurações/Plano de contas/Balancete, glossário e `FiscalTermHint` | CA-1…15, 20, 21, 38…40 |
| 3 | N-Box restrito, documentos, score, cofre | CA-31…37 |
| 4 | Créditos + Forge/precificação | CA-16…19, 23…27 |
| 5 | Avisos + `COMPLIANCE_ITEM_DUE` + ASTRO + Reforma + Space Help + Visão geral | CA-22, 28…30 |

## 8. Plano de testes

Não há runner (regra 20). As funções puras são validadas por `scripts/accounting-qa-check.ts` (`pnpm tsx`), com um caso por CA, cujo nome cita o id. O resto é checado manualmente.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-9…14, 16, 26, 34, 35, 38, 39 | automatizado (script) | Casos R-1…R-9 abaixo, com fixtures XML em `scripts/fixtures/accounting/` |
| CA-4, 5, 7, 8 | script contra o banco local | Criar e pagar uma entry, rodar o rebuild 2×, conferir a soma D=C |
| CA-15, 17, 18, 28, 30 | manual (Inngest dev) | Disparar e repetir, e conferir que não duplica |
| CA-1…3, 19…25, 27, 29, 31…33, 36, 37, 40 | manual | Roteiro de validação em `docs/contabil-overview.md` |

### 8.1 Casos de referência numéricos

> Os valores foram **calculados a partir das tabelas abaixo**. As tabelas vêm de fonte legal, mas **não foram conferidas na fonte nesta sessão**, porque o acesso de rede aos sites oficiais estava bloqueado. Por isso estão todas marcadas [VERIFICAR]. Se a conferência mudar uma tabela, recalcule o caso e registre no changelog.

**Tabelas usadas.** LC 123/2006, Anexos III e V, redação da LC 155/2016 **[VERIFICAR]**:

| Faixa | RBT12 | Anexo III nominal | III dedução | Anexo V nominal | V dedução |
| --- | --- | --- | --- | --- | --- |
| 1 | até 180.000,00 | 6,00% | 0 | 15,50% | 0 |
| 2 | 180.000,01 – 360.000,00 | 11,20% | 9.360,00 | 18,00% | 4.500,00 |
| 3 | 360.000,01 – 720.000,00 | 13,50% | 17.640,00 | 19,50% | 9.900,00 |
| 4 | 720.000,01 – 1.800.000,00 | 16,00% | 35.640,00 | 20,50% | 17.100,00 |
| 5 | 1.800.000,01 – 3.600.000,00 | 21,00% | 125.640,00 | 23,00% | 62.100,00 |
| 6 | 3.600.000,01 – 4.800.000,00 | 33,00% | 648.000,00 | 30,50% | 540.000,00 |

Alíquota efetiva = (RBT12 × nominal − dedução) ÷ RBT12. Fator R = folha dos 12 meses ÷ RBT12, com limite de 28% para cair no Anexo III (LC 123, art. 18 §§ 5º-J e 5º-M) **[VERIFICAR]**.

| Caso | Entrada | Resultado esperado |
| --- | --- | --- |
| **R-1**: DAS anexo III com Fator R (CA-9) | Serviço sujeito ao Fator R, RBT12 = 300.000,00, folha 12m = 90.000,00, receita do mês = 25.000,00 | Fator R = 30% (≥ 28%) → Anexo III, faixa 2. Efetiva = (300.000 × 11,2% − 9.360) ÷ 300.000 = **8,08%**. DAS = **R$ 2.020,00** |
| **R-2**: mesma empresa sem Fator R (CA-10) | Igual a R-1, mas com folha 12m = 60.000,00 | Fator R = 20% (< 28%) → Anexo V, faixa 2. Efetiva = (300.000 × 18% − 4.500) ÷ 300.000 = **16,50%**. DAS = **R$ 4.125,00** (diferença de R$ 2.105,00/mês, que é o que o simulador de Fator R precisa mostrar) |
| **R-3**: Presumido, trimestre sem adicional (CA-11) | Serviços, receita do trimestre = 180.000,00, presunção 32% (IRPJ e CSLL) | Base = 57.600,00. IRPJ 15% = **8.640,00**, adicional 10% sobre (57.600 − 60.000) = **0**. CSLL 9% = **5.184,00**. PIS 0,65% = **1.170,00**. COFINS 3% = **5.400,00** (Lei 9.249/1995, arts. 15 e 20; Lei 9.430/1996; Lei 9.718/1998) **[VERIFICAR]**. ISS fora do caso (municipal, ver R-10) |
| **R-4**: Presumido com adicional (CA-11) | Serviços, receita do trimestre = 300.000,00 | Base = 96.000,00. IRPJ = 14.400,00 + adicional 10% × 36.000,00 = 3.600,00, total **18.000,00**. CSLL = **8.640,00** |
| **R-5**: CBS/IBS 2026 (CA-12) | Lucro Presumido, saídas tributadas de 100.000,00 na competência 2026-03, sem redução | CBS 0,9% = **900,00**, IBS 0,1% = **100,00**. Marcados como "teste 2026", compensáveis com PIS/COFINS devidos. Para o Simples no mesmo período, o resultado é **dispensado** (LC 214/2025, disposições de transição) **[VERIFICAR artigos]** |
| **R-6**: crédito abate (CA-13) | R-5 + `TaxCredit AVAILABLE` de CBS 300,00 e IBS 40,00 | CBS a recolher **600,00**, IBS **60,00**. Com crédito de CBS de 1.200,00: CBS **0,00** e saldo credor de **300,00** |
| **R-7**: markup divisor (CA-26) | Custo 100,00, impostos 10%, comissão 5%, margem 20% | Preço = 100 ÷ (1 − 0,35) = **R$ 153,85** (arredondado ao centavo, half-up). Conferência: 153,85 × 35% = 53,85 |
| **R-8**: guia em atraso (CA-39) | Guia de 1.000,00 | 10 dias: multa 10 × 0,33% = 3,30% = **R$ 33,00**. 70 dias: 23,10%, limitado a 20% = **R$ 200,00**. Juros Selic acumulada + 1% no mês do pagamento vêm de dado de entrada (Lei 9.430/1996, art. 61 e §3º) **[VERIFICAR]** |
| **R-9**: score com 1 mês de guia em aberto (CA-34) | Itens aplicáveis e pesos: CND Federal (3, OK), Alvará (2, OK), Cartão CNPJ (1, OK), Contrato social (1, OK), DAS mensal (3). DAS de 2026-08 vencido e não pago | DAS = OVERDUE. Score = (3+2+1+1) ÷ (3+2+1+1+3) = 7 ÷ 10 = **70%**. Depois de pagar o DAS de 2026-08: **100%**. Um item EXPIRING_SOON conta como OK |
| **R-10**: ISS Teresina | — | Alíquota por item da LC 116 conforme o Código Tributário de Teresina **[VERIFICAR]**. Não há número de referência até a conferência. A LC 116/2003 limita a alíquota entre 2% e 5% **[VERIFICAR]** |

### 8.2 Dados em aberto (entram como `// VERIFICAR` no seed)

| Dado | Fonte legal a conferir |
| --- | --- |
| Tabelas dos anexos I, II e IV do Simples e a repartição por tributo dentro do DAS (segregação) | LC 123/2006, anexos, redação da LC 155/2016 |
| Valores fixos do DAS-MEI (INSS 5% do salário mínimo vigente + ICMS/ISS fixos) | LC 123/2006, art. 18-A, e o salário mínimo de 2026 |
| Alíquotas de CBS e IBS de 2027 a 2033 (CBS cheia menos 0,1 p.p. em 2027–2028, IBS 0,05% + 0,05%, escalonamento do IBS de 2029 a 2032, extinção de PIS/COFINS/ICMS/ISS) | LC 214/2025, disposições de transição; EC 132/2023, ADCT arts. 125–133 |
| Alíquota de referência da CBS e do IBS (fixada pelo Senado/TCU) | LC 214/2025 e as resoluções do Senado a serem publicadas |
| Percentuais de redução (30%/60%/100%) por `cClassTrib` | LC 214/2025 (regimes diferenciados) e a tabela `cClassTrib` da NT 2025.002 |
| Aumento de 10% nas presunções do Presumido acima de R$ 5 mi/ano, se vigente em 2026 | LC 224/2025 (a confirmar se existe e se se aplica) |
| ISS de Teresina por item da LC 116 | Código Tributário Municipal de Teresina / SEMF |
| Retenções: IRRF 1,5%, CSRF 4,65%, INSS 11% e os limites de dispensa | Lei 10.833/2003, arts. 30–31; IN RFB 1.234/2012; Lei 8.212/1991, art. 31 |
| Tabela progressiva do IRRF de 2026 (pró-labore) | Lei vigente em 2026, incluindo a faixa de isenção |
| Salário mínimo de 2026 e teto do INSS | Decreto/portaria de 2026 |
| Layout do grupo IBSCBS na NF-e/NFS-e | NT 2025.002 (versão vigente) |

### 8.3 Links oficiais do glossário

Nenhum link pôde ser aberto nesta sessão (bloqueio de rede). Todos ficam com `verifiedAt = null` até a conferência.

| Termo(s) | Link | Verificado em |
| --- | --- | --- |
| EC 132/2023 | https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm | [VERIFICAR] |
| LC 214/2025 (CBS, IBS, IS, cClassTrib, split payment, crédito) | https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm | [VERIFICAR] |
| LC 123/2006 (Simples, DAS, RBT12, Fator R, Anexo, MEI) | https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm | [VERIFICAR] |
| LC 116/2003 (ISS, lista de serviços) | https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm | [VERIFICAR] |
| Lei 9.430/1996 (multa/juros de mora, IRPJ trimestral) | https://www.planalto.gov.br/ccivil_03/leis/l9430.htm | [VERIFICAR] |
| Lei 9.249/1995 (presunção do Presumido) | https://www.planalto.gov.br/ccivil_03/leis/l9249.htm | [VERIFICAR] |
| Lei 9.718/1998 (PIS/COFINS cumulativos) | https://www.planalto.gov.br/ccivil_03/leis/l9718compilada.htm | [VERIFICAR] |
| Portal do Simples Nacional (PGDAS-D, DEFIS, DASN-SIMEI) | https://www8.receita.fazenda.gov.br/simplesnacional/ | [VERIFICAR] |
| Reforma Tributária — Ministério da Fazenda | https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria | [VERIFICAR] |
| Portal NFS-e Nacional | https://www.gov.br/nfse | [VERIFICAR] |
| Portal Nacional da NF-e (notas técnicas, NT 2025.002) | https://www.nfe.fazenda.gov.br/portal/principal.aspx | [VERIFICAR] |
| e-CAC / CND Federal (Receita/PGFN) | https://www.gov.br/receitafederal/pt-br/servicos/certidoes | [VERIFICAR] |
| SEFAZ-PI (CND Estadual, DAR/DAE) | https://portal.sefaz.pi.gov.br/ | [VERIFICAR] |
| SEMF Teresina (ISS, NFS-e, CND Municipal) | https://semf.teresina.pi.gov.br/ | [VERIFICAR] |
| CRF do FGTS (Caixa) | https://consulta-crf.caixa.gov.br/ | [VERIFICAR] |
| CNDT (TST) | https://www.tst.jus.br/certidao1 | [VERIFICAR] |
| JUCEPI | https://www.jucepi.pi.gov.br/ | [VERIFICAR] |
| CNAE (IBGE/CONCLA) | https://concla.ibge.gov.br/ | [VERIFICAR] |

## 9. Riscos e rollback

- **Número fiscal errado passa por verdade.** Esse é o maior risco. A mitigação é D-8 (fonte e data em cada linha), RNF-5 (aviso na UI) e manter a guia como DRAFT até alguém confirmar. O sistema nunca paga sozinho.
- **Migration grande.** Ela é aditiva (CA-2) e reversível por `DROP` das tabelas novas e das colunas opcionais. Nenhum dado existente é alterado. O histórico de migrations no Neon é divergente, então a aplicação segue o ritual da regra 11 (`db execute` + `migrate resolve`).
- **Journal divergente dos lançamentos.** Ele é derivado (D-1): o rollback é apagar `JournalEntry/Line` e rodar o backfill.
- **Vazamento de segredo do cofre.** Cifragem + step-up WebAuthn + log + nenhum segredo no payload de listagem (RNF-6). O rollback é desabilitar a subaba. Os segredos continuam cifrados.
- **Pasta restrita visível por engano.** O filtro fica no servidor (D-6) e nunca só na UI. CA-31 é conferido com um usuário sem acesso.
- **Refatoração do N-Box quebra o `/nbox`.** O explorer é extraído sem mudar o comportamento (CA-37). Rollback: reverter o arquivo.
- **Spam de WhatsApp.** Dedup por slot (D-3) e opt-out pelas regras do `alert-catalog`.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-28 | Weydson (via Claude Code) | Criada a partir de `docs/contabil-plano.md`, com as correções D-1 a D-10 depois de conferir o plano contra o código na `main` (`3f45bc5`). Links e tabelas marcados [VERIFICAR] (sem acesso à fonte na sessão). |
