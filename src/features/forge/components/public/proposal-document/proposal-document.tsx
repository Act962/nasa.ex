"use client";

import { useState } from "react";
import { Check, CheckCircle2, Download, Link2 } from "lucide-react";
import { proposalColorVariables, type ProposalLook, type ProposalSectionId } from "@/features/forge/lib/proposal-look";
import { DocumentFooter, DocumentHeader, DocumentTitle } from "./header-footer";
import {
  ClientSection,
  CtaSection,
  DescriptionSection,
  ItemsSection,
  PaymentSection,
  ResponsibleSection,
  TermsSection,
  TotalsSection,
} from "./sections";
import type { DocumentProposal, DocumentState, SectionProps } from "./types";

const SECTION_COMPONENTS: Record<ProposalSectionId, (props: SectionProps) => React.ReactNode> = {
  client: ClientSection,
  description: DescriptionSection,
  items: ItemsSection,
  totals: TotalsSection,
  payment: PaymentSection,
  terms: TermsSection,
  responsible: ResponsibleSection,
  cta: CtaSection,
};

function ActionBar({ isPreview }: { isPreview: boolean }) {
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const copyLink = async () => {
    if (isPreview) return;
    await navigator.clipboard.writeText(window.location.href);
    setIsLinkCopied(true);
    setTimeout(() => setIsLinkCopied(false), 2000);
  };
  const buttonClass =
    "flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50";
  return (
    <div className="forge-no-print mx-auto flex max-w-5xl justify-end gap-2 px-4 pt-4">
      <button type="button" onClick={copyLink} className={buttonClass}>
        {isLinkCopied ? <Check className="size-4" /> : <Link2 className="size-4" />}
        {isLinkCopied ? "Link copiado" : "Copiar link"}
      </button>
      <button type="button" onClick={() => !isPreview && window.print()} className={buttonClass}>
        <Download className="size-4" /> Salvar como PDF
      </button>
    </div>
  );
}

/**
 * Página da proposta no visual escolhido pela empresa (spec 0150). Usa consultas de contêiner (`@3xl:`) em vez da largura
 * da tela, para a prévia "ver como celular" da configuração ficar igual ao celular de verdade.
 */
export function ProposalDocument({
  proposal,
  look,
  state,
}: {
  proposal: DocumentProposal;
  look: ProposalLook;
  state: DocumentState;
}) {
  const props: SectionProps = { proposal, look, state };
  const sectionGap = look.template === "compact" ? "space-y-5" : "space-y-7";
  return (
    <div className="@container min-h-full bg-neutral-100 pb-8 text-neutral-900" style={proposalColorVariables(look) as React.CSSProperties}>
      {state.isExpired && !state.isPaid ? (
        <div className="bg-amber-100 px-4 py-2.5 text-center text-sm font-semibold text-amber-900">Esta proposta expirou.</div>
      ) : null}
      {state.isPaid ? (
        <div className="bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--accent-ink)]">
          <CheckCircle2 className="mr-1.5 inline size-4" /> Pagamento confirmado. Obrigado!
        </div>
      ) : null}
      <ActionBar isPreview={state.isPreview} />
      <article className="mx-auto mt-3 max-w-5xl overflow-hidden bg-white shadow-[0_10px_40px_rgba(20,20,43,0.08)] @3xl:mx-4 @3xl:rounded-2xl @5xl:mx-auto">
        <DocumentHeader {...props} />
        <div className={`px-5 @3xl:px-10 ${sectionGap}`}>
          <DocumentTitle {...props} />
          {look.sections
            .filter((section) => section.enabled)
            .map((section) => {
              const Section = SECTION_COMPONENTS[section.id];
              return <Section key={section.id} {...props} />;
            })}
        </div>
        <DocumentFooter {...props} />
      </article>
    </div>
  );
}
