# Emissão de NFS-e no Forge via Focus NFe

## Context

O app **Forge** hoje gera **contratos** (`ForgeContract`) e propostas, mas não emite nenhuma nota fiscal. A necessidade é passar a **emitir Nota Fiscal de Serviço eletrônica (NFS-e)** a partir dos contratos/serviços prestados, usando a API **Focus NFe** (`https://doc.focusnfe.com.br`).

Decisões do usuário (definem a arquitetura):

- **Conta única da plataforma**: NASA tem 1 conta/token master na Focus (por ambiente). Cada org cliente é cadastrada como "empresa" na Focus com o certificado A1 dela. A emissão usa o token master e roteia pela `prestador.cnpj`.
- **Escopo v1: NFS-e (serviços)** apenas — sem NF-e de produto.
- **Disparo manual**: botão "Emitir nota fiscal" no contrato.

Resultado pretendido: do contrato assinado, o usuário clica e emite a NFS-e; o sistema acompanha o processamento assíncrono (webhook) e disponibiliza PDF (DANFSE) + XML quando autorizada.

---

## O mínimo que você precisa saber da Focus NFe

- **Autenticação**: HTTP Basic. O **token entra como _username_, senha vazia** (`Authorization: Basic base64("TOKEN:")`). Token é **por ambiente** (um de homologação, um de produção).
- **Base URLs**: homologação `https://homologacao.focusnfe.com.br/v2` · produção `https://api.focusnfe.com.br/v2`. Só muda a URL e o token.
- **Emitir NFS-e**: `POST /v2/nfse?ref=SEU_REF` com JSON contendo `prestador`, `tomador`, `servico` + `data_emissao`, `natureza_operacao`, `optante_simples_nacional`. O **`ref` é a SUA chave de idempotência** (única por nota) — é por ele que se consulta/cancela depois. Resposta inicial: status `processando_autorizacao`.
- **Modelo assíncrono**: o resultado vem por **webhook** (Focus faz POST na sua URL) **ou** consultando `GET /v2/nfse/{ref}`. Status: `processando_autorizacao` → `autorizado` | `erro_autorizacao` | `cancelado`. Autorizada retorna `numero`, `codigo_verificacao`, `url` (espelho), `url_danfse` (PDF) e `caminho_xml_nota_fiscal`.
- **Webhook**: registra-se via `POST /v2/hooks` `{ event: "nfse", url, authorization?/authorization_header? }` (o `authorization` é o segredo que a Focus reenvia — usamos pra validar). Retries automáticos: 1min/30min/1h/3h/24h.
- **Pré-requisitos por empresa (fora de código, mas bloqueantes)**: NFS-e é **por município** — o município da empresa precisa estar integrado na Focus, e cada empresa precisa ter **certificado digital A1** + **inscrição municipal** cadastrados na Focus.

---

## Gap analysis — o que falta no app antes de emitir

Os dados de contrato/org de hoje **não bastam** para uma NFS-e válida. Faltam:

1. **Perfil fiscal por org (emitente)**: `Organization` tem `cnpj` + endereço texto, mas **não** tem `inscricao_municipal`, `regime_tributario`/`optante_simples_nacional`, nem o **código IBGE do município** (7 dígitos, exigido pela Focus). → novo modelo `FiscalCompanyProfile`.
2. **Classificação fiscal do serviço**: `item_lista_servico` (LC 116, ex. `17.09`), `aliquota` do ISS e `iss_retido` não existem em lugar nenhum. → defaults no perfil fiscal (+ override opcional por contrato).
3. **Tomador (cliente)**: `ForgeContract.clientData.address` é **string livre** ([contracts.ts:8](src/app/router/forge/contracts.ts)). NFS-e para tomador PJ normalmente exige endereço estruturado + código de município. → estruturar/coletar endereço do cliente na hora de emitir (PF muitas vezes aceita só CPF + nome).
4. **Discriminação do serviço**: texto descritivo — pode derivar do contrato/proposta ou de um template no perfil.
5. **Certificado A1 por empresa**: gap operacional — cada org precisa fornecer o `.pfx` + senha, cadastrado na Focus. Na v1, cadastro feito **manualmente no painel da Focus** por um admin (registro via API `POST /v2/empresas` fica para fase 2).
6. **Infra de credenciais/webhook**: env vars do token master + segredo do webhook.

