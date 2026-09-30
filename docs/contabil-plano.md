# Aba Contábil no NASA Payment — plano

## Contexto

**Objetivo:** depender o mínimo possível de contador. O financeiro ganha uma camada contábil e fiscal com estas características:
- **Regimes:** atende Simples/MEI, Lucro Presumido e Lucro Real.
- **Pessoal:** trata as contas pessoais para o IRPF.
- **Notas:** emite notas por uma API emissora.
- **Reforma:** fica 100% compatível com a Reforma Tributária (EC 132/2023 e LC 214/2025).
- **Avisos:** notifica vencimentos pelo WhatsApp usando os gatilhos existentes.

**Pedidos adicionais do usuário:**
- A aba precisa se explicar sozinha: ícone de informação em cada termo técnico, links oficiais, regras da Reforma e suporte do ASTRO.
- Mapear os nossos produtos e as propostas, para ver se o imposto já entra no preço e precificar corretamente.
- Usar as notas dos parceiros/fornecedores para aproveitar os créditos de IBS/CBS da nova regra, que é não cumulativa.

**O que já existe e será reaproveitado:**
- `PaymentEntry`, com competência e caixa separados, parcelas e recorrência.
- `PaymentCategory` em árvore.
- `PaymentContact` com CPF/CNPJ.
- Conciliação OFX/PDF.
- Leitura de NF-e/NFS-e por IA (`payment/schemas/financial-document-extraction.ts`).
- DRE/DRO (`router/payment/reports.ts`).
- Régua de cobrança e lembretes por WhatsApp.
- `sendOrganizationWhatsAppText` (`tracking-chat/lib/providers/send-org-document.ts`).
- `dispatchAlert` (`alerts/lib/alert-engine.ts`).
- O cron `detect-expenses-due-today`.
- O padrão `SCHEDULE_TRIGGER` com `WorkflowScheduleClaim`.
- `openAstroWidget(prompt)` (`astro/lib/open-astro-widget.ts`), que já existe e ainda não é chamado por ninguém.
- `APP_TOOL_PACKS` (`astro/server/tools/app-packs.ts`).
- A persona `ACCOUNTING` em `astro-commander/lib/personas.ts`.
- `SpaceHelpButton` (`space-help/components/space-help-button.tsx`), já mapeado para `/payment`.

**Lacunas encontradas:**
- **Contábil:** não há plano de contas, partidas dobradas, perfil fiscal, tabelas de alíquota, apuração, guias, calendário, livro PF nem emissão de notas.
- **Produtos:** `ForgeProduct` não tem NCM, NBS/LC 116 nem classificação tributária.
- **Simulador:** a alíquota "Impostos (%)" do simulador do Forge é digitada à mão. Ela **não é salva** (`buildPayload` descarta o `taxRate` em `simulation-builder.tsx:427`) e vai para a proposta só como uma linha de produto solta.
- **NF de fornecedor:** a extração lê só o valor total. Não pega itens, CFOP/CST nem os valores de ICMS/PIS/COFINS/IBS/CBS. Por isso não há como apurar crédito.
- **SEFAZ:** não existe distribuição DF-e (a captura automática das notas emitidas contra o nosso CNPJ).

**Decisões do usuário:**
- Atender os três regimes.
- Livro PF por usuário.
- Emissão via API emissora.
- A Fase 1 é a fundação contábil com as guias, incluindo agora também autoexplicação, precificação e créditos.

## Princípios de arquitetura

