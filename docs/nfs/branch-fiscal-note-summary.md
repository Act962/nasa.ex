# Branch `feature/fiscal-note` — resumo do que foi feito

> Sumário técnico da branch, gerado em 2026-07-10 a partir do diff completo contra `origin/main` (14 commits "de conteúdo", 106 arquivos, ~12k linhas). Documento de leitura única para revisão/PR — a fonte de verdade contínua do domínio fica em [`fiscal-ddd-roadmap.md`](./fiscal-ddd-roadmap.md), [`municipios-requirements.md`](./municipios-requirements.md), [`focusnfe-nf-overview.md`](./focusnfe-nf-overview.md) e [`emissao.md`](./emissao.md).

## 1. O que essa branch entrega

Um domínio fiscal completo (`src/features/fiscal/`) que emite **NFS-e** (nota fiscal de serviço eletrônica) para as organizações do NASA, com:

- Dois gateways de emissão por trás de um port único (**NFE.io**, gateway padrão atual, e **Focus NFe**, mantido para perfis/notas legados).
- Cadastro de perfil fiscal por organização (emitente), com sincronização automática de dados via CNPJ e upload de certificado digital A1.
- Emissão manual a partir de **contratos do Forge** e de **lançamentos financeiros** (`PaymentEntry`), e emissão **automática** quando um lançamento a receber é quitado.
- Acompanhamento assíncrono de status via webhook + polling de fallback (Inngest), download de PDF/XML, cancelamento.
- Um registry de requisitos por município (CNAE, endereço do tomador, etc.) que evita hardcode de regras de prefeitura no código de emissão.

## 2. Linha do tempo (commits, em ordem)

| # | Commit | O que fez |
| --- | --- | --- |
| 1 | `e3582f8b` feat: implement issue invoice dialog and related hooks | Primeira versão do diálogo de emissão + hooks (`use-fiscal-*`) |
| 2 | `28680287` feat: refactor focus-nfe client and operations | Client HTTP Focus NFe (`src/http/focus-nfe/`) |
| 3 | `7ea9006e` feat(fiscal): enhance fiscal profile management and API integration | Perfil fiscal (`FiscalCompanyProfile`), CRUD, integração com API |
| 4 | `12e22d00` feat: enhance fiscal invoice management with new endpoints and token handling | Endpoints de nota + tratamento de token |
| 5 | `08e496dd` feat(fiscal): dual environment support for Focus NFe webhook IDs | Suporte a homologação/produção em paralelo pro webhook |
| 6 | `01be0dac` wip(fiscal): checkpoint NFS-e nacional antes de merge da main | Checkpoint do padrão NFS-e Nacional |
| 7 | `e999a6b6` feat(fiscal): default CNAE e código tributário municipal + registry de municípios | Nasce o `municipio-requirements.ts` (registry data-driven) |
| 8 | `37d901ba` feat: enhance NFS-e issuance with timezone handling and address validation | Ajustes de fuso horário e validação de endereço |
| 9 | `8f27c4ce` feat(fiscal): implement NFE.io gateway integration | **Segundo gateway**: nasce o port `FiscalGatewayAdapter` e o adapter NFE.io |
| 10 | `c61dd5f9` feat(fiscal): refactor invoice issuance to support payment entries | Generaliza emissão para lançamentos financeiros + emissão automática no pagamento |

(Os merges de `origin/main` intercalados trazem features de outras branches — campanhas de WhatsApp, personalização de campos do Kanban — não fazem parte do escopo desta branch.)

## 3. Modelagem de dados (Prisma)

Dois modelos novos + seis enums em `prisma/schema.prisma`:

