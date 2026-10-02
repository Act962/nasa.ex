"use client";

import { useState } from "react";
import {
  useForgeContracts,
  useDeleteForgeContract,
  useForgeTemplates,
  useDeleteForgeTemplate,
} from "../../hooks/use-forge";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus, FileCheck2, Pencil, Trash2, Users,
  BookText, Calendar, AlignLeft, Share2, Sparkles,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ContractForm } from "./contract-form";
import { TemplateModal } from "./template-modal";
import { PatternsSection } from "@/features/admin/components/patterns-section";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { ContractCardList } from "./contract-card-list";
import {
  CONTRACT_STATUS_CONFIG,
  formatContractNumber,
  formatCurrency,
  getContractStatus,
} from "./contract-status";
import {
  SignerLinksPanel,
  hasOnlyOrphanSigners,
  toSignerRows,
  type SignerRow,
} from "./signer-links-panel";

interface Template {
  id: string;
  name: string;
  content: string;
  defaultStartDate: Date | null;
  defaultEndDate: Date | null;
}

// ─── Per-signer sharing popover ───────────────────────────────────────────────

function ShareSignersPopover({ signers, contractTitle }: { signers: SignerRow[]; contractTitle: string }) {
  const isAllOrphans = hasOnlyOrphanSigners(signers);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          title={isAllOrphans ? "Re-salve o contrato para gerar links" : "Visualizar / Compartilhar"}
          disabled={isAllOrphans}
          onClick={(event) => {
            if (isAllOrphans) {
              event.preventDefault();
              toast.info("Re-salve o contrato para gerar links de assinatura");
            }
          }}
        >
          <Share2 className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden shadow-xl border-border/60">
        <SignerLinksPanel signers={signers} contractTitle={contractTitle} />
      </PopoverContent>
    </Popover>
  );
}

// ─── Template manager (inside Sheet) ─────────────────────────────────────────