---

## Implementação

Domínio novo e fechado: `src/features/fiscal/` (regras CLAUDE.md de arquitetura por features). Reaproveita os padrões já existentes no repo (client `fetch` em `src/http/`, oRPC em `src/app/router/`, webhook em `src/app/api/.../webhook`, Inngest, `encryptSecret`).

### 1. Schema Prisma (`prisma/schema.prisma`)

Novos modelos + enums:

- **`FiscalCompanyProfile`** (1:1 com `Organization`): `organizationId @unique`, `cnpj`, `inscricaoMunicipal`, `codigoMunicipio` (IBGE), `razaoSocial`, `optanteSimplesNacional Boolean`, `regimeEspecialTributacao String?`, endereço estruturado do prestador (`logradouro/numero/complemento/bairro/cep/uf`), defaults do serviço (`defaultItemListaServico`, `defaultAliquotaIss Decimal`, `defaultIssRetido Boolean`, `defaultDiscriminacao String?`), `environment` (HOMOLOGACAO|PRODUCAO), `focusEmpresaRegistered Boolean` (flag de que o CNPJ já está habilitado na Focus).
- **`FiscalInvoice`** (a nota): `organizationId`, `contractId` (FK → `ForgeContract`, nullable), `ref @unique` (idempotência Focus, ex. `forge-<contractId>-<n>`), `type` (enum `FiscalInvoiceType` = NFSE), `status` (enum `FiscalInvoiceStatus`: PROCESSANDO|AUTORIZADO|ERRO|CANCELADO), `environment`, `valorServicos Decimal`, `requestPayload Json`, `focusResponse Json?`, `numero String?`, `codigoVerificacao String?`, `urlEspelho String?`, `urlDanfse String?`, `caminhoXml String?`, `tomadorSnapshot Json`, `errorMessage String?`, `issuedById`, timestamps + `authorizedAt`.
- Relações: `Organization` ganha `fiscalProfile FiscalCompanyProfile?` e `fiscalInvoices`; `ForgeContract` ganha `fiscalInvoices FiscalInvoice[]`.
- Enums: `FiscalInvoiceStatus`, `FiscalInvoiceType`, `FiscalEnvironment`.

> Migration via `pnpm db:migrate` (pedir ao dev). **Aplicar o ritual pós-migration do CLAUDE.md** (regenerar Prisma, bumpar `SCHEMA_VERSION` em `src/lib/prisma.ts`, touch nos catch-all routes, validar via curl).

### 2. Env vars (`.env.local` + doc no CLAUDE.md)

- `FOCUS_ADMIN_TOKEN` — token master da conta, usado somente em CRUD de `/empresas` (endpoint só existe em produção). Emissão/consulta/cancelamento de NFS-e e registro de webhook usam sempre o token por-empresa (`focusTokenProducao`/`focusTokenHomologacao`, criptografados no banco).
- `FOCUS_NFE_WEBHOOK_SECRET` — valor enviado como `authorization` no registro do hook e validado na entrada.

### 3. HTTP client — `src/http/focus-nfe/`

Espelhar `src/http/nerp/client.ts` / `src/lib/asaas.ts`:

- `client.ts`: `focusFetch<T>({ method, path, body, environment })` — Basic auth (`base64("TOKEN:")`), base URL por ambiente, `AbortSignal.timeout`, classe `FocusNfeHttpError`.
- Funções: `emitirNfse(ref, payload, env)`, `consultarNfse(ref, env)`, `cancelarNfse(ref, justificativa, env)`, `registrarWebhook(...)` (helper one-off de setup).
- `types.ts`: tipos do payload (`prestador`/`tomador`/`servico`) e das respostas.
- `build-nfse-payload.ts`: monta o payload a partir de `ForgeContract` + `FiscalCompanyProfile` (prestador do profile, tomador do `clientData`/snapshot, valores do contrato, defaults de ISS/item).

### 4. oRPC — `src/app/router/fiscal/` (registrar em [router/index.ts](src/app/router/index.ts))

Seguir o padrão `base.use(requiredAuthMiddleware).use(requireOrgMiddleware).input(zod).handler(...)`:

