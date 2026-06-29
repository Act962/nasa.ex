"use client";

import Link from "next/link";
import {
  Bell,
  Zap,
  Plug,
  KeyRound,
  Trophy,
  CreditCard,
  Users,
  Headphones,
  Webhook,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CommentsShell } from "@/features/comments/components/comments-shell";
import { CommentsConnectCard } from "@/features/comments/components/comments-connect-card";
import { useCommentsConnection } from "@/features/comments/hooks/use-comments-connection";

const DOMAINS = [
  {
    href: "/comments/notifications",
    label: "Notificações",
    desc: "Eventos da plataforma",
    icon: Bell,
  },
  {
    href: "/comments/automations",
    label: "Automações",
    desc: "Fluxos de DM/Comentário",
    icon: Zap,
  },
  {
    href: "/comments/listeners",
    label: "Listeners",
    desc: "Configurar respostas",
    icon: Headphones,
  },
  {
    href: "/comments/triggers",
    label: "Gatilhos",
    desc: "Quando disparar",
    icon: Webhook,
  },
  {
    href: "/comments/keywords",
    label: "Palavras-chave",
    desc: "Termos que ativam",
    icon: KeyRound,
  },
  {
    href: "/comments/integrations",
    label: "Integrações",
    desc: "Contas Meta conectadas",
    icon: Plug,
  },
  {
    href: "/comments/sorteios",
    label: "Sorteios",
    desc: "Coleta de comentários e sorteios",
    icon: Trophy,
  },
  {
    href: "/comments/subscription",
    label: "Plano",
    desc: "Assinatura comments",
    icon: CreditCard,
  },
  {
    href: "/comments/profile",
    label: "Perfil",
    desc: "Dados e posts do usuário",
    icon: Users,
  },
];

export default function CommentsHubPage() {
  const conn = useCommentsConnection();

  return (
    <CommentsShell
      title="comments · Engajamento"
      description="Automatize respostas, rode sorteios e centralize comentários e DMs do Instagram/Facebook."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {conn.connected && conn.isActive ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DOMAINS.map(({ href, label, desc, icon: Icon }) => (
                <Link key={href} href={href}>
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className="size-4" />
                        {label}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {desc}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Conecte primeiro</CardTitle>
                <CardDescription>
                  Após conectar, os domínios do comments aparecem aqui pra
                  navegação.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Use o card ao lado pra iniciar o fluxo de consentimento.
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <CommentsConnectCard />
        </div>
      </div>
    </CommentsShell>
  );
}
