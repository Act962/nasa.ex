-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('MEI', 'SIMPLES', 'PRESUMIDO', 'REAL');

-- CreateEnum
CREATE TYPE "AccountingNature" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COST', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TaxKind" AS ENUM ('DAS', 'DAS_MEI', 'IRPJ', 'CSLL', 'PIS', 'COFINS', 'ISS', 'ICMS', 'CBS', 'IBS', 'IS', 'INSS', 'FGTS', 'IRRF');

-- CreateEnum
CREATE TYPE "TaxAssessmentStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FiscalObligationStatus" AS ENUM ('PENDING', 'DONE', 'OVERDUE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "TaxCreditStatus" AS ENUM ('PENDING_PAYMENT', 'AVAILABLE', 'USED', 'GLOSSED');

-- CreateEnum
CREATE TYPE "ProductTaxKind" AS ENUM ('PRODUCT', 'SERVICE');

-- AlterEnum
ALTER TYPE "NodeType" ADD VALUE 'COMPLIANCE_ITEM_DUE';

-- AlterTable
ALTER TABLE "forge_products" ADD COLUMN     "tax_classification_id" TEXT;

-- AlterTable
ALTER TABLE "forge_proposals" ADD COLUMN     "tax_breakdown" JSONB;

-- AlterTable
ALTER TABLE "forge_simulations" ADD COLUMN     "tax_rate_bps" INTEGER,
ADD COLUMN     "tax_rate_source" TEXT;

-- AlterTable
ALTER TABLE "nbox_folders" ADD COLUMN     "is_restricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "system_key" TEXT;

-- AlterTable
ALTER TABLE "payment_contacts" ADD COLUMN     "state_registration" TEXT,
ADD COLUMN     "tax_regime" "TaxRegime";

-- CreateTable
CREATE TABLE "organization_tax_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "regime" "TaxRegime" NOT NULL DEFAULT 'SIMPLES',
    "cnae_principal" TEXT,
    "cnaes_secundarios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "simples_annex" TEXT,
    "is_fator_r_subject" BOOLEAN NOT NULL DEFAULT false,
    "state_registration" TEXT,
    "municipal_registration" TEXT,
    "municipio_ibge" TEXT,
    "uf" TEXT,
    "opened_at" TIMESTAMP(3),
    "payroll_12m_cents" INTEGER NOT NULL DEFAULT 0,
    "has_employees" BOOLEAN NOT NULL DEFAULT false,
    "is_icms_contributor" BOOLEAN NOT NULL DEFAULT false,
    "is_iss_contributor" BOOLEAN NOT NULL DEFAULT true,
    "presumed_irpj_base_bps" INTEGER NOT NULL DEFAULT 3200,
    "presumed_csll_base_bps" INTEGER NOT NULL DEFAULT 3200,
    "iss_rate_bps" INTEGER,
    "ibs_cbs_outside_simples" BOOLEAN NOT NULL DEFAULT false,
    "alert_phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboarding_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_tax_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nature" "AccountingNature" NOT NULL,
    "parent_id" TEXT,
    "is_analytical" BOOLEAN NOT NULL DEFAULT true,
    "referential_code" TEXT,
    "system_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_mappings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "source_event" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit_cents" INTEGER NOT NULL DEFAULT 0,
    "credit_cents" INTEGER NOT NULL DEFAULT 0,
    "cost_center_id" TEXT,
    "memo" TEXT,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "tax" "TaxKind" NOT NULL,
    "regime" "TaxRegime",
    "annex" TEXT,
    "bracket" INTEGER,
    "revenue_from_cents" INTEGER,
    "revenue_to_cents" INTEGER,
    "rate_bps" INTEGER NOT NULL,
    "deduction_cents" INTEGER,
    "fixed_amount_cents" INTEGER,
    "municipio_ibge" TEXT,
    "c_class_trib" TEXT,
    "reduction_bps" INTEGER,
    "distribution" JSONB,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "legal_source" TEXT NOT NULL,
    "note" TEXT,
    "seed_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_assessments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "tax" "TaxKind" NOT NULL,
    "base_cents" INTEGER NOT NULL,
    "effective_rate_bps" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "credits_cents" INTEGER NOT NULL DEFAULT 0,
    "calculation_memo" JSONB NOT NULL,
    "status" "TaxAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "due_date" TIMESTAMP(3),
    "payment_entry_id" TEXT,
    "confirmed_by_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_obligations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "FiscalObligationStatus" NOT NULL DEFAULT 'PENDING',
    "assessment_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_credits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "attachment_id" TEXT,
    "entry_id" TEXT,
    "supplier_contact_id" TEXT,
    "supplier_document" TEXT,
    "supplier_name" TEXT,
    "access_key" TEXT NOT NULL,
    "tax" "TaxKind" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "invoice_total_cents" INTEGER,
    "competence" TEXT NOT NULL,
    "status" "TaxCreditStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "used_in_assessment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_tax_classifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProductTaxKind" NOT NULL DEFAULT 'SERVICE',
    "ncm" TEXT,
    "nbs" TEXT,
    "lc116_item" TEXT,
    "c_class_trib" TEXT,
    "cst" TEXT,
    "reduction_bps" INTEGER NOT NULL DEFAULT 0,
    "iss_municipio_ibge" TEXT,
    "iss_rate_bps" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_tax_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type_code" TEXT NOT NULL,
    "label" TEXT,
    "nbox_item_id" TEXT,
    "number" TEXT,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "period" TEXT,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "extraction" JSONB,
    "notes" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_document_requirements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type_code" TEXT NOT NULL,
    "is_applicable" BOOLEAN,
    "weight" INTEGER,
    "default_validity_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_credentials" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "portal" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "username" TEXT,
    "secret_encrypted" TEXT NOT NULL,
    "secret_last4" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_credential_reveal_logs" (
    "id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "revealed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_credential_reveal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_certificates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'A1',
    "subject_name" TEXT,
    "document" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "pfx_encrypted" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regularity_score_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "score_bps" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regularity_score_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_tax_profiles_organization_id_key" ON "organization_tax_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "accounting_accounts_organization_id_nature_idx" ON "accounting_accounts"("organization_id", "nature");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_accounts_organization_id_code_key" ON "accounting_accounts"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_accounts_organization_id_system_key_key" ON "accounting_accounts"("organization_id", "system_key");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_mappings_organization_id_source_type_source_id_key" ON "accounting_mappings"("organization_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "journal_entries_organization_id_date_idx" ON "journal_entries"("organization_id", "date");

-- CreateIndex
CREATE INDEX "journal_entries_source_type_source_id_idx" ON "journal_entries"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "journal_lines_organization_id_account_id_idx" ON "journal_lines"("organization_id", "account_id");

-- CreateIndex
CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_seed_key_key" ON "tax_rates"("seed_key");

-- CreateIndex
CREATE INDEX "tax_rates_tax_regime_valid_from_idx" ON "tax_rates"("tax", "regime", "valid_from");

-- CreateIndex
CREATE INDEX "tax_rates_organization_id_idx" ON "tax_rates"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_assessments_payment_entry_id_key" ON "tax_assessments"("payment_entry_id");

-- CreateIndex
CREATE INDEX "tax_assessments_organization_id_status_idx" ON "tax_assessments"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tax_assessments_organization_id_tax_period_key" ON "tax_assessments"("organization_id", "tax", "period");

-- CreateIndex
CREATE INDEX "fiscal_obligations_organization_id_due_date_idx" ON "fiscal_obligations"("organization_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_obligations_organization_id_kind_period_key" ON "fiscal_obligations"("organization_id", "kind", "period");

-- CreateIndex
CREATE INDEX "tax_credits_organization_id_competence_idx" ON "tax_credits"("organization_id", "competence");

-- CreateIndex
CREATE INDEX "tax_credits_entry_id_idx" ON "tax_credits"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_credits_organization_id_access_key_tax_key" ON "tax_credits"("organization_id", "access_key", "tax");

-- CreateIndex
CREATE INDEX "product_tax_classifications_organization_id_idx" ON "product_tax_classifications"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_documents_nbox_item_id_key" ON "company_documents"("nbox_item_id");

-- CreateIndex
CREATE INDEX "company_documents_organization_id_type_code_idx" ON "company_documents"("organization_id", "type_code");

-- CreateIndex
CREATE INDEX "company_documents_organization_id_expires_at_idx" ON "company_documents"("organization_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "company_document_requirements_organization_id_type_code_key" ON "company_document_requirements"("organization_id", "type_code");

-- CreateIndex
CREATE INDEX "company_credentials_organization_id_idx" ON "company_credentials"("organization_id");

-- CreateIndex
CREATE INDEX "company_credential_reveal_logs_credential_id_revealed_at_idx" ON "company_credential_reveal_logs"("credential_id", "revealed_at");

-- CreateIndex
CREATE INDEX "company_certificates_organization_id_valid_to_idx" ON "company_certificates"("organization_id", "valid_to");

-- CreateIndex
CREATE UNIQUE INDEX "regularity_score_snapshots_organization_id_date_key" ON "regularity_score_snapshots"("organization_id", "date");

-- CreateIndex
CREATE INDEX "forge_products_tax_classification_id_idx" ON "forge_products"("tax_classification_id");

-- CreateIndex
CREATE UNIQUE INDEX "nbox_folders_organization_id_system_key_key" ON "nbox_folders"("organization_id", "system_key");

-- AddForeignKey
ALTER TABLE "forge_products" ADD CONSTRAINT "forge_products_tax_classification_id_fkey" FOREIGN KEY ("tax_classification_id") REFERENCES "product_tax_classifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_tax_profiles" ADD CONSTRAINT "organization_tax_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounting_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "accounting_mappings" ADD CONSTRAINT "accounting_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_mappings" ADD CONSTRAINT "accounting_mappings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounting_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_assessments" ADD CONSTRAINT "tax_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_obligations" ADD CONSTRAINT "fiscal_obligations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_obligations" ADD CONSTRAINT "fiscal_obligations_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "tax_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_credits" ADD CONSTRAINT "tax_credits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tax_classifications" ADD CONSTRAINT "product_tax_classifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_document_requirements" ADD CONSTRAINT "company_document_requirements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_credentials" ADD CONSTRAINT "company_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_credential_reveal_logs" ADD CONSTRAINT "company_credential_reveal_logs_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "company_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_certificates" ADD CONSTRAINT "company_certificates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regularity_score_snapshots" ADD CONSTRAINT "regularity_score_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

