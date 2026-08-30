"use client";

/**
 * Aba "Contratos Ativos" do Payment. Lista ForgeContract com status ATIVO
 * da org corrente, com filtro por lead e busca por título/número.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, FileSignature, Loader2, ExternalLink } from "lucide-react";

type ContractRow = {
  id: string;
  number: number;
  status: "ATIVO" | "ENCERRADO" | "CANCELADO" | "PENDENTE_ASSINATURA";
  startDate: Date;
  endDate: Date;
  value: string;
  proposalTitle: string | null;
  proposalNumber: number | null;
  clientLeadId: string | null;
  clientName: string | null;
  templateName: string | null;
  createdAt: Date;
};

const STATUS_STYLE: Record<
  ContractRow["status"],
  { label: string; className: string }
> = {
  ATIVO: {
    label: "Ativo",
    className: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  },
  PENDENTE_ASSINATURA: {
    label: "Pendente",
    className: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  },
  ENCERRADO: {
    label: "Encerrado",
    className: "text-blue-500 border-blue-500/30 bg-blue-500/10",
  },
  CANCELADO: {
    label: "Cancelado",
    className: "text-red-500 border-red-500/30 bg-red-500/10",
  },
};

export function ContractsTab() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery(
    orpc.payment.contracts.listActive.queryOptions({
      input: { search: search || undefined },
    }),
  );

  const contracts = (data?.contracts ?? []) as ContractRow[];

  const totalValue = contracts.reduce(
    (acc, contract) => acc + Number.parseFloat(contract.value || "0"),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {contracts.length}{" "}
            {contracts.length === 1 ? "contrato ativo" : "contratos ativos"}
          </p>
          <p className="text-2xl font-black text-emerald-500">
            R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Buscar por título…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30 text-xs text-muted-foreground">
              <th className="text-left px-4 py-3 font-medium">Contrato</th>
              <th className="hidden lg:table-cell text-left px-4 py-3 font-medium">Cliente</th>
              <th className="hidden lg:table-cell text-left px-4 py-3 font-medium">Período</th>
              <th className="text-right px-4 py-3 font-medium">Valor</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="size-4 animate-spin inline mr-2" />
                  Carregando…
                </td>
              </tr>
            ) : contracts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                  Nenhum contrato ativo.
                </td>
              </tr>
            ) : (
              contracts.map((contract) => (
                <tr
                  key={contract.id}
                  className="border-b border-border/30 hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium flex items-center gap-1.5">
                      <FileSignature className="size-3.5 text-[#1E90FF]" />
                      #{contract.number}
                      {contract.proposalTitle && (
                        <span className="text-xs text-muted-foreground">
                          — {contract.proposalTitle}
                        </span>
                      )}
                    </p>
                    {contract.templateName && (
                      <p className="text-[10px] text-muted-foreground">
                        Template: {contract.templateName}
                      </p>
                    )}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-xs">
                    {contract.clientName ?? "—"}
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-xs text-muted-foreground">
                    {new Date(contract.startDate).toLocaleDateString("pt-BR")} –{" "}
                    {new Date(contract.endDate).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-500 tabular-nums">
                    R${" "}
                    {Number.parseFloat(contract.value).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant="outline"
                      className={STATUS_STYLE[contract.status].className}
                    >
                      {STATUS_STYLE[contract.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {contract.clientLeadId && (
                      <a
                        href={`/contatos/${contract.clientLeadId}`}
                        className="inline-flex items-center justify-center size-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Abrir lead"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Card className="p-3 text-xs text-muted-foreground">
        Contratos vindos do Forge. Um lead conta como &quot;com contrato ativo&quot;
        quando aparece como cliente numa proposta cujo contrato está com status
        ATIVO. Isso alimenta a cesta de compra dos cards.
      </Card>
    </div>
  );
}
