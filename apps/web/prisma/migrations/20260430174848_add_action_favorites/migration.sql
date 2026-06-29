-- CreateTable
CREATE TABLE "action_favorites" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_favorites_user_id_idx" ON "action_favorites"("user_id");

-- CreateIndex
CREATE INDEX "action_favorites_action_id_idx" ON "action_favorites"("action_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_favorites_action_id_user_id_key" ON "action_favorites"("action_id", "user_id");

-- AddForeignKey
ALTER TABLE "action_favorites" ADD CONSTRAINT "action_favorites_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_favorites" ADD CONSTRAINT "action_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
