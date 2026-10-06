/**
 * Section Media + Text — foto de um lado, texto do outro (título, parágrafos, lista com ✓,
 * números e botões). Serve para "quem é a mentora" e, com `isHero`, para o topo da página
 * com foto ao lado. No celular o texto vem primeiro e a foto embaixo.
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderSectionButton, type SectionButton } from "./buttons";
import { renderHighlightedText } from "./highlight-text";
import { bgColor, fgColor, mutedColor, primaryColor, type SectionRendererProps } from "./types";

export const MEDIA_TEXT_STAT_SEPARATOR = "|";

function isFilledLine(lineText: string): boolean {
  return lineText.trim().length > 0;
}

export function SectionMediaText({ element, tokens, readonly }: SectionRendererProps) {
  const eyebrow = (element.eyebrow as string | undefined) ?? "";
  const heading = (element.heading as string | undefined) ?? "";
  const body = (element.body as string | undefined) ?? "";
  const checklist = ((element.checklist as string[] | undefined) ?? []).filter(isFilledLine);
  const stats = ((element.stats as string[] | undefined) ?? []).filter(isFilledLine);
  const imageUrl = (element.imageUrl as string | undefined) ?? "";
  const imageAlt = (element.imageAlt as string | undefined) ?? "";
  const isImageOnLeft = (element.imageSide as string | undefined) === "left";
  const isHero = (element.isHero as boolean | undefined) ?? false;
  const primaryButtonLabel = (element.primaryButtonLabel as string | undefined) ?? "";
  const primaryButtonHref = (element.primaryButtonHref as string | undefined) ?? "#";
  const secondaryButtonLabel = (element.secondaryButtonLabel as string | undefined) ?? "";
  const secondaryButtonHref = (element.secondaryButtonHref as string | undefined) ?? "#";
  const anchorId = (element.anchorId as string | undefined) || undefined;

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  const paragraphs = body.split("\n").filter(isFilledLine);
  const buttons: SectionButton[] = [
    ...(primaryButtonLabel
      ? [{ id: "primary", label: primaryButtonLabel, href: primaryButtonHref, variant: "primary" as const }]
      : []),
    ...(secondaryButtonLabel
      ? [{ id: "secondary", label: secondaryButtonLabel, href: secondaryButtonHref, variant: "outline" as const }]
      : []),
  ];
  const HeadingTag = isHero ? "h1" : "h2";

  return (
    <section
      id={anchorId}
      className={cn(
        "w-full scroll-mt-20 px-4 sm:px-6 lg:px-8",
        isHero ? "py-14 sm:py-20 md:py-24" : "py-14 sm:py-20",
      )}
      style={{ background: bg, color: fg }}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-14">
        <div className={cn("flex flex-col gap-5", isImageOnLeft && "md:order-last")}>
          {eyebrow && (
            <p
              data-cascade-item
              className="text-xs font-semibold tracking-[0.2em] uppercase"
              style={{ color: primary }}
            >
              {eyebrow}
            </p>
          )}
          {heading && (
            <HeadingTag
              data-cascade-item
              className={cn(
                "leading-[1.1] font-bold tracking-tight",
                isHero ? "text-3xl sm:text-5xl lg:text-6xl" : "text-2xl sm:text-4xl",
              )}
            >
              {renderHighlightedText(heading, element, primary)}
            </HeadingTag>
          )}
          {paragraphs.map((paragraphText, paragraphIndex) => (
            <p
              key={paragraphIndex}
              data-cascade-item
              className="text-sm leading-relaxed sm:text-base"
              style={{ color: muted }}
            >
              {paragraphText}
            </p>
          ))}
          {checklist.length > 0 && (
            <ul className="flex flex-col gap-3">
              {checklist.map((itemText, itemIndex) => (
                <li key={itemIndex} data-cascade-item className="flex items-start gap-3 text-sm leading-relaxed">
                  <Check className="mt-0.5 size-4 shrink-0" style={{ color: primary }} aria-hidden />
                  <span>{itemText}</span>
                </li>
              ))}
            </ul>
          )}
          {buttons.length > 0 && (
            <div data-cascade-item className="mt-1 flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
              {buttons.map((button) => renderSectionButton(button, { primary, fg, size: "md" }))}
            </div>
          )}
          {stats.length > 0 && (
            <div
              data-cascade-item
              className="mt-2 grid grid-cols-2 gap-5 border-t pt-6 sm:grid-cols-4"
              style={{ borderColor: `${fg}1a` }}
            >
              {stats.map((statLine, statIndex) => {
                const [statValue, statLabel] = statLine.split(MEDIA_TEXT_STAT_SEPARATOR);
                return (
                  <div key={statIndex}>
                    <div className="text-2xl leading-none font-bold" style={{ color: primary }}>
                      {statValue?.trim()}
                    </div>
                    <div className="mt-1.5 text-xs leading-snug" style={{ color: muted }}>
                      {statLabel?.trim()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            data-cascade-item
            src={imageUrl}
            alt={imageAlt}
            className="max-h-[680px] w-full rounded-2xl object-cover"
            style={{ boxShadow: `0 24px 70px ${primary}26` }}
          />
        ) : (
          !readonly && (
            <div
              className="grid aspect-[4/5] w-full place-items-center rounded-2xl border-2 border-dashed text-sm"
              style={{ borderColor: `${fg}33`, color: muted }}
            >
              Adicione a foto no painel à direita
            </div>
          )
        )}
      </div>
    </section>
  );
}
