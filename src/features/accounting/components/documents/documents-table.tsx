"use client";

import { useState } from "react";
import { ExternalLink, FilePlus2, KeyRound, PencilLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { companyDocumentFileHref, useDeleteCompanyDocument } from "@/features/accounting/hooks/use-accounting-documents";
import { formatPeriodLabel } from "@/features/accounting/lib/profile/tax-display";
import { DOCUMENT_STATUS_CLASSES, DOCUMENT_STATUS_LABELS, formatDocumentDate } from "./document-display";
import type { CompanyDocumentRowView } from "./document-row-types";

interface DocumentsTableProps {
  documents: CompanyDocumentRowView[];
  canManage: boolean;
  onUpload: () => void;
  onReview: (document: CompanyDocumentRowView) => void;
}

export function DocumentsTable({ documents, canManage, onUpload, onReview }: DocumentsTableProps) {
  const [isShowingReplaced, setIsShowingReplaced] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CompanyDocumentRowView | null>(null);
  const deleteDocument = useDeleteCompanyDocument();

  const visibleDocuments = isShowingReplaced
    ? documents
    : documents.filter((document) => document.displayStatus !== "REPLACED");
  const replacedCount = documents.length - documents.filter((document) => document.displayStatus !== "REPLACED").length;

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteDocument.mutate(
      { documentId: pendingDelete.id },
      {
        onSuccess: () => {
          toast.success("Documento excluído.");
          setPendingDelete(null);
        },
        onError: (error) => toast.error(error.message || "Não foi possível excluir."),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Todos os documentos</CardTitle>
        <div className="flex items-center gap-3">
          {replacedCount > 0 && (
            <div className="flex items-center gap-2">
              <Switch id="show-replaced" checked={isShowingReplaced} onCheckedChange={setIsShowingReplaced} />
              <Label htmlFor="show-replaced" className="text-xs text-muted-foreground">
                Mostrar substituídos ({replacedCount})
              </Label>
            </div>
          )}
          <Button size="sm" className="bg-info text-white hover:bg-info" onClick={onUpload}>
            <FilePlus2 className="size-3.5" /> Enviar documento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {visibleDocuments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
            <p className="text-sm font-medium">Nenhum documento ainda</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Comece pelas certidões e pelo contrato social: a IA lê o arquivo e preenche número e validade para você.
            </p>
            <Button size="sm" variant="outline" onClick={onUpload}>
              <FilePlus2 className="size-3.5" /> Enviar o primeiro
            </Button>
          </div>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDocuments.map((document) => (
                  <TableRow key={document.id} className={cn(document.displayStatus === "REPLACED" && "opacity-60")}>
                    <TableCell className="min-w-48 whitespace-normal">
                      <p className="flex items-center gap-1.5 font-medium">
                        {document.isFromCertificate && <KeyRound className="size-3.5 text-info" />}
                        {document.typeLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[document.groupLabel, document.period ? formatPeriodLabel(document.period) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{document.number ?? "—"}</TableCell>
                    <TableCell className="text-sm">{formatDocumentDate(document.issuedAt)}</TableCell>
                    <TableCell className="text-sm">
                      {formatDocumentDate(document.effectiveExpiresAt)}
                      {document.isExpiryEstimated && <span className="block text-[11px] text-muted-foreground">estimada</span>}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          DOCUMENT_STATUS_CLASSES[document.displayStatus],
                        )}
                      >
                        {DOCUMENT_STATUS_LABELS[document.displayStatus]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {document.displayStatus === "PENDING_REVIEW" && (
                          <Button size="sm" variant="outline" onClick={() => onReview(document)}>
                            <PencilLine className="size-3.5" /> Revisar
                          </Button>
                        )}
                        {document.file && (
                          <Button size="icon" variant="ghost" className="size-8" asChild>
                            <a
                              href={companyDocumentFileHref(document.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir ${document.file.name}`}
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        )}
                        {canManage && !document.isFromCertificate && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label="Excluir documento"
                            onClick={() => setPendingDelete(document)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(isOpen) => !isOpen && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{pendingDelete?.typeLabel}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo sai do N-Box e do armazenamento. Se houver uma versão anterior deste documento, ela volta a valer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDocument.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
