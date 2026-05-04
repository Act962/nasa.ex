"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Users,
  ChevronDown,
  ChevronUp,
  Lock,
  UserPlus,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { ROLE_META, RoleBadge } from "./role-config";
import { PermissionMatrix } from "./permission-matrix";
import { MemberList } from "./member-list";
import { AddMemberDialog } from "./add-member-dialog";
import { StarsHistory } from "./stars-history";
import { MetaAccountsTab } from "./meta-accounts-tab";
import { usePermissionsMutations } from "./hooks/use-permissions-mutations";

export function PermissionsTab() {
  const { data: session } = authClient.useSession();
  const [showMatrix, setShowMatrix] = useState(true);
  const [showMetaAccounts, setShowMetaAccounts] = useState(false);

  // Add member dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    ...orpc.permissions.getPermissions.queryOptions(),
  });

  const { updatePerm, updateRole, removeMember, addMember } =
    usePermissionsMutations();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const currentMember = data?.members.find(
    (m) => m.userId === session?.user.id,
  );
  const isMaster = currentMember?.role === "owner";
  const isModerador = currentMember?.role === "moderador";
  const canManage = isMaster || isModerador;

  const handlePermUpdate = (
    role: string,
    appKey: string,
    field: string,
    val: boolean,
  ) => {
    const cur = data?.matrix?.[role]?.[appKey];
    if (!cur) return;
    updatePerm.mutate({
      role,
      appKey,
      canView: field === "canView" ? val : cur.canView,
      canCreate: field === "canCreate" ? val : cur.canCreate,
      canEdit: field === "canEdit" ? val : cur.canEdit,
      canDelete: field === "canDelete" ? val : cur.canDelete,
    });
  };

  const handleAddMember = (formData: {
    email: string;
    name: string;
    role: "owner" | "admin" | "member" | "moderador";
  }) => {
    addMember.mutate(formData, {
      onSuccess: (data) => {
        if (data.isNewUser && data.tempPassword) {
          setCreatedPassword(data.tempPassword);
        } else {
          toast.success("Usuário adicionado à organização!");
          setAddDialogOpen(false);
        }
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Permissões</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Controle o acesso de cada tipo de usuário aos apps e ferramentas da
            empresa
          </p>
        </div>
        {currentMember && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground mb-1">Seu cargo</p>
            <RoleBadge role={currentMember.role} />
          </div>
        )}
      </div>

      {/* ── Role legend ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(ROLE_META).map(([role, meta]) => (
          <div
            key={role}
            className={cn(
              "rounded-xl border p-3 space-y-1",
              meta.bg,
              meta.border,
            )}
          >
            <span className={cn("text-xs font-bold", meta.color)}>
              {meta.label}
            </span>
            <p className="text-[11px] text-muted-foreground">
              {meta.description}
            </p>
          </div>
        ))}
      </div>

      {/* ── Members table ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Users className="size-4" /> Participantes (
            {data?.members.length ?? 0})
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              ⭐ {(data?.starsBalance ?? 0).toLocaleString("pt-BR")} stars na
              conta
            </span>
            {canManage && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  setCreatedPassword(null);
                  setAddDialogOpen(true);
                }}
              >
                <UserPlus className="size-3.5" />
                Adicionar Usuário
              </Button>
            )}
          </div>
        </div>

        <MemberList
          members={(data?.members as any) ?? []}
          currentUserId={session?.user.id}
          isMaster={isMaster}
          canManage={canManage}
          onUpdateRole={(memberId, role) =>
            updateRole.mutate({
              memberId,
              role: role as any,
            })
          }
          onRemoveMember={(memberId) => removeMember.mutate(memberId)}
        />
      </div>

      {/* ── Permission Matrix ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <button
          className="flex items-center gap-2 text-base font-semibold w-full text-left"
          onClick={() => setShowMatrix((v) => !v)}
        >
          <Shield className="size-4" />
          Matriz de Permissões
          {showMatrix ? (
            <ChevronUp className="size-4 ml-auto" />
          ) : (
            <ChevronDown className="size-4 ml-auto" />
          )}
        </button>

        {showMatrix && (
          <div className="rounded-xl border overflow-hidden">
            {!isMaster && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b text-xs text-amber-700 dark:text-amber-400">
                <Lock className="size-3.5" /> Apenas o Master pode editar as
                permissões
              </div>
            )}
            <div className="p-2">
              <PermissionMatrix
                apps={data?.apps ?? []}
                matrix={data?.matrix ?? {}}
                isMaster={isMaster}
                onUpdate={handlePermUpdate}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Acesso por conta Meta ─────────────────────────────────────────── */}
      {isMaster && (
        <div className="space-y-3">
          <button
            className="flex items-center gap-2 text-base font-semibold w-full text-left"
            onClick={() => setShowMetaAccounts((v) => !v)}
          >
            <Building2 className="size-4" />
            Acesso por conta Meta
            {showMetaAccounts ? (
              <ChevronUp className="size-4 ml-auto" />
            ) : (
              <ChevronDown className="size-4 ml-auto" />
            )}
          </button>

          {showMetaAccounts && <MetaAccountsTab />}
        </div>
      )}

      {/* ── Stars usage ───────────────────────────────────────────────────── */}
      {isMaster && (
        <StarsHistory transactions={(data?.starTransactions as any) ?? []} />
      )}

      {/* ── Add User Dialog ───────────────────────────────────────────────── */}
      <AddMemberDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        isAdding={addMember.isPending}
        isMaster={isMaster}
        onAdd={handleAddMember}
        createdPassword={createdPassword}
        resetCreatedPassword={() => setCreatedPassword(null)}
      />
    </div>
  );
}