- **`FiscalCompanyProfile`** (1:1 com `Organization`) — o emitente. Guarda documento (CNPJ/CPF), razão social, endereço estruturado, regime tributário (Simples Nacional/MEI), defaults de serviço (item de lista LC 116, alíquota ISS, CNAE, retenção), config de Reforma Tributária (IBS/CBS), `fiscalGateway` (qual adapter usar), campos específicos de cada gateway (`focusEmpresaId`/tokens/webhooks da Focus; `nfeIoCompanyId`/status de certificado da NFE.io), e a flag **`autoIssueOnEntryPaid`** que liga a emissão automática.
- **`FiscalInvoice`** (a nota) — vinculada por `contractId` **ou** `paymentEntryId` (união, não ambos), `ref` único (idempotência), `type` (`NFSE`/`NFSE_NACIONAL`), `status` (`PROCESSANDO`/`AUTORIZADO`/`ERRO`/`CANCELADO`), `gateway`, snapshot do tomador, payload enviado e resposta crua do provedor, URLs de PDF/XML, mensagem de erro formatada.
- Enums: `FiscalEnvironment` (HOMOLOGACAO/PRODUCAO), `FiscalInvoiceStatus`, `FiscalInvoiceType`, `NfseStandard` (MUNICIPAL/NACIONAL — só relevante pro adapter Focus), `TomadorType` (PF/PJ), `FiscalGateway` (FOCUS_NFE/NFE_IO).
- 8 migrations aplicadas ao longo da branch (schema evoluindo incrementalmente conforme os gaps apareciam).

## 4. Arquitetura: port + registry (por que não é um monte de `if`)

```
oRPC (src/app/router/fiscal/) / Inngest / rotas API
        │
        ▼
  FiscalGatewayAdapter (PORT)  ── registry registerGateway/resolveGateway
        ▲                ▲            (src/features/fiscal/lib/gateways/factory.ts)
        │                │
 FocusNfeGateway     NfeIoGateway
   │ delega em          │ usa o SDK oficial `nfe-io`
   │ resolveNfseProvider │ (src/lib/nfe-io.ts)
   │ (municipal/nacional
   │  fica interno)
```

- **Port** (`lib/gateways/types.ts`): `FiscalGatewayAdapter` — CRUD de empresa, `validateBeforeIssue`/`issueInvoice`/`getInvoice`/`cancelInvoice`, download de PDF/XML. É o único contrato que handlers/Inngest conhecem — nunca importam um client HTTP de gateway diretamente.
- **Registry** (`factory.ts`): `registerGateway`/`resolveGateway`/`resolveGatewayForInvoice`, mesmo padrão Open/Closed já usado em `tracking-chat/lib/providers/factory.ts`.
- **Adapter Focus** (`adapters/focus-nfe/`): por trás dele ainda vive a distinção interna MUNICIPAL × NACIONAL, resolvida por um segundo nível de strategy (`lib/providers/`: `municipal-nfse-provider.ts` e `nacional-nfse-provider.ts`, escolhidos via `resolveNfseProvider(standard)`).
- **Adapter NFE.io** (`adapters/nfe-io/`): usa o SDK oficial `nfe-io` (dependência nova em `package.json`); resolve municipal/nacional internamente, sem expor a distinção ao usuário.
- **Decisão de produto**: toda empresa nova é sincronizada na **NFE.io**; Focus continua registrada só para perfis/notas antigos (consultáveis via `resolveGatewayForInvoice`).
- **Registry de município** (`lib/municipio-requirements.ts`): módulo puro (sem I/O), consultado por 3 lugares diferentes com a mesma fonte de verdade — o formulário de perfil, o preflight client do diálogo de emissão, e o builder de payload no servidor. Resolve por código IBGE do prestador; filosofia "default é superset seguro", overrides só sob demanda quando um município real exige algo diferente (hoje só Teresina-PI está mapeada).

Racional completo e dívidas técnicas mapeadas em [`fiscal-ddd-roadmap.md`](./fiscal-ddd-roadmap.md).

## 5. Fluxos de emissão

### 5.1 Núcleo comum: `issueInvoiceFromSource`
Toda emissão (contrato ou lançamento, manual ou automática) passa por `src/features/fiscal/server/issue-invoice.ts`:

