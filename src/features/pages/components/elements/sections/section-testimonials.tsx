/**
 * Section Testimonials — grid responsivo de depoimentos.
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
  { id: "1", quote: "Em 2 meses, dobrei minha conversão. O processo virou um só.", author: "Mariana F.", role: "Studio MF Design", avatar: "https://i.pravatar.cc/120?img=5" },
  { id: "2", quote: "Saí de 7 ferramentas pra uma. Time inteiro agradeceu.", author: "Rafael Lima", role: "Lima Consultoria", avatar: "https://i.pravatar.cc/120?img=11" },
  { id: "3", quote: "A IA conhece o histórico de cada cliente. Game changer.", author: "Ana Carvalho", role: "AC Imóveis", avatar: "https://i.pravatar.cc/120?img=20" },
];

export function SectionTestimonials({ element, tokens }: SectionRendererProps) {
  const heading = (element.heading as string) ?? "O que dizem por aí";
  const testimonials =
    (element.testimonials as Testimonial[] | undefined) ?? DEFAULT_TESTIMONIALS;
  const anchorId = (element.anchorId as string) ?? undefined;

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  return (
    <section
      id={anchorId}
      className="w-full px-4 sm:px-6 lg:px-8 py-14 sm:py-20 scroll-mt-20"
      style={{ background: bg, color: fg }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8 sm:gap-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center">
          {heading}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="p-5 sm:p-6 rounded-2xl border"
              style={{ background: `${fg}05`, borderColor: `${fg}15` }}
            >
              <p
                className="text-sm sm:text-base leading-relaxed mb-4 italic"
                style={{ color: fg }}
              >
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                {t.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.avatar}
                    alt={t.author}
                    className="w-10 h-10 rounded-full object-cover border-2"
                    style={{ borderColor: `${primary}40` }}
                  />
                )}
                <div>
                  <div className="text-sm font-bold" style={{ color: fg }}>
                    {t.author}
                  </div>
                  {t.role && (
                    <div className="text-xs" style={{ color: muted }}>
                      {t.role}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
