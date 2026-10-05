"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { BRAND_LOGO_LABEL, BRAND_LOGO_VARIANTS, type BrandLogoVariant } from "../../lib/brand-kit-completeness";

const REQUIRED_LOGO_VARIANTS: BrandLogoVariant[] = ["color", "black", "white"];

/** Logo branca aparece em fundo escuro e a preta em fundo claro, nos dois temas. */
const SLOT_SURFACE: Partial<Record<BrandLogoVariant, { surface: string; placeholder: string }>> = {
  white: { surface: "bg-foreground dark:bg-background", placeholder: "text-background/70 dark:text-muted-foreground" },
  black: { surface: "bg-background dark:bg-foreground", placeholder: "text-muted-foreground dark:text-background/70" },
};
import { useSavePlannerBrandKit } from "../../hooks/use-planner-brand-kit";
import { brandFileUrl, uploadBrandFile } from "./brand-file-upload";

/** Logos do kit em 5 variações, PNG com fundo transparente (spec 0063, RF-1). */

function LogoSlot({ organizationId, brandKitId, variant, value, canEdit }: { organizationId: string; brandKitId: string | null; variant: BrandLogoVariant; value: string | null; canEdit: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const saveBrandKit = useSavePlannerBrandKit();
  const slotSurface = SLOT_SURFACE[variant];
  const isRequired = REQUIRED_LOGO_VARIANTS.includes(variant);

  const saveLogo = (logoValue: string | null) =>
    saveBrandKit.mutate({ organizationId, brandKitId, logos: { [variant]: logoValue } }, { onError: (error) => toast.error(error.message) });

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setIsUploading(true);
    try {
      saveLogo(await uploadBrandFile(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não deu para enviar o logo.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={!canEdit || isUploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "grid h-24 w-full place-items-center rounded-2xl border border-line p-2 transition hover:border-foreground/30",
          slotSurface?.surface ?? "bg-card",
          !value && "border-dashed",
        )}
      >
        {isUploading ? (
          <OrbitaSpinner className="size-4" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brandFileUrl(value)} alt={`Logo ${BRAND_LOGO_LABEL[variant]}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className={cn("flex flex-col items-center gap-1 text-[11px]", slotSurface?.placeholder ?? "text-muted-foreground")}>
            <ImagePlus className="size-4" /> Enviar
          </span>
        )}
      </button>
      <p className="mt-1.5 text-center text-xs font-medium capitalize">{BRAND_LOGO_LABEL[variant]}</p>
      <p className={cn("text-center text-[10.5px]", isRequired && !value ? "text-warning" : "text-muted-foreground")}>{isRequired ? "obrigatória" : "opcional"}</p>
      {value && canEdit && (
        <button type="button" onClick={() => saveLogo(null)} aria-label="Remover logo" className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-card shadow">
          <X className="size-3" />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/svg+xml,image/webp" className="hidden" onChange={(event) => void pickFile(event.target.files?.[0])} />
    </div>
  );
}

export function BrandKitLogos({ organizationId, brandKitId, logos, canEdit }: { organizationId: string; brandKitId: string | null; logos: Record<BrandLogoVariant, string | null>; canEdit: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {BRAND_LOGO_VARIANTS.map((variant) => (
          <LogoSlot key={variant} organizationId={organizationId} brandKitId={brandKitId} variant={variant} value={logos[variant]} canEdit={canEdit} />
        ))}
    </div>
  );
}
