"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CourseForm } from "@/features/nasa-route/components/creator/course-form";

export default function NewCoursePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/nasa-route/criador"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar para o painel
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Novo curso</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Preencha as informações básicas. Você poderá adicionar aulas e módulos depois.
      </p>
      <div className="mt-8">
        <CourseForm />
      </div>
    </div>
  );
}
