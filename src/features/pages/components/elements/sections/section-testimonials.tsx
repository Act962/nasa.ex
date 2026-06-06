/**
 * Section Testimonials — grid responsivo de depoimentos.
 *
 * Personalização tipográfica:
 *   - O cabeçalho da section tem `headingStyle?: TextStyle` (no
 *     element).
 *   - Cada card tem `quoteStyle?`, `authorStyle?`, `roleStyle?`
 *     (override por card). Cai pra `quoteStyle`/`authorStyle`/`roleStyle`
 *     da section. Cai pros defaults aqui.
 *   - Cards também ganham `cardBg`, `cardBorder`, `cardRadius`,
 *     `cardPadding` opcionais (cada card sobrepõe os da section).
 *
 * Resolução via `resolveTextStyle(card, section, defaults)`. Pages
 * antigas continuam pixel-perfect (props undefined → fallback no
 * default, que copia o estilo anterior).
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
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
import { wrapCardWithAnimatedBorder } from "../animated-border";

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role?: string;
  avatar?: string;
  /** Overrides por card — sobrescrevem os da section. */
  quoteStyle?: TextStyle;
  authorStyle?: TextStyle;
  roleStyle?: TextStyle;
  /** Aparência do card individual. */
  cardBg?: string;
  cardBorder?: string;
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

  // Section-level styles (vêm direto do element JSON).
  const sectionHeadingStyle = element.headingStyle as TextStyle | undefined;
  const sectionQuoteStyle = element.quoteStyle as TextStyle | undefined;
  const sectionAuthorStyle = element.authorStyle as TextStyle | undefined;
  const sectionRoleStyle = element.roleStyle as TextStyle | undefined;

  // Defaults — preservam o look original quando NENHUM override existe.
  const headingDefaults: TextStyle = {
    color: fg,
    fontSize: 32,
    fontWeight: "900",
    align: "center",
  };
  const quoteDefaults: TextStyle = {
    color: fg,
    fontSize: 15,
    fontWeight: "400",
    italic: true,
    lineHeight: 1.6,
  };
  const authorDefaults: TextStyle = {
    color: fg,
    fontSize: 14,
    fontWeight: "700",
  };
  const roleDefaults: TextStyle = {
    color: muted,
    fontSize: 12,
    fontWeight: "400",
  };

  const headingMerged = resolveTextStyle(undefined, sectionHeadingStyle, headingDefaults);
  const sectionCardBg = (element.cardBg as string) ?? `${fg}05`;
  const sectionCardBorder = (element.cardBorder as string) ?? `${fg}15`;
  const cardRadius = (element.cardRadius as number) ?? 16;
  const cardPadding = (element.cardPadding as number) ?? 24;

  const interlude = (element.interlude as InterludeZones | undefined) ?? {};

  return (
    <section
      id={anchorId}
      className="w-full px-4 sm:px-6 lg:px-8 py-14 sm:py-20 scroll-mt-20"
      style={{ background: bg, color: fg }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-8 sm:gap-10">
        <RenderInterludeBlocks blocks={interlude.aboveHeading} />
        <h2 style={textStyleToCSS(headingMerged)}>{heading}</h2>
        <RenderInterludeBlocks blocks={interlude.betweenHeadingAndCards} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((card) => {
            const quoteMerged = resolveTextStyle(
              card.quoteStyle,
              sectionQuoteStyle,
              quoteDefaults,
            );
            const authorMerged = resolveTextStyle(
              card.authorStyle,
              sectionAuthorStyle,
              authorDefaults,
            );
            const roleMerged = resolveTextStyle(
              card.roleStyle,
              sectionRoleStyle,
              roleDefaults,
            );
            const cardInner = (
              <div
                className="border"
                style={{
                  background: card.cardBg ?? sectionCardBg,
                  borderColor: card.cardBorder ?? sectionCardBorder,
                  borderRadius: cardRadius,
                  padding: cardPadding,
                  width: "100%",
                  height: "100%",
                }}
              >
                <p style={{ ...textStyleToCSS(quoteMerged), marginBottom: 16 }}>
                  &ldquo;{card.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  {card.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.avatar}
                      alt={card.author}
                      className="w-10 h-10 rounded-full object-cover border-2"
                      style={{ borderColor: `${primary}40` }}
                    />
                  )}
                  <div>
                    <div style={textStyleToCSS(authorMerged)}>{card.author}</div>
                    {card.role && (
                      <div style={textStyleToCSS(roleMerged)}>{card.role}</div>
                    )}
                  </div>
                </div>
              </div>
            );
            return (
              <div key={card.id}>
                {wrapCardWithAnimatedBorder(element, cardInner)}
              </div>
            );
          })}
        </div>
        <RenderInterludeBlocks blocks={interlude.afterCards} />
      </div>
    </section>
  );
}
