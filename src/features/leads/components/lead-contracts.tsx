"use client";

/**
 * Aba "Contratos" dentro dos detalhes do lead. Lista ForgeContracts onde
 * este lead aparece como cliente (via ForgeProposal.clientId).
 */

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Badge } from "@/components/ui/badge";
import { FileSignature } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";

type Contract = {
  id: string;
  number: number;
  status: "ATIVO" | "ENCERRADO" | "CANCELADO" | "PENDENTE_ASSINATURA";
  startDate: Date;
  endDate: Date;
  value: string;
  proposalTitle: string | null;
  templateName: string | null;
};

const STATUS_STYLE: Record<
  Contract["status"],
  { label: string; className: string }
> = {
  ATIVO: {
    label: "Ativo",
    className: "text-success border-success/30 bg-success/10",
  },
  PENDENTE_ASSINATURA: {
    label: "Pendente assinatura",
    className: "text-warning border-warning/30 bg-warning/10",
  },
  ENCERRADO: {
    label: "Encerrado",
    className: "text-info border-info/30 bg-info/10",
  },
  CANCELADO: {
    label: "Cancelado",
    className: "text-destructive border-destructive/30 bg-destructive/10",
  },
};

interface Props {
  leadId: string;
}

export function LeadContracts({ leadId }: Props) {
  const { data, isLoading } = useQuery(
    orpc.payment.contracts.listActive.queryOptions({
      input: { leadId, includeAllStatuses: true },
    }),
  );

  const contracts = (data?.contracts ?? []) as Contract[];
  const active = contracts.filter((contract) => contract.status === "ATIVO");
  const totalActive = active.reduce(
    (acc, contract) => acc + Number.parseFloat(contract.value || "0"),
    0,
  );

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {active.length}{" "}
            {active.length === 1 ? "contrato ativo" : "contratos ativos"}
          </p>
          <p className="text-xl font-black text-success">
            R${" "}
            {totalActive.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <OrbitaSpinner className="size-4 " /> Carregando…
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-xl border border-border/40 py-10 text-center text-xs text-muted-foreground">
          Este lead ainda não tem contratos vinculados.
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className="rounded-xl border border-border/50 p-3 flex items-start justify-between gap-3 hover:bg-muted/20"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium flex items-center gap-1.5 truncate">
                  <FileSignature className="size-3.5 text-info" />#
                  {contract.number}
                  {contract.proposalTitle && (
                    <span className="text-xs text-muted-foreground truncate">
                      — {contract.proposalTitle}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(contract.startDate).toLocaleDateString("pt-BR")} –{" "}
                  {new Date(contract.endDate).toLocaleDateString("pt-BR")}
                  {contract.templateName && ` · ${contract.templateName}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge
                  variant="outline"
                  className={STATUS_STYLE[contract.status].className}
                >
                  {STATUS_STYLE[contract.status].label}
                </Badge>
                <p className="text-sm font-semibold tabular-nums text-success">
                  R${" "}
                  {Number.parseFloat(contract.value).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