- `fiscal.profile.get` / `fiscal.profile.upsert` — CRUD do perfil fiscal da org.
- `fiscal.invoices.issueFromContract({ contractId, tomadorOverride?, servicoOverride? })` — valida perfil completo, monta payload, `emitirNfse`, cria `FiscalInvoice` (status PROCESSANDO), retorna a nota. Cobrar Stars opcional (padrão `chargeStarsByAction`, como em [contracts.ts:116](src/app/router/forge/contracts.ts)).
- `fiscal.invoices.listByContract` / `fiscal.invoices.get` / `fiscal.invoices.refreshStatus` (consulta `GET /nfse/{ref}` sob demanda) / `fiscal.invoices.cancel`.

### 5. Webhook — `src/app/api/focus-nfe/webhook/route.ts`

Espelhar [stripe/webhook](src/app/api/stripe/webhook/route.ts): `runtime = "nodejs"`, valida `FOCUS_NFE_WEBHOOK_SECRET` (fail-closed), lê `ref` do body, faz update idempotente e **dispara Inngest** `fiscal/nfse.status-changed` `{ ref }` (não bloqueia a resposta), retorna 200.

### 6. Inngest — `src/inngest/functions/fiscal-nfse-sync.ts` (registrar em [functions.ts](src/inngest/functions.ts))

Evento `fiscal/nfse.status-changed`: `step.run` consulta a Focus (`consultarNfse`), atualiza `FiscalInvoice` (status/numero/urls/xml/erro/`authorizedAt`) por `ref`, e notifica (email/pusher) o usuário. Idempotente.

### 7. UI — `src/features/fiscal/`

- `hooks/use-fiscal-profile.ts`, `hooks/use-fiscal-invoices.ts` (padrão hooks-por-recurso do CLAUDE.md, item 9).
- Painel de **configuração fiscal** da org (inscrição municipal, código município, regime/Simples, item lista serviço default, alíquota ISS, ambiente) — dentro de Forge Settings ([forge-settings.tsx](src/features/forge/components/settings/forge-settings.tsx)) ou seção própria.
- No contrato (em [contracts-tab.tsx](src/features/forge/components/contracts/contracts-tab.tsx) / detalhe): botão **"Emitir nota fiscal"** + badge de status + link pro PDF/XML quando autorizada. Diálogo pra completar/confirmar dados do tomador e do serviço antes de emitir.

### 8. Setup único (admin)

Registrar o webhook na Focus (`registrarWebhook`) uma vez por ambiente, e cadastrar cada empresa/certificado A1 no painel da Focus (v1 manual).

---

## Arquivos principais

- `prisma/schema.prisma` — novos modelos/enums + relações em `Organization` e `ForgeContract`.
- `src/http/focus-nfe/{client,types,build-nfse-payload}.ts` — integração (espelha `src/http/nerp/`, `src/lib/asaas.ts`).
- `src/app/router/fiscal/*` + registro em `src/app/router/index.ts`.
- `src/app/api/focus-nfe/webhook/route.ts` — espelha `src/app/api/stripe/webhook/route.ts`.
- `src/inngest/functions/fiscal-nfse-sync.ts` + registro em `src/inngest/functions.ts`.
- `src/features/fiscal/{hooks,components}/*` + ganchos na UI do Forge.
- `src/lib/prisma.ts` — bump `SCHEMA_VERSION` (ritual pós-migration).

## Verificação (end-to-end em homologação)

1. `pnpm db:migrate` + ritual pós-migration (regenerar Prisma, bump `SCHEMA_VERSION`, touch catch-all, validar rotas com `curl`).
2. Cadastrar uma empresa de teste + certificado A1 no painel **de homologação** da Focus; preencher o perfil fiscal da org no app.
3. Registrar o webhook apontando pra URL pública (ngrok/preview) em homologação.
4. Criar/assinar um contrato → clicar **"Emitir nota fiscal"** → conferir `FiscalInvoice` criada com `status=PROCESSANDO` e `ref`.
5. Aguardar webhook/Inngest → conferir transição para `AUTORIZADO` com `numero`, `url_danfse` (PDF) e `caminho_xml`. Testar fallback `refreshStatus` (GET `/nfse/{ref}`).
6. Testar caminho de erro (`erro_autorizacao`) e cancelamento.

> Começar **sempre em homologação**; só apontar pra produção após validar emissão e webhook ponta a ponta.