1. **O `PaymentEntry` continua sendo a fonte.** A contabilidade é derivada dele: cada evento gera um `JournalEntry` com débito e crédito, a partir de regras categoria→conta.
2. **Alíquota nunca fica fixa no código.** `TaxRateTable` é versionada por vigência. A transição da Reforma de 2026 a 2033 entra como dados, sem deploy.
3. **Apurar gera um lançamento a pagar.** A guia vira `PaymentEntry PAYABLE` e herda lembretes, régua, conciliação e WhatsApp.
4. **Conhecimento fiscal fica em dados, não na interface.** Um glossário único (termo, explicação simples, base legal, link oficial, prompt do ASTRO) alimenta os tooltips, o ASTRO e o Space Help. Assim a mesma explicação aparece igual nos três lugares.
5. **Domínio novo em `src/features/accounting/`.** Router em `src/app/router/accounting/`, aba "Contábil" no `payment-page.tsx` e acesso pelo `requirePaymentAccess` já existente.
6. **Transações só com escritas (regra 18).** O journal vai no mesmo `tx`. Notificações e chamadas externas acontecem depois do commit.

## Fase 1 — Fundação contábil, guias, autoexplicação, precificação e créditos

### 1. Spec
Escrever `specs/accounting/0051-aba-contabil-fundacao.md` a partir de `specs/TEMPLATE.md`, com critérios CA-n para cada bloco abaixo. Revisar antes do código (regra 17).

### 2. Schema (migration `accounting_foundation`) e ritual da regra 11

**Perfil fiscal e escrituração:**
- **`OrganizationTaxProfile` (1:1 com Organization).**
  - `regime` (MEI/SIMPLES/PRESUMIDO/REAL), `cnaePrincipal`, `cnaesSecundarios[]`, `simplesAnexo`.
  - `ie`, `im`, `municipioIbge`, `uf`, `dataAbertura`.
  - `folha12mCents` (Fator R) e `optouIbsCbsForaDoSimples`.
- **`AccountingAccount`.**
  - `code`, `name`, `nature`, `parentId`, `isAnalytical`, `referentialCode` (plano referencial do SPED).
  - Seed de um plano padrão PME.
- **`AccountingMapping`:** liga categoria ou conta bancária a uma `AccountingAccount`.
- **`JournalEntry` e `JournalLine`.**
  - Linha: `debitCents`, `creditCents`, `costCenterId`.
  - Cabeçalho: `sourceType`/`sourceId` e `competenceDate`.

**Alíquotas, apuração e calendário:**
- **`TaxRateTable`.**
  - Campos: `tax`, `regime`, `anexo`, `faixa`, `aliquotaBps`, `deducaoCents`, `municipioIbge?`, `cClassTrib?`, `reducaoBps?` (regimes diferenciados de 30%/60%/100%), `validFrom`/`validTo`.
  - Seed: anexos I a V do Simples, presunções do Presumido, ISS de Teresina, CBS 0,9% e IBS 0,1% de 2026, além do cronograma de 2027 a 2033.
- **`TaxAssessment`.**
  - Campos: `period`, `tax`, `baseCents`, `aliquotaEfetivaBps`, `valorCents`, `creditosCents`, `memoriaCalculo` (Json), `status`, `paymentEntryId`.
  - Chave única `[organizationId, tax, period]`.
- **`FiscalObligation`:** `kind`, `dueDate`, `period`, `status`, `assessmentId?`.

**Créditos e classificação:**
- **`TaxCredit`: o crédito de IBS/CBS (e PIS/COFINS no Presumido/Real até 2026).**
  - Campos: `attachmentId`, `supplierContactId`, `accessKey`, `tax`, `valorCents`, `competence`.
  - `status` pode ser PENDING_PAYMENT, AVAILABLE, USED ou GLOSSED. O LC 214 condiciona o crédito à extinção do débito, o que o split payment vai tornar automático.
  - Chave única `[organizationId, accessKey, tax]`.
- **`ProductTaxClassification`.**
  - Campos: `kind` (PRODUCT/SERVICE), `ncm?`, `nbs?`, `lc116Item?`, `cClassTrib`, `cst`, `reducaoBps`, `issMunicipioIbge?`.
  - Referenciada por `ForgeProduct.taxClassificationId`.
  - Serve depois também a NASA Route e ao Tráfego, via `sourceType`.
