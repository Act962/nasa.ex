"use client";

import { Suspense } from "react";
import { PanelLeft, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSidebarPrefs,
  useSetSidebarPref,
  useSetHomeApp,
  getHomeAppKey,
  isItemVisible,
} from "@/hooks/use-sidebar-prefs";
import { SIDEBAR_NAV_ITEMS } from "@/features/apps/lib/sidebar-items";
import { OFF_MENU_HOME_APPS } from "@/features/apps/lib/app-signup-link";
import { useSuspenseWokspaces } from "@/features/workspace/hooks/use-workspace";
import { SidebarToggle } from "./app-card";

// ─── Workspace Toggles ────────────────────────────────────────────────────────

export function WorkspaceToggles() {
  const { data } = useSuspenseWokspaces();
  const { data: prefs } = useSidebarPrefs();
  const setPref = useSetSidebarPref();

  if (data.workspaces.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum projeto encontrado.
      </p>
    );

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
                setPref.mutate({
                  itemKey: `workspace:${ws.id}`,
                  visible: !visible,
                })
              }
              title={
                visible
                  ? "Ocultar da barra lateral"
                  : "Mostrar na barra lateral"
              }
              className={cn(
                "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors shrink-0",
                visible
                  ? "bg-info/10 text-info border-info/30 hover:bg-info/20"
                  : "bg-muted text-muted-foreground border-border hover:border-info/30 hover:text-info",
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

// ─── App principal ────────────────────────────────────────────────────────────

/**
 * Marca o app que abre primeiro ao entrar no Órbita. Só um por vez — clicar no
 * que já está marcado desfaz a escolha e devolve o Início como tela inicial.
 */
function HomeAppToggle({
  appKey,
  appTitle,
}: {
  appKey: string;
  appTitle: string;
}) {
  const { data: prefs } = useSidebarPrefs();
  const setHomeApp = useSetHomeApp();
  const isPrimary = getHomeAppKey(prefs) === appKey;

  return (
    <button
      type="button"
      onClick={() => setHomeApp.mutate({ appKey: isPrimary ? null : appKey })}
      title={
        isPrimary
          ? `${appTitle} abre primeiro ao entrar. Clique para desfazer.`
          : `Fazer o ${appTitle} abrir primeiro ao entrar no Órbita`
      }
      className={cn(
        "flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
        isPrimary
          ? "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
          : "border-border text-muted-foreground hover:border-warning/30 hover:text-warning",
      )}
    >
      <Star className={cn("size-3", isPrimary && "fill-current")} />
      {isPrimary ? "App principal" : "Definir como principal"}
    </button>
  );
}

// ─── Personalizar Menu ────────────────────────────────────────────────────────

export function PersonalizarMenu() {
  const configurableItems = SIDEBAR_NAV_ITEMS.filter(
    (item) => !item.alwaysVisible,
  );
  // Astro, Astro Chat, Comments, NERP: sem item no menu, mas podem ser o app principal.
  const offMenuApps = OFF_MENU_HOME_APPS.filter((app) => !app.hidden);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold mb-1 text-foreground">
          Apps no menu lateral
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Escolha quais apps aparecem na sua barra lateral.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {configurableItems.map((item) => {
            const Icon = item.icon as React.ElementType;
            return (
              <div
                key={item.key}
                className="flex flex-col gap-2 p-3 rounded-xl border bg-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {item.title}
                    </span>
                  </div>
                  <SidebarToggle
                    sidebarKey={item.key}
                    defaultVisible={item.defaultVisible}
                  />
                </div>
                <HomeAppToggle appKey={item.key} appTitle={item.title} />
              </div>
            );
          })}
        </div>
      </div>

      {offMenuApps.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-1 text-foreground">
            Outros apps
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Não ficam no menu lateral, mas também podem abrir primeiro ao entrar no Órbita.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {offMenuApps.map((app) => {
              const Icon = app.lineIcon;
              return (
                <div key={app.id} className="flex flex-col gap-2 p-3 rounded-xl border bg-card">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{app.name}</span>
                  </div>
                  <HomeAppToggle appKey={app.id} appTitle={app.name} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-1 text-foreground">
          Projetos no menu lateral
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Escolha quais projetos (workspaces) aparecem na sua barra lateral.
        </p>
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">
              Carregando projetos...
            </p>
          }
        >
          <WorkspaceToggles />
        </Suspense>
      </div>
    </div>
  );
}
