"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Download,
  Eye,
  Pencil,
  Trash2,
  FileText,
  FileSpreadsheet,
  FileCode,
  ImageIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { describePaymentError } from "../../lib/describe-error";
import {
  usePaymentAttachments,
  useUpdatePaymentAttachment,
  useDeletePaymentAttachment,
  attachmentPreviewUrl,
  attachmentDownloadUrl,
} from "../../hooks/use-payment-attachments";
import {
  PAYMENT_ATTACHMENT_KINDS,
  ATTACHMENT_KIND_LABELS,
  formatFileSize,
  type PaymentAttachmentKind,
} from "../../lib/attachments";
import { formatCurrency, formatTimestampDate } from "../../lib/format";
import { cn } from "@/lib/utils";
import {
  PaymentPagination,
  PaymentPaginationNav,
} from "../shared/payment-pagination";

const PER_PAGE = 24;
const SEARCH_DEBOUNCE_MS = 300;

type LinkageFilter = "all" | "RECEIVABLE" | "PAYABLE" | "unlinked";

const KIND_BADGE_CLASSES: Record<PaymentAttachmentKind, string> = {
  NOTA_FISCAL: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  BOLETO: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  RECIBO: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  COMPROVANTE:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CONTRATO: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  OUTRO: "border-border bg-muted text-muted-foreground",
};

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="size-4" />;
  if (mimeType.includes("xml")) return <FileCode className="size-4" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet className="size-4" />;
  return <FileText className="size-4" />;
}

interface EditableAttachment {
  id: string;
  fileName: string;
  kind: PaymentAttachmentKind;
  description: string | null;
}

export function DocumentsTab() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<PaymentAttachmentKind | "all">("all");
  const [linkage, setLinkage] = useState<LinkageFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EditableAttachment | null>(null);

  // Debounce pra não disparar uma query por tecla digitada.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data, isLoading } = usePaymentAttachments({
    search: search || undefined,
    kind: kind === "all" ? undefined : kind,
    linkage,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo ? `${dateTo}T23:59:59` : undefined,
    page,
    perPage: PER_PAGE,
  });

  const updateAttachment = useUpdatePaymentAttachment();
  const deleteAttachment = useDeletePaymentAttachment();

  const attachments = data?.attachments ?? [];
  const total = data?.total ?? 0;

  const hasActiveFilters = useMemo(
    () => !!search || kind !== "all" || linkage !== "all" || !!dateFrom || !!dateTo,
    [search, kind, linkage, dateFrom, dateTo],
  );

  function clearFilters() {
    setSearchInput("");
    setKind("all");
    setLinkage("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function handleDelete(attachmentId: string, fileName: string) {
    if (!confirm(`Excluir "${fileName}"? O arquivo é removido definitivamente.`)) return;
    deleteAttachment.mutate(
      { id: attachmentId },
      {
        onSuccess: () => toast.success("Documento excluído"),
        onError: (error) =>
          toast.error(describePaymentError(error, "Não foi possível excluir o documento")),
      },
    );
  }

  function handleSaveEdit() {
    if (!editing) return;
    if (!editing.fileName.trim()) return toast.error("Nome obrigatório");

    updateAttachment.mutate(
      {
        id: editing.id,
        fileName: editing.fileName.trim(),
        kind: editing.kind,
        description: editing.description?.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Documento atualizado");
          setEditing(null);
        },
        onError: (error) =>
          toast.error(describePaymentError(error, "Não foi possível atualizar o documento")),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Documentos</h2>
          <p className="text-sm text-muted-foreground">
            Notas, boletos, recibos e comprovantes anexados aos lançamentos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Carregando…" : `${total} ${total === 1 ? "documento" : "documentos"}`}
          </p>
          <PaymentPaginationNav
            page={page}
            total={total}
            perPage={PER_PAGE}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nome do arquivo, descrição ou lançamento..."
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value as PaymentAttachmentKind | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Todos os tipos</SelectItem>
              {PAYMENT_ATTACHMENT_KINDS.map((option) => (
                <SelectItem key={option} value={option}>
                  {ATTACHMENT_KIND_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Vínculo</Label>
          <Select
            value={linkage}
            onValueChange={(value) => {
              setLinkage(value as LinkageFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PAYABLE">Despesas</SelectItem>
              <SelectItem value="RECEIVABLE">Receitas</SelectItem>
              <SelectItem value="unlinked">Sem vínculo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
          Limpar filtros
        </Button>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
      ) : attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-14 text-center">
          <FileText className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">
            {hasActiveFilters ? "Nenhum documento encontrado" : "Nenhum documento ainda"}
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {hasActiveFilters
              ? "Ajuste a busca ou os filtros."
              : "Anexe notas, boletos e comprovantes ao criar uma despesa ou receita — eles aparecem aqui."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group flex flex-col gap-2.5 rounded-lg border p-3 transition-colors hover:border-muted-foreground/30"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0 rounded-md bg-muted p-2 text-muted-foreground">
                  <FileTypeIcon mimeType={attachment.mimeType} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={attachment.fileName}>
                    {attachment.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.sizeBytes)} · {formatTimestampDate(attachment.createdAt)}
                    {attachment.uploadedBy?.name ? ` · ${attachment.uploadedBy.name}` : ""}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-[10px]", KIND_BADGE_CLASSES[attachment.kind])}
                >
                  {ATTACHMENT_KIND_LABELS[attachment.kind]}
                </Badge>
              </div>

              {attachment.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {attachment.description}
                </p>
              )}

              {attachment.entry ? (
                <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                  {attachment.entry.type === "RECEIVABLE" ? (
                    <ArrowDownLeft className="size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <ArrowUpRight className="size-3.5 shrink-0 text-red-500" />
                  )}
                  <span className="truncate" title={attachment.entry.description}>
                    {attachment.entry.description}
                  </span>
                  <span className="ml-auto shrink-0 font-medium tabular-nums">
                    {formatCurrency(attachment.entry.amount)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
                  <Unlink className="size-3.5 shrink-0" />
                  Sem vínculo com lançamento
                </div>
              )}

              <div className="flex items-center gap-1 border-t pt-2">
                <Button asChild variant="ghost" size="sm" className="h-7 flex-1 text-xs">
                  <a
                    href={attachmentPreviewUrl(attachment.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Eye className="size-3.5" />
                    Ver
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm" className="h-7 flex-1 text-xs">
                  <a href={attachmentDownloadUrl(attachment.id)}>
                    <Download className="size-3.5" />
                    Baixar
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Editar"
                  onClick={() =>
                    setEditing({
                      id: attachment.id,
                      fileName: attachment.fileName,
                      kind: attachment.kind,
                      description: attachment.description,
                    })
                  }
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  title="Excluir"
                  onClick={() => handleDelete(attachment.id, attachment.fileName)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaymentPagination
        page={page}
        total={total}
        perPage={PER_PAGE}
        onPageChange={setPage}
        itemLabel="documento"
        isLoading={isLoading}
      />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editing.fileName}
                  onChange={(event) =>
                    setEditing({ ...editing, fileName: event.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select
                  value={editing.kind}
                  onValueChange={(value) =>
                    setEditing({ ...editing, kind: value as PaymentAttachmentKind })
                  }
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {PAYMENT_ATTACHMENT_KINDS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {ATTACHMENT_KIND_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={editing.description ?? ""}
                  placeholder="Ex: NF de janeiro do fornecedor X"
                  onChange={(event) =>
                    setEditing({ ...editing, description: event.target.value })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateAttachment.isPending}>
              {updateAttachment.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
