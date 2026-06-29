/**
 * Section FAQ — accordion responsivo com tipografia editável por item.
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

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  questionStyle?: TextStyle;
  answerStyle?: TextStyle;
  cardBg?: string;
  cardBorder?: string;
}

const DEFAULT_FAQ: FaqItem[] = [
  { id: "1", question: "Preciso de cartão de crédito pra começar?", answer: "Não. O plano Free é gratuito pra sempre." },
  { id: "2", question: "Como faço a migração dos meus dados?", answer: "Temos importadores nativos pra RD, Pipedrive e CSV. A primeira semana tem acompanhamento incluído." },
  { id: "3", question: "Posso cancelar a qualquer momento?", answer: "Sim. Cancelamento em 1 clique, sem multa ou retenção." },
];

export function SectionFaq({ element, tokens }: SectionRendererProps) {
  const heading = (element.heading as string) ?? "Perguntas frequentes";
  const items = (element.items as FaqItem[] | undefined) ?? DEFAULT_FAQ;
  const anchorId = (element.anchorId as string) ?? undefined;

  const primary = primaryColor(element, tokens);
  const bg = bgColor(element, tokens);
  const fg = fgColor(element, tokens);
  const muted = mutedColor(element, tokens);

  const sectionHeadingStyle = element.headingStyle as TextStyle | undefined;
  const sectionQuestionStyle = element.questionStyle as TextStyle | undefined;
  const sectionAnswerStyle = element.answerStyle as TextStyle | undefined;

  const headingDefaults: TextStyle = {
    color: fg,
    fontSize: 32,
    fontWeight: "900",
    align: "center",
  };
  const questionDefaults: TextStyle = {
    color: fg,
    fontSize: 15,
    fontWeight: "700",
  };
  const answerDefaults: TextStyle = {
    color: muted,
    fontSize: 14,
    lineHeight: 1.55,
  };

  const sectionCardBg = (element.cardBg as string) ?? `${fg}05`;
  const sectionCardBorder = (element.cardBorder as string) ?? `${fg}15`;
  const cardRadius = (element.cardRadius as number) ?? 12;
  const cardPadding = (element.cardPadding as number) ?? 20;

  const interlude = (element.interlude as InterludeZones | undefined) ?? {};

  return (
    <section
      id={anchorId}
      className="w-full px-4 sm:px-6 lg:px-8 py-14 sm:py-20 scroll-mt-20"
      style={{ background: bg, color: fg }}
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <RenderInterludeBlocks blocks={interlude.aboveHeading} />
        <h2 style={textStyleToCSS(resolveTextStyle(undefined, sectionHeadingStyle, headingDefaults))}>
          {heading}
        </h2>
        <RenderInterludeBlocks blocks={interlude.betweenHeadingAndCards} />

        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const questionMerged = resolveTextStyle(
              item.questionStyle,
              sectionQuestionStyle,
              questionDefaults,
            );
            const answerMerged = resolveTextStyle(
              item.answerStyle,
              sectionAnswerStyle,
              answerDefaults,
            );
            const itemInner = (
              <details
                className="cursor-pointer border"
                style={{
                  background: item.cardBg ?? sectionCardBg,
                  borderColor: item.cardBorder ?? sectionCardBorder,
                  borderRadius: cardRadius,
                  padding: cardPadding,
                  width: "100%",
                }}
              >
                <summary
                  className="flex items-center justify-between list-none"
                  style={textStyleToCSS(questionMerged)}
                >
                  <span className="pr-4">{item.question}</span>
                  <span className="text-lg shrink-0" style={{ color: primary }}>
                    +
                  </span>
                </summary>
                <p
                  className="mt-3 pt-3 border-t"
                  style={{
                    ...textStyleToCSS(answerMerged),
                    borderColor: `${fg}10`,
                  }}
                >
                  {item.answer}
                </p>
              </details>
            );
            return (
              <div key={item.id}>
                {wrapCardWithAnimatedBorder(element, itemInner)}
              </div>
            );
          })}
        </div>
        <RenderInterludeBlocks blocks={interlude.afterCards} />
      </div>
    </section>
  );
}