1. Carrega o `FiscalCompanyProfile` da org — sem perfil, aborta com `FiscalIssueValidationError`.
2. Garante que não existe nota **ativa** (`PROCESSANDO`/`AUTORIZADO`) já vinculada ao mesmo contrato/lançamento.
3. Resolve o gateway (`resolveGateway(profile.fiscalGateway)`) e roda o preflight (`validateBeforeIssue`).
4. Gera `ref` idempotente (`forge-<id>-<n>` ou `payment-<id>-<n>`), chama `gateway.issueInvoice`.
5. Erros específicos de cada gateway (`FocusNfeHttpError`, `NfeError` do SDK `nfe-io`) são traduzidos em mensagem legível antes de virar `FiscalIssueValidationError`.
6. Persiste a `FiscalInvoice`; em colisão de `ref` (corrida ou nota antiga apagada), reconta e tenta 1x com o próximo número antes de desistir.

### 5.2 Emissão manual — Forge (contrato)
`fiscal.invoices.issue` (`src/app/router/fiscal/invoices/issue.ts`) → `issueInvoiceFromSource` com `link: { contractId }`. UI: botão "Nota Fiscal" no `contracts-tab.tsx` abre um `Sheet` com `FiscalInvoiceCard`, que embrulha o `issue-invoice-dialog.tsx` (formulário completo com overrides do tomador, Reforma Tributária, campos condicionais por município).

### 5.3 Emissão manual — Financeiro (lançamento) *(novo nesta última leva de commits)*
`fiscal.invoices.issueFromPaymentEntry` (`issue-from-payment-entry.ts`) — mesmo núcleo, `link: { paymentEntryId }`, só aceita lançamentos `RECEIVABLE` não cancelados. UI: `entries-table.tsx` (financeiro) ganhou a ação de emitir nota por linha, reaproveitando o mesmo `FiscalInvoiceCard`/dialog do Forge (o card agora aceita um `target` genérico `{ kind: "contract" | "paymentEntry", ... }` em vez de só contrato).

### 5.4 Emissão automática ao quitar um lançamento
Quando `payPaymentEntry` (`src/app/router/payment/entries.ts`) marca um lançamento `RECEIVABLE` como `PAID`, dispara o evento Inngest `payment/entry.paid` — **sem saber nada de fiscal** (o módulo `payment` continua agnóstico; a decisão de emitir mora inteiramente do lado fiscal). O envio do evento é best-effort (falha logada, não derruba a quitação já persistida).

`fiscalAutoIssueNfseOnEntryPaid` (`src/inngest/functions/fiscal/auto-issue-nfse-on-entry-paid.ts`) escuta o evento:
1. Sai cedo se `profile.autoIssueOnEntryPaid` estiver desligado, se o lançamento não for elegível, ou se já houver nota ativa pro mesmo lançamento.
2. Exige que o contato do lançamento tenha CPF/CNPJ — sem isso, loga falha (`logActivity`) e para (não lança exceção retryable, é uma condição de dado faltante).
3. Para tomador PJ, **hidrata endereço automaticamente** consultando a CNPJ.ws (`src/http/cnpj-ws/client.ts`, cliente novo) — se a consulta falhar (404/429/rede), segue sem endereço e deixa o preflight do gateway decidir se é exigível pro município.
4. Chama o mesmo `issueInvoiceFromSource` do fluxo manual. Erros de validação de negócio (`FiscalIssueValidationError`) viram `NonRetriableError` do Inngest (não adianta tentar de novo); outros erros propagam para o retry padrão (3 tentativas).

### 5.5 Status assíncrono
Webhooks dedicados por gateway (`/api/focus-nfe/webhook`, `/api/nfe-io/webhook`) atualizam a `FiscalInvoice` e dão fallback de polling via Inngest (`nfse-status-sync.ts`) e a procedure `refreshStatus` (consulta sob demanda). PDF/XML são servidos via `/api/fiscal/invoices/[invoiceId]/{pdf,xml}` (proxy/redirect para o arquivo do gateway).

## 6. UI

