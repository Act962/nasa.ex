"use client";

import { useMemo, useState } from "react";
import { Monitor, Palette, RotateCcw, Save, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { GUIDE_RESULT_KINDS } from "@/features/astro-guides/lib/result-kinds";
import { emitTourResult } from "@/features/tour/store";
import { useForgeSettings, useUpdateForgeProposalLook } from "@/features/forge/hooks/use-forge";
import { ProposalDocument } from "@/features/forge/components/public/proposal-document/proposal-document";
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_BRAND_COLOR,
  resolveProposalLook,
  type ProposalLook,
} from "@/features/forge/lib/proposal-look";
import { ColorField, PaymentMethodsEditor, SectionsEditor, TemplatePicker } from "./look-controls";
import { buildSampleProposal } from "./sample-proposal";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const DEFAULT_LOOK = resolveProposalLook(null);

function LookForm({ look, onChange }: { look: ProposalLook; onChange: (look: ProposalLook) => void }) {
  const set = <Key extends keyof ProposalLook>(key: Key, value: ProposalLook[Key]) => onChange({ ...look, [key]: value });
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Modelo</h3>
        <TemplatePicker value={look.template} onChange={(template) => set("template", template)} />
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <ColorField label="Cor principal" hint="Topo, título e total." value={look.brandColor} onChange={(color) => set("brandColor", color)} />
        <ColorField label="Cor de destaque" hint="Botões e selo de desconto." value={look.accentColor} onChange={(color) => set("accentColor", color)} />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Seções</h3>
        <p className="text-xs text-muted-foreground">Arraste ou use as setas para mudar a ordem. Desligue o que não quer mostrar.</p>
        <SectionsEditor sections={look.sections} onChange={(sections) => set("sections", sections)} />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Formas de pagamento</h3>
        <PaymentMethodsEditor value={look.paymentMethods} onChange={(methods) => set("paymentMethods", methods)} />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Condições comerciais</h3>
        <Textarea
          rows={4}
          maxLength={1500}
          placeholder="Ex.: Prazo de entrega conforme disponibilidade. Garantia de 12 meses."
          value={look.commercialTerms ?? ""}
          onChange={(event) => set("commercialTerms", event.target.value || null)}
        />
      </section>
    </div>
  );
}

function LookPreview({ look, organization }: { look: ProposalLook; organization: { name: string; logo: string | null } }) {
  const [isMobile, setIsMobile] = useState(false);
  const sample = useMemo(() => buildSampleProposal(organization), [organization]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 pb-2">
        <p className="text-xs text-muted-foreground">Prévia com dados de exemplo</p>
        <div className="flex rounded-lg border p-0.5">
          <button type="button" onClick={() => setIsMobile(false)} className={cn("rounded-md p-1.5", !isMobile && "bg-muted")} aria-label="Ver como computador">
            <Monitor className="size-4" />
          </button>
          <button type="button" onClick={() => setIsMobile(true)} className={cn("rounded-md p-1.5", isMobile && "bg-muted")} aria-label="Ver como celular">
            <Smartphone className="size-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-neutral-100">
        <div className={cn("mx-auto", isMobile ? "w-[390px] max-w-full" : "w-full")}>
          <ProposalDocument proposal={sample} look={look} state={{ isExpired: false, isPaid: false, token: "", isPreview: true }} />
        </div>
      </div>
    </div>
  );
}

/** Janela "Visual da proposta" (spec 0150): modelo, cores, seções, pagamento e condições, com prévia ao vivo. */
export function ProposalLookEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data } = useForgeSettings();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const updateLook = useUpdateForgeProposalLook();
  const savedLook = useMemo(() => resolveProposalLook(data?.settings ?? null), [data?.settings]);
  const [draft, setDraft] = useState<ProposalLook | null>(null);
  const look = draft ?? savedLook;
  const organization = useMemo(
    () => ({ name: activeOrganization?.name ?? "Sua empresa", logo: data?.settings.logoUrl ?? activeOrganization?.logo ?? null }),
    [activeOrganization?.name, activeOrganization?.logo, data?.settings.logoUrl],
  );
  const previewLook: ProposalLook = {
    ...look,
    brandColor: HEX_COLOR.test(look.brandColor) ? look.brandColor : DEFAULT_BRAND_COLOR,
    accentColor: HEX_COLOR.test(look.accentColor) ? look.accentColor : DEFAULT_ACCENT_COLOR,
  };

  const save = () => {
    if (!HEX_COLOR.test(look.brandColor) || !HEX_COLOR.test(look.accentColor)) {
      toast.error("Use cores no formato #RRGGBB.");
      return;
    }
    updateLook.mutate(
      {
        proposalTemplate: look.template,
        brandColor: look.brandColor,
        accentColor: look.accentColor,
        proposalSections: look.sections,
        paymentMethods: look.paymentMethods.map((entry) => ({
          method: entry.method,
          installments: entry.installments ?? null,
          note: entry.note?.trim() || null,
        })),
        commercialTerms: look.commercialTerms?.trim() || null,
      },
      {
        onSuccess: () => {
          setDraft(null);
          toast.success("Visual da proposta salvo.");
          emitTourResult({ kind: GUIDE_RESULT_KINDS.proposalLookSaved });
        },
        onError: (error) => toast.error(error.message || "Não foi possível salvar."),
      },
    );
  };

  const close = (nextOpen: boolean) => {
    if (!nextOpen) setDraft(null);
    onOpenChange(nextOpen);
  };

  const form = <LookForm look={look} onChange={setDraft} />;
  const preview = <LookPreview look={previewLook} organization={organization} />;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-3 rounded-none p-4 sm:h-[92dvh] sm:w-[96vw] sm:max-w-[1400px] sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="size-4" /> Visual da proposta
          </DialogTitle>
        </DialogHeader>

        <div className="hidden min-h-0 flex-1 gap-5 lg:grid lg:grid-cols-[400px_1fr]">
          <div className="min-h-0 overflow-y-auto pr-2">{form}</div>
          {preview}
        </div>

        <Tabs defaultValue="adjust" className="flex min-h-0 flex-1 flex-col lg:hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="adjust">Ajustar</TabsTrigger>
            <TabsTrigger value="preview">Prévia</TabsTrigger>
          </TabsList>
          <TabsContent value="adjust" className="min-h-0 flex-1 overflow-y-auto">
            {form}
          </TabsContent>
          <TabsContent value="preview" className="min-h-0 flex-1">
            {preview}
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={() => setDraft(DEFAULT_LOOK)}>
            <RotateCcw className="size-4" /> Restaurar padrão
          </Button>
          <Button type="button" onClick={save} disabled={updateLook.isPending} data-guide={GUIDE_ANCHORS.forgeProposalLookSave.id}>
            <Save className="size-4" /> {updateLook.isPending ? "Salvando..." : "Salvar visual"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