- **Alterações em modelos existentes:**
  - `ForgeSimulation`: novos campos `taxRateBps` e `taxRateSource` (MANUAL/PROFILE).
  - `ForgeProposal`: novo campo `taxBreakdown` (Json).
  - `PaymentContact`: novos campos `taxRegime?` e `ie?`. Fornecedor do Simples transfere crédito diferente.

**Depois da migration:** `db:generate`, subir `SCHEMA_VERSION`, `migrate resolve`, `touch` nas rotas catch-all e conferir com `curl`.

### 3. Motor contábil (`src/features/accounting/server/journal/`)
- **`post-from-payment-entry.ts`:** chamado dentro do `tx` dos services `payment/server/entries/*` (create, pay, update, cancel).
- **Backfill idempotente:** job Inngest pelo `sourceId`.
- **Relatórios:** balancete, razão e balanço. A DRE atual continua existindo, e surge uma opção "DRE contábil".

### 4. Motor fiscal (`src/features/accounting/lib/tax/`, funções puras)
- **Simples e MEI:**
  - `simples/compute-das.ts` (RBT12, alíquota efetiva, Fator R, segregação por anexo).
  - `mei/compute-das-mei.ts`.
- **Lucro Presumido:**
  - `presumido/compute-irpj-csll.ts`.
  - `compute-pis-cofins-cumulativo.ts`.
  - `compute-iss.ts`.
- **Reforma:** `reforma/compute-cbs-ibs.ts`.
  - Débito sobre as saídas menos crédito das entradas (`TaxCredit AVAILABLE`), com redução por `cClassTrib`.
  - 2026 é informativo: compensa PIS/COFINS, e o Simples fica dispensado.
  - Opção do Simples por fora a partir de 2027.
- **Lucro Real:** na Fase 1, só razão/balancete e o LALUR em rascunho.
- **`server/assess-period.ts`:** a apuração começa como DRAFT com memória de cálculo. Ao confirmar, gera a guia como `PaymentEntry PAYABLE`.
- **`lib/pricing/compute-effective-rate.ts`:** alíquota efetiva da organização aplicada a uma receita de um tipo e classificação. É usada na precificação (item 7).

### 5. Créditos das notas de parceiros e fornecedores
- **Extração mais completa em `financial-document-extraction.ts`:** novo bloco `taxes` (vICMS, vPIS, vCOFINS, vISS, vIBS, vCBS, vIS) e `items[]` (NCM/NBS, CFOP, CST/cClassTrib, valor).
- **XML primeiro:** novo parser determinístico `accounting/lib/nfe-xml/parse-nfe.ts` para XML de NF-e/NFS-e, incluindo o grupo IBSCBS da NT 2025.002. A IA fica só como alternativa para PDF e imagem.
- **Registro do crédito:** `server/credits/register-credit-from-attachment.ts` roda ao anexar uma NF de entrada e cria `TaxCredit`. Quando a despesa vinculada é paga, o crédito passa para AVAILABLE.
- **Painel "Créditos":**
  - Crédito disponível por mês e o quanto ele reduz a guia.
  - Ranking de fornecedores por crédito gerado versus preço, para mostrar quando comprar de fornecedor do Simples ou sem nota sai mais caro.
  - Alerta de despesa paga sem nota anexada, sinalizada como "crédito perdido".

### 6. Aba autoexplicativa e ASTRO
- **Glossário:** `accounting/lib/glossary/terms.ts`. Cada termo tem `id`, `label`, `plainExplanation`, `example`, `legalBasis` e `links[]` (URL oficial e `lastVerifiedAt`), além de `astroPrompt`.
  - Termos: DAS, RBT12, Fator R, Anexo, CNAE, CBS, IBS, IS, cClassTrib, NBS, NCM, CFOP, crédito não cumulativo, split payment, competência, partida dobrada, balancete, LALUR, carnê-leão, etc.
  - Links: LC 214/2025 e EC 132/2023 (planalto.gov.br), Portal do Simples Nacional, Portal NFS-e Nacional (gov.br/nfse), SEFAZ-PI, SEMF Teresina e as notas técnicas da NF-e. Todos serão conferidos na spec.
