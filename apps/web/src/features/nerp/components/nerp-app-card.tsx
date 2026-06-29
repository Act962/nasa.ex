"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV_ITEMS } from "@/features/apps/lib/sidebar-items";
import {
  SidebarToggle,
  type AppDef,
} from "@/features/apps/components/app-card";
import { useNerpConnection } from "@/features/nerp/hooks/use-nerp-connection";

// Card customizado pro NERP: além do "Abrir App" padrão (vai pra `/nerp`),
// expõe um botão "Configurar" que abre um wizard explicando os 4 passos
// pra conectar a integração — útil pra quem ainda não autorizou.
export function NerpAppCard({ app }: { app: AppDef }) {
  const [configOpen, setConfigOpen] = useState(false);
  const conn = useNerpConnection();
  const Icon = app.icon;
  const sidebarItem = app.sidebarKey
    ? SIDEBAR_NAV_ITEMS.find((i) => i.key === app.sidebarKey)
    : null;
  const SidebarIcon = sidebarItem?.icon as React.ElementType | undefined;

  return (
    <>
      <Link
        href={app.href ?? "/nerp"}
        className={cn(
          "group relative flex flex-col rounded-2xl border bg-card transition-all duration-300 overflow-hidden cursor-pointer",
          "hover:border-[#7C3AED]/60 hover:shadow-lg hover:shadow-[#7C3AED]/15 hover:-translate-y-1",
          "before:absolute before:inset-0 before:rounded-2xl before:bg-linear-to-br before:from-[#7C3AED]/[0.03] before:to-transparent before:pointer-events-none",
        )}
      >
        <div className="absolute inset-0 rounded-2xl ring-1 ring-[#7C3AED]/0 group-hover:ring-[#7C3AED]/30 transition-all pointer-events-none" />

        {/* Botão "+"/"-" flutuante canto superior direito */}
        {sidebarItem && (
          <div
            className="absolute top-2.5 right-2.5 z-10"
            onClick={(e) => e.preventDefault()}
          >
            <SidebarToggle
              sidebarKey={app.sidebarKey!}
              defaultVisible={sidebarItem.defaultVisible}
            />
          </div>
        )}

        {/* Conexão dot mini canto superior esquerdo */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <div
            title={
              conn.connected
                ? conn.isActive
                  ? "Conectado"
                  : "Desativado"
                : "Não conectado"
            }
            className={cn(
              "size-2 rounded-full ring-2 ring-background",
              conn.connected
                ? conn.isActive
                  ? "bg-emerald-500"
                  : "bg-zinc-400"
                : "bg-amber-500",
            )}
          />
        </div>

        {/* Body */}
        <div className="relative flex flex-col items-center justify-center gap-2.5 px-3 pt-8 pb-3 flex-1">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:shadow-[#7C3AED]/25">
            <Icon />
          </div>
          <div className="text-center min-w-0 w-full px-1">
            <h3 className="font-bold text-[13px] tracking-tight leading-tight truncate">
              {app.name}
            </h3>
            <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
              {app.byline}
            </p>
          </div>
        </div>

        <div className="px-3 pb-2">
          <p className="text-[10.5px] text-muted-foreground leading-snug line-clamp-2 text-center min-h-[28px]">
            {app.shortDesc}
          </p>
        </div>

        {/* Menu chip — preview do ícone+nome no sidebar */}
        {sidebarItem && SidebarIcon && (
          <div className="px-3 pb-2 flex justify-center">
            <div
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40"
              title={`No menu lateral: ${sidebarItem.title}`}
            >
              <SidebarIcon className="size-3" />
              <span>{sidebarItem.title}</span>
            </div>
          </div>
        )}

        {/* Action buttons — Abrir + Configurar lado a lado, h-7 */}
        <div className="px-3 pb-3 flex gap-1.5">
          <button
            type="button"
            className={cn(
              "flex-1 h-7 rounded-md text-[11px] font-medium",
              "bg-linear-to-r from-[#7C3AED] to-[#8B5CF6] text-white",
              "hover:from-[#6D28D9] hover:to-[#7C3AED] transition-all",
              "shadow-sm hover:shadow-md hover:shadow-[#7C3AED]/25",
              "flex items-center justify-center gap-1",
            )}
          >
            Abrir
          </button>
          <button
            type="button"
            onClick={(e) => {
              // Link envolve o card todo — evitar navegar pro /nerp ao
              // clicar em "Configurar".
              e.preventDefault();
              e.stopPropagation();
              setConfigOpen(true);
            }}
            title="Configurar"
            aria-label="Configurar"
            className={cn(
              "shrink-0 h-7 w-7 rounded-md text-[11px]",
              "border border-border/60 bg-background hover:bg-muted",
              "flex items-center justify-center",
            )}
          >
            <Settings className="size-3.5" />
          </button>
        </div>
      </Link>

      <NerpSetupDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        connected={conn.connected}
      />
    </>
  );
}

// Wizard explicativo curto. Não controla o fluxo — só lista os passos.
function NerpSetupDialog({
  open,
  onOpenChange,
  connected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  connected: boolean;
}) {
  const steps = [
    {
      title: "Crie sua conta no nerp",
      body: "Acesse nasaerp.com e cadastre seu email — é gratuito.",
      cta: {
        label: "Abrir nasaerp.com",
        href: "https://www.nasaerp.com/",
        external: true as const,
      },
    },
    {
      title: "Cadastre ou escolha sua empresa",
      body: "Após o login, crie a empresa que você quer integrar (ou selecione uma existente).",
    },
    {
      title: "Conecte a integração",
      body: "Volte aqui no NASA, abra o app NERP e autorize o acesso quando o nerp pedir.",
      cta: connected
        ? undefined
        : {
            label: "Conectar agora",
            href: "/api/integrations/nerp/start?returnUrl=%2Fapps",
            external: false as const,
          },
    },
    {
      title: "Pronto",
      body: "Suas credenciais ficam salvas no NASA. Produtos, vendas, estoque e dashboards do nerp passam a aparecer aqui.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-4 text-[#7C3AED]" />
            Como conectar o NERP
          </DialogTitle>
          <DialogDescription>
            4 passos rápidos pra usar o ERP dentro do NASA.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  connected && i < steps.length - 1
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-[#7C3AED]/15 text-[#7C3AED]",
                )}
              >
                {connected && i < steps.length - 1 ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              <div className="space-y-1 flex-1">
                <div className="text-sm font-medium leading-tight">
                  {step.title}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.body}
                </p>
                {step.cta && (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs mt-1"
                  >
                    {step.cta.external ? (
                      <a
                        href={step.cta.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {step.cta.label}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <a href={step.cta.href}>
                        {step.cta.label}
                        <ArrowRight className="size-3" />
                      </a>
                    )}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
