"use client";

import { useState, useEffect } from "react";
import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

interface Org { id: string; name: string }

interface Permission {
  id: string;
  role: string;
  appKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const PERM_KEYS = ["canView", "canCreate", "canEdit", "canDelete"] as const;
const PERM_LABELS: Record<string, string> = {
  canView: "Ver", canCreate: "Criar", canEdit: "Editar", canDelete: "Excluir",
};

export function PermissionsMatrix({
  orgs, allApps, roles,
}: {
  orgs: Org[];
  allApps: string[];
  roles: string[];
}) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState(roles[0]);
  const [orgSearch, setOrgSearch] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const filteredOrgs = orgs.filter((o) =>
    o.name.toLowerCase().includes(orgSearch.toLowerCase())
  );

  const { data: perms, refetch, isLoading } = useQuery({
    queryKey: ["admin-permissions", selectedOrgId],
    queryFn: () => orpc.admin.getOrgPermissions.call({ orgId: selectedOrgId }),
    enabled: !!selectedOrgId,
  });

  // Build a map: role+appKey -> Permission
  const permMap: Record<string, Permission> = {};
  for (const p of perms ?? []) {
    permMap[`${p.role}:${p.appKey}`] = p;
  }

  const setPermMut = useMutation({
    mutationFn: (data: {
      orgId: string; role: string; appKey: string;
      canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean;
    }) => orpc.admin.setOrgPermission.call(data),
    onSuccess: () => refetch(),
    onSettled: (_, __, vars) => {
      const key = `${vars.role}:${vars.appKey}`;
      setPending((p) => { const n = { ...p }; delete n[key]; return n; });
    },
  });

  function togglePerm(appKey: string, permKey: typeof PERM_KEYS[number]) {
    if (!selectedOrgId) return;
    const existing = permMap[`${selectedRole}:${appKey}`];
    const current = existing ?? { canView: true, canCreate: true, canEdit: false, canDelete: false };
    const updated = { ...current, [permKey]: !current[permKey] };
    const key = `${selectedRole}:${appKey}`;
    setPending((p) => ({ ...p, [key]: true }));
    setPermMut.mutate({
      orgId:     selectedOrgId,
      role:      selectedRole,
      appKey,
      canView:   updated.canView,
      canCreate: updated.canCreate,
      canEdit:   updated.canEdit,
      canDelete: updated.canDelete,
    });
  }

  return (
    <div className="grid grid-cols-[220px_1fr] gap-6">
      {/* Org selector */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2 h-fit">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
            placeholder="Buscar empresa..."
            className="w-full pl-8 pr-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white placeholder:text-zinc-600 focus:outline-none"
          />
        </div>
        <div className="max-h-80 overflow-y-auto space-y-0.5">
          {filteredOrgs.map((org) => (
            <button
              key={org.id}
              onClick={() => setSelectedOrgId(org.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                selectedOrgId === org.id
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        {!selectedOrgId ? (
          <p className="text-sm text-zinc-500 text-center py-12">Selecione uma empresa à esquerda.</p>
        ) : (
          <div className="space-y-4">
            {/* Role tabs */}
            <div className="flex gap-2 border-b border-zinc-800 pb-3">
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRole(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedRole === r
                      ? "bg-violet-600 text-white"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {isLoading ? (
              <p className="text-sm text-zinc-500 text-center py-8">Carregando...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-2 pr-4 text-xs font-medium text-zinc-500 w-40">App</th>
                      {PERM_KEYS.map((k) => (
                        <th key={k} className="text-center py-2 px-3 text-xs font-medium text-zinc-500 w-20">
                          {PERM_LABELS[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allApps.map((app) => {
                      const perm = permMap[`${selectedRole}:${app}`];
                      const defaults = { canView: true, canCreate: true, canEdit: false, canDelete: false };
                      const current = perm ?? defaults;
                      const isLoading = pending[`${selectedRole}:${app}`];
                      return (
                        <tr key={app} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="py-2.5 pr-4 text-zinc-300 font-mono text-xs">{app}</td>
                          {PERM_KEYS.map((k) => (
                            <td key={k} className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => togglePerm(app, k)}
                                disabled={isLoading}
                                className={`w-5 h-5 rounded border text-xs font-bold transition-colors ${
                                  current[k]
                                    ? "bg-violet-600 border-violet-500 text-white"
                                    : "bg-zinc-800 border-zinc-700 text-zinc-600"
                                } ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"}`}
                              >
                                {current[k] ? "✓" : ""}
                              </button>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoading && (
              <p className="text-xs text-zinc-600 mt-2">
                * Permissões sem registro usam os padrões: Ver ✓ Criar ✓ Editar ✗ Excluir ✗
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
