"use client";

import { useEffect } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { Check, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { usePlannerClients } from "../../hooks/use-planner-calendar";
import { usePlannerBrandKit, usePlannerBrandKits } from "../../hooks/use-planner-brand-kit";
import { BRAND_LOGO_LABEL } from "../../lib/brand-kit-completeness";
import { BrandKitHeader, BrandKitList } from "./brand-kit-switcher";
import { BrandKitLogos } from "./brand-kit-logos";
import { BrandKitIdentityFields, BrandKitPalette, BrandKitTypography, BrandKitVocabulary, BrandKitWebsite } from "./brand-kit-identity";
import { BrandKitAssetList } from "./brand-kit-asset-list";
import type { PlannerBrandKit } from "./brand-kit-types";

/** Kit da Marca por cliente (spec 0063), aba do Planner: tudo que a IA precisa para criar no tom, nas cores e com os materiais da marca. */

type SectionStatus = { pendingLabel: string | null } | "optional";

function Section({ title, hint, status, className, children }: { title: string; hint: string; status: SectionStatus; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-[20px] bg-panel p-4", className)}>
      <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {title}
        {status === "optional" ? (
          <span className="ml-auto rounded-full bg-knob px-2 py-px text-[10.5px] font-semibold text-muted-foreground">opcional</span>
        ) : status.pendingLabel ? (
          <span className="ml-auto rounded-full bg-warning/10 px-2 py-px text-[10.5px] font-semibold text-warning">{status.pendingLabel}</span>
        ) : (
          <CheckCircle2 className="ml-auto size-4 text-success" aria-label="Completo" />
        )}
      </h4>
      <p className="mt-0.5 mb-3 text-xs text-muted-foreground">{hint}</p>
      {children}
    </section>
  );
}

function StepGroup({ id, title, hint, children }: { id: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <header className="mx-1 mb-2.5 flex flex-wrap items-baseline gap-x-2.5">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </header>
      {children}
    </section>
  );
}

const joinWithAnd = (labels: string[]) => (labels.length <= 1 ? labels.join("") : `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`);

/** O que falta em cada cartão; espelha os 9 itens de `computeBrandKitCompleteness`. */
function describePending(brandKit: PlannerBrandKit) {
  const countAssets = (kind: PlannerBrandKit["assets"][number]["kind"]) => brandKit.assets.filter((asset) => asset.kind === kind).length;
  const isMonochromeLogoMissing = !brandKit.logos.black || !brandKit.logos.white;
  const missingLogoLabels = (["color", "black", "white"] as const).filter((variant) => !brandKit.logos[variant]).map((variant) => BRAND_LOGO_LABEL[variant]);
  const hasVoiceTone = Boolean(brandKit.voiceTone?.trim());
  const hasAudience = Boolean(brandKit.audience?.trim() || brandKit.positioning?.trim());
  const missingVoiceLabels = [!hasVoiceTone && "tom de voz", !hasAudience && "público"].filter((label): label is string => Boolean(label));
  const hasProducts = countAssets("PRODUCT") > 0;
  const hasSiteOrMaterial = Boolean(brandKit.website?.trim()) || countAssets("MATERIAL") > 0;
  const hasReferencePosts = countAssets("REFERENCE_POST") > 0;

  return {
    sections: {
      logos: missingLogoLabels.length > 0 ? `falta ${joinWithAnd(missingLogoLabels)}` : null,
      palette: brandKit.palette.length >= 2 ? null : "mínimo 2",
      typography: brandKit.fontHeading ? null : "falta a de títulos",
      voice: missingVoiceLabels.length > 0 ? `falta ${joinWithAnd(missingVoiceLabels)}` : null,
      products: hasProducts ? null : "falta 1",
      materials: hasSiteOrMaterial ? null : "falta site ou material",
      referencePosts: hasReferencePosts ? null : "falta 1",
    },
    steps: [
      { id: "kit-identidade-visual", title: "Identidade visual", checks: [Boolean(brandKit.logos.color), !isMonochromeLogoMissing, brandKit.palette.length >= 2, Boolean(brandKit.fontHeading)] },
      { id: "kit-voz-e-mensagem", title: "Voz e mensagem", checks: [hasVoiceTone, hasAudience] },
      { id: "kit-materiais", title: "Materiais", checks: [hasProducts, hasSiteOrMaterial, hasReferencePosts] },
    ],
  };
}

type KitStep = ReturnType<typeof describePending>["steps"][number];

function CompletenessSummary({ completeness, steps }: { completeness: PlannerBrandKit["completeness"]; steps: KitStep[] }) {
  const percent = Math.round((completeness.completedCount / completeness.totalCount) * 100);
  const nextStep = steps.find((step) => step.checks.some((isDone) => !isDone));
  return (
    <div data-guide={GUIDE_ANCHORS.plannerBrandKitMeter.id} className="mt-4 space-y-3">
      <div className={cn("flex items-center gap-4 rounded-2xl px-4 py-3", completeness.isComplete ? "bg-success/10" : "bg-warning/10")}>
        <div
          className="grid size-13 flex-none place-items-center rounded-full"
          style={{ background: `conic-gradient(var(--color-${completeness.isComplete ? "success" : "warning"}) ${percent}%, var(--color-knob) 0)` }}
        >
          <span className="grid size-10.5 place-items-center rounded-full bg-panel text-xs font-bold">
            {completeness.completedCount}/{completeness.totalCount}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{completeness.isComplete ? "Kit completo" : "O Astro ainda não consegue criar com esta marca"}</p>
          <p className="text-xs text-muted-foreground">
            {completeness.isComplete
              ? "O Astro já pode criar conteúdo com a marca."
              : `Faltam ${completeness.totalCount - completeness.completedCount} de ${completeness.totalCount} itens${nextStep ? `. Continue por "${nextStep.title}"` : ""}.`}
          </p>
        </div>
      </div>
      <nav aria-label="Etapas do kit" className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, stepIndex) => {
          const pendingCount = step.checks.filter((isDone) => !isDone).length;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => document.getElementById(step.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex items-center gap-2.5 rounded-2xl bg-card px-3 py-2.5 text-left transition hover:bg-knob"
            >
              <span className={cn("grid size-6 flex-none place-items-center rounded-full text-xs font-bold", pendingCount === 0 ? "bg-success text-background" : "bg-knob")}>
                {pendingCount === 0 ? <Check className="size-3.5" /> : stepIndex + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{step.title}</span>
                <span className={cn("block text-[11.5px]", pendingCount === 0 ? "text-success" : "text-warning")}>
                  {pendingCount === 0 ? "completa" : `${pendingCount === 1 ? "falta" : "faltam"} ${pendingCount} de ${step.checks.length}`}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function BrandKitPage({ organizationId }: { organizationId: string | null }) {
  const { clients, isLoading: isLoadingClients } = usePlannerClients();
  const client = clients.find((candidate) => candidate.id === organizationId);
  const [requestedKitId, setRequestedKitId] = useQueryState("kit", parseAsString);
  const { kits, isLoading: isLoadingKits } = usePlannerBrandKits(organizationId);
  // Kit da URL que não é deste cliente (apagado, ou de outra empresa) cai no padrão (spec 0070, CB-10).
  const selectedKitId = kits.some((kit) => kit.brandKitId === requestedKitId) ? requestedKitId : null;
  const isRequestedKitMissing = !isLoadingKits && kits.length > 0 && requestedKitId !== null && selectedKitId === null;
  useEffect(() => {
    if (isRequestedKitMissing) void setRequestedKitId(null);
  }, [isRequestedKitMissing, setRequestedKitId]);
  const { brandKit, isLoading } = usePlannerBrandKit(isLoadingKits ? null : organizationId, { brandKitId: selectedKitId });
  const canEdit = Boolean(client?.permissions.canCreate);
  const assetsOf = (kind: PlannerBrandKit["assets"][number]["kind"]) => brandKit?.assets.filter((asset) => asset.kind === kind) ?? [];
  const isReady = !isLoadingClients && !isLoadingKits && !isLoading && Boolean(brandKit);
  const pending = brandKit ? describePending(brandKit) : null;

  return (
    <div data-guide={GUIDE_ANCHORS.plannerBrandKitPage.id} className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[264px_minmax(0,1fr)]">
      {organizationId && (
        <BrandKitList
          organizationId={organizationId}
          organizationName={client?.name ?? null}
          selectedKitId={selectedKitId}
          canEdit={canEdit}
          onSelectKit={(brandKitId) => void setRequestedKitId(brandKitId)}
        />
      )}

      {!isReady || !brandKit || !pending ? (
        <OrbitaSpinner className="size-5" />
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          <BrandKitHeader organizationId={brandKit.organization.id} selectedKitId={selectedKitId} canEdit={canEdit} onDeleted={() => void setRequestedKitId(null)}>
            <CompletenessSummary completeness={brandKit.completeness} steps={pending.steps} />
            {!canEdit && <p className="mt-3 text-xs text-muted-foreground">Você pode ver o kit deste cliente, mas seu papel não permite editar.</p>}
          </BrandKitHeader>

          <div key={`${brandKit.organization.id}:${brandKit.brandKitId ?? "padrao"}`} className="flex flex-col gap-6">
            <StepGroup id={pending.steps[0].id} title="1 · Identidade visual" hint="Como a marca aparece nas artes.">
              <div className="grid gap-3 xl:grid-cols-[2fr_1fr_1fr]">
                <Section title="Logos" hint="PNG com fundo transparente. Cada versão aparece no fundo em que vai ser usada." status={{ pendingLabel: pending.sections.logos }}>
                  <BrandKitLogos organizationId={brandKit.organization.id} brandKitId={brandKit.brandKitId} logos={brandKit.logos} canEdit={canEdit} />
                </Section>
                <Section title="Cores" hint="As cores da marca usadas nas artes." status={{ pendingLabel: pending.sections.palette }}>
                  <BrandKitPalette brandKit={brandKit} canEdit={canEdit} />
                </Section>
                <Section title="Tipografia" hint="Nome da fonte como está no Google Fonts." status={{ pendingLabel: pending.sections.typography }}>
                  <BrandKitTypography brandKit={brandKit} canEdit={canEdit} />
                </Section>
              </div>
            </StepGroup>

            <StepGroup id={pending.steps[1].id} title="2 · Voz e mensagem" hint="Como a marca fala. É o que o Astro lê antes de escrever.">
              <div className="grid gap-3 md:grid-cols-2">
                <Section title="Quem é a marca" hint="Escreva como explicaria para um redator novo." status={{ pendingLabel: pending.sections.voice }}>
                  <BrandKitIdentityFields brandKit={brandKit} canEdit={canEdit} />
                </Section>
                <Section title="Palavras e fechamentos" hint="Digite e aperte Enter para adicionar cada item." status="optional">
                  <BrandKitVocabulary brandKit={brandKit} canEdit={canEdit} />
                </Section>
              </div>
            </StepGroup>

            <StepGroup id={pending.steps[2].id} title="3 · Materiais" hint="O que a marca vende e exemplos do que já funcionou.">
              <div className="grid gap-3 md:grid-cols-2">
                <Section title="Produtos e serviços" hint="Nome, descrição e preço do que a marca vende." status={{ pendingLabel: pending.sections.products }}>
                  <BrandKitAssetList organizationId={brandKit.organization.id} brandKitId={brandKit.brandKitId} kind="PRODUCT" assets={assetsOf("PRODUCT")} canEdit={canEdit} />
                </Section>
                <Section title="Site e materiais" hint="O endereço do site ou um release, catálogo ou apresentação." status={{ pendingLabel: pending.sections.materials }}>
                  <div className="space-y-3">
                    <BrandKitWebsite brandKit={brandKit} canEdit={canEdit} />
                    <BrandKitAssetList organizationId={brandKit.organization.id} brandKitId={brandKit.brandKitId} kind="MATERIAL" assets={assetsOf("MATERIAL")} canEdit={canEdit} />
                  </div>
                </Section>
                <Section title="Posts de referência" hint="Posts que deram certo e servem de modelo." status={{ pendingLabel: pending.sections.referencePosts }}>
                  <BrandKitAssetList organizationId={brandKit.organization.id} brandKitId={brandKit.brandKitId} kind="REFERENCE_POST" assets={assetsOf("REFERENCE_POST")} canEdit={canEdit} />
                </Section>
                <Section title="Fundos e texturas" hint="Imagens de fundo para as artes." status="optional">
                  <BrandKitAssetList organizationId={brandKit.organization.id} brandKitId={brandKit.brandKitId} kind="BACKGROUND" assets={assetsOf("BACKGROUND")} canEdit={canEdit} />
                </Section>
              </div>
            </StepGroup>
          </div>
        </div>
      )}
    </div>
  );
}
