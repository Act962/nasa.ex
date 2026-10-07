"use client";

/** Bloco "SEO e compartilhamento" da aba Ajustes: como a página aparece no Google e em links. */

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import {
  SEO_DESCRIPTION_RECOMMENDED_LENGTH,
  SEO_TITLE_RECOMMENDED_LENGTH,
  type PageSeoFields,
} from "../../lib/page-seo";
import { ImageUploaderField } from "../properties-panel/image-uploader-field";

function LengthHint({ length, recommendedLength }: { length: number; recommendedLength: number }) {
  return (
    <span className={cn("text-[10px]", length > recommendedLength ? "text-warning" : "text-muted-foreground")}>
      {length}/{recommendedLength}
    </span>
  );
}

export function PageSeoPanel({
  seo,
  siteName,
  siteAddress,
  updateMeta,
}: {
  seo: PageSeoFields;
  /** Nome do site: é o título usado enquanto o campo estiver vazio. */
  siteName: string;
  /** Endereço mostrado na prévia (domínio próprio ou /s/<slug>). */
  siteAddress: string;
  updateMeta: (patch: Record<string, unknown>) => void;
}) {
  const title = seo.title ?? "";
  const description = seo.description ?? "";
  const previewTitle = title || siteName;
  const previewDescription = description || "Escreva uma descrição para aparecer aqui, embaixo do título.";

  return (
    <div data-guide={GUIDE_ANCHORS.pagesSeoPanel.id}>
      <p className="mb-1 text-[10px] font-semibold text-muted-foreground uppercase">SEO e compartilhamento</p>
      <p className="mb-3 text-[10px] leading-relaxed text-muted-foreground">
        Como a página aparece no Google, na aba do navegador e quando o link é enviado no WhatsApp.
        Começa a valer depois de publicar.
      </p>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Título da página</Label>
            <LengthHint length={title.length} recommendedLength={SEO_TITLE_RECOMMENDED_LENGTH} />
          </div>
          <input
            type="text"
            value={title}
            onChange={(event) => updateMeta({ title: event.target.value || undefined })}
            placeholder={siteName}
            className="mt-1 h-9 w-full rounded-full border border-line bg-background px-3 text-xs"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Descrição</Label>
            <LengthHint length={description.length} recommendedLength={SEO_DESCRIPTION_RECOMMENDED_LENGTH} />
          </div>
          <Textarea
            rows={3}
            value={description}
            onChange={(event) => updateMeta({ description: event.target.value || undefined })}
            placeholder="Uma ou duas frases dizendo o que a pessoa encontra na página."
            className="mt-1 text-xs"
          />
        </div>

        <div className="rounded-xl border bg-background p-3">
          <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Prévia no Google
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{siteAddress}</p>
          <p className="truncate text-sm font-medium text-info">{previewTitle}</p>
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{previewDescription}</p>
        </div>

        <ImageUploaderField
          label="Imagem de compartilhamento (1200 × 630)"
          value={seo.og ?? ""}
          onChange={(shareImageUrl) => updateMeta({ og: shareImageUrl || undefined })}
          previewHeight={96}
        />

        <ImageUploaderField
          label="Ícone da aba (favicon, quadrado)"
          value={seo.favicon ?? ""}
          onChange={(faviconUrl) => updateMeta({ favicon: faviconUrl || undefined })}
          previewHeight={48}
          accept="image/png,image/svg+xml,image/x-icon,.ico"
        />

        <label className="flex cursor-pointer items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-medium">Não aparecer no Google</span>
            <span className="text-[10px] leading-snug text-muted-foreground">
              Pede aos buscadores para não listarem esta página. Quem tiver o link continua acessando.
            </span>
          </span>
          <Switch
            checked={seo.noIndex ?? false}
            onCheckedChange={(isHiddenFromSearch) => updateMeta({ noIndex: isHiddenFromSearch || undefined })}
            className="shrink-0"
          />
        </label>
      </div>
    </div>
  );
}
