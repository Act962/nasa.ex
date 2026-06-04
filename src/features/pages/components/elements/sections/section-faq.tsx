/**
 * Section FAQ — accordion responsivo.
 */
import {
  bgColor,
  fgColor,
  mutedColor,
  primaryColor,
  type SectionRendererProps,
} from "./types";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const DEFAULT_FAQ: FaqItem[] = [
  { id: "1", question: "Preciso de cartão de crédito pra começar?", answer: "Não. O plano Free é gratuito pra sempre." },
  { id: "2", question: "Como faço a migração dos meus dados?", answer: "Temos importadores nativos pra RD, Pipedrive e CSV. A primeira semana tem acompanhamento incluído." },
  { id: "3", question: "Posso cancelar a qualquer momento?", answer: "Sim. Cancelamento em 1 clique, sem multa ou retenção." },
];

export function SectionFaq({ element, tokens }: SectionRendererProps) {
  const heading = (element.heading as string) ?? "Perguntas frequentes";
  const items = (element.items as FaqItem[] | undefined) ?? DEFAULT_FAQ;
  // `anchorId` permite navbar/botões linkarem aqui via #faq.
  // Antes esse campo era escrito pelo editor mas ignorado.
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
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center">
          {heading}
        </h2>

        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <details
              key={item.id}
              className="p-4 sm:p-5 rounded-xl border cursor-pointer"
              style={{ background: `${fg}05`, borderColor: `${fg}15` }}
            >
              <summary
                className="font-bold text-sm sm:text-base flex items-center justify-between list-none"
                style={{ color: fg }}
              >
                <span className="pr-4">{item.question}</span>
                <span className="text-lg shrink-0" style={{ color: primary }}>
                  +
                </span>
              </summary>
              <p
                className="mt-3 pt-3 text-xs sm:text-sm leading-relaxed border-t"
                style={{ color: muted, borderColor: `${fg}10` }}
              >
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
