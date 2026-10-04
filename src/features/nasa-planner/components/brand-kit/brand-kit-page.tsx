"use client";

import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { ArrowLeft, CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { usePlannerClients } from "../../hooks/use-planner-calendar";
import { usePlannerBrandKit } from "../../hooks/use-planner-brand-kit";
import { ClientAvatar } from "../v2/client-avatar";
import { BrandKitLogos } from "./brand-kit-logos";
import { BrandKitPalette, BrandKitTypography, BrandKitVoice, BrandKitWebsite } from "./brand-kit-identity";
import { BrandKitAssetList } from "./brand-kit-asset-list";
import type { PlannerBrandKit } from "./brand-kit-types";

/** Kit da Marca por cliente (spec 0063): tudo que a IA precisa para criar no tom, nas cores e com os materiais da marca. */

function Section({ title, isDone, className, children }: { title: string; isDone?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-[20px] bg-panel p-4", className)}>
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        {title}
        {isDone !== undefined &&
          (isDone ? <CheckCircle2 className="size-3.5 text-success" /> : <CircleAlert className="size-3.5 text-warning" />)}
      </h3>
      {children}
    </section>
  );
}

function CompletenessMeter({ completeness }: { completeness: PlannerBrandKit["completeness"] }) {
  const percent = Math.round((completeness.completedCount / completeness.totalCount) * 100);
  return (
    <div data-guide={GUIDE_ANCHORS.plannerBrandKitMeter.id} className={cn("flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3", completeness.isComplete ? "bg-success/10" : "bg-warning/10")}>
      <p className="text-sm font-semibold">
        {completeness.isComplete ? "Kit completo" : `${completeness.completedCount} de ${completeness.totalCount} completos`}
      </p>
      <div className="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-foreground/10">
        <div className={cn("h-full rounded-full", completeness.isComplete ? "bg-success" : "bg-warning")} style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {completeness.isComplete ? "O Astro já pode criar conteúdo com a marca." : `Falta: ${completeness.missing.join(" · ")}`}
      </p>
    </div>
  );
}

export function BrandKitPage() {
  const { clients, isLoading: isLoadingClients } = usePlannerClients();
  const [selectedOrganizationId, setSelectedOrganizationId] = useQueryState("org", parseAsString);
  const organizationId = selectedOrganizationId ?? clients[0]?.id ?? null;
  const client = clients.find((candidate) => candidate.id === organizationId);
  const { brandKit, isLoading } = usePlannerBrandKit(organizationId);
  const canEdit = Boolean(client?.permissions.canCreate);
  const assetsOf = (kind: PlannerBrandKit["assets"][number]["kind"]) => brandKit?.assets.filter((asset) => asset.kind === kind) ?? [];
  const missing = new Set(brandKit?.completeness.missing ?? []);
  const isMissing = (label: string) => [...missing].some((missingLabel) => missingLabel.startsWith(label));

  return (
    <div data-guide={GUIDE_ANCHORS.plannerBrandKitPage.id} className="mx-auto flex max-w-6xl flex-col gap-4 p-3 md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/nasa-planner" className="grid size-9 place-items-center rounded-full bg-panel" aria-label="Voltar ao calendário">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="flex-1 text-xl font-bold">Kit da Marca</h1>
        <div className="flex flex-wrap gap-2">
          {clients.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => void setSelectedOrganizationId(candidate.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", candidate.id === organizationId ? "bg-foreground font-semibold text-background" : "bg-panel")}
            >
              <ClientAvatar name={candidate.name} logo={candidate.logo} clientIndex={clients.indexOf(candidate)} className="size-4 text-[7px] ring-1" />
              {candidate.name}
            </button>
          ))}
        </div>
      </div>

      {isLoadingClients || isLoading || !brandKit ? (
        <OrbitaSpinner className="size-5" />
      ) : (
        <>
          <CompletenessMeter completeness={brandKit.completeness} />
          {!canEdit && <p className="text-sm text-muted-foreground">Você pode ver o kit deste cliente, mas seu papel não permite editar.</p>}
          <div key={brandKit.organization.id} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Section title="Logos" isDone={!isMissing("logo")} className="md:col-span-2">
              <BrandKitLogos organizationId={brandKit.organization.id} logos={brandKit.logos} canEdit={canEdit} />
            </Section>
            <Section title="Cores" isDone={!isMissing("2 cores")}>
              <BrandKitPalette brandKit={brandKit} canEdit={canEdit} />
            </Section>
            <Section title="Tipografia" isDone={!isMissing("fonte")}>
              <BrandKitTypography brandKit={brandKit} canEdit={canEdit} />
            </Section>
            <Section title="Voz da marca" isDone={!isMissing("tom de voz") && !isMissing("público")} className="xl:row-span-2">
              <BrandKitVoice brandKit={brandKit} canEdit={canEdit} />
            </Section>
            <Section title="Fundos e texturas">
              <BrandKitAssetList organizationId={brandKit.organization.id} kind="BACKGROUND" assets={assetsOf("BACKGROUND")} canEdit={canEdit} />
            </Section>
            <Section title="Produtos e serviços" isDone={!isMissing("produtos")}>
              <BrandKitAssetList organizationId={brandKit.organization.id} kind="PRODUCT" assets={assetsOf("PRODUCT")} canEdit={canEdit} />
            </Section>
            <Section title="Site, releases e materiais" isDone={!isMissing("site")}>
              <div className="space-y-3">
                <BrandKitWebsite brandKit={brandKit} canEdit={canEdit} />
                <BrandKitAssetList organizationId={brandKit.organization.id} kind="MATERIAL" assets={assetsOf("MATERIAL")} canEdit={canEdit} />
              </div>
            </Section>
            <Section title="Posts de referência" isDone={!isMissing("posts de referência")}>
              <BrandKitAssetList organizationId={brandKit.organization.id} kind="REFERENCE_POST" assets={assetsOf("REFERENCE_POST")} canEdit={canEdit} />
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
