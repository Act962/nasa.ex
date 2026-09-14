import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

/** Shell compartilhado por Termos e Política — mesma leitura, mesmo respiro. */
export function LegalPage({
  title,
  updatedAt,
  intro,
  sections,
}: {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="px-4 py-10 md:py-16">
      <article className="mx-auto max-w-2xl">
        <Link
          href="/trafego"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Voltar para o trafeGO
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-white md:text-3xl">{title}</h1>
        <p className="mt-1 text-xs text-white/40">
          Última atualização: {updatedAt}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-white/70">{intro}</p>

        <div className="mt-8 space-y-8">
          {sections.map((section, index) => (
            <section key={section.title}>
              <h2 className="text-base font-semibold text-white">
                {index + 1}. {section.title}
              </h2>
              <div className="mt-2 space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="text-sm leading-relaxed text-white/60"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-2 space-y-1.5">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet.slice(0, 40)}
                        className="flex gap-2 text-sm leading-relaxed text-white/60"
                      >
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-violet-400" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-10 border-t border-white/10 pt-6 text-xs text-white/35">
          Dúvidas sobre este documento? Fale com a gente pelo painel ou pelo
          WhatsApp de atendimento.
        </p>
      </article>
    </div>
  );
}
