import {
  LegalPage as BaseLegalPage,
  type LegalSection,
} from "@/features/legal/components/legal-page";

/** Shell compartilhado por Termos e Política — mesma leitura, mesmo respiro. */
export function LegalPage({
  title,
  updatedAt,
  intro,
  sections,
}: {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <BaseLegalPage
      title={title}
      updatedAt={updatedAt}
      intro={intro}
      sections={sections}
      backHref="/trafego"
      backLabel="Voltar para o trafeGO"
      footer="Dúvidas sobre este documento? Fale com a gente pelo painel ou pelo WhatsApp de atendimento."
    />
  );
}
