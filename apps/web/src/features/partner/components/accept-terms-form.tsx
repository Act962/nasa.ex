"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { client as orpc } from "@/lib/orpc";
import { Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";

export function AcceptTermsForm({
  termsVersionId,
  version,
}: {
  termsVersionId: string;
  version: string;
}) {
  const [agreed, setAgreed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onAccept = () => {
    startTransition(async () => {
      try {
        await orpc.partner.acceptTerms({ termsVersionId });
        toast.success(`Termos v${version} aceitos com sucesso 🚀`);
        router.push("/partner");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao aceitar";
        toast.error(msg);
      }
    });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-4 h-4 accent-amber-500 cursor-pointer"
        />
        <span className="text-sm text-zinc-200">
          Li e concordo com as <strong>Regras do Programa NASA Partner</strong>,
          a <strong>Política de Privacidade</strong> e estou ciente das minhas
          responsabilidades sob a <strong>LGPD</strong>, incluindo
          confidencialidade dos dados das empresas indicadas, vedação de uso
          comercial dos dados visualizados e dever de reportar incidentes de
          segurança.
        </span>
      </label>

      <button
        onClick={onAccept}
        disabled={!agreed || isPending}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Registrando aceite...
          </>
        ) : (
          <>
            <ScrollText className="w-4 h-4" /> Aceitar e continuar
          </>
        )}
      </button>
    </div>
  );
}