- **`<FiscalTermHint termId>`** (`accounting/components/shared/`): ícone `Info` com `HoverCard` do shadcn que mostra explicação, exemplo, base legal, links e o botão "Perguntar ao ASTRO" (`openAstroWidget(term.astroPrompt)`). Todo rótulo técnico da aba usa esse componente.
- **Subaba "Reforma Tributária":**
  - Linha do tempo de 2026 a 2033: o que muda em cada ano e o que a empresa precisa fazer, por regime.
  - Simulação da carga atual versus IBS/CBS sobre o faturamento real, já descontando os créditos.
  - Checklist de adequação: produtos classificados, fornecedores com regime cadastrado, notas com o grupo IBS/CBS.
- **ASTRO:**
  - Novo pacote `accounting` em `APP_TOOL_PACKS` (`astro/server/tools/accounting/`), só com ferramentas de leitura na Fase 1:
    - `explain_fiscal_term`, a partir do glossário;
    - `get_tax_profile`;
    - `simulate_das` e `simulate_cbs_ibs`;
    - `list_obligations_due`;
    - `list_available_credits`;
    - `suggest_product_price`;
    - `diagnose_pricing` (produtos sem classificação ou propostas sem imposto).
  - Prompt de escopo em `astro/lib/prompts/accounting`, que sempre cita a base legal e indica o link oficial.
  - A persona `ACCOUNTING` ganha essas ferramentas como `defaultTools`.
- **Space Help:** artigos seed com `featureSlug: "contabil"` e `<SpaceHelpButton featureSlug="contabil">` no cabeçalho da aba.
- **Onboarding:** o wizard do Perfil fiscal explica cada passo e sugere o anexo a partir do CNAE.

### 7. Produtos, propostas e precificação
- **Diagnóstico de precificação** (subaba "Produtos & Preços"):
  - Lista `ForgeProduct` com classificação, alíquota efetiva e margem líquida após imposto.
  - Marca produtos sem classificação e propostas sem imposto ou com alíquota diferente da efetiva.
  - Nesta fase mapeia o Forge. Rotas e Tráfego entram como leitura, mostrando o preço e o imposto estimado de cada plano.
- **Simulador do Forge (`simulation-builder.tsx`):**
  - "Impostos (%)" passa a vir preenchido pelo `compute-effective-rate` do perfil fiscal, com a opção de trocar para manual.
  - O valor é salvo em `taxRateBps` e `taxRateSource`, o que corrige a perda no `buildPayload`.
  - Ao lado, aparece a comparação "hoje x com IBS/CBS (ano X)".
- **Proposta:** `handleConvert` e `router/forge/simulations.ts` gravam o `taxBreakdown` estruturado, além das linhas atuais (sem quebrar as propostas existentes).
- **Calculadora de preço:** preço = custo / (1 − impostos − comissão − margem), usando `ForgeSettings.commissionPercentage`.

### 8. Notificações pelo WhatsApp com gatilhos
- **Eventos novos em `alert-catalog.ts`:**
  - `accounting.obligation_due_soon`
  - `accounting.obligation_overdue`
  - `accounting.assessment_ready`
  - `accounting.credit_missing_invoice`
- **Cron `crons/detect-fiscal-obligations-due.ts`**, copiado de `detect-expenses-due-today.ts`:
  - dedup por slot;
  - `dispatchAlert`;
  - `sendOrganizationWhatsAppText`, com template Meta no padrão de `trafego/server/lib/send-client-whatsapp.ts`.
- **`NodeType` novo `FISCAL_OBLIGATION_DUE`, gatilho do modo agente:**
  - dispatcher em `agent-workflow-triggers.ts`;
  - nó em `node-components.ts` e `node-options.ts`;
  - formulário em `agent-node-forms.tsx`.

