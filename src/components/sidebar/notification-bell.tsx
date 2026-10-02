"use client";

import { useState, useCallback } from "react";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ICON_MODE_BUTTON, ICON_MODE_LABEL } from "./icon-mode";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useNotifications } from "./hooks/use-notifications";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const TYPE_ICON: Record<string, string> = {
  NEW_LEAD: "🎯",
  AI_TOKEN_ALERT: "🤖",
  STARS_ALERT: "⭐",
  CARD_EDIT: "📝",
  APPOINTMENT_REMINDER: "📅",
  INSIGHTS_MOVEMENT: "📊",
  PLAN_EXPIRY: "⚠️",
  ADMIN_MESSAGE: "📢",
  CUSTOM: "🔔",
  info: "ℹ️",
  warning: "⚠️",
  success: "✅",
  error: "❌",
};

const TYPE_COLOR: Record<string, string> = {
  AI_TOKEN_ALERT: "text-info",
  STARS_ALERT: "text-warning",
  PLAN_EXPIRY: "text-destructive",
  ADMIN_MESSAGE: "text-info",
  NEW_LEAD: "text-success",
  info: "text-info",
  warning: "text-warning",
  success: "text-success",
  error: "text-destructive",
};

const TARGET_LABEL: Record<string, string> = {
  all: "Geral",
  org: "Empresa",
  user: "Para você",
};

const TARGET_STYLE: Record<string, string> = {
  all: "bg-info/15 text-info border-info/30",
  org: "bg-warning/15 text-warning border-warning/30",
  user: "bg-info/15 text-info border-info/30",
};

const SEVERITY_LABEL: Record<string, string> = {
  info: "Info",
  warning: "Atenção",
  critical: "Crítico",
};

const SEVERITY_STYLE: Record<string, string> = {
  info: "bg-info/15 text-info border-info/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const SEVERITY_ITEM_BORDER: Record<string, string> = {
  info: "",
  warning: "border-l-2 border-l-warning/60",
  critical: "border-l-2 border-l-destructive/70",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const {
    notifications,
    unread,
    isLoading,
    markAllRead,
    isMarkingAllRead,
    handleNotifClick,
  } = useNotifications();

  const onNotifClick = useCallback(
    (n: any) => {
      handleNotifClick(n, () => setOpen(false));
    },
    [handleNotifClick],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <PopoverTrigger asChild>
          <SidebarMenuButton
            size="default"
            className={cn(
              "relative transition-all duration-200",
              ICON_MODE_BUTTON,
              open &&
                "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
            )}
            tooltip="Notificações"
          >
            <span className="relative shrink-0">
              <Bell
                className={cn(
                  "size-4",
                  unread > 0 && "animate-[wiggle_1.5s_ease-in-out_infinite]",
                )}
              />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-3.5 h-3.5 px-0.5 bg-destructive rounded-full text-[8px] font-bold text-white flex items-center justify-center leading-none pointer-events-none">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </span>

            <span className={ICON_MODE_LABEL}>Notificações</span>

            {isLoading && (
              <OrbitaSpinner className="ml-auto size-3 opacity-40 shrink-0 group-data-[collapsible=icon]:hidden" />
            )}
          </SidebarMenuButton>
        </PopoverTrigger>
      </SidebarMenuItem>

      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        className="w-80 p-0 bg-popover border-line shadow-2xl rounded-[20px] overflow-hidden z-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-panel">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-info" />
            Notificações
            {unread > 0 && (
              <span className="bg-destructive text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {unread}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={() => markAllRead()}
                disabled={isMarkingAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Ler todas
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                router.push("/settings/notifications");
              }}
              className="text-sm text-muted-foreground hover:text-info transition-colors"
              title="Configurar notificações"
            >
              ⚙
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-70 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-8 h-8 mx-auto mb-3 text-muted-foreground/70" />
              <p className="text-xs text-muted-foreground">
                Nenhuma notificação por aqui
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => onNotifClick(n)}
                className={cn(
                  "flex gap-3 px-4 py-3 border-b border-line cursor-pointer transition-all hover:bg-muted",
                  !n.isRead && "bg-panel",
                  // severity opcional — só aparece pra warning/critical
                  SEVERITY_ITEM_BORDER[
                    (n as { severity?: string }).severity ?? ""
                  ] ?? "",
                )}
              >
                <span className="text-base shrink-0 mt-0.5">
                  {TYPE_ICON[n.type] ?? "🔔"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    {n.targetType && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider border",
                          TARGET_STYLE[n.targetType] ??
                            "bg-muted text-muted-foreground border-line",
                        )}
                      >
                        {TARGET_LABEL[n.targetType] ?? n.targetType}
                      </span>
                    )}
                    {(n as { severity?: string }).severity &&
                      (n as { severity: string }).severity !== "info" && (
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider border",
                            SEVERITY_STYLE[
                              (n as { severity: string }).severity
                            ] ?? "bg-muted text-muted-foreground border-line",
                          )}
                        >
                          {SEVERITY_LABEL[
                            (n as { severity: string }).severity
                          ] ?? (n as { severity: string }).severity}
                        </span>
                      )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "text-xs font-semibold leading-tight",
                        TYPE_COLOR[n.type] ?? "text-foreground",
                        n.isRead && "text-muted-foreground font-medium",
                      )}
                    >
                      {n.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground/70 shrink-0">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-xs mt-0.5 line-clamp-2",
                      n.isRead ? "text-muted-foreground" : "text-muted-foreground",
                    )}
                  >
                    {n.body}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {!n.isRead && (
                      <span className="w-1.5 h-1.5 bg-info rounded-full" />
                    )}
                    {n.actionUrl && (
                      <span className="text-[10px] text-info flex items-center gap-0.5 font-medium">
                        <ExternalLink className="w-2.5 h-2.5" /> Ver →
                      </span>
                    )}
                    {n.isRead && <Check className="w-3 h-3 text-muted-foreground/70" />}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-panel text-center">
          <button
            onClick={() => {
              setOpen(false);
              router.push("/settings/notifications");
            }}
            className="text-[11px] font-medium text-info hover:underline transition-colors"
          >
            Configurações de notificações →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
