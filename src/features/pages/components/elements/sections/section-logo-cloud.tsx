/**
 * Section Logo Cloud — grid responsivo de logos.
 * Editor: heading tipográfico + drag-reorder + tamanho/opacity ajustáveis.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  type SectionRendererProps,
} from "./types";
import {
  resolveTextStyle,
  textStyleToCSS,
  type TextStyle,
} from "../../../lib/text-style";
import {
  RenderInterludeBlocks,
  type InterludeZones,
} from "./interlude-block";

interface LogoItem {
  id: string;
  imageUrl: string;
  alt: string;
}

export function SectionLogoCloud({ element, tokens }: SectionRendererProps) {
  const heading =
    (element.heading as string) ?? "Empresas que confiam em nós";
  const logos =
    (element.logos as LogoItem[] | undefined) ?? [
      { id: "1", imageUrl: "", alt: "Logo 1" },
      { id: "2", imageUrl: "", alt: "Logo 2" },
      { id: "3", imageUrl: "", alt: "Logo 3" },
      { id: "4", imageUrl: "", alt: "Logo 4" },
      { id: "5", imageUrl: "", alt: "Logo 5" },
    ];

  const anchorId = (element.anchorId as string) ?? undefined;
  const logoHeight = (element.logoHeight as number) ?? 32;
  const logoOpacity = (element.logoOpacity as number) ?? 0.6;

  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  const sectionHeadingStyle = element.headingStyle as TextStyle | undefined;
  const headingDefaults: TextStyle = {
    color: muted,
    fontSize: 12,
    fontWeight: "600",
    align: "center",
    letterSpacing: 4,
  };
  const merged = resolveTextStyle(undefined, sectionHeadingStyle, headingDefaults);

  const interlude = (element.interlude as InterludeZones | undefined) ?? {};

  return (
    <section
      id={anchorId}
      className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 scroll-mt-20"
      style={{ background: bg, color: fg }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <p
          style={{
            ...textStyleToCSS(merged),
            textTransform: "uppercase",
          }}
        >
          {heading}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
          {logos.map((logo) => (
            <div
              key={logo.id}
              style={{
                height: logoHeight,
                opacity: logoOpacity,
                minWidth: 80,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {logo.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo.imageUrl}
                  alt={logo.alt}
                  style={{ height: "100%", width: "auto", objectFit: "contain" }}
                />
              ) : (
                <span className="text-xs" style={{ color: muted }}>
                  {logo.alt}
                </span>
              )}
            </div>
          ))}
        </div>
        <RenderInterludeBlocks blocks={interlude.afterCards} />
      </div>
    </section>
  );
}
