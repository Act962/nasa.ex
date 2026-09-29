import { Switch } from "@/components/ui/switch";
import { CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_META, RoleBadge, PERM_KEYS, PERM_LABELS } from "./role-config";

type MatrixApp = {
  key: string;
  label: string;
  icon: string;
  actionHints?: Partial<Record<string, string>>;
};

interface PermissionMatrixProps {
  apps: MatrixApp[];
  extendedActionsByApp?: Record<string, string[]>;
  matrix: Record<string, Record<string, Record<string, boolean>>>;
  isMaster: boolean;
  onUpdate: (role: string, appKey: string, field: string, val: boolean) => void;
}

const EXTENDED_ACTION_LABELS: Record<string, string> = {
  canApprove: "Aprovar",
  canPay: "Pagar",
};

function describeHints(app: MatrixApp): string | undefined {
  if (!app.actionHints) return undefined;
  return Object.entries(app.actionHints)
    .map(([action, hint]) => `${PERM_LABELS[action]?.label ?? EXTENDED_ACTION_LABELS[action] ?? action}: ${hint}`)
    .join("\n");
}

export function PermissionMatrix({
  apps,
  extendedActionsByApp = {},
  matrix,
  isMaster,
  onUpdate,
}: PermissionMatrixProps) {
  const editableRoles = ["admin", "member", "moderador"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-semibold text-muted-foreground w-40">
              App
            </th>
            {/* Master column (locked) */}
            <th className="py-2 px-2 text-center min-w-[96px]">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
                  ROLE_META.owner.color,
                  ROLE_META.owner.bg,
                )}
              >
                <Lock className="size-2.5" /> Master
              </span>
            </th>
            {editableRoles.map((r) => (
              <th key={r} className="py-2 px-2 text-center min-w-[96px]">
                <RoleBadge role={r} size="xs" />
              </th>
            ))}
          </tr>
          <tr className="border-b bg-muted/20">
            <th />
            {/* Master perms header */}
            <th className="py-1 px-2">
              <div className="flex justify-center gap-1">
                {PERM_KEYS.map((k) => (
                  <span
                    key={k}
                    title={PERM_LABELS[k].label}
                    className="text-[9px] text-muted-foreground w-6 text-center"
                  >
                    {PERM_LABELS[k].label}
                  </span>
                ))}
              </div>
            </th>
            {editableRoles.map((r) => (
              <th key={r} className="py-1 px-2">
                <div className="flex justify-center gap-1">
                  {PERM_KEYS.map((k) => (
                    <span
                      key={k}
                      title={PERM_LABELS[k].label}
                      className="text-[9px] text-muted-foreground w-6 text-center"
                    >
                      {PERM_LABELS[k].label}
                    </span>
                  ))}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr
              key={app.key}
              className="border-b hover:bg-muted/10 transition-colors"
            >
              <td className="py-2 px-3 font-medium" title={describeHints(app)}>
                <span className="mr-1.5">{app.icon}</span>
                {app.label}
                {app.actionHints?.canView && (
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    {app.actionHints.canView}
                  </span>
                )}
              </td>
              {/* Master — always full, locked */}
              <td className="py-2 px-2">
                <div className="flex justify-center gap-1">
                  {PERM_KEYS.map((k) => (
                    <div
                      key={k}
                      className="w-6 flex justify-center"
                      title={PERM_LABELS[k].label}
                    >
                      <CheckCircle2 className="size-3.5 text-violet-500" />
                    </div>
                  ))}
                </div>
              </td>
              {/* Editable roles */}
              {editableRoles.map((role) => (
                <td key={role} className="py-2 px-2">
                  <div className="flex justify-center gap-1">
                    {PERM_KEYS.map((k) => {
                      const val = matrix[role]?.[app.key]?.[k] ?? false;
                      return (
                        <div
                          key={k}
                          className="w-6 flex justify-center"
                          title={app.actionHints?.[k] ?? PERM_LABELS[k].label}
                        >
                          {isMaster ? (
                            <Switch
                              checked={val}
                              onCheckedChange={(v) =>
                                onUpdate(role, app.key, k, v)
                              }
                              className="scale-50 -m-1.5"
                            />
                          ) : val ? (
                            <CheckCircle2 className="size-3.5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="size-3.5 text-slate-300" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ExtendedActionsTable
        apps={apps}
        extendedActionsByApp={extendedActionsByApp}
        editableRoles={editableRoles}
        matrix={matrix}
        isMaster={isMaster}
        onUpdate={onUpdate}
      />
    </div>
  );
}

// Ações além do CRUD (aprovar resgates, aprovar/pagar no financeiro): uma
// linha por ação, para ficar claro o que cada chave libera.
function ExtendedActionsTable({
  apps,
  extendedActionsByApp,
  editableRoles,
  matrix,
  isMaster,
  onUpdate,
}: {
  apps: MatrixApp[];
  extendedActionsByApp: Record<string, string[]>;
  editableRoles: string[];
  matrix: Record<string, Record<string, Record<string, boolean>>>;
  isMaster: boolean;
  onUpdate: (role: string, appKey: string, field: string, val: boolean) => void;
}) {
  const rows = apps.flatMap((app) =>
    (extendedActionsByApp[app.key] ?? []).map((action) => ({ app, action })),
  );
  if (rows.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground">Ações especiais</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Ação</th>
            <th className="py-2 px-2 text-center min-w-[96px]">
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", ROLE_META.owner.color, ROLE_META.owner.bg)}>
                <Lock className="size-2.5" /> Master
              </span>
            </th>
            {editableRoles.map((role) => (
              <th key={role} className="py-2 px-2 text-center min-w-[96px]">
                <RoleBadge role={role} size="xs" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ app, action }) => (
            <tr key={`${app.key}-${action}`} className="border-b hover:bg-muted/10 transition-colors">
              <td className="py-2 px-3">
                <p className="font-medium">
                  <span className="mr-1.5">{app.icon}</span>
                  {app.label} · {EXTENDED_ACTION_LABELS[action] ?? action}
                </p>
                {app.actionHints?.[action] && (
                  <p className="text-[10px] text-muted-foreground">{app.actionHints[action]}</p>
                )}
              </td>
              <td className="py-2 px-2">
                <div className="flex justify-center">
                  <CheckCircle2 className="size-3.5 text-violet-500" />
                </div>
              </td>
              {editableRoles.map((role) => {
                const isEnabled = matrix[role]?.[app.key]?.[action] ?? false;
                return (
                  <td key={role} className="py-2 px-2">
                    <div className="flex justify-center">
                      {isMaster ? (
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(value) => onUpdate(role, app.key, action, value)}
                          className="scale-75"
                        />
                      ) : isEnabled ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="size-3.5 text-slate-300" />
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
