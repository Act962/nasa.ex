"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Link2,
  Package,
  Settings,
  Users,
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV_ITEMS } from "@/features/apps/lib/sidebar-items";
import {
  StatusBadge,
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

  return (
    <>
      <Link
        href={app.href ?? "/nerp"}
        className={cn(
          "group relative flex flex-col rounded-2xl border-2 bg-card transition-all duration-200 overflow-hidden cursor-pointer",
          "hover:border-[#7C3AED] hover:shadow-lg hover:shadow-[#7C3AED]/10 hover:-translate-y-0.5",
          "border-border",
        )}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-[#7C3AED] to-[#a855f7] opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex items-start gap-3 p-5 pb-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-sm">
            <Icon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-black text-sm tracking-wide leading-tight">
                  {app.name}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {app.byline}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={app.status} />
                {conn.connected ? (
                  <Badge
                    variant={conn.isActive ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {conn.isActive ? "Conectado" : "Desativado"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Não conectado
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-4 flex-1">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {app.shortDesc}
          </p>
        </div>

        <div className="px-5 pb-4 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="size-3 shrink-0" />
            <span>{app.activeUsers ?? "—"}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Package className="size-3 shrink-0" />
            <span>{app.category}</span>
          </div>
          {app.integration && app.integration !== "—" && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Link2 className="size-3 shrink-0" />
              <span>{app.integration}</span>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex flex-col gap-2">
          <Button
            size="sm"
            className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5 text-xs"
          >
            Abrir App
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full gap-1.5 text-xs"
            onClick={(e) => {
              // Link envolve o card todo — evitar navegar pro `/nerp` ao
              // clicar em "Configurar".
              e.preventDefault();
              e.stopPropagation();
              setConfigOpen(true);
            }}
          >
            <Settings className="size-3.5" />
            Configurar
          </Button>
          {sidebarItem && (
            <SidebarToggle
              sidebarKey={app.sidebarKey!}
              defaultVisible={sidebarItem.defaultVisible}
            />
          )}
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
