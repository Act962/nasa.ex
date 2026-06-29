"use client";

import { useState } from "react";
import { useForgeProposals, useDeleteForgeProposal, useUpdateForgeProposal } from "../../hooks/use-forge";
import { useAppTemplate } from "@/features/admin/hooks/use-app-template";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, FileText, User, Calendar, Share2, Pencil, Trash2, Eye,
  MoreHorizontal, Send, ScanEye, CheckCircle2, Clock, XCircle, FilePlus2, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ProposalForm } from "./proposal-form";
import { ContractForm } from "../contracts/contract-form";
import { PatternsSection } from "@/features/admin/components/patterns-section";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RASCUNHO:    { label: "Rascunho",    color: "bg-gray-100 text-gray-600 border-gray-200" },
  ENVIADA:     { label: "Enviada",     color: "bg-blue-100 text-blue-600 border-blue-200" },
  VISUALIZADA: { label: "Visualizada", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  PAGA:        { label: "Paga",        color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  EXPIRADA:    { label: "Expirada",    color: "bg-red-100 text-red-600 border-red-200" },
  CANCELADA:   { label: "Cancelada",   color: "bg-red-50 text-red-400 border-red-100" },
};

const STATUS_ACTIONS = [
  { key: "ENVIADA",     label: "Enviada",     Icon: Send,         className: "text-blue-600" },
  { key: "VISUALIZADA", label: "Visualizada", Icon: ScanEye,      className: "text-yellow-600" },
  { key: "PAGA",        label: "Paga",        Icon: CheckCircle2, className: "text-emerald-600" },
  { key: "EXPIRADA",    label: "Expirada",    Icon: Clock,        className: "text-red-500" },
  { key: "CANCELADA",   label: "Cancelada",   Icon: XCircle,      className: "text-red-400" },
] as const;

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcTotal(proposal: { products: { quantity: string; unitValue: string; discount: string | null }[]; discount: string | null; discountType: string | null }) {
  let subtotal = 0;
  for (const pp of proposal.products) {
    subtotal += Number(pp.quantity) * Number(pp.unitValue) - Number(pp.discount ?? 0);
  }
  if (proposal.discount) {
    const d = Number(proposal.discount);
    subtotal = proposal.discountType === "PERCENTUAL" ? subtotal * (1 - d / 100) : subtotal - d;
  }
  return Math.max(0, subtotal);
}

interface GenerateContractState {
  proposalId: string;
  defaultValue: string;
  clientName?: string;
  clientEmail?: string;
}

export function ProposalsTab() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [generateContract, setGenerateContract] = useState<GenerateContractState | null>(null);
  const [templateToggling, setTemplateToggling] = useState<string | null>(null);

  const { data, isLoading } = useForgeProposals(statusFilter !== "ALL" ? { status: statusFilter } : {});
  const deleteProposal = useDeleteForgeProposal();
  const updateProposal = useUpdateForgeProposal();
  const { toggleTemplate } = useAppTemplate();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProposal.mutateAsync({ id: deleteId });
      toast.success("Proposta removida");
    } catch {
      toast.error("Erro ao remover proposta");
    } finally {
      setDeleteId(null);
    }
  };

  const handleTemplateToggle = async (proposalId: string, isTemplate: boolean) => {
    setTemplateToggling(proposalId);
    try {
      await toggleTemplate("forge-proposal", proposalId, !isTemplate);
      toast.success(isTemplate ? "Padrão desmarcado" : "Proposta marcada como padrão");
    } catch {
      toast.error("Erro ao marcar como padrão");
    } finally {
      setTemplateToggling(null);
    }
  };

  const handleShare = (publicToken: string | null | undefined) => {
    if (!publicToken) {
      toast.info("Re-salve a proposta para gerar o link público");
      return;
    }
    const url = `${window.location.origin}/proposta/${publicToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado para a área de transferência");
  };

  const handleStatusChange = async (id: string, status: string, currentStatus: string) => {
    if (status === currentStatus) return;
    try {
      await updateProposal.mutateAsync({ id, status });
      toast.success(`Status alterado para "${STATUS_CONFIG[status]?.label ?? status}"`);
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  const filters = ["ALL", "RASCUNHO", "ENVIADA", "VISUALIZADA", "PAGA", "EXPIRADA", "CANCELADA"];
  const filterLabels: Record<string, string> = {
    ALL: "Todas", ...Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])),
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                statusFilter === f
                  ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                  : "border-border text-muted-foreground hover:border-[#7C3AED]/50",
              )}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
        <Button
          className="ml-auto bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5 shrink-0"
          onClick={() => { setEditingId(null); setFormOpen(true); }}
        >
          <Plus className="size-4" />
          Nova Proposta
        </Button>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 w-full rounded-xl" />)}
        </div>
      ) : !data?.proposals.length ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <FileText className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma proposta encontrada.</p>
          <Button variant="outline" onClick={() => { setEditingId(null); setFormOpen(true); }}>
            <Plus className="size-4 mr-1.5" /> Criar proposta
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.proposals.map((p) => {
            const st = STATUS_CONFIG[p.status] ?? { label: p.status, color: "bg-gray-100 text-gray-600 border-gray-200" };
            const total = calcTotal(p);
            return (
              <div
                key={p.id}
                className="border rounded-xl bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                {/* color bar */}
                <div className="h-1.5 bg-gradient-to-r from-[#7C3AED] to-[#a855f7]" />

                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono text-muted-foreground">
                        PROPOSTA #{String(p.number).padStart(4, "0")}
                      </p>
                      <h3 className="font-bold text-sm leading-tight mt-0.5 line-clamp-2">{p.title}</h3>
                    </div>
                    <Badge className={cn("text-[10px] shrink-0 whitespace-nowrap", st.color)}>{st.label}</Badge>
                  </div>

                  {/* Meta */}
                  <div className="space-y-1.5 flex-1">
                    {p.client && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="size-3 shrink-0" />
                        <span className="truncate">Cliente: <strong>{p.client.name}</strong></span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="size-3 shrink-0" />
                      <span className="truncate">Responsável: {p.responsible.name}</span>
                    </div>
                    {p.validUntil && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3 shrink-0" />
                        <span>Válida até {new Date(p.validUntil).toLocaleDateString("pt-BR")}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t pt-3 flex items-center justify-between">
                    <span className="font-bold text-[#7C3AED] text-base">{fmt(total)}</span>
                    <div className="flex gap-1 items-center">
                      {/* View */}
                      <Button
                        size="icon" variant="ghost" className="size-7"
                        title={p.publicToken ? "Visualizar proposta pública" : "Re-salve a proposta para gerar link"}
                        disabled={!p.publicToken}
                        onClick={() => {
                          if (!p.publicToken) {
                            toast.info("Re-salve a proposta para gerar o link público");
                            return;
                          }
                          window.open(`/proposta/${p.publicToken}`, "_blank");
                        }}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                      {/* Share */}
                      <Button
                        size="icon" variant="ghost" className="size-7"
                        title={p.publicToken ? "Copiar link" : "Re-salve a proposta para gerar link"}
                        disabled={!p.publicToken}
                        onClick={() => handleShare(p.publicToken)}
                      >
                        <Share2 className="size-3.5" />
                      </Button>

                      {/* More actions dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="size-7" title="Mais ações">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {/* Status change */}
                          <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
                            Alterar status
                          </DropdownMenuLabel>
                          {STATUS_ACTIONS.map(({ key, label, Icon, className }) => (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => handleStatusChange(p.id, key, p.status)}
                              className={cn("gap-2 cursor-pointer text-xs", p.status === key && "font-semibold")}
                            >
                              <Icon className={cn("size-3.5 shrink-0", className)} />
                              <span className="flex-1">{label}</span>
                              {p.status === key && (
                                <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                              )}
                            </DropdownMenuItem>
                          ))}

                          <DropdownMenuSeparator />

                          {/* Generate contract */}
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-xs text-[#7C3AED] focus:text-[#7C3AED]"
                            onClick={() =>
                              setGenerateContract({
                                proposalId: p.id,
                                defaultValue: String(total),
                                clientName: p.client?.name,
                                clientEmail: p.client?.email ?? undefined,
                              })
                            }
                          >
                            <FilePlus2 className="size-3.5 shrink-0" />
                            Gerar Contrato
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Template toggle */}
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-xs text-[#7C3AED] focus:text-[#7C3AED]"
                            onClick={() => handleTemplateToggle(p.id, p.isTemplate ?? false)}
                            disabled={templateToggling === p.id}
                          >
                            <Sparkles className="size-3.5 shrink-0" />
                            {p.isTemplate ? "Desmarcar como padrão" : "Marcar como padrão"}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Edit */}
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-xs"
                            onClick={() => { setEditingId(p.id); setFormOpen(true); }}
                          >
                            <Pencil className="size-3.5 shrink-0" />
                            Editar proposta
                          </DropdownMenuItem>

                          {/* Delete */}
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(p.id)}
                          >
                            <Trash2 className="size-3.5 shrink-0" />
                            Excluir proposta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Proposal form */}
      {formOpen && (
        <ProposalForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingId(null); }}
          proposalId={editingId ?? undefined}
        />
      )}

      {/* Generate contract from proposal */}
      {generateContract && (
        <ContractForm
          open={!!generateContract}
          onClose={() => setGenerateContract(null)}
          initialProposalId={generateContract.proposalId}
          initialValue={generateContract.defaultValue}
          initialClientName={generateContract.clientName}
          initialClientEmail={generateContract.clientEmail}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PatternsSection appType="forge-proposal" />
    </div>
  );
}
