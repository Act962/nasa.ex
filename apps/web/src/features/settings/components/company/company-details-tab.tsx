"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOrgRole } from "@/hooks/use-org-role";
import { orpc } from "@/lib/orpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  companyNiche: z.string().min(1, "Nicho é obrigatório"),
  companyCep: z
    .string()
    .min(1, "CEP é obrigatório")
    .regex(/^\d{5}-\d{3}$/, "CEP inválido (formato: 00000-000)"),
  brandIcp: z.string().optional(),
  swotStrengths: z.string().optional(),
  swotWeaknesses: z.string().optional(),
  swotOpportunities: z.string().optional(),
  swotThreats: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  orgId: string;
  companyNiche: string;
  companyCep: string;
  brandIcp: string;
  brandSwot: Record<string, string>;
}

export function CompanyDetailsTab({
  orgId: _orgId,
  companyNiche,
  companyCep,
  brandIcp,
  brandSwot,
}: Props) {
  const { isSingle } = useOrgRole();
  const canEdit = !isSingle;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyNiche,
      companyCep,
      brandIcp: brandIcp ?? "",
      swotStrengths: brandSwot?.strengths ?? "",
      swotWeaknesses: brandSwot?.weaknesses ?? "",
      swotOpportunities: brandSwot?.opportunities ?? "",
      swotThreats: brandSwot?.threats ?? "",
    },
  });

  const mutation = useMutation(
    orpc.orgs.updateCompanyDetails.mutationOptions({
      onSuccess: () => toast.success("Dados da empresa atualizados!"),
      onError: () => toast.error("Erro ao salvar. Tente novamente."),
    }),
  );

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
    setValue("companyCep", formatted, { shouldValidate: true });
  };

  const onSubmit = (data: FormData) => {
    mutation.mutate({
      companyNiche: data.companyNiche,
      companyCep: data.companyCep,
      brandIcp: data.brandIcp,
      brandSwot: {
        strengths: data.swotStrengths,
        weaknesses: data.swotWeaknesses,
        opportunities: data.swotOpportunities,
        threats: data.swotThreats,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldSet>
        <FieldGroup>
          {/* Nicho & CEP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="companyNiche">Nicho da empresa</FieldLabel>
              <Input
                id="companyNiche"
                placeholder="Ex: Agência de Marketing"
                {...register("companyNiche")}
                disabled={!canEdit || mutation.isPending}
              />
              {errors.companyNiche && (
                <FieldError>{errors.companyNiche.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="companyCep">CEP</FieldLabel>
              <Input
                id="companyCep"
                placeholder="00000-000"
                value={watch("companyCep") ?? ""}
                onChange={handleCepChange}
                disabled={!canEdit || mutation.isPending}
                maxLength={9}
              />
              {errors.companyCep && (
                <FieldError>{errors.companyCep.message}</FieldError>
              )}
            </Field>
          </div>

          {/* ICP */}
          <Field>
            <FieldLabel htmlFor="brandIcp">ICP — Perfil de cliente ideal</FieldLabel>
            <Textarea
              id="brandIcp"
              placeholder="Descreva o perfil do cliente ideal da empresa…"
              rows={4}
              {...register("brandIcp")}
              disabled={!canEdit || mutation.isPending}
            />
          </Field>

          {/* SWOT */}
          <div>
            <p className="text-sm font-medium mb-3">Análise SWOT</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="swotStrengths">Forças</FieldLabel>
                <Textarea
                  id="swotStrengths"
                  placeholder="Pontos fortes da empresa…"
                  rows={3}
                  {...register("swotStrengths")}
                  disabled={!canEdit || mutation.isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="swotWeaknesses">Fraquezas</FieldLabel>
                <Textarea
                  id="swotWeaknesses"
                  placeholder="Pontos fracos da empresa…"
                  rows={3}
                  {...register("swotWeaknesses")}
                  disabled={!canEdit || mutation.isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="swotOpportunities">Oportunidades</FieldLabel>
                <Textarea
                  id="swotOpportunities"
                  placeholder="Oportunidades de mercado…"
                  rows={3}
                  {...register("swotOpportunities")}
                  disabled={!canEdit || mutation.isPending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="swotThreats">Ameaças</FieldLabel>
                <Textarea
                  id="swotThreats"
                  placeholder="Ameaças e riscos externos…"
                  rows={3}
                  {...register("swotThreats")}
                  disabled={!canEdit || mutation.isPending}
                />
              </Field>
            </div>
          </div>
        </FieldGroup>

        {canEdit && (
          <Field className="w-fit self-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </Field>
        )}
      </FieldSet>
    </form>
  );
}