function TemplateManager({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useForgeTemplates();
  const deleteTemplate = useDeleteForgeTemplate();
  const [templateModal, setTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTemplateId) return;
    try {
      await deleteTemplate.mutateAsync({ id: deleteTemplateId });
      toast.success("Padrão removido");
    } catch {
      toast.error("Erro ao remover padrão");
    } finally {
      setDeleteTemplateId(null);
    }
  };

  const templates = data?.templates ?? [];

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Crie modelos reutilizáveis com texto, datas e variáveis dinâmicas.
        </p>
        <Button
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => { setEditingTemplate(null); setTemplateModal(true); }}
        >
          <Plus className="size-3.5" /> Novo Padrão
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3 text-center border border-dashed rounded-xl">
          <BookText className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum padrão cadastrado.</p>
          <Button variant="outline" size="sm" onClick={() => { setEditingTemplate(null); setTemplateModal(true); }}>
            <Plus className="size-3.5 mr-1.5" /> Criar padrão
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="border rounded-xl p-4 bg-card hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="font-semibold text-sm truncate">{t.name}</p>
                  {(t.defaultStartDate || t.defaultEndDate) && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="size-3 shrink-0" />
                      <span>
                        {t.defaultStartDate
                          ? new Date(t.defaultStartDate).toLocaleDateString("pt-BR")
                          : "—"}
                        {" → "}
                        {t.defaultEndDate
                          ? new Date(t.defaultEndDate).toLocaleDateString("pt-BR")
                          : "—"}
                      </span>
                    </div>
                  )}
                  {t.content && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <AlignLeft className="size-3 shrink-0 mt-0.5" />
                      <p className="line-clamp-2">{t.content.slice(0, 120)}{t.content.length > 120 ? "…" : ""}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon" variant="ghost" className="size-7"
                    onClick={() => { setEditingTemplate(t as Template); setTemplateModal(true); }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTemplateId(t.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template modal */}
      {templateModal && (
        <TemplateModal
          open={templateModal}
          onClose={() => { setTemplateModal(false); setEditingTemplate(null); }}
          template={editingTemplate}
        />
      )}

      {/* Delete template confirmation */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={(o) => !o && setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              O padrão será removido mas os contratos já criados não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function ContractsTab() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateToggling, setTemplateToggling] = useState<string | null>(null);

  const { data, isLoading } = useForgeContracts(statusFilter !== "ALL" ? { status: statusFilter } : {});
  const deleteContract = useDeleteForgeContract();
  const { toggleTemplate } = useAppTemplate();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteContract.mutateAsync({ id: deleteId });
      toast.success("Contrato removido");
    } catch {
      toast.error("Erro ao remover contrato");
    } finally {
      setDeleteId(null);
    }
  };

  const handleTemplateToggle = async (contractId: string, isTemplate: boolean) => {
    setTemplateToggling(contractId);
    try {
      await toggleTemplate("forge-contract", contractId, !isTemplate);
      toast.success(isTemplate ? "Padrão desmarcado" : "Contrato marcado como padrão");
    } catch {
      toast.error("Erro ao marcar como padrão");
    } finally {
      setTemplateToggling(null);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const handleEdit = (contractId: string) => {
    setEditingId(contractId);
    setFormOpen(true);
  };

  const filters = ["ALL", "PENDENTE_ASSINATURA", "ATIVO", "ENCERRADO", "CANCELADO"];
  const filterLabels: Record<string, string> = {
    ALL: "Todos",
    ...Object.fromEntries(
      Object.entries(CONTRACT_STATUS_CONFIG).map(([statusKey, statusConfig]) => [statusKey, statusConfig.label]),
    ),
  };

  return (
    <div className="space-y-4">
      <Button
        className="h-11 w-full gap-1.5 rounded-full md:hidden"
        onClick={handleCreate}
      >
        <Plus className="size-4" />
        Novo contrato
      </Button>

      <div className="flex items-center gap-2 md:flex-wrap">
        <div className="scroll-hidden-x flex min-w-0 flex-1 gap-1.5 overflow-x-auto md:flex-none md:flex-wrap md:overflow-visible">
          {filters.map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setStatusFilter(filterKey)}
              className={cn(
                "shrink-0 whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border transition-all max-md:h-9 max-md:px-4",
                statusFilter === filterKey
                  ? "bg-info text-white border-info"
                  : "border-border text-muted-foreground hover:border-info/50",
              )}
            >
              {filterLabels[filterKey]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-info/40 text-info hover:bg-info/5 max-md:h-9 max-md:rounded-full"
            onClick={() => setTemplatesOpen(true)}
          >
            <BookText className="size-3.5" />
            Padrões
          </Button>
          <Button
            className="gap-1.5 max-md:hidden"
            onClick={handleCreate}
          >
            <Plus className="size-4" />
            Novo Contrato
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <>
          <div className="flex justify-center py-12 md:hidden">
            <OrbitaSpinner size={32} />
          </div>
          <div className="space-y-2 max-md:hidden">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </>
      ) : !data?.contracts.length ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <FileCheck2 className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum contrato encontrado.</p>
          <Button variant="outline" className="rounded-full" onClick={handleCreate}>
            <Plus className="size-4 mr-1.5" /> Criar contrato
          </Button>
        </div>
      ) : (
        <>
        <div className="md:hidden">
          <ContractCardList
            contracts={data.contracts}
            togglingTemplateId={templateToggling}
            onEdit={handleEdit}
            onDelete={setDeleteId}
            onToggleTemplate={handleTemplateToggle}
          />
        </div>
        <div className="rounded-lg border overflow-x-auto max-md:hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[70px]">Nº</TableHead>
                <TableHead>Proposta</TableHead>
                <TableHead className="hidden sm:table-cell">Início</TableHead>
                <TableHead className="hidden sm:table-cell">Término</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="hidden md:table-cell">Assinantes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.contracts.map((c) => {
                const st = getContractStatus(c.status);
                const signers = toSignerRows(c.signers);
                const signedCount = signers.filter((signer) => signer.signed_at).length;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-bold">{formatContractNumber(c.number)}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">{c.proposal?.title ?? "—"}</TableCell>
                    <TableCell className="text-xs hidden sm:table-cell whitespace-nowrap">
                      {new Date(c.startDate).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs hidden sm:table-cell whitespace-nowrap">
                      {new Date(c.endDate).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold whitespace-nowrap">{formatCurrency(c.value)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1 text-xs">
                        <Users className="size-3 text-muted-foreground" />
                        <span>{signedCount}/{signers.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] whitespace-nowrap", st.color)}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Share / view per-signer links */}
                        <ShareSignersPopover
                          signers={signers}
                          contractTitle={c.proposal?.title ?? `Contrato ${formatContractNumber(c.number)}`}
                        />
                        <Button
                          size="icon" variant="ghost" className="size-7"
                          onClick={() => handleTemplateToggle(c.id, c.isTemplate ?? false)}
                          disabled={templateToggling === c.id}
                          title={c.isTemplate ? "Desmarcar como padrão" : "Marcar como padrão"}
                        >
                          <Sparkles className={cn("size-3.5", c.isTemplate && "text-info")} />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="size-7"
                          onClick={() => handleEdit(c.id)}
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(c.id)}
                          title="Excluir"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {/* Contract form */}
      {formOpen && (
        <ContractForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingId(null); }}
          contractId={editingId ?? undefined}
        />
      )}

      {/* Templates sheet */}
      <Sheet open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookText className="size-4 text-info" />
              Padrões de Contrato
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <TemplateManager onClose={() => setTemplatesOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete contract confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PatternsSection appType="forge-contract" />
    </div>
  );
}
