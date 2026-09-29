import type { ReactNode } from "react";
import Link from "next/link";
import { LegalPage, type LegalSection } from "./legal-page";
import { ORBITA_CONTACT_EMAIL, ORBITA_LEGAL_URLS } from "@/features/legal/lib/orbita-legal";
import {
  getLatestRevisionDate,
  listLegalChanges,
} from "@/features/legal/lib/orbita-legal-revisions";

const footerLinkClassName = "underline underline-offset-2 hover:text-white/70";

export function OrbitaLegalPage({
  title,
  intro,
  sections,
  children,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
  children?: ReactNode;
}) {
  return (
    <LegalPage
      title={title}
      updatedAt={getLatestRevisionDate()}
      intro={intro}
      sections={sections}
      backHref="/"
      backLabel="Voltar para o Órbita"
      footer={
        <>
          <LegalChangeHistory />
          <p>
            Dúvidas sobre este documento? Escreva para{" "}
            <a href={`mailto:${ORBITA_CONTACT_EMAIL}`} className={footerLinkClassName}>
              {ORBITA_CONTACT_EMAIL}
            </a>
            .
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Link href={ORBITA_LEGAL_URLS.privacy} className={footerLinkClassName}>
              Política de Privacidade
            </Link>
            <Link href={ORBITA_LEGAL_URLS.cookies} className={footerLinkClassName}>
              Política de Cookies
            </Link>
            <Link href={ORBITA_LEGAL_URLS.terms} className={footerLinkClassName}>
              Termos de uso
            </Link>
          </p>
        </>
      }
    >
      {children}
    </LegalPage>
  );
}

const MAX_VISIBLE_CHANGES = 10;

function LegalChangeHistory() {
  const changes = listLegalChanges().slice(0, MAX_VISIBLE_CHANGES);
  if (changes.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
        Histórico de alterações
      </h2>
      <ul className="mt-2 space-y-2">
        {changes.map((change) => (
          <li key={change.date} className="text-xs leading-relaxed text-white/45">
            <span className="font-medium text-white/60">{change.date}:</span>{" "}
            {[
              change.added.length > 0 ? `incluídos ${change.added.join(", ")}` : null,
              change.removed.length > 0 ? `removidos ${change.removed.join(", ")}` : null,
            ]
              .filter(Boolean)
              .join("; ") || "descrições atualizadas"}
          </li>
        ))}
      </ul>
    </section>
  );
}
