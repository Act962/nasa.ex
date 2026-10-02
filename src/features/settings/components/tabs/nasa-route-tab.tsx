"use client";

import Link from "next/link";
import { GraduationCap, Sparkles, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FreeAccessManager } from "@/features/nasa-route/components/creator/free-access-manager";

export function NasaRouteTab() {
  return (
    <div className="space-y-6 px-4 md:space-y-8 md:px-2">
      <header className="rounded-[24px] border border-line bg-gradient-to-br from-info/10 via-info/5 to-transparent p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-info">
              App de membros
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight max-md:hidden">ÓRBITA Route</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie cursos, acesso livre e vendas dos seus cursos.
            </p>
          </div>
          <Button asChild className="h-11 w-full gap-1.5 rounded-full sm:h-9 sm:w-auto">
            <Link href="/nasa-route/criador">
              Painel do criador
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/nasa-route/criador"
            className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-4 transition hover:shadow-sm"
          >
            <GraduationCap className="size-5 text-info" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Meus cursos</p>
              <p className="text-xs text-muted-foreground">Criar e editar</p>
            </div>
          </Link>
          <Link
            href="/nasa-route/criador/vendas"
            className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-4 transition hover:shadow-sm"
          >
            <Sparkles className="size-5 text-warning" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Vendas</p>
              <p className="text-xs text-muted-foreground">Receber STARs</p>
            </div>
          </Link>
          <Link
            href="/nasa-route/criador/alunos"
            className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-4 transition hover:shadow-sm"
          >
            <Users className="size-5 text-success" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Alunos</p>
              <p className="text-xs text-muted-foreground">Acompanhar progresso</p>
            </div>
          </Link>
        </div>
      </header>

      <section className="rounded-[24px] border border-line bg-card p-4 md:p-6">
        <FreeAccessManager />
      </section>
    </div>
  );
}
