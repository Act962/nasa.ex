-- CreateEnum
CREATE TYPE "TypeAction" AS ENUM ('TASK', 'ACTION', 'MEETING', 'NOTE');

-- CreateTable
CREATE TABLE "actions_user_participants" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "actions_user_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions_user_responsibles" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "actions_user_responsibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "type" "TypeAction" NOT NULL DEFAULT 'TASK',
    "created_by" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_actions_user_responsible" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sub_action_id" TEXT NOT NULL,

    CONSTRAINT "sub_actions_user_responsible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_action" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "finish_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action_id" TEXT NOT NULL,

    CONSTRAINT "sub_action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "actions_user_participants_action_id_user_id_key" ON "actions_user_participants"("action_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "actions_user_responsibles_action_id_user_id_key" ON "actions_user_responsibles"("action_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sub_actions_user_responsible_user_id_sub_action_id_key" ON "sub_actions_user_responsible"("user_id", "sub_action_id");

-- AddForeignKey
ALTER TABLE "actions_user_participants" ADD CONSTRAINT "actions_user_participants_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions_user_participants" ADD CONSTRAINT "actions_user_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions_user_responsibles" ADD CONSTRAINT "actions_user_responsibles_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions_user_responsibles" ADD CONSTRAINT "actions_user_responsibles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_actions_user_responsible" ADD CONSTRAINT "sub_actions_user_responsible_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_actions_user_responsible" ADD CONSTRAINT "sub_actions_user_responsible_sub_action_id_fkey" FOREIGN KEY ("sub_action_id") REFERENCES "sub_action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_action" ADD CONSTRAINT "sub_action_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
