"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Users } from "lucide-react";

/**
 * Aviso de contatos vindos de /contatos.
 *
 * A seleção chega pela URL e fica visível até virar campanha — sem isto o
 * usuário clica em "Disparar mensagens", cai numa lista de campanhas e perde
 * o que tinha acabado de escolher.
 *
 * Disparo em massa exige WhatsApp Oficial (`META_CLOUD`). Quando a
 * organização não tem número, o caminho de contratar fica aqui, no momento em
 * que a falta aparece — não escondido numa tela de configuração.
 */
export function IncomingSelectionBanner() {
  const params = useSearchParams();
  const leads = (params.get("leads") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const { data: numbers, isLoading } = useQuery({
    ...orpc.campanhas.listSendingNumbers.queryOptions(),
    enabled: leads.length > 0,
  });

  if (leads.length === 0) return null;

  const hasOfficialNumber = (numbers ?? []).some(
    (number) => number.status === "CONNECTED",
  );

  return (
    <div className="mb-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Users className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {leads.length} {leads.length === 1 ? "contato" : "contatos"} de Contatos
          </p>
          <p className="text-sm text-muted-foreground">
            Crie a campanha abaixo e eles entram como destinatários.
          </p>
        </div>
      </div>

      {!isLoading && !hasOfficialNumber && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle className="size-4 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-sm">
            Disparo em massa precisa de um número do WhatsApp Oficial. Sua
            organização ainda não tem um conectado.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/integrations">
              Contratar número
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
