/**
 * Section Logo Cloud — grid responsivo de logos.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  type SectionRendererProps,
} from "./types";

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

  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  return (
    <section
      id={anchorId}
      className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 scroll-mt-20"
      style={{ background: bg, color: fg }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <p
          className="text-center text-[10px] sm:text-xs tracking-[0.25em] uppercase"
          style={{ color: muted }}
        >
          {heading}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
          {logos.map((l) => (
            <div
              key={l.id}
              className="h-7 sm:h-8 opacity-60 flex items-center justify-center min-w-[80px]"
            >
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.imageUrl}
                  alt={l.alt}
                  className="h-full w-auto object-contain"
                />
              ) : (
                <span className="text-xs" style={{ color: muted }}>
                  {l.alt}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
