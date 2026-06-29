import { Switch } from "@/components/ui/switch";
import { CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_META, RoleBadge, PERM_KEYS, PERM_LABELS } from "./role-config";

interface PermissionMatrixProps {
  apps: { key: string; label: string; icon: string }[];
  matrix: Record<string, Record<string, Record<string, boolean>>>;
  isMaster: boolean;
  onUpdate: (role: string, appKey: string, field: string, val: boolean) => void;
}

export function PermissionMatrix({
  apps,
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
              <td className="py-2 px-3 font-medium">
                <span className="mr-1.5">{app.icon}</span>
                {app.label}
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
                          title={PERM_LABELS[k].label}
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
    </div>
  );
}
