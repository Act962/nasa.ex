"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  MessageCircle,
  QrCode,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { useTrafegoPendingPurchase } from "@/features/trafego/hooks/use-trafego-purchase";
import type { TrafegoPixCharge } from "@/features/trafego/hooks/use-trafego-purchase";

const POLL_INTERVAL_MS = 5_000;

/**
 * Tela do PIX, em dois modos.
 *
 * Com cobrança no Asaas (`autoConfirms`), mostra o QR e o copia-e-cola, e a
 * confirmação chega pelo webhook em segundos. Sem ela, é o fluxo antigo: chave
 * estática da agência e comprovante pelo WhatsApp, confirmado por uma pessoa.
 *
 * O polling serve aos dois — o que muda é quanto tempo ele espera.
 */
export function PixInstructions({
  charge,
  pendingId,
}: {
  charge: TrafegoPixCharge;
  pendingId: string;
}) {
  const [copied, setCopied] = useState(false);
  const { data } = useTrafegoPendingPurchase(
    { pendingId },
    { refetchInterval: POLL_INTERVAL_MS },
  );

  const isConfirmed = data?.status === "PAID" || data?.status === "REDEEMED";

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // Com QR, o que se copia é o código da cobrança — ele já carrega valor e
  // identificação. Sem QR, resta a chave da agência.
  const copyValue = charge.qrPayload ?? charge.key ?? "";

  async function copyPixCode() {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (isConfirmed) {
    return (
      <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/[0.07] p-7 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/20">
          <Check className="size-6 text-emerald-300" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-white">
          Pagamento confirmado!
        </h2>
        <p className="mt-1.5 text-sm text-white/55">
          {data?.orderId
            ? "Sua nova campanha já está disponível no painel."
            : charge.autoConfirms
              ? "Recebemos seu PIX. Agora é criar sua senha para acessar o painel."
              : "Nossa equipe conferiu seu comprovante. Agora é criar sua senha para acessar o painel."}
        </p>
        <Link
          href={
            data?.orderId
              ? `/trafego/painel/${data.orderId}`
              : data?.signupToken
                ? `/trafego/ativar/${data.signupToken}`
                : `/trafego/sucesso?token=${pendingId}`
          }
          className="mt-6 inline-flex rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Acessar meu painel
        </Link>
      </div>
    );
  }

  const whatsappHref = charge.supportWhatsapp
    ? `https://wa.me/${charge.supportWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(charge.receiptMessage)}`
    : null;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
          <QrCode className="size-5 text-violet-300" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-white sm:text-xl">
            Falta pagar {formatBrlFromCents(charge.amountBrlCents)}
          </h2>
          <p className="mt-1 text-sm text-white/45">
            {charge.autoConfirms
              ? "Escaneie o QR ou use o copia e cola. A confirmação é automática."
              : "Pague na chave abaixo e mande o comprovante — a equipe confirma em horário comercial."}
          </p>
        </div>
      </div>

      {charge.qrImageBase64 && (
        <div className="mt-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- base64 do Asaas, sem URL para otimizar */}
          <img
            src={`data:image/png;base64,${charge.qrImageBase64}`}
            alt="QR Code para pagamento via PIX"
            className="size-56 rounded-2xl bg-white p-3"
          />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
          {charge.qrPayload ? "PIX copia e cola" : "Chave PIX"}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate text-base font-semibold text-white">
            {copyValue}
          </code>
          <button
            type="button"
            onClick={copyPixCode}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-medium text-white transition hover:bg-white/[0.1]"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-300" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>

        <dl className="mt-4 space-y-1.5 border-t border-white/[0.07] pt-3 text-xs">
          {!charge.autoConfirms && charge.holderName && (
            <Row label="Titular" value={charge.holderName} />
          )}
          {!charge.autoConfirms && charge.bankName && (
            <Row label="Banco" value={charge.bankName} />
          )}
          <Row
            label="Valor"
            value={formatBrlFromCents(charge.amountBrlCents)}
          />
          <Row label="Referência" value={charge.reference} mono />
        </dl>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] p-3.5">
        <Timer className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <p className="text-xs leading-relaxed text-amber-100">
          {charge.autoConfirms ? (
            <>Esta cobrança vale até </>
          ) : (
            <>
              Cite a referência <strong>{charge.reference}</strong> ao enviar o
              comprovante — é assim que achamos o seu pedido. A cobrança vale até{" "}
            </>
          )}
          <strong>
            {new Date(charge.expiresAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          .
        </p>
      </div>

      {!charge.autoConfirms && whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 text-sm font-semibold text-white transition hover:brightness-110"
        >
          <MessageCircle className="size-4" />
          Já paguei — enviar comprovante
        </a>
      )}

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-white/35">
        <Loader2 className="size-3.5 animate-spin" />
        {charge.autoConfirms
          ? "Esperando o pagamento cair — esta tela troca sozinha."
          : "Esta tela troca sozinha assim que confirmarmos o pagamento."}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-white/40">{label}</dt>
      <dd
        className={
          mono ? "font-mono font-semibold text-white" : "text-white/80"
        }
      >
        {value}
      </dd>
    </div>
  );
}
