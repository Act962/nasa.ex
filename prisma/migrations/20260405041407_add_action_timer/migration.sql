-- CreateTable
CREATE TABLE "action_timers" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stopped_at" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "action_timers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_timers_action_id_idx" ON "action_timers"("action_id");

-- CreateIndex
CREATE INDEX "action_timers_user_id_idx" ON "action_timers"("user_id");

-- CreateIndex
CREATE INDEX "action_timers_stopped_at_idx" ON "action_timers"("stopped_at");

-- AddForeignKey
ALTER TABLE "action_timers" ADD CONSTRAINT "action_timers_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_timers" ADD CONSTRAINT "action_timers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
