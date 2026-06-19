# Etapa 1 — Schema Prisma

## Objetivo

Criar os modelos `FiscalCompanyProfile` e `FiscalInvoice`, 4 novos enums, e adicionar as relações em `Organization` e `ForgeContract`.

## Novos enums

```prisma
enum FiscalEnvironment {
  HOMOLOGACAO
  PRODUCAO
}

enum FiscalInvoiceStatus {
  PROCESSANDO
  AUTORIZADO
  ERRO
  CANCELADO
}

enum FiscalInvoiceType {
  NFSE
}

enum TomadorType {
  PF
  PJ
}
```

## Modelo `FiscalCompanyProfile` (1:1 com Organization)

```prisma
model FiscalCompanyProfile {
  id                       String            @id @default(cuid())
  organizationId           String            @unique
  organization             Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Prestador
  cnpj                     String
  razaoSocial              String
  inscricaoMunicipal       String
  codigoMunicipio          String            // IBGE 7 dígitos
  optanteSimplesNacional   Boolean           @default(false)
  regimeEspecialTributacao String?

  // Endereço estruturado do prestador
  logradouro               String
  numero                   String
  complemento              String?
  bairro                   String
  cep                      String
  uf                       String

  // Defaults do serviço
  defaultItemListaServico  String            // LC 116, ex: "17.09"
  defaultAliquotaIss       Decimal           @db.Decimal(5, 4)
  defaultIssRetido         Boolean           @default(false)
  defaultDiscriminacao     String?

  // Infra
  environment              FiscalEnvironment @default(HOMOLOGACAO)
  focusEmpresaRegistered   Boolean           @default(false)
  supportedByFocus         Boolean           @default(false)

  createdAt                DateTime          @default(now())
  updatedAt                DateTime          @updatedAt

  fiscalInvoices           FiscalInvoice[]

  @@index([organizationId])
}
```

## Modelo `FiscalInvoice`

```prisma
model FiscalInvoice {
  id                   String               @id @default(cuid())
  organizationId       String
  organization         Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  profileId            String
  profile              FiscalCompanyProfile @relation(fields: [profileId], references: [id])
  contractId           String?
  contract             ForgeContract?       @relation(fields: [contractId], references: [id])

  ref                  String               @unique   // "forge-<contractId>-<n>"
  type                 FiscalInvoiceType    @default(NFSE)
  status               FiscalInvoiceStatus  @default(PROCESSANDO)
  environment          FiscalEnvironment

  // Valores
  valorServicos        Decimal              @db.Decimal(14, 2)
  aliquotaIss          Decimal              @db.Decimal(5, 4)
  issRetido            Boolean              @default(false)
  valorIss             Decimal?             @db.Decimal(14, 2)
  deducoes             Decimal?             @db.Decimal(14, 2)
  // Retenções federais (zeradas v1, estrutura presente para v2)
  retencaoIr           Decimal?             @db.Decimal(14, 2)
  retencaoPis          Decimal?             @db.Decimal(14, 2)
  retencaoCofins       Decimal?             @db.Decimal(14, 2)
  retencaoCsll         Decimal?             @db.Decimal(14, 2)
  retencaoInss         Decimal?             @db.Decimal(14, 2)

  dataCompetencia      DateTime             // mês/ano da competência fiscal

  requestPayload       Json                 // payload enviado à Focus
  focusResponse        Json?                // última resposta da Focus

  // Resultado (preenchido em AUTORIZADO)
  numero               String?
  codigoVerificacao    String?
  urlEspelho           String?
  urlDanfse            String?
  caminhoXmlFocus      String?              // URL original da Focus
  caminhoXmlStorage    String?              // URL interna R2/S3

  // Tomador snapshot
  tomadorSnapshot      Json
  tipoTomador          TomadorType

  errorMessage         String?
  issuedById           String
  issuedBy             User                 @relation(fields: [issuedById], references: [id])

  authorizedAt         DateTime?
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  @@index([organizationId])
  @@index([contractId])
  @@index([status, createdAt])
  @@index([ref])
}
```

## Relações a adicionar em modelos existentes

```prisma
// Dentro de model Organization:
fiscalProfile    FiscalCompanyProfile?
fiscalInvoices   FiscalInvoice[]

// Dentro de model ForgeContract:
fiscalInvoices   FiscalInvoice[]
```

## Guard de dupla emissão (SQL na migration)

Adicionar no arquivo de migration gerado pelo Prisma **após** o `-- CreateTable`:

```sql
-- Impede duas notas ativas para o mesmo contrato
CREATE UNIQUE INDEX "fiscal_invoice_contract_active_unique"
  ON "FiscalInvoice" ("contractId")
  WHERE status IN ('PROCESSANDO', 'AUTORIZADO');
```

> O Prisma não suporta índice parcial com `WHERE` via schema — precisa ser adicionado manualmente no arquivo `.sql` da migration antes de aplicar.

## Execução

```bash
# Pedir ao dev:
pnpm db:migrate          # gera migration + aplica

# Ritual pós-migration (obrigatório — ver CLAUDE.md item 11):
pnpm db:generate         # regenera cliente Prisma
# Bumpar SCHEMA_VERSION em src/lib/prisma.ts: "v39-fiscal-invoice"
touch src/app/api/auth/[...all]/route.ts src/app/api/rpc/[[...rest]]/route.ts
curl -sI -m 10 http://localhost:3000/api/rpc   # deve retornar 200/307
```

## Validação

- `npx prisma studio` → confirmar tabelas `FiscalCompanyProfile` e `FiscalInvoice` criadas
- `prisma migrate status` → todos aplicados, sem drift
