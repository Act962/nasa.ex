-- Web Push: inscrições por browser (spec 0022)
-- Um usuário tem N inscrições. O endpoint é a identidade da inscrição e é
-- único globalmente: o mesmo browser depois de troca de conta reaproveita a
-- linha, mudando só o user_id.
CREATE TABLE IF NOT EXISTS "push_subscription" (
  "id"            TEXT NOT NULL,
  "user_id"       TEXT NOT NULL,
  "endpoint"      TEXT NOT NULL,
  "p256dh"        TEXT NOT NULL,
  "auth"          TEXT NOT NULL,
  "user_agent"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at"  TIMESTAMP(3),
  "failure_count" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscription_endpoint_key"
  ON "push_subscription" ("endpoint");

CREATE INDEX IF NOT EXISTS "push_subscription_user_id_idx"
  ON "push_subscription" ("user_id");

-- Cascade: conta apagada leva as inscrições junto.
ALTER TABLE "push_subscription"
  DROP CONSTRAINT IF EXISTS "push_subscription_user_id_fkey";
ALTER TABLE "push_subscription"
  ADD CONSTRAINT "push_subscription_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
