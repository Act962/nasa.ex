"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { ImageIcon, Instagram, Sparkles, VideoIcon, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConstructUrl } from "@/hooks/use-construct-url";
import type { TrafegoSocialProfile } from "@/features/trafego/lib/social-profile";
import { useAnalyzeTrafegoCreative, useSuggestTrafegoAdCopy } from "@/features/trafego/hooks/use-trafego-creative-review";
import type { TrafegoCreativeDraft } from "@/features/trafego/lib/creative-review/schema";
import type { AdCopySuggestion, CreativeGuidance } from "@/features/trafego/lib/creative-review/guidance";
import { INITIAL_MESSAGE_MAX_CHARS } from "@/features/trafego/lib/meta-ad-rules";
import type { GuardrailWarning } from "@/features/trafego/lib/wizard-guardrails";
import { uploadImage, uploadVideo } from "@/features/trafego/utils/upload-creative-file";
import type { CreativeFramesResult } from "@/features/trafego/utils/creative-frames";
import { cn } from "@/lib/utils";
import { CreativeIntake } from "../../panel/creative-review/creative-intake";
import { CreativeReviewResult } from "../../panel/creative-review/creative-review-result";
import { Field, fieldClass } from "./field";
import { GuardrailNotes } from "./guardrail-notes";
import { MetaAdRulesGuide } from "./meta-ad-rules-guide";
import { MetaAdPreview, type MetaAdPreviewMedia } from "./meta-ad-preview";

/**
 * Passo "Criativo" do wizard de quem já é cliente (spec 0126, RF-9; spec 0129): sobe o
 * arquivo, o Astro analisa com os números da conta e preenche os próximos passos; o texto
 * sai do botão "Gere com IA" (spec 0130). A prévia mostra o anúncio como na Meta. É opcional.
 */

type AnalyzeResult = NonNullable<ReturnType<typeof useAnalyzeTrafegoCreative>["data"]>;

