import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

/** Shell de leitura dos documentos legais (Órbita e trafeGO). */
export function LegalPage({
  title,
  updatedAt,
  intro,
  sections,
  backHref,
  backLabel,
  footer,
  children,
}: {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
  backHref: string;
  backLabel: string;
  footer: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="px-4 py-10 md:py-16">
      <article className="mx-auto max-w-2xl">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-white md:text-3xl">{title}</h1>
        <p className="mt-1 text-xs text-white/40">Última atualização: {updatedAt}</p>
        <p className="mt-4 text-sm leading-relaxed text-white/70">{intro}</p>

        {children}

        <div className="mt-8 space-y-8">
          {sections.map((section, index) => (
            <section key={section.title}>
              <h2 className="text-base font-semibold text-white">
                {index + 1}. {section.title}
              </h2>
              <div className="mt-2 space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="text-sm leading-relaxed text-white/60">
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

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/35">{footer}</div>
      </article>
    </div>
  );
}
