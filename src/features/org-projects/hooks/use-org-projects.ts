"use client";

import { orpc } from "@/lib/orpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useOrgProjects(opts?: { type?: string; isActive?: boolean }) {
  const { data, isLoading } = useQuery(
    orpc.orgProjects.list.queryOptions({ input: opts ?? {} }),
  );
  return { projects: data?.projects ?? [], isLoading };
}

export function useOrgProject(projectId: string) {
  const { data, isLoading } = useQuery({
    ...orpc.orgProjects.get.queryOptions({ input: { projectId } }),
    enabled: !!projectId,
  });
  return { project: data?.project, isLoading };
}

export function useCreateOrgProject() {
  const qc = useQueryClient();
  return useMutation(
    orpc.orgProjects.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.orgProjects.list.key() });
        toast.success("Projeto/Cliente criado!");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao criar"),
    }),
  );
}

export function useUpdateOrgProject() {
  const qc = useQueryClient();
  return useMutation(
    orpc.orgProjects.update.mutationOptions({
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: orpc.orgProjects.list.key() });
        qc.invalidateQueries({
          queryKey: orpc.orgProjects.get.key({
            input: { projectId: (vars as any).projectId },
          }),
        });
        toast.success("Projeto/Cliente atualizado!");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar"),
    }),
  );
}

export function useDeleteOrgProject() {
  const qc = useQueryClient();
  return useMutation(
    orpc.orgProjects.delete.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.orgProjects.list.key() });
        toast.success("Projeto/Cliente desativado.");
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao remover"),
    }),
  );
}