- **Settings › Fiscal** (`settings/fiscal/page.tsx` + `fiscal-tab.tsx`): cadastro do perfil da organização — `fiscal-profile-form.tsx` (maior componente da branch, ~1300 linhas: dados cadastrais, endereço, regime tributário, defaults de serviço, bloco de Reforma Tributária condicional, upload de certificado, toggle de emissão automática).
- **Forge › Contratos**: botão "Nota Fiscal" por contrato abrindo `FiscalInvoiceCard`.
- **Financeiro › Lançamentos**: ação equivalente por lançamento (`entries-table.tsx`).
- **`issue-invoice-dialog.tsx`** (~1300 linhas): formulário de emissão com overrides do tomador (PF/PJ), data de competência, campos condicionais guiados pelo registry de município, bloco avançado de IBS/CBS.
- **`municipio-combobox.tsx`**: busca de município (usado no perfil).

## 7. Infra auxiliar nova

- `src/http/cnpj-ws/client.ts` — cliente da CNPJ.ws (consulta pública de CNPJ), usado tanto na hidratação automática do perfil quanto na emissão automática do tomador.
- `src/http/focus-nfe/*` — client HTTP completo da Focus (empresas, NFS-e municipal e nacional, webhooks, municípios).
- `src/lib/nfe-io.ts` — wrapper do SDK oficial `nfe-io` com tradução de erro (`describeNfeIoError`).
- `src/utils/document-masks.ts`, `src/utils/mask-money.ts`, `src/utils/validate-data.ts` — helpers de máscara/validação de CPF/CNPJ/dinheiro reaproveitados no formulário fiscal (e em outros formulários do projeto).
- `src/app/api/cnpj-ws/[cnpj]/route.ts`, `src/app/api/focus-nfe/{certificado,municipios}/route.ts`, `src/app/api/fiscal/certificado/route.ts` — rotas de apoio (proxy de consulta, upload de certificado).

## 8. Documentação viva já mantida (não duplicar aqui)

Essa branch já vinha documentando a si mesma incrementalmente — os documentos abaixo são a fonte de verdade contínua e devem ser atualizados junto do código daqui pra frente (regra do `CLAUDE.md`, item 10/14 espelhado no item 7 do roadmap):

- [`fiscal-ddd-roadmap.md`](./fiscal-ddd-roadmap.md) — arquitetura do domínio, ubiquitous language, dívidas técnicas.
- [`municipios-requirements.md`](./municipios-requirements.md) — registry de requisitos por município, roadmap de etapas, testes reais.
- [`investigacao-homologacao-teresina.md`](./investigacao-homologacao-teresina.md) — relatório da investigação que levou à adoção da NFE.io como gateway padrão (Focus não tem homologação MUNICIPAL para Teresina-PI; Teresina não aderiu ao Emissor Nacional).
- [`focusnfe-nf-overview.md`](./focusnfe-nf-overview.md) — conhecimento de base sobre NF/NFSe + API Focus + estado atual municipal×nacional.
- [`emissao.md`](./emissao.md) — plano original (v1, só Focus/contrato) que deu origem à feature.
- [`plan/`](./plan) — plano detalhado por camada (schema, http client, procedures oRPC, webhook/Inngest, hooks, UI) da fase inicial.

## 9. Pendências conhecidas (herdadas da investigação, não bugs desta branch)

- **Etapa 6 do roadmap de município** (emitir de fato em homologação) está bloqueada para Teresina-PI por motivos regulatórios/de infraestrutura do integrador, não por bug de código — ver seção 8-9 de `municipios-requirements.md`.
- `FiscalInvoice.focusResponse` é um nome legado que hoje guarda a resposta de **qualquer** gateway — candidato a rename (`provider_response`) na próxima migration que já mexa nesse modelo.
- `nfseStandard`/`supportedByFocus` seguem no formulário só por compatibilidade com perfis Focus legados; remover quando todos os perfis ativos estiverem em `NFE_IO`.
- `sync-invoice-status` está duplicado entre `invoices/refresh-status.ts` (on-demand) e `nfse-status-sync.ts` (Inngest) — extrair quando aparecer um 3º consumidor.

## 10. Fora do escopo desta branch

O diff local (`main` desatualizada) também mostra commits de **campanhas de disparo em massa via WhatsApp** (`feature/campanhas`, fases 1–4) — esses já estão mergeados em `origin/main` e não pertencem a `feature/fiscal-note`; foram trazidos por merges de sincronização (`Merge remote-tracking branch 'origin/main'...`), não desenvolvidos nesta branch.
