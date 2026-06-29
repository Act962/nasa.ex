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
  BookText, Calendar, AlignLeft,
  Eye, Share2, Copy, MessageCircle, Mail, CheckCircle2, Clock, Sparkles,
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDENTE_ASSINATURA: { label: "Pendente Assinatura", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  ATIVO:               { label: "Ativo",               color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ENCERRADO:           { label: "Encerrado",           color: "bg-gray-100 text-gray-600 border-gray-200" },
  CANCELADO:           { label: "Cancelado",           color: "bg-red-100 text-red-600 border-red-200" },
};

function fmt(n: number | string) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Template {
  id: string;
  name: string;
  content: string;
  defaultStartDate: Date | null;
  defaultEndDate: Date | null;
}

// ─── Per-signer sharing popover ───────────────────────────────────────────────

interface SignerRow {
  name: string;
  email: string;
  token: string;
  signed_at: string | null;
}

function ShareSignersPopover({ signers, contractTitle }: { signers: SignerRow[]; contractTitle: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const validSigners = signers.filter((s) => !!s.token);
  const orphanCount = signers.length - validSigners.length;
  const allOrphans = signers.length > 0 && validSigners.length === 0;

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).then(() => toast.success("Link copiado!"));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          title={allOrphans ? "Re-salve o contrato para gerar links" : "Visualizar / Compartilhar"}
          disabled={allOrphans}
          onClick={(e) => {
            if (allOrphans) {
              e.preventDefault();
              toast.info("Re-salve o contrato para gerar links de assinatura");
            }
          }}
        >
          <Share2 className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden shadow-xl border-border/60">
        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Links de assinatura
          </p>
          <p className="text-sm font-medium truncate mt-0.5">{contractTitle}</p>
        </div>
        {orphanCount > 0 && (
          <div className="mx-2 mt-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
            {orphanCount} assinante{orphanCount > 1 ? "s" : ""} sem link válido — re-salve o contrato para gerar.
          </div>
        )}
        <div className="p-2 space-y-1">
          {validSigners.map((s, idx) => {
            const url = `${origin}/contrato/${s.token}`;
            const waText = encodeURIComponent(`Olá ${s.name}, segue o link para assinar o contrato "${contractTitle}":\n${url}`);
            const mailSubject = encodeURIComponent(`Contrato para assinatura: ${contractTitle}`);
            const mailBody = encodeURIComponent(`Olá ${s.name},\n\nSegue o link para assinatura:\n\n${url}\n\nAtenciosamente.`);

            return (
              <div key={s.token ?? idx} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {s.signed_at
                    ? <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    : <Clock className="size-3.5 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{s.name}</p>
                    {s.signed_at
                      ? <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          Assinado em {new Date(s.signed_at).toLocaleDateString("pt-BR")}
                        </p>
                      : <p className="text-[10px] text-muted-foreground">Aguardando assinatura</p>}
                  </div>
                  {/* Open in new tab */}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir contrato"
                    className="size-6 rounded flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                  >
                    <Eye className="size-3.5 text-muted-foreground" />
                  </a>
                </div>

                {/* Action buttons */}
                {!s.signed_at && (
                  <div className="flex gap-1.5">
                    <a
                      href={`https://wa.me/?text=${waText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/20 transition-colors"
                    >
                      <MessageCircle className="size-3" /> WhatsApp
                    </a>
                    <a
                      href={`mailto:${s.email}?subject=${mailSubject}&body=${mailBody}`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-[11px] font-medium hover:bg-blue-500/20 transition-colors"
                    >
                      <Mail className="size-3" /> E-mail
                    </a>
                    <button
                      onClick={() => handleCopy(url)}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-muted border border-border text-muted-foreground text-[11px] font-medium hover:bg-muted/80 transition-colors"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5 shrink-0"
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

  const filters = ["ALL", "PENDENTE_ASSINATURA", "ATIVO", "ENCERRADO", "CANCELADO"];
  const filterLabels: Record<string, string> = {
    ALL: "Todos",
    ...Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])),
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
        <div className="ml-auto flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-[#7C3AED]/40 text-[#7C3AED] hover:bg-[#7C3AED]/5"
            onClick={() => setTemplatesOpen(true)}
          >
            <BookText className="size-3.5" />
            Padrões
          </Button>
          <Button
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
            onClick={() => { setEditingId(null); setFormOpen(true); }}
          >
            <Plus className="size-4" />
            Novo Contrato
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !data?.contracts.length ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <FileCheck2 className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum contrato encontrado.</p>
          <Button variant="outline" onClick={() => { setEditingId(null); setFormOpen(true); }}>
            <Plus className="size-4 mr-1.5" /> Criar contrato
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
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
                const st = STATUS_CONFIG[c.status] ?? { label: c.status, color: "bg-gray-100 text-gray-600 border-gray-200" };
                const signers: { name: string; signed_at: string | null }[] = Array.isArray(c.signers) ? c.signers : [];
                const signedCount = signers.filter((s) => s.signed_at).length;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-bold">#{String(c.number).padStart(4, "0")}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">{c.proposal?.title ?? "—"}</TableCell>
                    <TableCell className="text-xs hidden sm:table-cell whitespace-nowrap">
                      {new Date(c.startDate).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs hidden sm:table-cell whitespace-nowrap">
                      {new Date(c.endDate).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold whitespace-nowrap">{fmt(c.value)}</TableCell>
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
                          signers={signers as SignerRow[]}
                          contractTitle={c.proposal?.title ?? `Contrato #${String(c.number).padStart(4, "0")}`}
                        />
                        <Button
                          size="icon" variant="ghost" className="size-7"
                          onClick={() => handleTemplateToggle(c.id, c.isTemplate ?? false)}
                          disabled={templateToggling === c.id}
                          title={c.isTemplate ? "Desmarcar como padrão" : "Marcar como padrão"}
                        >
                          <Sparkles className={cn("size-3.5", c.isTemplate && "text-[#7C3AED]")} />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="size-7"
                          onClick={() => { setEditingId(c.id); setFormOpen(true); }}
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
              <BookText className="size-4 text-[#7C3AED]" />
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
