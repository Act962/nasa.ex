# Roadmap DDD do domínio Fiscal

> Documento vivo do bounded context **Fiscal** (emissão de documentos fiscais). Última revisão: 2026-07-09 — introdução do gateway NFE.io + port `FiscalGatewayAdapter`.
>
> **Regra de manutenção:** sempre que alterar `src/features/fiscal/lib/gateways/`, adicionar um novo gateway ou um novo `FiscalInvoiceType`, **atualize este arquivo na mesma sessão** — ele é o mapa de como o domínio deve evoluir sem virar uma pilha de ifs por gateway/padrão/tipo.

## 1. Por que este documento existe

O domínio fiscal cresceu organicamente: primeiro NFS-e municipal via Focus NFe, depois NFS-e nacional (mesmo gateway, padrão diferente), agora NFE.io como segundo gateway. Cada entrada nova arriscava virar mais um `if (profile.nfseStandard === "NACIONAL")` ou `if (profile.fiscalGateway === "NFE_IO")` espalhado pelos handlers. A introdução do port `FiscalGatewayAdapter` (`src/features/fiscal/lib/gateways/`) resolveu a bifurcação **gateway** (Focus × NFE.io); este roadmap descreve o caminho para o domínio inteiro não se perder quando entrarem novos **tipos de emissão** (NF-e de produto, NFC-e) ou novos gateways.

## 2. Estado atual (implementado)

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
   │ (municipal/nacional,
   │  detalhe interno)
