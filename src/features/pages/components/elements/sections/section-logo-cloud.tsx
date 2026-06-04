/**
 * Section Logo Cloud — grid estático de logos de parceiros/marcas.
 * Editável: heading, lista de logos {imageUrl, alt}.
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

  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "40px 32px",
        background: bg,
        color: fg,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        overflow: "hidden",
      }}
    >
      <p
        style={{
          textAlign: "center",
          fontSize: 11,
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: muted,
          margin: 0,
        }}
      >
        {heading}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          flexWrap: "wrap",
        }}
      >
        {logos.map((l) => (
          <div
            key={l.id}
            style={{
              opacity: 0.6,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 80,
            }}
          >
            {l.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={l.imageUrl}
                alt={l.alt}
                style={{ height: "100%", width: "auto", objectFit: "contain" }}
              />
            ) : (
              <span style={{ color: muted, fontSize: 12 }}>{l.alt}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
