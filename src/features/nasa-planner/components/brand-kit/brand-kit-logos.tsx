"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { BRAND_LOGO_LABEL, BRAND_LOGO_VARIANTS, type BrandLogoVariant } from "../../lib/brand-kit-completeness";
import { useSavePlannerBrandKit } from "../../hooks/use-planner-brand-kit";
import { brandFileUrl, uploadBrandFile } from "./brand-file-upload";

/** Logos do kit em 5 variações, PNG com fundo transparente (spec 0063, RF-1). */

function LogoSlot({ organizationId, variant, value, canEdit }: { organizationId: string; variant: BrandLogoVariant; value: string | null; canEdit: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const saveBrandKit = useSavePlannerBrandKit();
  const isDarkSlot = variant === "white";

  const saveLogo = (logoValue: string | null) =>
    saveBrandKit.mutate({ organizationId, logos: { [variant]: logoValue } }, { onError: (error) => toast.error(error.message) });

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
          "grid h-20 w-full place-items-center rounded-xl border border-line p-2 transition hover:border-foreground/30",
          isDarkSlot ? "bg-foreground dark:bg-background" : "bg-card",
          !value && "border-dashed",
        )}
      >
        {isUploading ? (
          <OrbitaSpinner className="size-4" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brandFileUrl(value)} alt={`Logo ${BRAND_LOGO_LABEL[variant]}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className={cn("flex flex-col items-center gap-1 text-[11px]", isDarkSlot ? "text-background/70 dark:text-muted-foreground" : "text-muted-foreground")}>
            <ImagePlus className="size-4" /> Enviar
          </span>
        )}
      </button>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">{BRAND_LOGO_LABEL[variant]}</p>
      {value && canEdit && (
        <button type="button" onClick={() => saveLogo(null)} aria-label="Remover logo" className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-card shadow">
          <X className="size-3" />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/svg+xml,image/webp" className="hidden" onChange={(event) => void pickFile(event.target.files?.[0])} />
    </div>
  );
}

export function BrandKitLogos({ organizationId, logos, canEdit }: { organizationId: string; logos: Record<BrandLogoVariant, string | null>; canEdit: boolean }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {BRAND_LOGO_VARIANTS.map((variant) => (
          <LogoSlot key={variant} organizationId={organizationId} variant={variant} value={logos[variant]} canEdit={canEdit} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Use PNG com fundo transparente. A versão branca aparece sobre fundo escuro.</p>
    </div>
  );
}
