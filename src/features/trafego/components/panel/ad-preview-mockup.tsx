import type { TrafegoPlatform } from "@/generated/prisma/enums";
import {
  Bookmark,
  Heart,
  ImageIcon,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Search,
  Send,
  Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TechnicalTerm } from "../technical-term";

interface PreviewCopy {
  headline: string | null;
  primaryText: string;
  description: string | null;
  callToAction: string | null;
}

interface PreviewCreative {
  kind: "IMAGE" | "VIDEO";
  url: string;
  fileName: string | null;
}

interface AdPreviewMockupProps {
  platform: TrafegoPlatform;
  businessName: string | null;
  destinationUrl: string | null;
  whatsappNumber: string | null;
  copy: PreviewCopy | null;
  creative: PreviewCreative | null;
}

function displayHost(url: string | null) {
  if (!url) return "seusite.com.br";

  try {
    return new URL(
      url.startsWith("http") ? url : `https://${url}`,
    ).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || "seusite.com.br";
  }
}

function CreativeMedia({ creative }: { creative: PreviewCreative | null }) {
  if (!creative) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
        <div className="rounded-full bg-background p-3 shadow-sm">
          <ImageIcon className="size-5" />
        </div>
        <span className="text-[11px] font-medium">
          Seu criativo aparece aqui
        </span>
      </div>
    );
  }

  if (creative.kind === "VIDEO") {
    return (
      <video
        src={creative.url}
        aria-label={creative.fileName ?? "Vídeo do anúncio"}
        controls
        className="aspect-[4/3] w-full bg-black object-cover"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={creative.url}
      alt={creative.fileName ?? "Imagem do anúncio"}
      className="aspect-[4/3] w-full bg-muted object-cover"
    />
  );
}

