-- Migration: send-email node type + cart-recovery cron support
--
-- 1. NodeType.SEND_EMAIL — pro executor agent-mode novo (Resend + React Email)
-- 2. PendingCoursePurchaseStatus.ABANDONED — cron marca após 30+ dias sem pagar
-- 3. PendingCoursePurchase.last_reminder_sent_at + last_reminder_stage — pro
--    cron de recuperação decidir qual estágio mandar e não duplicar emails

-- Postgres não permite ALTER TYPE ... ADD VALUE dentro de transação se o
-- valor for usado no mesmo statement; aplicamos antes das colunas.
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'SEND_EMAIL';
ALTER TYPE "PendingCoursePurchaseStatus" ADD VALUE IF NOT EXISTS 'ABANDONED';

ALTER TABLE "pending_course_purchase"
  ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_reminder_stage" TEXT;
