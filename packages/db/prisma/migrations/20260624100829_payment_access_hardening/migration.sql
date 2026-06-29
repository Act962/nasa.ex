-- CreateEnum
CREATE TYPE "PaymentRole" AS ENUM ('VIEWER', 'EDITOR', 'ADMIN', 'OWNER');

-- AlterTable: PaymentAccess ganha role + permissions granulares + OTP + WebAuthn
ALTER TABLE "payment_access"
  ADD COLUMN "role"                   "PaymentRole" NOT NULL DEFAULT 'VIEWER',
  ADD COLUMN "permissions"            JSONB,
  ADD COLUMN "session_count"          INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN "last_otp_at"            TIMESTAMP(3),
  ADD COLUMN "pending_otp_hash"       TEXT,
  ADD COLUMN "pending_otp_expires_at" TIMESTAMP(3),
  ADD COLUMN "webauthn_credentials"   JSONB;

-- AlterTable: governance ganha controles de sessão/OTP
ALTER TABLE "payment_governance_config"
  ADD COLUMN "session_timeout_minutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "otp_every_n_sessions"    INTEGER NOT NULL DEFAULT 10;
