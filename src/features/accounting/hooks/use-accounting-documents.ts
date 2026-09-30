"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useInvalidateAccounting } from "./use-accounting-invalidation";

export function useCompanyDocuments() {
  return useQuery(orpc.accounting.documents.list.queryOptions({ input: {} }));
}

/** A pasta pode nascer nesta chamada: o cache do N-Box é renovado para enxergá-la. */
export function useCompanyDocumentsFolder() {
  const queryClient = useQueryClient();
  const folderQuery = useQuery(orpc.accounting.documents.folder.queryOptions({ input: {} }));
  const rootFolderId = folderQuery.data?.rootFolderId ?? null;
  useEffect(() => {
    if (rootFolderId) queryClient.invalidateQueries({ queryKey: orpc.nbox.key() });
  }, [rootFolderId, queryClient]);
  return folderQuery;
}

/** Link autenticado para abrir o arquivo (id do documento ou do item do N-Box). */
export function companyDocumentFileHref(id: string, shouldDownload = false): string {
  return `/api/accounting/documents/${encodeURIComponent(id)}${shouldDownload ? "?download=1" : ""}`;
}

/** Documentos também moram no N-Box: invalida os dois. */
function useInvalidateDocuments() {
  const queryClient = useQueryClient();
  const invalidateAccounting = useInvalidateAccounting();
  return () => {
    invalidateAccounting();
    queryClient.invalidateQueries({ queryKey: orpc.nbox.key() });
  };
}

export interface UploadCompanyDocumentInput {
  file: File;
  typeCode: string;
  label?: string;
  period?: string;
  issuedAt?: string;
  expiresAt?: string;
  number?: string;
}

export interface UploadedCompanyDocument {
  id: string;
  typeCode: string;
  status: string;
  period: string | null;
}

async function postCompanyDocument(input: UploadCompanyDocumentInput): Promise<UploadedCompanyDocument> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("typeCode", input.typeCode);
  const optionalFields: Array<[string, string | undefined]> = [
    ["label", input.label],
    ["period", input.period],
    ["issuedAt", input.issuedAt],
    ["expiresAt", input.expiresAt],
    ["number", input.number],
  ];
  for (const [fieldName, fieldValue] of optionalFields) {
    if (fieldValue) formData.append(fieldName, fieldValue);
  }

  const response = await fetch("/api/accounting/documents/upload", { method: "POST", body: formData });
  const responseBody = (await response.json().catch(() => null)) as
    | { document?: UploadedCompanyDocument; error?: string }
    | null;
  if (!response.ok || !responseBody?.document) {
    throw new Error(responseBody?.error ?? "Não foi possível enviar o documento.");
  }
  return responseBody.document;
}

export function useUploadCompanyDocument() {
  const invalidateDocuments = useInvalidateDocuments();
  return useMutation({ mutationFn: postCompanyDocument, onSuccess: invalidateDocuments });
}

export function useExtractCompanyDocument() {
  const invalidateDocuments = useInvalidateDocuments();
  return useMutation({ ...orpc.accounting.documents.extract.mutationOptions(), onSuccess: invalidateDocuments });
}

export function useConfirmCompanyDocument() {
  const invalidateDocuments = useInvalidateDocuments();
  return useMutation({ ...orpc.accounting.documents.confirm.mutationOptions(), onSuccess: invalidateDocuments });
}

export function useDeleteCompanyDocument() {
  const invalidateDocuments = useInvalidateDocuments();
  return useMutation({ ...orpc.accounting.documents.delete.mutationOptions(), onSuccess: invalidateDocuments });
}
