"use client";

import { CheckCircle2, Rocket, ShieldCheck } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";
import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import { isOrderActivatable } from "@/features/trafego/lib/order-status";
import { TechnicalTerm } from "../technical-term";

interface OrderStatusNoticesProps {
  status: TrafegoOrderStatus;
  canActivate: boolean;
  pendingReasons: string[];
  isActivating: boolean;
  onActivate: () => void;
}

/** Ativação e avisos da fase atual, logo abaixo do progresso. */
export function OrderStatusNotices({
  status,
  canActivate,
  pendingReasons,
  isActivating,
  onActivate,
}: OrderStatusNoticesProps) {
  return (
    <>
      {isOrderActivatable(status) && (
        <div className="mt-5 rounded-[20px] border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {canActivate
                  ? "Tudo pronto para a equipe assumir"
                  : "Falta pouco para ativar"}
              </p>
              <p className="text-xs text-muted-foreground">
                {canActivate
                  ? "Ao ativar, sua campanha entra na fila da nossa equipe."
                  : `Para ativar: ${pendingReasons.join(", ")}.`}
              </p>
            </div>
            <Button
              type="button"
              onClick={onActivate}
              disabled={!canActivate || isActivating}
              className="h-11 w-full shrink-0 rounded-full sm:h-9 sm:w-auto"
            >
              {isActivating ? (
                <OrbitaSpinner className="mr-1.5 size-4" />
              ) : (
                <Rocket className="mr-1.5 size-4" />
              )}
              Ativar campanha
            </Button>
          </div>
        </div>
      )}

      {status === "ACCOUNT_REVIEW" && (
        <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-info/30 bg-info/15 p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              Estamos analisando sua conta de anúncios
              <TechnicalTerm term="adAccount" />
            </p>
            <p className="text-xs text-muted-foreground">
              Se você já tem BM
              <TechnicalTerm term="bm" />, adicione a Órbita como parceira —
              enviamos o passo a passo por WhatsApp e e-mail. Enquanto isso,
              envie as imagens ou vídeos
              <TechnicalTerm term="creative" /> e o texto do anúncio
              <TechnicalTerm term="copy" />: quando a conta for liberada, é só
              ativar.
            </p>
          </div>
        </div>
      )}

      {status === "REQUESTED" && (
        <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-success/30 bg-success/15 p-4">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Recebemos sua campanha</p>
            <p className="text-xs text-muted-foreground">
              Nossa equipe está revisando os materiais. Você é avisado por aqui
              a cada mudança.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
