"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLeads } from "@/hooks/use-lead";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../ui/skeleton";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle } from "lucide-react";

export function LeadModal() {
  const lead = useLeads();

  const { data, isLoading, error } = useQuery(
    orpc.leads.get.queryOptions({
      input: {
        id: lead.lead?.id,
      },
      enabled: lead.isOpen && !!lead.lead?.id,
    })
  );

  return (
    <Dialog open={lead.isOpen} onOpenChange={lead.onClose}>
      <DialogContent className="w-full md:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {/* ✅ Mostra o nome do lead do estado inicial enquanto carrega */}
            {isLoading ? "Carregando..." : data?.lead.name || lead.lead?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[200px]">
          {/* ✅ Estado de Loading */}
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          )}

          {/* ✅ Estado de Erro */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Erro ao carregar lead. Tente novamente.
              </AlertDescription>
            </Alert>
          )}

          {/* ✅ Dados do Lead */}
          {!isLoading && !error && data?.lead && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Informações</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Nome:</strong> {data.lead.name}
                  </p>
                  {data.lead.email && (
                    <p>
                      <strong>Email:</strong> {data.lead.email}
                    </p>
                  )}
                  {data.lead.phone && (
                    <p>
                      <strong>Telefone:</strong> {data.lead.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