### 9. Subaba "N-Box · Documentos da empresa" e Score de Regularidade

**O que já existe e o que falta no N-Box:**
- Hoje o N-Box tem pastas e itens (`NBoxFolder`/`NBoxItem`) com escopo de org, mas nenhum controle de acesso, nenhuma validade e nenhum tipo de documento.
- O `nbox-app.tsx` tem 1130 linhas e não pode ser embutido em outra tela.
- A rota `/api/s3/upload` não exige autenticação.
- Não existe cofre genérico de credenciais. O `src/lib/crypto.ts` (AES-256-GCM) só cifra colunas específicas.

**Schema, na mesma migration:**
- **`NBoxFolder`: novos campos `systemKey?` e `isRestricted`.**
  - Cada org ganha uma pasta de sistema "Documentos da empresa", com subpastas por grupo.
  - Pastas restritas ficam de fora de `nbox.folders/items.getMany` e do seletor do `SEND_NBOX`, a não ser para quem tem `PaymentAccess` ADMIN/OWNER.
  - Arquivo restrito nunca pode ficar público.
- **`CompanyDocumentType`: catálogo em seed, editável.**
  - Campos: `code`, `label`, `group`, `authority`, `recurrence` (ONE_TIME / PER_VALIDITY / ANNUAL / MONTHLY), `defaultValidityDays`, `weight` (peso no score), `criticality`.
  - `applicability`: condição por regime, se tem funcionários, se é contribuinte de ICMS ou de ISS, atividade regulada.
  - `officialLinks[]` (onde emitir ou consultar) e `glossaryTermId`.
- **`CompanyDocument`:** `typeId`, `nboxItemId`, `number?`, `issuedAt`, `expiresAt?`, `period?` (para os mensais), `status`, `extraction` (Json).
- **`CompanyCredential`: o cofre.**
  - Campos: `portal`, `username`, `secretEncrypted` (via `encryptSecret`), `last4`, `notes`.
  - Acesso só para ADMIN/OWNER, com step-up WebAuthn usando as credenciais que o `PaymentAccess` já tem.
  - `CompanyCredentialRevealLog` guarda a auditoria de cada senha revelada.
  - Portais cobertos: e-CAC, Simples Nacional, SEFAZ-PI, Prefeitura de Teresina (NFS-e/ISS), FGTS Digital, eSocial/gov.br, JUCEPI, bancos.
- **Certificado digital A1:** o `.pfx` e a senha ficam cifrados, e a validade é lida do próprio certificado. O mesmo cofre será usado pela emissora na Fase 2.
- **`RegularityScoreSnapshot`:** snapshot diário com `score`, `breakdown` (Json) e `date`, para o gráfico de histórico.

**Catálogo seed de documentos, por grupo.** Nesta lista incluí itens que faltavam no pedido, e cada um só conta no score quando se aplica à empresa:
- **Societário:**
  - Contrato social com as alterações consolidadas, ou CCMEI / Requerimento de Empresário.
  - Certidão simplificada da JUCEPI.
  - Acordo de sócios.
  - Procurações, incluindo a procuração eletrônica no e-CAC para o contador.
- **Cadastros:**
  - Cartão CNPJ.
  - Cartão de Inscrição Estadual.
  - Cartão de Inscrição Municipal.
  - Enquadramento no Simples ou MEI (termo de opção).
- **Certificados:** e-CNPJ A1/A3 e e-CPF dos sócios.
- **Licenças:**
  - Alvará de funcionamento.
  - Licença sanitária (VISA).
  - AVCB/CLCB dos Bombeiros.
  - Licença ambiental.
  - Registro no conselho de classe (CRC/CREA/CRM…).
  - Contrato de locação e IPTU do endereço.
- **Certidões e regularidade:**
  - CND Federal (Receita/PGFN).
  - CND Estadual (SEFAZ-PI).
  - CND Municipal (Teresina).
  - CRF do FGTS (Caixa).
  - CNDT Trabalhista (TST).
  - Certidão de falência/recuperação judicial (TJ-PI), exigida em licitações.
