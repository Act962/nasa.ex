import { AlertTriangle } from "lucide-react";

/**
 * Banner amarelo no topo do evento quando `isDisputed=true`. Aparece
 * pra qualquer visitante sinalizando que há reivindicação contestada
 * ou denúncias acumuladas — admin ainda não decidiu.
 *
 * NÃO esconde o evento — só sinaliza visualmente.
 */
export function DisputedBanner({
  reason,
}: {
  reason: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-400/60 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="text-xs leading-relaxed">
        <strong>Ownership contestado.</strong> Este evento foi reivindicado
        por outra parte e está em análise.
        {reason && (
          <>
            <br />
            <span className="opacity-80">{reason}</span>
          </>
        )}
      </div>
    </div>
  );
}
