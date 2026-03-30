"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Brand Config ─────────────────────────────────────────────────────────────

export const useNasaPostBrandConfig = () => {
  const { data, isLoading } = useQuery(
    orpc.nasaPost.brandConfig.get.queryOptions({}),
  );
  return { config: data?.config ?? null, isLoading };
};

export const useUpsertBrandConfig = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPost.brandConfig.upsert.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(orpc.nasaPost.brandConfig.get.queryOptions({}));
        toast.success("Configuração de marca salva!");
      },
      onError: (e) => toast.error("Erro ao salvar: " + e.message),
    }),
  );
};

// ── Posts ─────────────────────────────────────────────────────────────────────

const postsQueryKey = () => orpc.nasaPost.posts.getMany.queryOptions({ input: {} });

export const useNasaPosts = (params?: { status?: string; search?: string }) => {
  const { data, isLoading } = useQuery(
    orpc.nasaPost.posts.getMany.queryOptions({
      input: {
        status: params?.status,
        search: params?.search,
      },
    }),
  );
  return { posts: data?.posts ?? [], isLoading };
};

export const useCreateNasaPost = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPost.posts.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(postsQueryKey());
        toast.success("Post criado!");
      },
      onError: (e) => toast.error("Erro ao criar post: " + e.message),
    }),
  );
};

export const useUpdateNasaPost = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPost.posts.update.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(postsQueryKey());
      },
      onError: (e) => toast.error("Erro ao atualizar: " + e.message),
    }),
  );
};

export const useDeleteNasaPost = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPost.posts.delete.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(postsQueryKey());
        toast.success("Post excluído!");
      },
      onError: (e) => toast.error("Erro ao excluir: " + e.message),
    }),
  );
};

export const useGenerateNasaPost = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPost.posts.generate.mutationOptions({
      onSuccess: (data) => {
        qc.invalidateQueries(postsQueryKey());
        toast.success(
          `Conteúdo gerado! ${data.starsSpent} stars consumidas. Saldo: ${data.balanceAfter}★`,
        );
      },
      onError: (e) => toast.error("Erro na geração: " + e.message),
    }),
  );
};

export const useApproveNasaPost = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPost.posts.approve.mutationOptions({
      onSuccess: (data) => {
        qc.invalidateQueries(postsQueryKey());
        toast.success(
          `Post aprovado! ${data.starsSpent} stars consumidas.`,
        );
      },
      onError: (e) => toast.error("Erro ao aprovar: " + e.message),
    }),
  );
};

export const useScheduleNasaPost = () => {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPost.posts.schedule.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(postsQueryKey());
        toast.success("Post agendado com sucesso!");
      },
      onError: (e) => toast.error("Erro ao agendar: " + e.message),
    }),
  );
};