- **Livros e demonstrações:**
  - Livro Diário e Razão (ECD).
  - Livro Caixa.
  - Balancetes mensais, gerados pela própria aba.
  - Balanço patrimonial e DRE anuais.
  - Livros fiscais: registro de entradas, saídas e ISS.
- **Declarações:** DEFIS / DASN-SIMEI, ECD/ECF, DCTFWeb, EFD-Reinf, eSocial (recibos), EFD ICMS/IPI quando se aplica, e a DIRPF dos sócios (ponte com a Fase 3).
- **Guias e comprovantes mensais:**
  - DAS/DARF.
  - DCTFWeb/INSS.
  - FGTS Digital (GFD).
  - DAR/DAE-PI (ICMS).
  - ISS municipal.
  - Cada um com o comprovante de pagamento.
- **Trabalhista:** folha e contracheques, PGR/PCMSO (SST), quando tem funcionários.
- **Notas fiscais do mês:**
  - Envio mensal das notas emitidas.
  - Notas de entrada anexadas às despesas pagas, ligadas ao `TaxCredit`.
- **LGPD:** política de privacidade e registro de tratamento. É opcional e tem peso baixo.

**Leitura automática:**
- Ao subir uma certidão, alvará ou cartão, o pipeline de IA existente (`payment/server/documents/extract-financial-document.ts`, com um schema novo `company-document-extraction.ts`) lê tipo, número, emissão, validade e CNPJ.
- Depois sugere o `CompanyDocumentType` e pede confirmação.
- Se o CNPJ do documento for diferente do CNPJ da organização, aparece um alerta.

**Score de Regularidade** (função pura `accounting/lib/compliance/compute-regularity-score.ts`):
- Cada item aplicável recebe um status: OK, EXPIRING_SOON (30 dias, só alerta), MISSING, EXPIRED ou OVERDUE.
- Score = Σ peso dos itens OK ÷ Σ peso dos itens aplicáveis.
- **Itens mensais** (guias pagas e notas do mês enviadas), conforme o pedido:
  - um único mês em aberto já derruba o score;
  - o item só volta a OK quando o mês é regularizado.
  - Fonte: `FiscalObligation` e `TaxAssessment` com `PaymentEntry` pago; notas emitidas ou anexadas na competência.
- **Itens críticos** (certidões negativas, certificado digital, alvará) têm peso maior. Se estiverem vencidos, aparece um aviso de "impedimento": não pode participar de licitação, não pode emitir nota.

**Dashboard (primeiro bloco da subaba):**
- Medidor com o % de regularidade e a variação desde o último mês, mais o gráfico de histórico.
- Lista "O que falta", ordenada pelo impacto no score. Cada item mostra:
  - botão de upload;
  - link oficial para emitir;
  - `FiscalTermHint` explicando o documento;
  - "Pedir ao ASTRO".
- Linha do tempo de vencimentos: 30, 60 e 90 dias.
- Cartões por grupo: Federal, Estadual, Municipal, Trabalhista, Societário, Fiscal/Contábil.

**N-Box embutido:**
- Separar o explorer do `nbox-app.tsx` em `features/nbox/components/nbox-explorer.tsx` (`{ rootFolderId, readOnly? }`) e continuar usando os hooks de `use-nbox.ts`.
- O `NBoxApp` passa a usar esse explorer, e a subaba monta a pasta de sistema.
- Upload dos documentos restritos por uma rota autenticada nova no padrão de `api/payment/attachments/upload`. A leitura é feita com `getPresignedReadUrl` depois da checagem de acesso.

**ASTRO:** ferramentas de leitura `get_regularity_score`, `list_missing_documents` e `list_expiring_documents`. Exemplo: "o que falta para eu tirar a CND federal?".

