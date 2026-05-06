"use client";

import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Card padrão pro chat do Astro quando o user tenta usar uma tool Meta Ads
 * mas não está autorizado. Mensagem fixa conforme aprovado no plano.
 */
export function AstroUnauthorizedCard({
  reason,
  message,
}: {
  reason?: "no_grant" | "revoked" | "mcp_disabled" | "not_member" | string;
  message?: string;
}) {
  const defaultMsg =
    reason === "mcp_disabled"
      ? "Astro Meta Ads ainda não foi habilitado nesta organização."
      : "Você não é autorizado a realizar essa operação.";
  const helper =
    reason === "mcp_disabled"
      ? "Peça ao Master ou Moderador pra habilitar em Integrações → Meta → Astro + IA."
      : "Peça ao Master ou Moderador da organização pra liberar o uso do Astro Meta Ads.";

  return (
    <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 shrink-0">
          <Lock className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{message ?? defaultMsg}</p>
          <p className="text-xs text-muted-foreground mt-1">{helper}</p>
          <div className="mt-2">
            <Button asChild size="sm" variant="outline" className="text-xs h-7">
              <Link href="/integrations">Abrir Integrações</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
