"use client";

import { orpc } from "@/lib/orpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Campaigns ────────────────────────────────────────────────────────────────

export function useCampaigns(status?: string) {
  const { data, isLoading } = useQuery(
    orpc.nasaPlanner.campaigns.list.queryOptions({ input: status ? { status } : {} }),
  );
  return { campaigns: data?.campaigns ?? [], isLoading };
}

export function useCampaign(campaignId: string) {
  const { data, isLoading } = useQuery(
    orpc.nasaPlanner.campaigns.get.queryOptions({ input: { campaignId } }),
  );
  return { campaign: data?.campaign, isLoading };
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.campaigns.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.list.key() });
        toast.success("Planejamento de campanha criado! (-1 STAR)");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao criar campanha"),
    }),
  );
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.campaigns.update.mutationOptions({
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.list.key() });
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.get.key({ input: { campaignId: (vars as any).campaignId } }) });
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar campanha"),
    }),
  );
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.campaigns.delete.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.list.key() });
        toast.success("Campanha removida.");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao remover campanha"),
    }),
  );
}

// ─── Campaign Events ──────────────────────────────────────────────────────────

export function useCreateCampaignEvent() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.campaignEvents.create.mutationOptions({
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.get.key({ input: { campaignId: (vars as any).campaignId } }) });
        toast.success("Evento adicionado!");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao criar evento"),
    }),
  );
}

export function useUpdateCampaignEvent() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.campaignEvents.update.mutationOptions({
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.get.key({ input: { campaignId: (vars as any).campaignId } }) });
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar evento"),
    }),
  );
}

export function useDeleteCampaignEvent() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.campaignEvents.delete.mutationOptions({
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.get.key({ input: { campaignId: (vars as any).campaignId } }) });
        toast.success("Evento removido.");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao remover evento"),
    }),
  );
}

// ─── Campaign Tasks ───────────────────────────────────────────────────────────

export function useCreateCampaignTask() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.campaignTasks.create.mutationOptions({
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.get.key({ input: { campaignId: (vars as any).campaignId } }) });
        toast.success("Tarefa criada!");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao criar tarefa"),
    }),
  );
}

export function useUpdateCampaignTask() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.campaignTasks.update.mutationOptions({
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.get.key({ input: { campaignId: (vars as any).campaignId } }) });
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar tarefa"),
    }),
  );
}

// ─── Campaign Brand Assets ────────────────────────────────────────────────────

export function useCreateCampaignBrandAsset() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.campaignBrandAssets.create.mutationOptions({
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.get.key({ input: { campaignId: (vars as any).campaignId } }) });
        toast.success("Material salvo!");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao salvar material"),
    }),
  );
}

export function useDeleteCampaignBrandAsset() {
  const qc = useQueryClient();
  return useMutation(
    orpc.nasaPlanner.campaignBrandAssets.delete.mutationOptions({
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.campaigns.get.key({ input: { campaignId: (vars as any).campaignId } }) });
        toast.success("Material removido.");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao remover material"),
    }),
  );
}

// ─── Campaign Calendar ────────────────────────────────────────────────────────

export function useCampaignCalendar(opts?: { startDate?: string; endDate?: string; campaignIds?: string[] }) {
  const { data, isLoading } = useQuery(
    orpc.nasaPlanner.campaignCalendar.get.queryOptions({ input: opts ?? {} }),
  );
  return { calendar: data, isLoading };
}

export function usePublicCalendar(accessCode: string) {
  const { data, isLoading, error } = useQuery({
    ...orpc.nasaPlanner.campaignCalendar.getPublic.queryOptions({ input: { accessCode } }),
    enabled: !!accessCode,
    retry: false,
  });
  return { publicCalendar: data, isLoading, error };
}
