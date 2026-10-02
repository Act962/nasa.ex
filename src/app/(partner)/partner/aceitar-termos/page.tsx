import { requirePartnerSession } from "@/features/partner/lib/partner-utils";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { AcceptTermsForm } from "@/features/partner/components/accept-terms-form";

export default async function AcceptTermsPage() {
  const { partner } = await requirePartnerSession({ skipTermsCheck: true });

  const activeTerms = await prisma.partnerTermsVersion.findFirst({
    where: { isActive: true },
    orderBy: { effectiveAt: "desc" },
  });

  if (!activeTerms) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="bg-card border border-line rounded-xl p-6 text-center">
          <ScrollText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-lg font-bold text-foreground">
            Termos do programa não publicados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            O administrador ainda não publicou a versão ativa dos termos.
            Aguarde para acessar o painel.
          </p>
        </div>
      </div>
    );
  }

  // Já aceitou esta versão?
  const alreadyAccepted = partner.acceptedTermsVersionId === activeTerms.id;

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-muted-foreground" />
          Termos ÓRBITA Partner — versão {activeTerms.version}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activeTerms.title}
        </p>
      </div>

      <div className="bg-card border border-line rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Sobre esta versão
          </h2>
          <p className="text-sm text-foreground mt-1">
            Esta versão entrou em vigor em{" "}
            {new Date(activeTerms.effectiveAt).toLocaleDateString("pt-BR")}.
            {activeTerms.changeSummary && (
              <span className="block mt-2 text-muted-foreground">
                <strong>Mudanças:</strong> {activeTerms.changeSummary}
              </span>
            )}
          </p>
        </div>

        <div className="border-t border-line pt-4">
          <h2 className="text-sm font-semibold text-foreground mb-2">
            Conteúdo dos termos
          </h2>
          <p className="text-sm text-muted-foreground">
            Leia o conteúdo completo na trilha educacional{" "}
            <Link
              href="/space-help/nasa-partner-regras"
              className="text-info hover:underline underline"
            >
              "ÓRBITA Partner — Regras, Privacidade e LGPD"
            </Link>{" "}
            antes de aceitar. Você é responsável por compreender as regras do
            programa, suas obrigações sobre dados das empresas indicadas, a
            política de privacidade e os deveres LGPD.
          </p>
        </div>

        {alreadyAccepted ? (
          <div className="bg-success/15 border border-success/30 rounded-lg p-4 text-center">
            <p className="text-sm text-success">
              ✅ Você já aceitou esta versão. Acesso liberado.
            </p>
            <Link
              href="/partner"
              className="inline-block mt-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-full"
            >
              Ir para o painel
            </Link>
          </div>
        ) : (
          <AcceptTermsForm
            termsVersionId={activeTerms.id}
            version={activeTerms.version}
          />
        )}
      </div>
    </div>
  );
}
