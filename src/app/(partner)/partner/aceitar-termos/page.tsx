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
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
          <ScrollText className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-white">
            Termos do programa não publicados
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
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
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-amber-400" />
          Termos NASA Partner — versão {activeTerms.version}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {activeTerms.title}
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Sobre esta versão
          </h2>
          <p className="text-sm text-zinc-300 mt-1">
            Esta versão entrou em vigor em{" "}
            {new Date(activeTerms.effectiveAt).toLocaleDateString("pt-BR")}.
            {activeTerms.changeSummary && (
              <span className="block mt-2 text-zinc-400">
                <strong>Mudanças:</strong> {activeTerms.changeSummary}
              </span>
            )}
          </p>
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <h2 className="text-sm font-semibold text-white mb-2">
            Conteúdo dos termos
          </h2>
          <p className="text-sm text-zinc-400">
            Leia o conteúdo completo na trilha educacional{" "}
            <Link
              href="/space-help/nasa-partner-regras"
              className="text-amber-400 hover:text-amber-300 underline"
            >
              "NASA Partner — Regras, Privacidade e LGPD"
            </Link>{" "}
            antes de aceitar. Você é responsável por compreender as regras do
            programa, suas obrigações sobre dados das empresas indicadas, a
            política de privacidade e os deveres LGPD.
          </p>
        </div>

        {alreadyAccepted ? (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-4 text-center">
            <p className="text-sm text-emerald-300">
              ✅ Você já aceitou esta versão. Acesso liberado.
            </p>
            <Link
              href="/partner"
              className="inline-block mt-3 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg"
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
