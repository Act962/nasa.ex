-- Automations: 7 novos NodeTypes da categoria "Adicionar Lead no App"
--
-- Sprint Automações — actions que criam/preparam recursos em outros
-- apps NASA (Form, Agenda, Forge, Linnker, N-Box, NASA Route) e enviam
-- link via WhatsApp pro lead.
--
-- Aplicada via `prisma db execute` + `migrate resolve --applied` pra
-- contornar drift conhecido no projeto (mesmo padrão das migrations
-- `lead_archive_fields` e `in_chat_manual_toggle`).
--
-- Idempotente: `ALTER TYPE ... ADD VALUE IF NOT EXISTS` é seguro pra
-- rodar 2x. Postgres aceita sem downtime.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SEND_FORM' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NodeType')) THEN
    ALTER TYPE "NodeType" ADD VALUE 'SEND_FORM';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SEND_AGENDA' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NodeType')) THEN
    ALTER TYPE "NodeType" ADD VALUE 'SEND_AGENDA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SEND_PROPOSAL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NodeType')) THEN
    ALTER TYPE "NodeType" ADD VALUE 'SEND_PROPOSAL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SEND_CONTRACT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NodeType')) THEN
    ALTER TYPE "NodeType" ADD VALUE 'SEND_CONTRACT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SEND_LINNKER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NodeType')) THEN
    ALTER TYPE "NodeType" ADD VALUE 'SEND_LINNKER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SEND_NBOX' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NodeType')) THEN
    ALTER TYPE "NodeType" ADD VALUE 'SEND_NBOX';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SEND_NASA_ROUTE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NodeType')) THEN
    ALTER TYPE "NodeType" ADD VALUE 'SEND_NASA_ROUTE';
  END IF;
END$$;
