/**
 * Section FAQ — perguntas frequentes em formato accordion.
 * Estado expandido controlado por <details> nativo (sem JS).
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
  {
    id: "1",
    question: "Preciso de cartão de crédito pra começar?",
    answer: "Não. O plano Free é gratuito pra sempre.",
  },
  {
    id: "2",
    question: "Como faço a migração dos meus dados?",
    answer:
      "Temos importadores nativos pra RD, Pipedrive e CSV. A primeira semana tem acompanhamento incluído.",
  },
  {
    id: "3",
    question: "Posso cancelar a qualquer momento?",
    answer: "Sim. Cancelamento em 1 clique, sem multa ou retenção.",
  },
];

export function SectionFaq({ element, tokens }: SectionRendererProps) {
  const heading = (element.heading as string) ?? "Perguntas frequentes";
  const items = (element.items as FaqItem[] | undefined) ?? DEFAULT_FAQ;

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
        gap: 24,
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
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 700,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {items.map((item) => (
          <details
            key={item.id}
            style={{
              padding: 16,
              borderRadius: 12,
              background: `${fg}05`,
              border: `1px solid ${fg}15`,
              cursor: "pointer",
            }}
          >
            <summary
              style={{
                fontWeight: 700,
                fontSize: 15,
                listStyle: "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: fg,
              }}
            >
              {item.question}
              <span style={{ color: primary, fontSize: 18 }}>+</span>
            </summary>
            <p
              style={{
                marginTop: 12,
                fontSize: 14,
                color: muted,
                lineHeight: 1.5,
                margin: 0,
                paddingTop: 12,
              }}
            >
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
