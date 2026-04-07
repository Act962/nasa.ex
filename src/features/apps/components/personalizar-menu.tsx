"use client";

import { Suspense } from "react";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarPrefs, useSetSidebarPref, isItemVisible } from "@/hooks/use-sidebar-prefs";
import { SIDEBAR_NAV_ITEMS } from "@/lib/sidebar-items";
import { useSuspenseWokspaces } from "@/features/workspace/hooks/use-workspace";
import { SidebarToggle } from "./app-card";

// ─── Workspace Toggles ────────────────────────────────────────────────────────

export function WorkspaceToggles() {
  const { data } = useSuspenseWokspaces();
  const { data: prefs } = useSidebarPrefs();
  const setPref = useSetSidebarPref();

  if (data.workspaces.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhum projeto encontrado.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {data.workspaces.map((ws) => {
        const visible = isItemVisible(prefs, `workspace:${ws.id}`, true);
        return (
          <div
            key={ws.id}
            className="flex items-center justify-between p-3 rounded-xl border bg-card gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0 text-base">{ws.icon}</span>
              <span className="text-sm font-medium truncate">{ws.name}</span>
            </div>
            <button
              onClick={() =>
                setPref.mutate({ itemKey: `workspace:${ws.id}`, visible: !visible })
              }
              title={visible ? "Ocultar da barra lateral" : "Mostrar na barra lateral"}
              className={cn(
                "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors shrink-0",
                visible
                  ? "bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20"
                  : "bg-muted text-muted-foreground border-border hover:border-violet-500/30 hover:text-violet-400",
              )}
            >
              <PanelLeft className="size-2.5" />
              {visible ? "No menu" : "Oculto"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Personalizar Menu ────────────────────────────────────────────────────────

export function PersonalizarMenu() {
  const configurableItems = SIDEBAR_NAV_ITEMS.filter((item) => !item.alwaysVisible);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold mb-1 text-foreground">Apps no menu lateral</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Escolha quais apps aparecem na sua barra lateral.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {configurableItems.map((item) => {
            const Icon = item.icon as React.ElementType;
            return (
              <div
                key={item.key}
                className="flex items-center justify-between p-3 rounded-xl border bg-card gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{item.title}</span>
                </div>
                <SidebarToggle
                  sidebarKey={item.key}
                  defaultVisible={item.defaultVisible}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-1 text-foreground">Projetos no menu lateral</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Escolha quais projetos (workspaces) aparecem na sua barra lateral.
        </p>
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Carregando projetos...</p>}
        >
          <WorkspaceToggles />
        </Suspense>
      </div>
    </div>
  );
}
