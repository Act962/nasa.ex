"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Storage ──────────────────────────────────────────────────────────────────

export const useNBoxStorage = () => {
  const { data, isLoading } = useQuery(
    orpc.nbox.getStorage.queryOptions({}),
  );
  return { storage: data, isLoading };
};

// ── Folders ───────────────────────────────────────────────────────────────────

export const useNBoxFolders = () => {
  const { data, isLoading } = useQuery(
    orpc.nbox.folders.getMany.queryOptions({}),
  );
  return { folders: data?.folders ?? [], isLoading };
};

export const useCreateNBoxFolder = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nbox.folders.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(orpc.nbox.folders.getMany.queryOptions({}));
        toast.success("Pasta criada!");
      },
      onError: (e) => toast.error("Erro ao criar pasta: " + e.message),
    }),
  );
};

export const useUpdateNBoxFolder = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nbox.folders.update.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(orpc.nbox.folders.getMany.queryOptions({}));
        toast.success("Pasta renomeada!");
      },
    }),
  );
};

export const useDeleteNBoxFolder = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nbox.folders.delete.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(orpc.nbox.folders.getMany.queryOptions({}));
        toast.success("Pasta excluída!");
      },
      onError: (e) => toast.error("Erro ao excluir: " + e.message),
    }),
  );
};

// ── Items ─────────────────────────────────────────────────────────────────────

export const useNBoxItems = (params: { folderId?: string | null; search?: string }) => {
  const { data, isLoading } = useQuery(
    orpc.nbox.items.getMany.queryOptions({
      input: { folderId: params.folderId, search: params.search },
    }),
  );
  return { items: data?.items ?? [], isLoading };
};

export const useCreateNBoxItem = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nbox.items.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(orpc.nbox.items.getMany.queryOptions({ input: {} }));
        qc.invalidateQueries(orpc.nbox.getStorage.queryOptions({}));
        toast.success("Item adicionado!");
      },
      onError: (e) => toast.error("Erro: " + e.message),
    }),
  );
};

export const useUpdateNBoxItem = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nbox.items.update.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(orpc.nbox.items.getMany.queryOptions({ input: {} }));
        toast.success("Item atualizado!");
      },
    }),
  );
};

export const useDeleteNBoxItem = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nbox.items.delete.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(orpc.nbox.items.getMany.queryOptions({ input: {} }));
        qc.invalidateQueries(orpc.nbox.getStorage.queryOptions({}));
        toast.success("Item excluído!");
      },
      onError: (e) => toast.error("Erro: " + e.message),
    }),
  );
};
