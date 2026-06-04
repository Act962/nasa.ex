/**
 * Section Testimonials — grid de depoimentos com avatar + quote + nome.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionRendererProps,
} from "./types";

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role?: string;
  avatar?: string;
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    quote: "Em 2 meses, dobrei minha conversão. O processo virou um só.",
    author: "Mariana F.",
    role: "Studio MF Design",
    avatar: "https://i.pravatar.cc/120?img=5",
  },
  {
    id: "2",
    quote: "Saí de 7 ferramentas pra uma. Time inteiro agradeceu.",
    author: "Rafael Lima",
    role: "Lima Consultoria",
    avatar: "https://i.pravatar.cc/120?img=11",
  },
  {
    id: "3",
    quote: "A IA conhece o histórico de cada cliente. Game changer.",
    author: "Ana Carvalho",
    role: "AC Imóveis",
    avatar: "https://i.pravatar.cc/120?img=20",
  },
];

export function SectionTestimonials({ element, tokens }: SectionRendererProps) {
  const heading = (element.heading as string) ?? "O que dizem por aí";
  const testimonials =
    (element.testimonials as Testimonial[] | undefined) ?? DEFAULT_TESTIMONIALS;

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "56px 32px",
        background: bg,
        color: fg,
        display: "flex",
        flexDirection: "column",
        gap: 32,
        overflow: "hidden",
      }}
    >
      <h2
        style={{
          fontSize: 32,
          fontWeight: 900,
          textAlign: "center",
          margin: 0,
        }}
      >
        {heading}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`,
          gap: 16,
        }}
      >
        {testimonials.map((t) => (
          <div
            key={t.id}
            style={{
              padding: 24,
              borderRadius: 16,
              background: `${fg}05`,
              border: `1px solid ${fg}15`,
            }}
          >
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: fg,
                margin: 0,
                marginBottom: 16,
                fontStyle: "italic",
              }}
            >
              “{t.quote}”
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {t.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.avatar}
                  alt={t.author}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: `2px solid ${primary}40`,
                  }}
                />
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t.author}</div>
                {t.role && (
                  <div style={{ fontSize: 12, color: muted }}>{t.role}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