**Avisos:**
- O cron (item 8) também avisa documentos vencendo em 30, 15 e 5 dias, documentos vencidos e queda do score.
- O `NodeType` passa a ser `COMPLIANCE_ITEM_DUE`, que substitui `FISCAL_OBLIGATION_DUE`. Tem filtro por tipo (obrigação, documento, guia, nota do mês), assim uma automação única cobre tudo pelo WhatsApp.

### 9b. Calculadora contábil
Fica em um lugar só, `accounting/components/calculator/`, e aparece de duas formas:
- como subaba "Calculadora";
- como botão flutuante 🧮 em todas as subabas da aba Contábil. Ele abre um Sheet lateral já com o contexto da tela (a apuração ou o produto aberto).

Toda conta usa as mesmas funções puras de `lib/tax/`, `lib/pricing/` e a `TaxRateTable`, sem fórmula repetida na interface.

**Calculadoras:**
- **Simples/MEI:**
  - DAS do mês: RBT12, alíquota efetiva e segregação por anexo.
  - Simulador de Fator R: quanto de pró-labore faz a empresa cair no anexo III em vez do V.
- **Presumido:** IRPJ/CSLL do trimestre (com adicional de 10%), PIS/COFINS cumulativos e ISS.
- **Comparativo de regimes:** Simples x Presumido x Real sobre o faturamento e a folha reais dos últimos 12 meses.
- **Reforma:** CBS/IBS por ano da transição (2026 a 2033), com a redução do `cClassTrib`, menos os créditos disponíveis. Mostra também a opção do Simples "por dentro x por fora" (qual das duas favorece o cliente PJ na hora de aproveitar crédito).
- **Preço de venda:**
  - Markup divisor: custo ÷ (1 − impostos − comissão − margem).
  - Margem real de um preço já definido.
  - Botão "aplicar no produto/simulação do Forge".
- **Retenções na fonte:** IRRF 1,5%, CSRF 4,65%, INSS 11% e ISS retido na nota de serviço, com o líquido a receber.
- **Pró-labore x distribuição de lucros:** INSS 11% e IRRF progressivo sobre o pró-labore, comparados à distribuição isenta. Serve de ponte com o livro PF da Fase 3.
- **Custo de funcionário:** salário mais encargos (INSS patronal ou Simples, FGTS 8%, provisões de férias + 1/3 e 13º).
- **Guia em atraso:** multa de 0,33% ao dia (teto de 20%) mais juros Selic acumulada, com o "Gerar lançamento" da guia atualizada.
- **Utilitárias:** depreciação linear, juros simples e compostos, e conversão entre regime de competência e de caixa.

**Na interface:**
- Cada campo tem `FiscalTermHint`.
- O resultado sempre mostra a **memória de cálculo** passo a passo, com a base legal e a tabela usada (vigência).
- Ações do resultado: "Explicar com ASTRO" (`openAstroWidget` com os números preenchidos), "Copiar" e "Salvar como rascunho de apuração" quando fizer sentido.
- ASTRO: a ferramenta `run_calculator(kind, inputs)` expõe as mesmas calculadoras ao assistente.

### 10. UI da aba "Contábil" no `payment-page.tsx`
Subabas:
- Visão geral (score de regularidade, próximas obrigações, guia do mês, créditos, alertas).
- N-Box · Documentos da empresa (dashboard de regularidade, documentos, cofre de credenciais).
- Perfil fiscal.
- Apurações e guias.
- Créditos.
- Produtos & Preços.
- Calendário fiscal.
- Calculadora (também disponível no botão flutuante em todas as subabas).
- Plano de contas.
- Balancete, Razão e Balanço.
- Reforma Tributária.

Hooks em `accounting/hooks/use-accounting-*.ts` (regra 9).

### 11. Documentação
- Criar `docs/contabil-overview.md` e uma regra nova no CLAUDE.md para mantê-lo, no mesmo formato das regras 10 e 14.
- O glossário é a fonte de verdade das explicações.

