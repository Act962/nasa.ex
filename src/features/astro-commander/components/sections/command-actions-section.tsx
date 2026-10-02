"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateAstroCommand } from "@/features/astro-commander/hooks/use-astro-commands";
import type { CommandDetailData } from "@/features/astro-commander/components/types";

/**
 * Ações do comando (spec 0028, RF-22): quais ferramentas ele pode usar e quais
 * exigem aprovação. Sem nenhuma marcada, vale o conjunto padrão do papel.
 */
export function CommandActionsSection({ command }: { command: CommandDetailData }) {
  const update = useUpdateAstroCommand();
  const query = useQuery(orpc.astroCommander.tools.list.queryOptions({ input: {} }));
  const [selected, setSelected] = useState<string[]>(command.toolScope);
  const [approvals, setApprovals] = useState<Record<string, boolean>>(
    (command.toolApprovals ?? {}) as Record<string, boolean>,
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof query.data extends undefined ? never[] : NonNullable<typeof query.data>["tools"]>();
    for (const tool of query.data?.tools ?? []) {
      const list = groups.get(tool.group) ?? [];
      list.push(tool);
      groups.set(tool.group, list);
    }
    return [...groups.entries()];
  }, [query.data]);

  const usingDefaults = selected.length === 0;

  function toggleTool(name: string, enabled: boolean) {
    setSelected((current) =>
      enabled ? [...new Set([...current, name])] : current.filter((item) => item !== name),
    );
  }

  function handleSave() {
    update.mutate(
      { id: command.id, toolScope: selected, toolApprovals: approvals },
      {
        onSuccess: () => toast.success("Ações salvas"),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Ações</h2>
          <p className="text-sm text-muted-foreground">
            {usingDefaults
              ? "Nenhuma marcada: o comando usa o conjunto padrão do papel."
              : `${selected.length} ferramentas liberadas.`}
          </p>
        </div>
        <Button onClick={handleSave} disabled={update.isPending} className="h-10 rounded-xl">
          {update.isPending && <OrbitaSpinner className="size-4 " />}
          Salvar
        </Button>
      </div>

      <div className="space-y-6">
        {grouped.map(([group, tools]) => (
          <div key={group} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{group}</h3>
            <div className="divide-y rounded-2xl border bg-card">
              {tools.map((tool) => (
                <div key={tool.name} className="flex items-center gap-3 p-3">
                  <Switch
                    checked={selected.includes(tool.name)}
                    onCheckedChange={(checked) => toggleTool(tool.name, checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-sm">{tool.name}</code>
                      {tool.alwaysRequiresApproval ? (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="size-3" />
                          Sempre aprova
                        </Badge>
                      ) : tool.mutating ? (
                        <Badge variant="outline">Escreve</Badge>
                      ) : null}
                    </div>
                    {tool.description && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {tool.description}
                      </p>
                    )}
                  </div>

                  {tool.mutating && !tool.alwaysRequiresApproval && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Exigir aprovação
                      <Switch
                        checked={Boolean(approvals[tool.name])}
                        onCheckedChange={(checked) =>
                          setApprovals((current) => ({ ...current, [tool.name]: checked }))
                        }
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
