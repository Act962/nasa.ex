"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useWebPush } from "../hooks/use-web-push";
import { cn } from "@/lib/utils";

/**
 * Botão de ligar/desligar Web Push neste dispositivo (spec 0022).
 *
 * Genérico: não cita caso de uso. O pedido de permissão sai daqui, por clique
 * explícito — pedir no load queimaria a chance para sempre naquele browser
 * quando o usuário negasse (spec 0022, risco 1).
 */
export function PushToggle({ className }: { className?: string }) {
  const {
    availability,
    permission,
    isSubscribed,
    isLoading,
    isPending,
    error,
    subscribe,
    unsubscribe,
  } = useWebPush();

  // Enquanto lê o estado do browser não há o que mostrar, e navegador sem
  // suporte não ganha um botão que não funciona (CB-1, CB-13).
  if (isLoading || availability !== "ready") return null;

  const isBlocked = permission === "denied";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={() => (isSubscribed ? unsubscribe() : subscribe())}
        disabled={isPending || isBlocked}
        title={
          isBlocked
            ? "Notificações bloqueadas nas permissões do navegador."
            : undefined
        }
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isSubscribed
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            : "border-white/15 text-white/70 hover:border-white/30 hover:text-white",
        )}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="size-4" />
        ) : (
          <BellOff className="size-4" />
        )}
        {isBlocked
          ? "Notificações bloqueadas"
          : isSubscribed
            ? "Notificações ativas"
            : "Ativar notificações"}
      </button>

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
