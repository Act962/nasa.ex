-- Nova ação OPEN_FORM no enum NodeType. Cria FormResponses vinculada ao
-- lead sem enviar link via WhatsApp — operador preenche localmente
-- (botão Preencher no LeadFormResponses ou clicando no ClipboardList do
-- card do lead). Idempotente (IF NOT EXISTS).
DO $$ BEGIN
  ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'OPEN_FORM';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
