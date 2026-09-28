"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { PaymentAttachmentKind } from "../lib/attachments";

export interface AttachmentFilters {
  search?: string;
  kind?: PaymentAttachmentKind;
  linkage?: "all" | "RECEIVABLE" | "PAYABLE" | "unlinked";
  entryId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
}

export function usePaymentAttachments(filters: AttachmentFilters = {}) {
  return useQuery(
    orpc.payment.attachments.list.queryOptions({
      input: {
        linkage: filters.linkage ?? "all",
        page: filters.page ?? 1,
        perPage: filters.perPage ?? 24,
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.entryId ? { entryId: filters.entryId } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
      },
    }),
  );
}

/** Anexos de um lançamento específico — usado no dialog de edição. */
export function useEntryAttachments(entryId: string | undefined) {
  return useQuery({
    ...orpc.payment.attachments.list.queryOptions({
      input: { entryId: entryId ?? "", linkage: "all", page: 1, perPage: 50 },
    }),
    enabled: !!entryId,
  });
}

export function useUpdatePaymentAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.payment.attachments.update.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export function useDeletePaymentAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.payment.attachments.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export function useLinkPaymentAttachments() {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.payment.attachments.link.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export interface UploadedAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: PaymentAttachmentKind;
}

/**
 * Upload é REST, não oRPC (multipart não passa pelo contrato tipado), então
 * este hook embrulha o `fetch` pra que os componentes continuem importando só
 * hooks — regra 9 do CLAUDE.md.
 */
export function useUploadPaymentAttachment() {
  const queryClient = useQueryClient();

  return useMutation<UploadedAttachment, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/payment/attachments/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao enviar o arquivo");
      }

      const body = (await response.json()) as { attachment: UploadedAttachment };
      return body.attachment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.payment.key() });
    },
  });
}

export function attachmentPreviewUrl(attachmentId: string) {
  return `/api/payment/attachments/${attachmentId}`;
}

export function attachmentDownloadUrl(attachmentId: string) {
  return `/api/payment/attachments/${attachmentId}?download=1`;
}
