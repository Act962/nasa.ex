"use client";

import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Lock, UploadCloud, X } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUploadCompanyDocument } from "@/features/accounting/hooks/use-accounting-documents";
import { CUSTOM_DOCUMENT_TYPE, MAX_UPLOAD_BYTES } from "./document-display";
import { DocumentFields, EMPTY_DOCUMENT_FIELDS, isMonthlyDocumentType, type DocumentFieldValues } from "./document-fields";
import { DocumentReviewForm } from "./document-review-form";

export interface DocumentDialogRequest {
  /** Envio novo, já com tipo/competência quando vem de "O que falta". */
  mode: "upload" | "review";
  initialValues?: Partial<DocumentFieldValues>;
  /** Revisão de um documento já enviado. */
  documentId?: string;
  hasExtraction?: boolean;
}

interface DocumentUploadDialogProps {
  request: DocumentDialogRequest | null;
  onClose: () => void;
}

const ACCEPTED_FILES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/xml": [".xml"],
  "text/xml": [".xml"],
};

export function DocumentUploadDialog({ request, onClose }: DocumentUploadDialogProps) {
  const [values, setValues] = useState<DocumentFieldValues>(EMPTY_DOCUMENT_FIELDS);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const uploadDocument = useUploadCompanyDocument();

  useEffect(() => {
    if (!request) return;
    setValues({ ...EMPTY_DOCUMENT_FIELDS, ...request.initialValues });
    setSelectedFile(null);
    setUploadedDocumentId(null);
  }, [request]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_FILES,
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
    disabled: uploadDocument.isPending,
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        toast.error("Arquivo não aceito. Envie PDF, imagem ou XML de até 15 MB.");
        return;
      }
      setSelectedFile(acceptedFiles[0] ?? null);
    },
  });

  const reviewDocumentId = request?.mode === "review" ? request.documentId ?? null : uploadedDocumentId;
  const isMonthly = isMonthlyDocumentType(values.typeCode);
  const isCustomWithoutLabel = values.typeCode === CUSTOM_DOCUMENT_TYPE && !values.label.trim();
  const canUpload =
    !!selectedFile && !!values.typeCode && !isCustomWithoutLabel && (!isMonthly || !!values.period) && !uploadDocument.isPending;

  function closeDialog() {
    setUploadedDocumentId(null);
    setSelectedFile(null);
    onClose();
  }

  function upload() {
    if (!selectedFile) return;
    uploadDocument.mutate(
      {
        file: selectedFile,
        typeCode: values.typeCode,
        label: values.label || undefined,
        period: isMonthly ? values.period : undefined,
        issuedAt: values.issuedAt || undefined,
        expiresAt: isMonthly ? undefined : values.expiresAt || undefined,
        number: values.number || undefined,
      },
      {
        onSuccess: (document) => setUploadedDocumentId(document.id),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={!!request} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{reviewDocumentId ? "Confira os dados do documento" : "Enviar documento da empresa"}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Lock className="size-3.5 shrink-0" />
            Fica na pasta restrita do N-Box, visível só para quem administra o financeiro.
          </DialogDescription>
        </DialogHeader>

        {reviewDocumentId ? (
          <DocumentReviewForm
            key={reviewDocumentId}
            documentId={reviewDocumentId}
            initialValues={
              request?.mode === "review" ? { ...EMPTY_DOCUMENT_FIELDS, ...request.initialValues } : values
            }
            shouldAutoExtract={request?.mode === "upload" || !!request?.hasExtraction}
            onDone={closeDialog}
          />
        ) : (
          <div className="space-y-4">
            {selectedFile ? (
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                <FileText className="size-8 shrink-0 text-info" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Trocar arquivo" onClick={() => setSelectedFile(null)}>
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                  isDragActive ? "border-info bg-info/5" : "border-border hover:border-info/50",
                )}
              >
                <input {...getInputProps()} />
                <UploadCloud className="mx-auto mb-2 size-9 text-muted-foreground/60" />
                <p className="text-sm font-medium">{isDragActive ? "Solte o arquivo aqui" : "Arraste ou toque para escolher"}</p>
                <p className="mt-1 text-xs text-muted-foreground">PDF, foto (PNG, JPG, WEBP) ou XML — até 15 MB</p>
              </div>
            )}

            <DocumentFields values={values} onChange={setValues} idPrefix="upload" />
            <p className="text-xs text-muted-foreground">
              Não sabe as datas? Pode deixar em branco: depois do envio a IA lê o arquivo e sugere tudo para você conferir.
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button className="bg-info text-white hover:bg-info" disabled={!canUpload} onClick={upload}>
                {uploadDocument.isPending && <OrbitaSpinner className="size-3.5 " />}
                Enviar e ler com IA
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
