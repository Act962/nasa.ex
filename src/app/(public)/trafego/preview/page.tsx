import Link from "next/link";
import { ArrowRight, LayoutDashboard, ShieldCheck } from "lucide-react";
import { PREVIEW_ORDER_ID } from "@/features/trafego/lib/preview-fixtures";

const SCREENS = [
  {
    href: "/trafego/preview/painel",
    icon: LayoutDashboard,
    title: "Painel do cliente — lista",
    description: "Três pedidos, cada um num status e canal diferente.",
  },
  {
    href: `/trafego/preview/painel/${PREVIEW_ORDER_ID}`,
    icon: LayoutDashboard,
    title: "Painel do cliente — detalhe",
    description:
      "As quatro abas: Materiais (criativos e copy), Andamento, Desempenho com KPIs e Suporte.",
  },
  {
    href: "/trafego/preview/admin",
    icon: ShieldCheck,
    title: "Painel da equipe — fila",
    description: "Tabela de pedidos com filtros e o alerta de valor divergente.",
  },
  {
    href: `/trafego/preview/admin/${PREVIEW_ORDER_ID}`,
    icon: ShieldCheck,
    title: "Painel da equipe — detalhe",
    description: "Materiais, briefing, histórico, conversa e o vínculo da campanha.",
  },
];

export default function TrafegoPreviewIndex() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Preview do trafeGO</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Telas do painel com dados fictícios, sem banco e sem login. São os
        componentes reais — editar o componente reflete aqui.
      </p>

      <div className="mt-6 grid gap-3">
        {SCREENS.map((screen) => (
          <Link
            key={screen.href}
            href={screen.href}
            className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40"
          >
            <screen.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{screen.title}</span>
              <span className="block text-sm text-muted-foreground">
                {screen.description}
              </span>
            </span>
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      <p className="mt-8 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
        Botões que gravam (ativar campanha, enviar mensagem, mudar status) mostram
        erro de propósito — o modo preview não tem banco. O que funciona é tudo
        que é visual: abas, formulários, upload de arquivo na tela, responsivo.
      </p>
    </div>
  );
}
