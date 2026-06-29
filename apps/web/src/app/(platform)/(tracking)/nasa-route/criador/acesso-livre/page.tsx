"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FreeAccessManager } from "@/features/nasa-route/components/creator/free-access-manager";

export default function FreeAccessPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/nasa-route/criador"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar para o painel
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Acesso livre</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Libere cursos para usuários sem cobrar STARs — ideal para parceiros, beta-testers e
        bolsistas.
      </p>
      <div className="mt-8">
        <FreeAccessManager />
      </div>
    </div>
  );
}
