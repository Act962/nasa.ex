-- Adiciona título customizado por resposta de formulário.
-- `label` aparece como sufixo no nome (ex: "Checklist · #00123").
-- `label_manually_edited=true` impede que próximos saves sobrescrevam.
ALTER TABLE "form_responses" ADD COLUMN "label" TEXT;
ALTER TABLE "form_responses" ADD COLUMN "label_manually_edited" BOOLEAN NOT NULL DEFAULT false;
