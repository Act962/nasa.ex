"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ─── Products ───────────────────────────────────────────────────────────────

export function useForgeProducts(search?: string) {
  return useQuery(orpc.forge.products.list.queryOptions({ input: { search } }));
}

export function useCreateForgeProduct() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.products.create.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.forge.products.list.queryOptions({ input: {} })),
  });
}

export function useUpdateForgeProduct() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.products.update.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.forge.products.list.queryOptions({ input: {} })),
  });
}

export function useDeleteForgeProduct() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.products.delete.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.forge.products.list.queryOptions({ input: {} })),
  });
}

// ─── Proposals ──────────────────────────────────────────────────────────────

export function useForgeProposals(filters?: { status?: string; responsibleId?: string }) {
  return useQuery(orpc.forge.proposals.list.queryOptions({ input: filters ?? {} }));
}

export function useCreateForgeProposal() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.proposals.create.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries(orpc.forge.proposals.list.queryOptions({ input: {} }));
      qc.invalidateQueries(orpc.forge.dashboard.get.queryOptions({ input: {} }));
    },
  });
}

export function useUpdateForgeProposal() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.proposals.update.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries(orpc.forge.proposals.list.queryOptions({ input: {} }));
      qc.invalidateQueries(orpc.forge.dashboard.get.queryOptions({ input: {} }));
    },
  });
}

export function useDeleteForgeProposal() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.proposals.delete.mutationOptions(),
    onSuccess: () => {
      qc.invalidateQueries(orpc.forge.proposals.list.queryOptions({ input: {} }));
      qc.invalidateQueries(orpc.forge.dashboard.get.queryOptions({ input: {} }));
    },
  });
}

// ─── Contracts ──────────────────────────────────────────────────────────────

export function useForgeContracts(filters?: { status?: string }) {
  return useQuery(orpc.forge.contracts.list.queryOptions({ input: filters ?? {} }));
}

export function useCreateForgeContract() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.contracts.create.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.forge.contracts.list.queryOptions({ input: {} })),
  });
}

export function useUpdateForgeContract() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.contracts.update.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.forge.contracts.list.queryOptions({ input: {} })),
  });
}

export function useDeleteForgeContract() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.contracts.delete.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.forge.contracts.list.queryOptions({ input: {} })),
  });
}

// ─── Templates ──────────────────────────────────────────────────────────────

export function useForgeTemplates() {
  return useQuery(orpc.forge.templates.list.queryOptions({ input: {} }));
}

export function useCreateForgeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.templates.create.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.forge.templates.list.queryOptions({ input: {} })),
  });
}

export function useUpdateForgeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.templates.update.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.forge.templates.list.queryOptions({ input: {} })),
  });
}

export function useDeleteForgeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.templates.delete.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.forge.templates.list.queryOptions({ input: {} })),
  });
}

// ─── Settings ───────────────────────────────────────────────────────────────

export function useForgeSettings() {
  return useQuery(orpc.forge.settings.get.queryOptions({ input: {} }));
}

export function useUpdateForgeSettings() {
  const qc = useQueryClient();
  return useMutation({
    ...orpc.forge.settings.update.mutationOptions(),
    onSuccess: () => qc.invalidateQueries(orpc.forge.settings.get.queryOptions({ input: {} })),
  });
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export function useForgeDashboard() {
  return useQuery(orpc.forge.dashboard.get.queryOptions({ input: {} }));
}