function MetaPreview({
  businessName,
  copy,
  creative,
}: Pick<AdPreviewMockupProps, "businessName" | "copy" | "creative">) {
  const brand = businessName || "Sua empresa";

  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2rem] border-[6px] border-foreground/90 bg-background shadow-xl">
      <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-foreground/80" />
      <div className="mt-2 border-y bg-card">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-orange-400 text-xs font-bold text-white">
            {brand.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{brand}</p>
            <p className="text-[10px] text-muted-foreground">Patrocinado</p>
          </div>
          <MoreHorizontal className="size-4 text-muted-foreground" />
        </div>

        <CreativeMedia creative={creative} />

        <div className="px-3 py-2.5">
          <div className="flex items-center gap-3">
            <Heart className="size-[18px]" />
            <MessageCircle className="size-[18px]" />
            <Send className="size-[18px]" />
            <Bookmark className="ml-auto size-[18px]" />
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed">
            <span className="mr-1 font-semibold">{brand}</span>
            {copy?.primaryText}
          </p>
          {(copy?.headline || copy?.description) && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2">
              <div className="min-w-0 flex-1">
                {copy.headline && (
                  <p className="truncate text-[11px] font-semibold">
                    {copy.headline}
                  </p>
                )}
                {copy.description && (
                  <p className="truncate text-[9px] text-muted-foreground">
                    {copy.description}
                  </p>
                )}
              </div>
              {copy.callToAction && (
                <span className="shrink-0 rounded-md border bg-background px-2 py-1 text-[9px] font-semibold">
                  {copy.callToAction}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="h-5" />
    </div>
  );
}

function WhatsappPreview({
  businessName,
  whatsappNumber,
  copy,
  creative,
}: Pick<
  AdPreviewMockupProps,
  "businessName" | "whatsappNumber" | "copy" | "creative"
>) {
  const brand = businessName || "Sua empresa";

  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2rem] border-[6px] border-foreground/90 bg-[#efeae2] shadow-xl dark:bg-[#0b141a]">
      <div className="bg-[#075e54] px-3 pb-3 pt-4 text-white dark:bg-[#202c33]">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-full bg-white/20 text-xs font-bold">
            {brand.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{brand}</p>
            <p className="text-[9px] text-white/70">
              {whatsappNumber || "Conta comercial"}
            </p>
          </div>
        </div>
      </div>
      <div className="min-h-[390px] p-3">
        <div className="ml-auto max-w-[92%] overflow-hidden rounded-lg rounded-tr-none bg-[#d9fdd3] shadow-sm dark:bg-[#005c4b]">
          {creative && <CreativeMedia creative={creative} />}
          <div className="p-2.5">
            {copy?.headline && (
              <p className="text-xs font-semibold">{copy.headline}</p>
            )}
            <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed">
              {copy?.primaryText}
            </p>
            {copy?.description && (
              <p className="mt-1 text-[10px] opacity-70">{copy.description}</p>
            )}
            {copy?.callToAction && (
              <div className="mt-2 border-t border-black/10 pt-2 text-center text-[10px] font-semibold text-emerald-700 dark:border-white/10 dark:text-emerald-300">
                {copy.callToAction}
              </div>
            )}
            <p className="mt-1 text-right text-[8px] opacity-60">10:42 ✓✓</p>
          </div>
        </div>
      </div>
      <div className="mx-3 mb-3 h-9 rounded-full bg-white/90 dark:bg-[#202c33]" />
    </div>
  );
}

function GooglePreview({
  businessName,
  destinationUrl,
  copy,
}: Pick<AdPreviewMockupProps, "businessName" | "destinationUrl" | "copy">) {
  const host = displayHost(destinationUrl);

  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border bg-background shadow-xl">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="mx-auto flex h-7 w-2/3 items-center gap-2 rounded-full border bg-background px-3 text-[10px] text-muted-foreground">
          <Search className="size-3" />
          Resultados da pesquisa
        </div>
      </div>
      <div className="px-6 py-8 sm:px-12 sm:py-12">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-semibold">Patrocinado</span>
            <span className="text-muted-foreground">·</span>
            <span className="truncate text-muted-foreground">
              https://{host}
            </span>
          </div>
          <p className="mt-1 text-lg font-medium leading-snug text-blue-700 dark:text-blue-400 sm:text-xl">
            {copy?.headline || businessName || "Título do seu anúncio"}
          </p>
          <p className="mt-1.5 max-w-xl whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {copy?.primaryText}
          </p>
          {copy?.description && (
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {copy.description}
            </p>
          )}
          {copy?.callToAction && (
            <Button
              type="button"
              size="sm"
              className="mt-4 pointer-events-none"
            >
              {copy.callToAction}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdPreviewMockup(props: AdPreviewMockupProps) {
  const isDesktop = props.platform === "GOOGLE_ADS";

  return (
    <section
      aria-labelledby="ad-preview-title"
      className="rounded-2xl border bg-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div>
          <h3 id="ad-preview-title" className="text-sm font-semibold">
            Prévia do anúncio
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Simulação com a copy
            <TechnicalTerm term="copy" /> selecionada e o primeiro criativo
            <TechnicalTerm term="creative" /> enviado.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          {isDesktop ? (
            <Monitor className="size-3.5" />
          ) : (
            <Smartphone className="size-3.5" />
          )}
          {isDesktop
            ? "Desktop · Google"
            : props.platform === "META_ADS"
              ? "Mobile · Meta"
              : "Mobile · WhatsApp"}
        </Badge>
      </div>

      <div className="bg-muted/30 p-4 sm:p-7">
        {!props.copy ? (
          <div className="mx-auto max-w-md rounded-xl border border-dashed bg-background p-8 text-center">
            <p className="text-sm font-medium">
              Selecione uma copy para visualizar
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A variação marcada para veicular aparece aqui no formato do canal
              escolhido.
            </p>
          </div>
        ) : props.platform === "GOOGLE_ADS" ? (
          <GooglePreview {...props} />
        ) : props.platform === "WHATSAPP_OFICIAL" ? (
          <WhatsappPreview {...props} />
        ) : (
          <MetaPreview {...props} />
        )}
      </div>
    </section>
  );
}
