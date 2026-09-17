"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  RotateCcw,
  SearchCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useConfirmTrafegoPhoneVerification,
  useCheckTrafegoWhatsappNumber,
  useStartTrafegoPhoneVerification,
} from "@/features/trafego/hooks/use-trafego-verification";

export type PhoneVerificationStatus =
  | "idle"
  | "sent"
  | "verified"
  | "unavailable";

interface PhoneVerificationProps {
  phone: string;
  status: PhoneVerificationStatus;
  onStatusChange: (status: PhoneVerificationStatus) => void;
  /** false quando não há instância para enviar o código — não bloqueia. */
  enabled: boolean;
  /** Consulta a Uazapi para impedir números que não existem no WhatsApp. */
  numberCheckEnabled: boolean;
}

/**
 * Confirma que o WhatsApp de contato é do cliente: código de 6 dígitos
 * enviado pelo número da equipe. Se o envio não estiver disponível, o
 * wizard segue e a equipe vê "não verificado" no card.
 */
export function PhoneVerification({
  phone,
  status,
  onStatusChange,
  enabled,
  numberCheckEnabled,
}: PhoneVerificationProps) {
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const start = useStartTrafegoPhoneVerification();
  const confirm = useConfirmTrafegoPhoneVerification();
  const checkNumber = useCheckTrafegoWhatsappNumber();

  const digits = phone.replace(/\D/g, "");
  const canSend =
    digits.length >= 10 &&
    cooldown === 0 &&
    !start.isPending &&
    !checkNumber.isPending;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  if (!enabled && !numberCheckEnabled) {
    return (
      <p className="mt-1.5 text-xs text-white/40">
        Confirmamos seu WhatsApp por mensagem depois do pagamento.
      </p>
    );
  }

  if (status === "verified") {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
        <CheckCircle2 className="size-3.5" />
        WhatsApp verificado
      </p>
    );
  }

  function sendCode() {
    setMessage(null);
    start.mutate(
      { phone },
      {
        onSuccess: (result) => {
          if (result.status === "sent") {
            onStatusChange("sent");
            setCooldown(60);
            setMessage(
              `Código enviado para o WhatsApp ${maskPhone(result.phone)}.`,
            );
          } else if (result.status === "cooldown") {
            onStatusChange("sent");
            setCooldown(result.retryInSeconds);
            setMessage("Já enviamos um código há pouco — confira o WhatsApp.");
          } else if (result.status === "invalid_phone") {
            setMessage("Confira o número: precisa ter DDD.");
          } else {
            onStatusChange("unavailable");
            setMessage(
              "Não conseguimos enviar o código agora. Pode continuar — confirmamos depois.",
            );
          }
        },
        onError: (error) => setMessage(error.message),
      },
    );
  }

  function handleSend() {
    setMessage(null);
    if (!numberCheckEnabled) {
      sendCode();
      return;
    }

    checkNumber.mutate(
      { phone },
      {
        onSuccess: (result) => {
          if (result.status === "not_found") {
            onStatusChange("idle");
            setMessage(
              "Esse número não foi encontrado no WhatsApp. Confira o DDD e o dígito 9.",
            );
            return;
          }
          if (result.status === "invalid_phone") {
            onStatusChange("idle");
            setMessage("Confira o número: precisa ser um celular com DDD.");
            return;
          }
          if (result.status === "found" && !enabled) {
            setMessage(
              result.verifiedName
                ? `Número ativo no WhatsApp · ${result.verifiedName}.`
                : "Número ativo no WhatsApp.",
            );
            return;
          }
          if (result.status === "skipped" && !enabled) {
            onStatusChange("unavailable");
            setMessage(
              "Não conseguimos consultar agora. Pode continuar — a equipe confirma depois.",
            );
            return;
          }
          sendCode();
        },
        onError: (error) => setMessage(error.message),
      },
    );
  }

  function handleConfirm() {
    setMessage(null);
    confirm.mutate(
      { phone, code },
      {
        onSuccess: (result) => {
          if (result.status === "verified") {
            onStatusChange("verified");
            return;
          }
          setMessage(
            result.status === "expired"
              ? "Código expirado. Peça um novo."
              : result.status === "no_code"
                ? "Nenhum código pendente — peça um novo."
                : "Código incorreto. Confira no WhatsApp.",
          );
        },
        onError: (error) => setMessage(error.message),
      },
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      {status !== "sent" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSend}
            disabled={!canSend}
            className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          >
            {start.isPending || checkNumber.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : !enabled ? (
              <SearchCheck className="mr-1.5 size-4" />
            ) : (
              <MessageCircle className="mr-1.5 size-4" />
            )}
            {enabled ? "Verificar por WhatsApp" : "Validar número"}
          </Button>
          <span className="text-xs text-white/45">
            {status === "unavailable"
              ? "Verificação indisponível agora — pode continuar."
              : enabled
                ? "Enviamos um código de 6 dígitos para este número."
                : "Confirmamos se o número está ativo no WhatsApp."}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && code.length === 6) {
                event.preventDefault();
                handleConfirm();
              }
            }}
            inputMode="numeric"
            placeholder="000000"
            className="w-32 border-white/10 bg-white/5 text-center font-mono text-lg tracking-[0.3em] text-white placeholder:text-white/20"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={code.length !== 6 || confirm.isPending}
            className="bg-violet-600 hover:bg-violet-500"
          >
            {confirm.isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : null}
            Confirmar
          </Button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="inline-flex items-center gap-1 text-xs text-white/50 transition hover:text-white/80 disabled:opacity-50"
          >
            <RotateCcw className="size-3" />
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar"}
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-xs text-white/60">{message}</p>}
    </div>
  );
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8
    ? `${digits.slice(0, -8).replace(/\d(?=\d{2})/g, "•")}••••-${digits.slice(-4)}`
    : phone;
}