## Fases seguintes (cada uma com spec própria)
- **Fase 2 — Emissão de notas e captura automática das notas recebidas.**
  - Adapter `src/http/<emissora>/`: Focus NFe ou Nuvem Fiscal, escolhido na spec. Critérios: Teresina e NFS-e Nacional, NF-e na SEFAZ-PI, layout IBS/CBS e **distribuição DF-e com manifestação**.
  - Certificado A1 cifrado com `src/lib/crypto.ts`.
  - Emissão a partir do lançamento, da proposta ou do contrato do Forge, já com a `ProductTaxClassification`.
  - As NF-e emitidas contra o nosso CNPJ chegam sozinhas e alimentam `TaxCredit`.
- **Fase 3 — Livro PF / IRPF.**
  - `PersonalLedger` por usuário.
  - Pró-labore e lucros lançados nos dois lados.
  - Dedutíveis, carnê-leão, bens e direitos.
  - Prévia da DIRPF.
- **Fase 4 — Lucro Real e obrigações acessórias:** LALUR/LACS, PIS/COFINS não cumulativo, exportação SPED (ECD/ECF/EFD), DCTFWeb e DEFIS.
- **Fase 5 — Integrações do Piauí e automação:**
  - consultas na SEFAZ-PI e no Simples;
  - emissão e consulta automática de certidões (CND Federal, Estadual PI, Municipal Teresina, CRF FGTS, CNDT) por um provedor de consultas, que alimenta o score sozinha;
  - DAE-PI;
  - split payment, quando o Comitê Gestor publicar a API;
  - Open Finance pelo `AGGREGATOR` (`statements/ports.ts`);
  - ferramentas de escrita do ASTRO com `confirm_action`.

## Verificação (Fase 1)
- **Funções puras** de `lib/tax/`, `lib/pricing/` e `lib/nfe-xml/` testadas por script `tsx` (não há runner, regra 20), com casos nomeados por CA-n:
  - exemplos oficiais do Simples (anexo III/V com Fator R);
  - um trimestre do Presumido;
  - XML de NF-e com o grupo IBSCBS.
- **Journal:** criar e pagar um `PaymentEntry` gera um journal balanceado, e o balancete fecha.
- **Crédito:** anexar o XML de um fornecedor cria `TaxCredit PENDING_PAYMENT`, que vira AVAILABLE ao pagar e reduz a apuração de CBS/IBS.
- **Guia:** apurar o DAS e confirmar faz a guia aparecer em "Despesa".
- **Cron:** execução manual no Inngest dev entrega sino, push e WhatsApp, e rodar de novo não duplica. O workflow `FISCAL_OBLIGATION_DUE` é executado.
- **Forge:** o simulador abre com a alíquota do perfil, salva, recarrega e mantém o valor. A proposta gerada tem `taxBreakdown`.
- **Autoexplicação:** todo termo técnico da aba tem `FiscalTermHint`, e "Perguntar ao ASTRO" abre o widget com o prompt. O ASTRO responde a "quanto vou pagar de DAS este mês?" usando `simulate_das`.
- **Calculadora:** cada calculadora bate com os casos de referência da spec (CA-n). O botão flutuante abre com o contexto da subaba. "Aplicar no produto" atualiza a simulação do Forge.
- **Score:** a função pura cobre documento faltando, vencido, vencendo e um mês de guia não paga (o score cai). Ao pagar, o score volta.
- **Documentos:** subir o PDF de uma CND faz a IA ler a validade. O documento aparece no N-Box, na pasta restrita. Um usuário sem `PaymentAccess` não vê a pasta no `/nbox` nem no `SEND_NBOX`.
- **Cofre:** revelar uma senha exige WebAuthn e fica registrado no log.
- **Rotas:** `curl` em `/payment` e `/api/rpc` retorna 200. Typecheck só dos arquivos alterados, no fim.

## Pré-requisito de git
A branch atual é de campanhas e tem alterações não commitadas. Antes de codar, rodar `/start financeiro aba-contabil`.
