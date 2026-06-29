import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";

export function usePermissionsMutations() {
  const qc = useQueryClient();

  const updatePerm = useMutation({
    mutationFn: (v: {
      role: string;
      appKey: string;
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
    }) => orpc.permissions.updatePermission.call(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permissions"] });
      toast.success("Permissão atualizada");
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Erro ao atualizar permissão"),
  });

  const updateRole = useMutation({
    mutationFn: (v: {
      memberId: string;
      role: "owner" | "admin" | "member" | "moderador";
    }) => orpc.permissions.updateMemberRole.call(v),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Cargo atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar cargo"),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      orpc.permissions.removeMember.call({ memberId }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Membro removido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover membro"),
  });

  const addMember = useMutation({
    mutationFn: (v: {
      email: string;
      name: string;
      role: "owner" | "admin" | "member" | "moderador";
    }) => orpc.permissions.createMember.call(v),
    onSuccess: () => {
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar usuário"),
  });

  return {
    updatePerm,
    updateRole,
    removeMember,
    addMember,
  };
}
