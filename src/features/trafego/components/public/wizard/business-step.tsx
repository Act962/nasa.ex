"use client";

import { BUSINESS_SEGMENTS } from "@/features/trafego/lib/segments";
import {
  SPECIAL_AD_CATEGORIES,
  type AudienceChip,
  type SpecialAdCategory,
} from "@/features/trafego/lib/audience";
import { AudienceChips } from "./audience-chips";
import { Field, fieldClass } from "./field";
import { SelectField } from "./select-field";
import { TechnicalTerm } from "../../technical-term";

export interface BusinessDraft {
  businessName: string;
  segment: string;
  destinationUrl: string;
  audienceChips: AudienceChip[];
  audienceNotes: string;
  specialCategory: SpecialAdCategory;
}

/**
 * 04 — o que a equipe precisa para montar a segmentação. O público vem em chips
 * (viram segmentação de verdade) e o prazo é perguntado aqui, antes do
 * pagamento: é o mal-entendido mais caro de desfazer depois.
 */
export function BusinessStep({
  value,
  onChange,
}: {
  value: BusinessDraft;
  onChange: (value: BusinessDraft) => void;
}) {
  const patch = (partial: Partial<BusinessDraft>) =>
    onChange({ ...value, ...partial });
  const isSpecial = value.specialCategory !== "none";

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Nome do negócio" required>
        <input
          value={value.businessName}
          onChange={(event) => patch({ businessName: event.target.value })}
          placeholder="Padaria do Zé"
          className={fieldClass}
        />
      </Field>

      <Field label="Segmento" required>
        <SelectField
          value={value.segment}
          onChange={(segment) => patch({ segment })}
          options={BUSINESS_SEGMENTS.map((segment) => ({
            value: segment,
            label: segment,
          }))}
        />
      </Field>

      <Field
        label={
          <>
            Site ou link de destino
            <TechnicalTerm term="destinationLink" className="text-white/50" />
          </>
        }
        wide
        hint="Para onde o cliente vai ao clicar no anúncio. Sem site? Deixe vazio: direcionamos para o WhatsApp."
      >
        <input
          value={value.destinationUrl}
          onChange={(event) => patch({ destinationUrl: event.target.value })}
          placeholder="www.padariadoze.com"
          className={fieldClass}
        />
      </Field>

      <Field
        label={
          <>
            Quem você quer alcançar? (público)
            <TechnicalTerm term="audience" className="text-white/50" />
          </>
        }
        wide
      >
        <AudienceChips
          chips={value.audienceChips}
          onChange={(audienceChips) => patch({ audienceChips })}
          specialCategory={value.specialCategory}
        />
        <input
          value={value.audienceNotes}
          onChange={(event) => patch({ audienceNotes: event.target.value })}
          placeholder="Outros detalhes do público (opcional)"
          className={`${fieldClass} mt-2.5`}
        />
      </Field>

      <Field
        label="Seu anúncio é sobre imóveis, emprego, crédito ou temas sociais?"
        required
        wide
        hint={
          isSpecial
            ? "Categoria especial: Meta e Google proíbem segmentar por gênero e idade nesses temas. Removemos essas opções do público."
            : undefined
        }
      >
        <SelectField
          value={value.specialCategory}
          onChange={(selected) => {
            const specialCategory = selected as SpecialAdCategory;
            // Categoria especial derruba gênero e idade — tira os chips agora
            // para o cliente não achar que a segmentação dele ficou valendo.
            patch({
              specialCategory,
              audienceChips:
                specialCategory === "none"
                  ? value.audienceChips
                  : value.audienceChips.filter(
                      (chip) =>
                        chip.dimension !== "gender" && chip.dimension !== "age",
                    ),
            });
          }}
          options={SPECIAL_AD_CATEGORIES.map((category) => ({
            value: category.id,
            label: category.label,
          }))}
        />
      </Field>
    </div>
  );
}
