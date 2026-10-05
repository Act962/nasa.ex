"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSavePlannerBrandKit } from "../../hooks/use-planner-brand-kit";
import type { PlannerBrandKit } from "./brand-kit-types";
import { BrandKitChips } from "./brand-kit-chips";

/** Cores, tipografia e voz da marca (spec 0063, RF-1). Texto salva ao sair do campo; listas salvam na hora. */

type IdentityField = "brandName" | "fontHeading" | "fontBody" | "voiceTone" | "audience" | "positioning" | "slogan" | "website";

type BrandKitSavePayload = Parameters<ReturnType<typeof useSavePlannerBrandKit>["mutate"]>[0];

/** Grava no kit que está em tela: o padrão da empresa ou um adicional (spec 0070). */
export function useBrandKitFieldSaver(brandKit: Pick<PlannerBrandKit, "organization" | "brandKitId">) {
  const saveBrandKit = useSavePlannerBrandKit();
  return (patch: Omit<BrandKitSavePayload, "organizationId" | "brandKitId">) =>
    saveBrandKit.mutate(
      { organizationId: brandKit.organization.id, brandKitId: brandKit.brandKitId, ...patch },
      { onError: (error) => toast.error(error.message) },
    );
}

function BlurField({ value, placeholder, isMultiline, canEdit, onSave }: { value: string | null; placeholder: string; isMultiline?: boolean; canEdit: boolean; onSave: (value: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  const commit = () => {
    if (draft.trim() === (value ?? "").trim()) return;
    onSave(draft.trim() || null);
  };
  return isMultiline ? (
    <Textarea value={draft} disabled={!canEdit} onChange={(event) => setDraft(event.target.value)} onBlur={commit} placeholder={placeholder} className="min-h-16 rounded-xl text-sm" />
  ) : (
    <Input value={draft} disabled={!canEdit} onChange={(event) => setDraft(event.target.value)} onBlur={commit} placeholder={placeholder} className="h-9 rounded-xl text-sm" />
  );
}

function LabeledField({ label, note, hint, isNegative, children }: { label: string; note?: string; hint?: string; isNegative?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className={cn("text-xs font-semibold", isNegative && "text-destructive")}>
        {label}
        {note && <span className="font-normal text-muted-foreground"> · {note}</span>}
      </p>
      {hint && <p className="text-[11.5px] text-muted-foreground">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function BrandKitPalette({ brandKit, canEdit }: { brandKit: PlannerBrandKit; canEdit: boolean }) {
  const saveField = useBrandKitFieldSaver(brandKit);
  const [newColor, setNewColor] = useState("#1d4ed8");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {brandKit.palette.map((color) => (
        <span key={color} className="group relative">
          <span className="block size-10 rounded-xl border border-line" style={{ backgroundColor: color }} title={color} />
          {canEdit && (
            <button
              type="button"
              onClick={() => saveField({ palette: brandKit.palette.filter((current) => current !== color) })}
              aria-label={`Remover ${color}`}
              className="absolute -top-1.5 -right-1.5 hidden size-5 place-items-center rounded-full bg-card shadow group-hover:grid"
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!canEdit && brandKit.palette.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma cor cadastrada.</p>}
      {canEdit && (
        <label className="flex h-10 items-center gap-1.5 rounded-xl border border-dashed border-line px-2">
          <input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent" />
          <button
            type="button"
            onClick={() => !brandKit.palette.includes(newColor) && saveField({ palette: [...brandKit.palette, newColor] })}
            className="inline-flex items-center gap-1 text-xs"
          >
            <Plus className="size-3" /> Adicionar cor
          </button>
        </label>
      )}
    </div>
  );
}

export function BrandKitTypography({ brandKit, canEdit }: { brandKit: PlannerBrandKit; canEdit: boolean }) {
  const saveField = useBrandKitFieldSaver(brandKit);
  const saveText = (field: IdentityField) => (value: string | null) => saveField({ [field]: value });
  return (
    <div className="space-y-3">
      <LabeledField label="Títulos">
        <BlurField value={brandKit.fontHeading} placeholder="Ex.: Sora" canEdit={canEdit} onSave={saveText("fontHeading")} />
      </LabeledField>
      <LabeledField label="Textos" note="opcional">
        <BlurField value={brandKit.fontBody} placeholder="Ex.: Inter" canEdit={canEdit} onSave={saveText("fontBody")} />
      </LabeledField>
    </div>
  );
}

export function BrandKitIdentityFields({ brandKit, canEdit }: { brandKit: PlannerBrandKit; canEdit: boolean }) {
  const saveField = useBrandKitFieldSaver(brandKit);
  const saveText = (field: IdentityField) => (value: string | null) => saveField({ [field]: value });
  return (
    <div className="space-y-3">
      <LabeledField label="Nome da marca">
        <BlurField value={brandKit.brandName} placeholder={`Ex.: ${brandKit.organization.name}`} canEdit={canEdit} onSave={saveText("brandName")} />
      </LabeledField>
      <LabeledField label="Tom de voz" hint="Como ela fala e como não fala.">
        <BlurField value={brandKit.voiceTone} placeholder="Ex.: direta, otimista, sem jargão…" isMultiline canEdit={canEdit} onSave={saveText("voiceTone")} />
      </LabeledField>
      <LabeledField label="Público" hint="Para quem os posts são escritos.">
        <BlurField value={brandKit.audience} placeholder="Ex.: donos de pequenas empresas" canEdit={canEdit} onSave={saveText("audience")} />
      </LabeledField>
      <LabeledField label="Posicionamento" note="vale no lugar do público">
        <BlurField value={brandKit.positioning} placeholder="O que diferencia a marca" canEdit={canEdit} onSave={saveText("positioning")} />
      </LabeledField>
      <LabeledField label="Slogan" note="opcional">
        <BlurField value={brandKit.slogan} placeholder="Ex.: Feito para durar" canEdit={canEdit} onSave={saveText("slogan")} />
      </LabeledField>
    </div>
  );
}

export function BrandKitVocabulary({ brandKit, canEdit }: { brandKit: PlannerBrandKit; canEdit: boolean }) {
  const saveField = useBrandKitFieldSaver(brandKit);
  return (
    <div className="space-y-3">
      <LabeledField label="Frases da marca" hint="Bordões e mensagens que podem aparecer nos textos.">
        <BrandKitChips values={brandKit.keyMessages} placeholder="Escreva e aperte Enter" canEdit={canEdit} onChange={(keyMessages) => saveField({ keyMessages })} />
      </LabeledField>
      <LabeledField label="Nunca usar" hint="Palavras proibidas. A aprovação do post avisa quando aparecem." isNegative>
        <BrandKitChips values={brandKit.forbiddenWords} placeholder="Palavra proibida + Enter" canEdit={canEdit} isNegative onChange={(forbiddenWords) => saveField({ forbiddenWords })} />
      </LabeledField>
      <LabeledField label="Hashtags padrão">
        <BrandKitChips values={brandKit.defaultHashtags} placeholder="#hashtag + Enter" prefix="#" canEdit={canEdit} onChange={(defaultHashtags) => saveField({ defaultHashtags })} />
      </LabeledField>
      <LabeledField label="Chamadas para ação" hint="Como os posts costumam terminar.">
        <BrandKitChips values={brandKit.defaultCtas} placeholder="Ex.: Fale com a gente no direct" canEdit={canEdit} onChange={(defaultCtas) => saveField({ defaultCtas })} />
      </LabeledField>
    </div>
  );
}

export function BrandKitWebsite({ brandKit, canEdit }: { brandKit: PlannerBrandKit; canEdit: boolean }) {
  const saveField = useBrandKitFieldSaver(brandKit);
  return (
    <LabeledField label="Site">
      <BlurField value={brandKit.website} placeholder="https://site-da-marca.com" canEdit={canEdit} onSave={(website) => saveField({ website })} />
    </LabeledField>
  );
}
