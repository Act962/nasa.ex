"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSavePlannerBrandKit } from "../../hooks/use-planner-brand-kit";
import type { PlannerBrandKit } from "./brand-kit-types";
import { BrandKitChips } from "./brand-kit-chips";

/** Cores, tipografia e voz da marca (spec 0063, RF-1). Texto salva ao sair do campo; listas salvam na hora. */

type IdentityField = "brandName" | "fontHeading" | "fontBody" | "voiceTone" | "audience" | "positioning" | "slogan" | "website";

type BrandKitSavePayload = Parameters<ReturnType<typeof useSavePlannerBrandKit>["mutate"]>[0];

export function useBrandKitFieldSaver(organizationId: string) {
  const saveBrandKit = useSavePlannerBrandKit();
  return (patch: Omit<BrandKitSavePayload, "organizationId">) =>
    saveBrandKit.mutate({ organizationId, ...patch }, { onError: (error) => toast.error(error.message) });
}

function BlurField({ value, placeholder, isMultiline, canEdit, onSave }: { value: string | null; placeholder: string; isMultiline?: boolean; canEdit: boolean; onSave: (value: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  const commit = () => {
    if (draft.trim() === (value ?? "").trim()) return;
    onSave(draft.trim() || null);
  };
  return isMultiline ? (
    <Textarea value={draft} disabled={!canEdit} onChange={(event) => setDraft(event.target.value)} onBlur={commit} placeholder={placeholder} className="min-h-16 rounded-2xl text-sm" />
  ) : (
    <Input value={draft} disabled={!canEdit} onChange={(event) => setDraft(event.target.value)} onBlur={commit} placeholder={placeholder} className="h-9 rounded-full text-sm" />
  );
}

export function BrandKitPalette({ brandKit, canEdit }: { brandKit: PlannerBrandKit; canEdit: boolean }) {
  const saveField = useBrandKitFieldSaver(brandKit.organization.id);
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
      {canEdit && (
        <label className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-2 py-1.5">
          <input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent" />
          <button
            type="button"
            onClick={() => !brandKit.palette.includes(newColor) && saveField({ palette: [...brandKit.palette, newColor] })}
            className="inline-flex items-center gap-1 text-xs"
          >
            <Plus className="size-3" /> Cor
          </button>
        </label>
      )}
    </div>
  );
}

export function BrandKitTypography({ brandKit, canEdit }: { brandKit: PlannerBrandKit; canEdit: boolean }) {
  const saveField = useBrandKitFieldSaver(brandKit.organization.id);
  const saveText = (field: IdentityField) => (value: string | null) => saveField({ [field]: value });
  return (
    <div className="space-y-2">
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground">Títulos (nome da fonte no Google Fonts)</p>
        <BlurField value={brandKit.fontHeading} placeholder="Ex.: Sora" canEdit={canEdit} onSave={saveText("fontHeading")} />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground">Textos</p>
        <BlurField value={brandKit.fontBody} placeholder="Ex.: Inter" canEdit={canEdit} onSave={saveText("fontBody")} />
      </div>
    </div>
  );
}

export function BrandKitVoice({ brandKit, canEdit }: { brandKit: PlannerBrandKit; canEdit: boolean }) {
  const saveField = useBrandKitFieldSaver(brandKit.organization.id);
  const saveText = (field: IdentityField) => (value: string | null) => saveField({ [field]: value });
  return (
    <div className="space-y-3">
      <BlurField value={brandKit.brandName} placeholder={`Nome da marca (ex.: ${brandKit.organization.name})`} canEdit={canEdit} onSave={saveText("brandName")} />
      <BlurField value={brandKit.voiceTone} placeholder="Tom de voz: direta, otimista, sem jargão…" isMultiline canEdit={canEdit} onSave={saveText("voiceTone")} />
      <BlurField value={brandKit.audience} placeholder="Público: donos de pequenas empresas…" canEdit={canEdit} onSave={saveText("audience")} />
      <BlurField value={brandKit.positioning} placeholder="Posicionamento: o que diferencia a marca" canEdit={canEdit} onSave={saveText("positioning")} />
      <BlurField value={brandKit.slogan} placeholder="Slogan" canEdit={canEdit} onSave={saveText("slogan")} />
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground">Frases da marca</p>
        <BrandKitChips values={brandKit.keyMessages} placeholder="Escreva e aperte Enter" canEdit={canEdit} onChange={(keyMessages) => saveField({ keyMessages })} />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground">Nunca usar</p>
        <BrandKitChips values={brandKit.forbiddenWords} placeholder="Palavra proibida + Enter" canEdit={canEdit} isNegative onChange={(forbiddenWords) => saveField({ forbiddenWords })} />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground">Hashtags padrão</p>
        <BrandKitChips values={brandKit.defaultHashtags} placeholder="#hashtag + Enter" prefix="#" canEdit={canEdit} onChange={(defaultHashtags) => saveField({ defaultHashtags })} />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-muted-foreground">CTAs padrão</p>
        <BrandKitChips values={brandKit.defaultCtas} placeholder="Ex.: Fale com a gente no direct" canEdit={canEdit} onChange={(defaultCtas) => saveField({ defaultCtas })} />
      </div>
    </div>
  );
}

export function BrandKitWebsite({ brandKit, canEdit }: { brandKit: PlannerBrandKit; canEdit: boolean }) {
  const saveField = useBrandKitFieldSaver(brandKit.organization.id);
  return <BlurField value={brandKit.website} placeholder="https://site-da-marca.com" canEdit={canEdit} onSave={(website) => saveField({ website })} />;
}
