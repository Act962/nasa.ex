"use client";

import { Shield, Eye, MessageSquare, BarChart3, Settings, Mail } from "lucide-react";

type Permission = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const META_PERMISSIONS: Permission[] = [
  {
    icon: BarChart3,
    title: "Ler suas campanhas e métricas",
    description: "Para mostrar KPIs reais (ROAS, CTR, gasto) no dashboard de Insights.",
  },
  {
    icon: Settings,
    title: "Gerenciar campanhas Meta Ads",
    description: "Para criar, pausar e ajustar campanhas direto pelo NASA.",
  },
  {
    icon: MessageSquare,
    title: "Mensagens de Instagram e Messenger",
    description: "Para responder DMs unificadas no NBox.",
  },
  {
    icon: Eye,
    title: "Listar páginas e contas Instagram",
    description: "Para você escolher quais conectar — sem acesso às demais.",
  },
];

const GOOGLE_PERMISSIONS: Permission[] = [
  {
    icon: BarChart3,
    title: "Acessar Google Ads",
    description: "Para puxar campanhas, conversões e métricas para o Insights.",
  },
  {
    icon: Mail,
    title: "Enviar e-mails pelo Gmail",
    description: "Para disparar mensagens de tracking e workflows.",
  },
  {
    icon: Eye,
    title: "Listar contas que você administra",
    description: "Para você escolher quais conectar.",
  },
];

export function PermissionExplainer({ provider }: { provider: "meta" | "google" }) {
  const items = provider === "meta" ? META_PERMISSIONS : GOOGLE_PERMISSIONS;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Shield className="size-4 text-emerald-500" />
        O que o NASA vai poder fazer:
      </div>
      <ul className="space-y-2.5">
        {items.map((p, i) => (
          <li key={i} className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#7C3AED]/10">
              <p.icon className="size-4 text-[#7C3AED]" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium leading-tight">{p.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{p.description}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Você pode revogar essas permissões a qualquer momento em Configurações ou direto na sua conta {provider === "meta" ? "Facebook" : "Google"}.
      </p>
    </div>
  );
}
