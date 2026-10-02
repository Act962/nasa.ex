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
import { ProposalThumbnail } from "./proposal-thumbnail";
import { ContractForm } from "../contracts/contract-form";
import { PatternsSection } from "@/features/admin/components/patterns-section";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RASCUNHO:    { label: "Rascunho",    color: "bg-muted text-muted-foreground border-line" },
  ENVIADA:     { label: "Enviada",     color: "bg-info/15 text-info border-info/30" },
  VISUALIZADA: { label: "Visualizada", color: "bg-warning/15 text-warning border-warning/30" },
  PAGA:        { label: "Paga",        color: "bg-success/15 text-success border-success/30" },
  EXPIRADA:    { label: "Expirada",    color: "bg-destructive/15 text-destructive border-destructive/30" },
  CANCELADA:   { label: "Cancelada",   color: "bg-destructive/10 text-destructive border-destructive/30" },
};

const STATUS_ACTIONS = [
  { key: "ENVIADA",     label: "Enviada",     Icon: Send,         className: "text-info" },
  { key: "VISUALIZADA", label: "Visualizada", Icon: ScanEye,      className: "text-warning" },
  { key: "PAGA",        label: "Paga",        Icon: CheckCircle2, className: "text-success" },
  { key: "EXPIRADA",    label: "Expirada",    Icon: Clock,        className: "text-destructive" },
  { key: "CANCELADA",   label: "Cancelada",   Icon: XCircle,      className: "text-destructive" },
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
      {/* Ações e filtros */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Button
          className="h-11 w-full gap-1.5 rounded-full md:order-last md:ml-auto md:h-9 md:w-auto"
          onClick={() => { setEditingId(null); setFormOpen(true); }}
          data-guide={GUIDE_ANCHORS.forgeNewProposalButton.id}
        >
          <Plus className="size-4" />
          Nova proposta
        </Button>
        <div className="scroll-hidden-x -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {filters.map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setStatusFilter(filterKey)}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors",
                statusFilter === filterKey
                  ? "border-foreground bg-foreground text-background"
                  : "border-line bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {filterLabels[filterKey]}
            </button>
          ))}
        </div>
      </div>

      {/* Miniaturas */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[3/4] w-full rounded-[20px]" />
          ))}
        </div>
      ) : !data?.proposals.length ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-line py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">Nenhuma proposta por aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {data.proposals.map((proposal) => {
            const statusStyle = STATUS_CONFIG[proposal.status] ?? { label: proposal.status, color: "bg-muted text-muted-foreground border-line" };
            const total = calcTotal(proposal);
            const openPreview = () => {
              if (!proposal.publicToken) {
                toast.info("Re-salve a proposta para gerar o link público");
                return;
              }
              window.open(`/proposta/${proposal.publicToken}`, "_blank");
            };
            return (
              <article
                key={proposal.id}
                className="group flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-line bg-card transition-shadow hover:shadow-md"
              >
                <div className="relative">
                  <button type="button" onClick={openPreview} className="block w-full text-left" aria-label={`Abrir ${proposal.title}`}>
                    <ProposalThumbnail
                      publicToken={proposal.publicToken}
                      title={proposal.title}
                      versionKey={String(proposal.updatedAt)}
                    />
                  </button>
                  <Badge className={cn("pointer-events-none absolute top-2 left-2 rounded-full text-[10px] shadow-sm", statusStyle.color)}>
                    {statusStyle.label}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 size-8 rounded-full bg-card/90 shadow-sm backdrop-blur"
                        aria-label="Mais ações"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem className="gap-2 text-xs" disabled={!proposal.publicToken} onClick={openPreview}>
                        <Eye className="size-3.5 shrink-0" /> Ver como o cliente
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-xs"
                        disabled={!proposal.publicToken}
                        onClick={() => handleShare(proposal.publicToken)}
                        data-guide={GUIDE_ANCHORS.forgeProposalShareButton.id}
                      >
                        <Share2 className="size-3.5 shrink-0" /> Copiar link
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-xs" onClick={() => { setEditingId(proposal.id); setFormOpen(true); }}>
                        <Pencil className="size-3.5 shrink-0" /> Editar proposta
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Alterar status</DropdownMenuLabel>
                      {STATUS_ACTIONS.map(({ key, label, Icon, className }) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => handleStatusChange(proposal.id, key, proposal.status)}
                          className={cn("gap-2 text-xs", proposal.status === key && "font-semibold")}
                        >
                          <Icon className={cn("size-3.5 shrink-0", className)} />
                          <span className="flex-1">{label}</span>
                          {proposal.status === key && <CheckCircle2 className="size-3 shrink-0 text-success" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-xs text-info focus:text-info"
                        onClick={() =>
                          setGenerateContract({
                            proposalId: proposal.id,
                            defaultValue: String(total),
                            clientName: proposal.client?.name,
                            clientEmail: proposal.client?.email ?? undefined,
                          })
                        }
                      >
                        <FilePlus2 className="size-3.5 shrink-0" /> Gerar contrato
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-xs text-info focus:text-info"
                        onClick={() => handleTemplateToggle(proposal.id, proposal.isTemplate ?? false)}
                        disabled={templateToggling === proposal.id}
                      >
                        <Sparkles className="size-3.5 shrink-0" />
                        {proposal.isTemplate ? "Desmarcar como padrão" : "Marcar como padrão"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-xs text-destructive focus:text-destructive"
                        onClick={() => setDeleteId(proposal.id)}
                      >
                        <Trash2 className="size-3.5 shrink-0" /> Excluir proposta
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <button
                  type="button"
                  onClick={() => { setEditingId(proposal.id); setFormOpen(true); }}
                  className="flex flex-1 flex-col gap-0.5 border-t border-line p-2.5 text-left md:p-3"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">#{String(proposal.number).padStart(4, "0")}</span>
                  <span className="line-clamp-2 text-[13px] leading-tight font-semibold">{proposal.title}</span>
                  {proposal.client && (
                    <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <User className="size-3 shrink-0" />
                      <span className="truncate">{proposal.client.name}</span>
                    </span>
                  )}
                  <span className="mt-auto pt-1 text-sm font-bold text-info tabular-nums">{fmt(total)}</span>
                  {proposal.validUntil && (
                    <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                      <Calendar className="size-3 shrink-0" /> até {new Date(proposal.validUntil).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </button>
              </article>
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
      <AlertDialog open={!!deleteId} onOpenChange={(isOpen) => !isOpen && setDeleteId(null)}>
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