```

- **Port**: `FiscalGatewayAdapter` (`lib/gateways/types.ts`) — CRUD de empresa, emissão/consulta/cancelamento/download de NFS-e, verificação de webhook. Único ponto que handlers/Inngest conhecem.
- **Registry**: `factory.ts` — `registerGateway`/`resolveGateway`/`resolveGatewayForInvoice`, mesmo padrão Open/Closed de `src/features/tracking-chat/lib/providers/factory.ts`.
- **Adapters**: `adapters/focus-nfe/` (envolve o `NfseProvider` municipal/nacional existente — não removido, virou detalhe privado) e `adapters/nfe-io/` (sobre o SDK `nfe-io`).
- **Decisão de produto**: `FiscalCompanyProfile.fiscalGateway` sempre `NFE_IO` para empresas novas/re-salvas; `FOCUS_NFE` só existe em perfis/notas legadas, mantido consultável via `resolveGatewayForInvoice`.
- **Registry de requisitos por município** (`lib/municipio-requirements.ts`) é hoje **gateway-agnóstico**: tanto o adapter Focus quanto o NFE.io chamam `resolveMunicipioRequirements(codigoMunicipio)` para exigências de CNAE/endereço do tomador.

## 3. Ubiquitous language

| Termo | Significado |
| --- | --- |
| **Emissor** | A empresa/organização que presta o serviço e emite o documento fiscal (`FiscalCompanyProfile`). |
| **Tomador** | Quem recebe o serviço (PF ou PJ) — snapshot gravado em `FiscalInvoice.tomadorSnapshot`. |
| **Documento Fiscal** | Termo guarda-chuva para qualquer nota emitida — hoje só NFS-e (municipal/nacional), amanhã pode incluir NF-e de produto/NFC-e. |
| **Gateway** | O provedor externo que fala com a SEFAZ/prefeitura em nome do NASA (Focus NFe, NFE.io, futuro). |
| **Competência** | Mês/ano de referência do serviço prestado (`dataCompetencia`), distinto da data de emissão. |
| **Código de Serviço** | **Cuidado**: existem dois códigos não intercambiáveis — item da lista de serviço LC 116/2003 (`defaultItemListaServico`, 6 dígitos, usado pela Focus) e código de serviço no formato do MUNICÍPIO (`defaultCityServiceCode`, usado pela NFE.io). Nunca usar um no lugar do outro. |

## 4. Camadas alvo (evolução futura, não implementado ainda)

O domínio hoje é "handlers oRPC finos chamando o gateway direto". Para crescer sem perder coesão, a evolução natural é introduzir uma camada de aplicação explícita:

```
src/features/fiscal/
├── domain/            # (futuro) Entidades e Value Objects puros, sem I/O
│   ├── cnpj.ts                    # VO: validação/formatação de CNPJ
│   ├── municipio-ibge.ts          # VO: código IBGE (7 dígitos)
│   ├── aliquota.ts                # VO: fração 0-1, evita confusão % × fração
│   └── service-code.ts            # VO: distingue ItemListaLc116 vs CityServiceCode
├── application/       # (futuro) Use cases — hoje vivem dentro dos handlers oRPC
│   ├── issue-service-invoice.ts   # orquestra: preflight → gateway.issueInvoice → persistir
│   ├── cancel-invoice.ts
│   └── sync-invoice-status.ts     # usado por Inngest E por refreshStatus (hoje duplicado)
├── lib/gateways/      # PORT (já implementado) — fica como está
│   └── ports/
│       ├── fiscal-gateway.ts        # = FiscalGatewayAdapter atual
│       ├── invoice-file-storage.ts  # (futuro) abstrai S3 (hoje chamado direto no Inngest)
│       └── billing-charger.ts       # (futuro) abstrai chargeStarsByAction (hoje chamado direto)
```

**Critério para migrar um handler para `application/`**: quando a mesma lógica de orquestração aparecer em 2+ lugares (ex.: `invoices/issue.ts` e `nfse-status-sync.ts` já duplicam parte da lógica de "persistir snapshot autorizado") — extrair nesse momento, não antes. Não criar a camada vazia por antecipação.

## 5. Como novos tipos de emissão entram (sem explosão de métodos)

Hoje `FiscalInvoiceType` tem `NFSE` e `NFSE_NACIONAL` (ambos resolvidos internamente pelo adapter Focus). Quando entrar um tipo genuinamente diferente (NF-e de produto, NFC-e):

1. **Não** adicionar `issueProductInvoice`, `issueConsumerInvoice` etc. ao `FiscalGatewayAdapter` — isso quebra adapters que não suportam o tipo novo.
2. Adicionar uma capability flag: `supportsInvoiceType(type: FiscalInvoiceType): boolean` no port. Handlers verificam antes de chamar `issueInvoice`.
3. Os métodos existentes (`issueInvoice`, `getInvoice`, `cancelInvoice`) permanecem genéricos — o `IssueInvoiceParams`/`InvoiceSnapshot` já carregam `invoiceType`, então o adapter decide o payload builder certo internamente (mesmo padrão que municipal/nacional usam hoje dentro do adapter Focus).
4. Cada adapter implementa só os tipos que o gateway realmente suporta; `supportsInvoiceType` retorna `false` para o resto em vez de lançar.

## 6. Dívidas técnicas mapeadas (não bloqueiam a Fase 1, mas devem ser resolvidas quando tocar a área)

| Dívida | Onde | Quando resolver |
| --- | --- | --- |
| Coluna `fiscal_invoice.focus_response` guarda a resposta de **qualquer** gateway (nome legado) | `prisma/schema.prisma` | Rename para `provider_response` na próxima migration que já mexa em `FiscalInvoice` (evita migration só-por-isso) |
| `FiscalCompanyProfile.focusWebhookId*` (4 colunas) só fazem sentido para Focus | schema | Remover quando/se a Focus for descontinuada de vez |
| 1 empresa por organização (`FiscalCompanyProfile.organizationId @unique`) | schema | Se o produto pedir múltiplos emissores por org, migrar para N:1 — não antes |
| `nfseStandard`/`supportedByFocus` seguem no formulário (payload, sem UI) por compat com perfis Focus legados | `fiscal-profile-form.tsx`, `profile-upsert.ts` | Remover de vez quando todos os perfis ativos estiverem em `NFE_IO` |
| `sync-invoice-status` duplicado entre `invoices/refresh-status.ts` (on-demand) e `nfse-status-sync.ts` (Inngest) | ambos arquivos | Extrair para `application/sync-invoice-status.ts` quando um 3º consumidor aparecer |

## 7. Regras de manutenção (espelha os itens 10/14 do CLAUDE.md)

Sempre que criar/atualizar qualquer coisa em `src/features/fiscal/lib/gateways/`, `src/lib/nfe-io.ts`, `src/http/focus-nfe/`, os handlers `src/app/router/fiscal/`, o Inngest `src/inngest/functions/fiscal/`, ou os modelos `Fiscal*`/enum `FiscalGateway` no `prisma/schema.prisma`: atualizar este documento **e** `docs/nfs/municipios-requirements.md` (se a mudança tocar requisitos por município) na mesma sessão.
