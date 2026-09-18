"use client";

import { CheckCircle2, Loader2, SearchCheck, TriangleAlert } from "lucide-react";
import { useCheckTrafegoWhatsappNumber } from "@/features/trafego/hooks/use-trafego-verification";
import { WhatsappWarmupNote } from "./whatsapp-warmup-note";
import { maskPhoneBr } from "@/features/form/lib/masks";

export type WhatsappNumberCheckResult =
  | {
      status: "found";
      phone: string;
      isBusiness: boolean;
      verifiedName: string | null;
      checkedAt: string;
    }
  | { status: "not_found"; phone: string; checkedAt: string }
  | { status: "skipped"; reason: string }
  | { status: "invalid_phone" };

/** 01B.1 — confere o número que o cliente já tem. */
export function WhatsappVerifyStep({
  number,
  onNumber,
  check,
  onCheck,
  checkEnabled,
}: {
  number: string;
  onNumber: (value: string) => void;
  check: WhatsappNumberCheckResult | null;
  onCheck: (value: WhatsappNumberCheckResult | null) => void;
  checkEnabled: boolean;
}) {
  const checkNumber = useCheckTrafegoWhatsappNumber();
  const digits = number.replace(/\D/g, "");

  function handleCheck() {
    if (digits.length < 10) return;
    checkNumber.mutate(
      { phone: number },
      { onSuccess: (result) => onCheck(result), onError: () => onCheck(null) },
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-white/55">
        Vamos verificar se o número existe na API Oficial da Meta.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white/70">
          🇧🇷 +55
        </span>
        <input
          value={number}
          onChange={(event) => {
            onNumber(maskPhoneBr(event.target.value));
            if (check) onCheck(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleCheck();
            }
          }}
          inputMode="tel"
          placeholder="(86) 99888-9999"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/60"
        />
        {checkEnabled && (
          <button
            type="button"
            onClick={handleCheck}
            disabled={digits.length < 10 || checkNumber.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {checkNumber.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SearchCheck className="size-4" />
            )}
            Verificar número
          </button>
        )}
      </div>

      {check?.status === "found" && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
          <div className="min-w-0 text-xs leading-relaxed">
            <p className="text-sm font-semibold text-emerald-200">
              Número ativo no WhatsApp!
            </p>
            <p className="mt-1 text-white/70">+{check.phone}</p>
            <p className="mt-0.5 text-white/45">
              {check.verifiedName ? (
                <>
                  Conta comercial verificada como{" "}
                  <strong className="text-white/70">{check.verifiedName}</strong>.
                  Confirmamos o vínculo com a API Oficial na análise da conta.
                </>
              ) : (
                <>
                  Ainda sem nome verificado. Confirmamos o vínculo com a API Oficial
                  na análise da conta.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {check?.status === "not_found" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] p-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <p className="text-xs leading-relaxed text-amber-100">
            Esse número não aparece no WhatsApp. Confira o DDD e o dígito 9 — ou
            volte e escolha <strong>&quot;preciso adquirir um novo número&quot;</strong>.
          </p>
        </div>
      )}

      {(check?.status === "skipped" || (!checkEnabled && digits.length >= 10)) && (
        <p className="text-xs text-white/35">
          Não deu para checar agora. Pode seguir — a equipe confere na análise da conta.
        </p>
      )}

      <WhatsappWarmupNote />
    </div>
  );
}
