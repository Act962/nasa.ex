"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Sparkles, Globe, Target, Mic2, Palette, Bot, BarChart2, Loader2, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

export type BrandEntity = "org" | "project";

const BrandSchema = z.object({
  slogan:         z.string().nullable().optional(),
  website:        z.string().nullable().optional(),
  icp:            z.string().nullable().optional(),
  positioning:    z.string().nullable().optional(),
  voiceTone:      z.string().nullable().optional(),
  aiInstructions: z.string().nullable().optional(),
  swotStrengths:     z.string().optional(),
  swotWeaknesses:    z.string().optional(),
  swotOpportunities: z.string().optional(),
  swotThreats:       z.string().optional(),
});

type BrandForm = z.infer<typeof BrandSchema>;

interface Props {
  entity: BrandEntity;
  projectId?: string;
}

// ── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, children, className,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4 space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-violet-500" />
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function BrandTab({ entity, projectId }: Props) {
  const qc = useQueryClient();
  const [astroSource, setAstroSource] = useState("");
  const [astroOpen, setAstroOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ── Queries ──

  const orgBrandQuery = useQuery({
    ...orpc.orgs.getBrand.queryOptions(),
    enabled: entity === "org",
  });

  const projectQuery = useQuery({
    ...orpc.orgProjects.get.queryOptions({ input: { projectId: projectId! } }),
    enabled: entity === "project" && !!projectId,
  });

  const isLoading = entity === "org" ? orgBrandQuery.isLoading : projectQuery.isLoading;

  const rawBrand = entity === "org"
    ? orgBrandQuery.data?.brand
    : (projectQuery.data?.project as any);

  // ── Form ──

  const form = useForm<BrandForm>({
    resolver: zodResolver(BrandSchema),
    values: rawBrand ? {
      slogan:         (rawBrand.brandSlogan ?? rawBrand.slogan) ?? "",
      website:        (rawBrand.brandWebsite ?? rawBrand.website) ?? "",
      icp:            (rawBrand.brandIcp ?? rawBrand.icp) ?? "",
      positioning:    (rawBrand.brandPositioning ?? rawBrand.positioning) ?? "",
      voiceTone:      (rawBrand.brandVoiceTone ?? rawBrand.voiceTone) ?? "",
      aiInstructions: (rawBrand.brandAiInstructions ?? rawBrand.aiInstructions) ?? "",
      swotStrengths:     (rawBrand.brandSwot ?? rawBrand.swot)?.strengths ?? "",
      swotWeaknesses:    (rawBrand.brandSwot ?? rawBrand.swot)?.weaknesses ?? "",
      swotOpportunities: (rawBrand.brandSwot ?? rawBrand.swot)?.opportunities ?? "",
      swotThreats:       (rawBrand.brandSwot ?? rawBrand.swot)?.threats ?? "",
    } : undefined,
  });

  // ── Mutations ──

  const updateOrgBrand = useMutation(
    orpc.orgs.updateBrand.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.orgs.getBrand.key() });
        toast.success("Marca atualizada!");
      },
      onError: () => toast.error("Erro ao salvar"),
    }),
  );

  const updateProjectBrand = useMutation(
    orpc.orgProjects.updateBrand.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.orgProjects.get.key() });
        toast.success("Marca do projeto atualizada!");
      },
      onError: () => toast.error("Erro ao salvar"),
    }),
  );

  const isSaving = updateOrgBrand.isPending || updateProjectBrand.isPending;

  function onSubmit(data: BrandForm) {
    const swot = {
      strengths:     data.swotStrengths,
      weaknesses:    data.swotWeaknesses,
      opportunities: data.swotOpportunities,
      threats:       data.swotThreats,
    };

    if (entity === "org") {
      updateOrgBrand.mutate({
        brandSlogan:         data.slogan,
        brandWebsite:        data.website,
        brandIcp:            data.icp,
        brandPositioning:    data.positioning,
        brandVoiceTone:      data.voiceTone,
        brandAiInstructions: data.aiInstructions,
        brandSwot:           swot,
      });
    } else if (projectId) {
      updateProjectBrand.mutate({
        projectId,
        slogan:         data.slogan,
        website:        data.website,
        icp:            data.icp,
        positioning:    data.positioning,
        voiceTone:      data.voiceTone,
        aiInstructions: data.aiInstructions,
        swot,
      });
    }
  }

  // ── Gerar com Astro ──

  async function handleGenerateWithAstro() {
    if (!astroSource.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/extract-brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: astroSource }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const b = json.brand;
      form.setValue("slogan",         b.slogan ?? "");
      form.setValue("website",        b.website ?? "");
      form.setValue("icp",            b.icp ?? "");
      form.setValue("positioning",    b.positioning ?? "");
      form.setValue("voiceTone",      b.voiceTone ?? "");
      form.setValue("aiInstructions", b.aiInstructions ?? "");
      form.setValue("swotStrengths",     b.swot?.strengths ?? "");
      form.setValue("swotWeaknesses",    b.swot?.weaknesses ?? "");
      form.setValue("swotOpportunities", b.swot?.opportunities ?? "");
      form.setValue("swotThreats",       b.swot?.threats ?? "");
      toast.success("Marca gerada com Astro! Revise e salve.");
      setAstroOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar com Astro");
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
      {/* ── Gerar com Astro ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-violet-700 dark:text-violet-400"
          onClick={() => setAstroOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Gerar com Astro
            <span className="text-xs font-normal text-violet-500">
              — extraia a identidade da marca automaticamente
            </span>
          </span>
          <ChevronDown className={cn("size-4 transition-transform", astroOpen && "rotate-180")} />
        </button>

        {astroOpen && (
          <div className="px-4 pb-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Informe o Instagram (ex: @nomemarca) ou URL do site. O Astro vai analisar o perfil, posts e público para preencher os campos de marca automaticamente.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="@instagram ou https://site.com.br"
                value={astroSource}
                onChange={(e) => setAstroSource(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleGenerateWithAstro}
                disabled={generating || !astroSource.trim()}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {generating ? (
                  <><Loader2 className="size-4 animate-spin" /> Analisando...</>
                ) : (
                  <><Sparkles className="size-4" /> Gerar</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Fields ────────────────────────────────────────────────────────── */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section icon={Sparkles} title="Slogan">
          <Input
            placeholder="Ex.: Transforme cada conversa em venda"
            {...form.register("slogan")}
          />
        </Section>

        <Section icon={Globe} title="Website">
          <Input
            placeholder="https://suamarca.com.br"
            {...form.register("website")}
          />
        </Section>
      </div>

      <Section icon={Target} title="ICP & Posicionamento">
        <Textarea
          placeholder="Descreva o perfil de cliente ideal (ICP): quem é, quais dores tem, o que deseja..."
          rows={3}
          {...form.register("icp")}
        />
        <Textarea
          placeholder="Posicionamento: como sua marca se diferencia no mercado, proposta de valor..."
          rows={3}
          {...form.register("positioning")}
        />
      </Section>

      <Section icon={Mic2} title="Voz & Tom">
        <Textarea
          placeholder="Ex.: Comunicação próxima e descomplicada, sem jargão técnico, com foco em resultado prático..."
          rows={3}
          {...form.register("voiceTone")}
        />
      </Section>

      <Section icon={Palette} title="Visual">
        <p className="text-xs text-muted-foreground">
          As cores e fontes são gerenciadas nos ativos de marca dentro do Planner de Campanhas.
        </p>
      </Section>

      <Section icon={Bot} title="Inteligência Artificial">
        <Textarea
          placeholder="Instruções para a IA gerar conteúdo: tom desejado, CTAs preferidos, palavras a evitar, restrições..."
          rows={4}
          {...form.register("aiInstructions")}
        />
      </Section>

      <Section icon={BarChart2} title="Análise SWOT">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { field: "swotStrengths"     as const, label: "Forças (Strengths)",          placeholder: "Vantagens competitivas, pontos fortes da marca..." },
            { field: "swotWeaknesses"    as const, label: "Fraquezas (Weaknesses)",       placeholder: "Pontos a melhorar, limitações internas..." },
            { field: "swotOpportunities" as const, label: "Oportunidades (Opportunities)", placeholder: "Tendências de mercado, nichos a explorar..." },
            { field: "swotThreats"       as const, label: "Ameaças (Threats)",            placeholder: "Concorrentes, riscos externos..." },
          ].map(({ field, label, placeholder }) => (
            <div key={field} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <Textarea
                placeholder={placeholder}
                rows={3}
                {...form.register(field)}
                className="text-xs"
              />
            </div>
          ))}
        </div>
      </Section>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSaving} className="gap-2">
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Salvar Marca
        </Button>
      </div>
    </form>
  );
}