export function CreativeStep({
  value,
  onChange,
  isLinkEnabled,
  businessName,
  businessNiche,
  socialProfile,
  withGuidance,
  onGuidance,
  warnings,
}: {
  value: TrafegoCreativeDraft | null;
  onChange: Dispatch<SetStateAction<TrafegoCreativeDraft | null>>;
  isLinkEnabled: boolean;
  businessName: string;
  businessNiche: string;
  socialProfile: TrafegoSocialProfile | null;
  /** Pede também a orientação do passo a passo (spec 0129). */
  withGuidance: boolean;
  onGuidance: (guidance: CreativeGuidance) => void;
  warnings: GuardrailWarning[];
}) {
  const analyze = useAnalyzeTrafegoCreative();
  const suggestCopy = useSuggestTrafegoAdCopy();
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  // Quadros do arquivo enviado: o "Gere com IA" olha a imagem sem subir o arquivo de novo.
  const [uploadedFrames, setUploadedFrames] = useState<string[]>([]);
  const [copySuggestion, setCopySuggestion] = useState<AdCopySuggestion | null>(null);
  const storedMediaUrl = useConstructUrl(value?.fileKey ?? "");

  useEffect(() => {
    if (!localMediaUrl) return;
    return () => URL.revokeObjectURL(localMediaUrl);
  }, [localMediaUrl]);

  const previewMedia: MetaAdPreviewMedia | null =
    value?.fileKey && (localMediaUrl || storedMediaUrl)
      ? { kind: value.kind, url: localMediaUrl ?? storedMediaUrl }
      : null;
  const pageName = socialProfile?.found ? (socialProfile.name ?? businessName) : businessName;
  const context = { businessName: businessName || undefined, businessNiche: businessNiche || undefined };
  const textOptions = copySuggestion?.options ?? [];

  function updateText(patch: { message?: string; headline?: string; initialMessage?: string }) {
    onChange((current) => {
      const next = { ...current, ...patch };
      const hasMedia = Boolean(current?.fileKey || current?.postLink);
      if (!hasMedia && !next.message?.trim() && !next.headline?.trim() && !current?.guidance) return null;
      return { kind: "IMAGE", ...next };
    });
  }

  function clearMedia() {
    setLocalMediaUrl(null);
    setUploadedFrames([]);
    onChange((current) =>
      current?.message?.trim()
        ? {
            kind: "IMAGE",
            message: current.message,
            headline: current.headline,
            initialMessage: current.initialMessage,
            guidance: current.guidance,
          }
        : null,
    );
  }

  async function generateCopy() {
    const review = value?.review;
    await suggestCopy
      .mutateAsync({
        context,
        frames: uploadedFrames.length ? uploadedFrames : undefined,
        creativeNotes: review ? [review.summary, review.readText && `Texto no criativo: ${review.readText}`].filter(Boolean).join("\n") : undefined,
        postLink: value?.postLink,
      })
      .then((suggestion) => {
        setCopySuggestion(suggestion);
        const [firstOption] = suggestion.options;
        onChange((current) => ({
          kind: "IMAGE",
          ...current,
          message: firstOption.message,
          headline: firstOption.headline,
          initialMessage: current?.initialMessage?.trim() ? current.initialMessage : suggestion.initialMessage,
        }));
      })
      .catch((error: Error) => toast.error(error.message));
  }

  // Resultado chega depois: o que o cliente já preencheu fica como está (spec 0129, CA-4).
  function applyResult(result: AnalyzeResult, media: Partial<TrafegoCreativeDraft>) {
    const { guidance, ...review } = result;
    onChange((current) => ({ kind: "IMAGE", ...current, ...media, review, guidance: guidance ?? current?.guidance }));
    if (guidance) onGuidance(guidance);
  }

  async function handleFile(file: File, frames: CreativeFramesResult) {
    const fileKey = frames.kind === "VIDEO" ? await uploadVideo(file) : await uploadImage(file);
    setLocalMediaUrl(URL.createObjectURL(file));
    setUploadedFrames(frames.frames);
    const media: Partial<TrafegoCreativeDraft> = {
      fileKey,
      postLink: undefined,
      kind: frames.kind,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      width: frames.width ?? undefined,
      height: frames.height ?? undefined,
      durationSeconds: frames.durationSeconds ?? undefined,
    };
    onChange((current) => ({ kind: frames.kind, ...current, ...media }));
    // mutateAsync, não mutate: o cliente pode seguir para o próximo passo e a resposta ainda precisa chegar (RNF-1).
    await analyze
      .mutateAsync({
        context,
        withGuidance,
        source: {
          type: "frames",
          frames: frames.frames,
          technical: {
            kind: frames.kind,
            width: frames.width,
            height: frames.height,
            durationSeconds: frames.durationSeconds,
            fileSize: file.size,
          },
        },
      })
      .then((result) => applyResult(result, media))
      .catch((error: Error) => toast.error(error.message));
  }

  async function handleLink(link: string) {
    await analyze
      .mutateAsync({ context, withGuidance, source: { type: "post", link } })
      .then((result) => {
        setUploadedFrames([]);
        applyResult(result, { kind: "IMAGE", postLink: link, fileKey: undefined });
      })
      .catch((error: Error) => toast.error(error.message));
  }

  const hasMedia = Boolean(value?.fileKey || value?.postLink);

  return (
    <div className="@container">
      <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {hasMedia && value ? (
            <div className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-3 py-2.5">
              {value.postLink ? (
                <Instagram className="size-4 shrink-0" />
              ) : value.kind === "VIDEO" ? (
                <VideoIcon className="size-4 shrink-0" />
              ) : (
                <ImageIcon className="size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{value.postLink ?? value.fileName ?? "Criativo"}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 rounded-full"
                aria-label="Trocar criativo"
                onClick={clearMedia}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <CreativeIntake
              onFile={handleFile}
              onLink={handleLink}
              isBusy={analyze.isPending}
              isLinkEnabled={isLinkEnabled}
            />
          )}

          {analyze.isPending && (
            <p className="flex items-center gap-2 text-xs text-white/55">
              <Sparkles className="size-3.5 animate-pulse text-info" />
              {withGuidance
                ? "O Astro está olhando o criativo e os números da sua conta. Pode seguir preenchendo."
                : "O Astro está analisando o criativo…"}
            </p>
          )}

          {hasMedia && (
            <Button
              type="button"
              onClick={generateCopy}
              disabled={suggestCopy.isPending}
              className="h-10 w-full rounded-full"
            >
              <Wand2 className={cn("size-4", suggestCopy.isPending && "animate-pulse")} />
              {suggestCopy.isPending
                ? "O Astro está escrevendo…"
                : textOptions.length > 0
                  ? "Gerar outras opções com IA"
                  : "Gere com IA"}
            </Button>
          )}

          {textOptions.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-info">
                <Sparkles className="size-3.5" />
                Textos do Astro, seguindo as regras da Meta e o que deu certo na sua conta
              </p>
              {textOptions.map((option, index) => {
                const isSelected = option.message === value?.message;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => updateText({ message: option.message, headline: option.headline })}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left text-xs leading-snug transition",
                      isSelected
                        ? "border-info/50 bg-info/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25",
                    )}
                  >
                    {option.headline && <span className="block font-semibold text-white">{option.headline}</span>}
                    <span className="line-clamp-3">{option.message}</span>
                    <span className="mt-1 block text-[11px] font-medium text-info">
                      {isSelected ? "Em uso" : `Usar opção ${index + 1}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <Field label="Texto do anúncio" hint="Aparece acima da imagem. As primeiras linhas são as que todo mundo lê.">
            <textarea
              value={value?.message ?? ""}
              onChange={(event) => updateText({ message: event.target.value })}
              maxLength={2000}
              rows={4}
              placeholder="Ex.: Agende sua avaliação com quem entende do assunto. Fale com a gente no WhatsApp."
              className={fieldClass}
            />
          </Field>
          <GuardrailNotes warnings={warnings} onRewrite={(message) => updateText({ message })} />
          <MetaAdRulesGuide />
          <Field label="Título" hint="Opcional. Sem título, a Meta mostra o convite para falar com a página.">
            <input
              value={value?.headline ?? ""}
              onChange={(event) => updateText({ headline: event.target.value })}
              maxLength={80}
              placeholder="Ex.: Avaliação gratuita"
              className={fieldClass}
            />
          </Field>
          <Field
            label="Mensagem inicial no WhatsApp"
            hint="Já aparece escrita para quem toca no botão. Curta, na voz de quem chama."
          >
            <input
              value={value?.initialMessage ?? ""}
              onChange={(event) => updateText({ initialMessage: event.target.value })}
              maxLength={INITIAL_MESSAGE_MAX_CHARS}
              placeholder="Ex.: Olá! Vi o anúncio e quero saber da avaliação."
              className={fieldClass}
            />
          </Field>

          {value?.review && <CreativeReviewResult review={value.review} />}
        </div>

        <MetaAdPreview
          pageName={pageName || "Sua página"}
          avatarUrl={socialProfile?.found ? socialProfile.pictureUrl : null}
          instagramUsername={socialProfile?.found ? socialProfile.username : null}
          message={value?.message ?? ""}
          headline={value?.headline ?? ""}
          media={previewMedia}
        />
      </div>
    </div>
  );
}
