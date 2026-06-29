import { useConstructUrl } from "@/hooks/use-construct-url";
import { ExternalLinkIcon } from "lucide-react";

export function ImagePreview({ imageUrl }: { imageUrl: string }) {
  const fullUrl = useConstructUrl(imageUrl);
  return (
    <div className="mt-2 space-y-2">
      <div className="relative aspect-video w-full rounded-md overflow-hidden border border-border bg-muted">
        <img
          src={fullUrl}
          alt="Anexo sugerido"
          className="object-contain w-full h-full"
        />
      </div>
      <div className="flex justify-end">
        <a
          href={fullUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors bg-secondary w-fit px-3 py-1.5 rounded-md"
        >
          <ExternalLinkIcon className="size-3.5" />
          Abrir imagem original
        </a>
      </div>
    </div>
  );
}
