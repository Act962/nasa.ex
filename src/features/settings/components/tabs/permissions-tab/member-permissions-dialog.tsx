"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSetMemberPermissions } from "@/features/permissions/hooks/use-member-permissions";
import {
  ALL_APPS,
  EXTENDED_ACTIONS_BY_APP,
  ROLE_LABELS,
  type AppPermissions,
  type PermissionAction,
} from "@/features/permissions/lib/app-permission-catalog";

const BASE_ACTIONS: { action: PermissionAction; label: string }[] = [
  { action: "canView", label: "Ver" },
  { action: "canCreate", label: "Criar" },
  { action: "canEdit", label: "Editar" },
  { action: "canDelete", label: "Excluir" },
];

const EXTENDED_LABELS: Partial<Record<PermissionAction, string>> = { canApprove: "Aprovar", canPay: "Pagar" };

interface MemberPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: { userId: string; name: string; role: string };
  /** Permissões do papel da pessoa, por app (matriz já resolvida). */
  rolePermissions: Record<string, AppPermissions>;
  /** Exceções já salvas da pessoa, por app. */
  savedOverrides: Record<string, AppPermissions>;
}

/** Permissões de UMA pessoa (spec 0152): cada app segue o papel ou tem exceção própria. */
export function MemberPermissionsDialog({ open, onOpenChange, member, rolePermissions, savedOverrides }: MemberPermissionsDialogProps) {
  const [overrides, setOverrides] = useState<Record<string, AppPermissions>>(savedOverrides);
  const setMemberPermissions = useSetMemberPermissions();

  const effectiveFor = (appKey: string): AppPermissions => overrides[appKey] ?? rolePermissions[appKey];

  const toggle = (appKey: string, action: PermissionAction, isEnabled: boolean) => {
    const next = { ...effectiveFor(appKey), [action]: isEnabled };
    // Sem "Ver" o resto não faz sentido; ligar qualquer ação liga o "Ver".
    if (action === "canView" && !isEnabled) Object.assign(next, { canCreate: false, canEdit: false, canDelete: false, canApprove: false, canPay: false });
    if (action !== "canView" && isEnabled) next.canView = true;
    setOverrides({ ...overrides, [appKey]: next });
  };

  const resetApp = (appKey: string) => {
    const { [appKey]: _removed, ...rest } = overrides;
    setOverrides(rest);
  };

  const save = () => {
    setMemberPermissions.mutate(
      { userId: member.userId, overrides: Object.entries(overrides).map(([appKey, permissions]) => ({ appKey, ...permissions })) },
      {
        onSuccess: () => {
          toast.success(`Permissões de ${member.name} salvas.`);
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message || "Não foi possível salvar."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permissões de {member.name}</DialogTitle>
          <DialogDescription>
            Cada app segue o papel {ROLE_LABELS[member.role] ?? member.role} até você mudar algo. Sem &quot;Ver&quot;, o app some do menu dessa pessoa.
          </DialogDescription>
        </DialogHeader>

        <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-xl border">
          {ALL_APPS.map((app) => {
            const permissions = effectiveFor(app.key);
            const isCustom = Boolean(overrides[app.key]);
            const actions = [
              ...BASE_ACTIONS,
              ...(EXTENDED_ACTIONS_BY_APP[app.key] ?? []).map((action) => ({ action, label: EXTENDED_LABELS[action] ?? action })),
            ];
            return (
              <li key={app.key} className={cn("space-y-2 px-3 py-3", !permissions?.canView && "opacity-70")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <span aria-hidden>{app.icon}</span>
                    <span className="truncate">{app.label}</span>
                  </span>
                  {isCustom ? (
                    <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => resetApp(app.key)}>
                      <RotateCcw className="size-3" /> Voltar ao padrão
                    </Button>
                  ) : (
                    <span className="shrink-0 text-[11px] text-muted-foreground">Padrão do papel</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {actions.map(({ action, label }) => (
                    <label key={action} className="flex items-center gap-1.5 text-xs">
                      <Switch
                        checked={Boolean(permissions?.[action])}
                        onCheckedChange={(isEnabled) => toggle(app.key, action, isEnabled)}
                        aria-label={`${label} em ${app.label}`}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={setMemberPermissions.isPending}>
            {setMemberPermissions.isPending ? "Salvando..." : "Salvar permissões"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
