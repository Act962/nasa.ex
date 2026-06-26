-- CreateEnum
CREATE TYPE "FiscalEnvironment" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "FiscalInvoiceStatus" AS ENUM ('PROCESSANDO', 'AUTORIZADO', 'ERRO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FiscalInvoiceType" AS ENUM ('NFSE');

-- CreateEnum
CREATE TYPE "TomadorType" AS ENUM ('PF', 'PJ');

-- CreateTable
CREATE TABLE "fiscal_company_profile" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "municipio" TEXT,
    "inscricao_municipal" TEXT NOT NULL,
    "codigo_municipio" TEXT NOT NULL,
    "optante_simples_nacional" BOOLEAN NOT NULL DEFAULT false,
    "regime_especial_tributacao" TEXT,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "default_item_lista_servico" TEXT NOT NULL,
    "default_aliquota_iss" DECIMAL(5,4) NOT NULL,
    "default_iss_retido" BOOLEAN NOT NULL DEFAULT false,
    "default_discriminacao" TEXT,
    "environment" "FiscalEnvironment" NOT NULL DEFAULT 'HOMOLOGACAO',
    "focus_empresa_registered" BOOLEAN NOT NULL DEFAULT false,
    "focus_empresa_id" INTEGER,
    "focus_token_producao" TEXT,
    "focus_token_homologacao" TEXT,
    "supported_by_focus" BOOLEAN NOT NULL DEFAULT false,
    "focus_certificado_uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_company_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_invoice" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "ref" TEXT NOT NULL,
    "type" "FiscalInvoiceType" NOT NULL DEFAULT 'NFSE',
    "status" "FiscalInvoiceStatus" NOT NULL DEFAULT 'PROCESSANDO',
    "environment" "FiscalEnvironment" NOT NULL,
    "valor_servicos" DECIMAL(14,2) NOT NULL,
    "aliquota_iss" DECIMAL(5,4) NOT NULL,
    "iss_retido" BOOLEAN NOT NULL DEFAULT false,
    "valor_iss" DECIMAL(14,2),
    "deducoes" DECIMAL(14,2),
    "retencao_ir" DECIMAL(14,2),
    "retencao_pis" DECIMAL(14,2),
    "retencao_cofins" DECIMAL(14,2),
    "retencao_csll" DECIMAL(14,2),
    "retencao_inss" DECIMAL(14,2),
    "data_competencia" TIMESTAMP(3) NOT NULL,
    "request_payload" JSONB NOT NULL,
    "focus_response" JSONB,
    "numero" TEXT,
    "codigo_verificacao" TEXT,
    "url_espelho" TEXT,
    "url_danfse" TEXT,
    "caminho_xml_focus" TEXT,
    "caminho_xml_storage" TEXT,
    "tomador_snapshot" JSONB NOT NULL,
    "tipo_tomador" "TomadorType" NOT NULL,
    "error_message" TEXT,
    "issued_by_id" TEXT NOT NULL,
    "authorized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_company_profile_organization_id_key" ON "fiscal_company_profile"("organization_id");

-- CreateIndex
CREATE INDEX "fiscal_company_profile_organization_id_idx" ON "fiscal_company_profile"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_invoice_ref_key" ON "fiscal_invoice"("ref");

-- CreateIndex
CREATE INDEX "fiscal_invoice_organization_id_idx" ON "fiscal_invoice"("organization_id");

-- CreateIndex
CREATE INDEX "fiscal_invoice_contract_id_idx" ON "fiscal_invoice"("contract_id");

-- CreateIndex
CREATE INDEX "fiscal_invoice_status_created_at_idx" ON "fiscal_invoice"("status", "created_at");

-- CreateIndex
CREATE INDEX "fiscal_invoice_ref_idx" ON "fiscal_invoice"("ref");

-- AddForeignKey
ALTER TABLE "fiscal_company_profile" ADD CONSTRAINT "fiscal_company_profile_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_invoice" ADD CONSTRAINT "fiscal_invoice_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_invoice" ADD CONSTRAINT "fiscal_invoice_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "fiscal_company_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_invoice" ADD CONSTRAINT "fiscal_invoice_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "forge_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_invoice" ADD CONSTRAINT "fiscal_invoice_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
