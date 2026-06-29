"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  ChevronLeft,
  GraduationCap,
  Plus,
  Users,
  TrendingUp,
  BookOpen,
  Eye,
  EyeOff,
  Pencil,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { COURSE_FORMAT_LABELS, COURSE_LEVEL_LABELS } from "../../types";
import { PriceStarsDisplay } from "../shared/price-stars-display";
import { imgSrc } from "@/features/public-calendar/utils/img-src";

export function CreatorDashboard() {
  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.creatorListCourses.queryOptions(),
  });

  const courses = data?.courses ?? [];
  const published = courses.filter((c) => c.isPublished);
  const totalStudents = courses.reduce((acc, c) => acc + c.studentsCount, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/nasa-route"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar para NASA Route
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel do Criador</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie e gerencie seus cursos. Receba 90% do valor pago em STARs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/nasa-route/criador/vendas">
              <TrendingUp className="size-4" />
              Vendas
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/nasa-route/criador/alunos">
              <Users className="size-4" />
              Alunos
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/nasa-route/criador/acesso-livre">
              <Gift className="size-4" />
              Acesso livre
            </Link>
          </Button>
          <Button asChild className="gap-1.5">
            <Link href="/nasa-route/criador/curso/novo">
              <Plus className="size-4" />
              Novo curso
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<BookOpen className="size-5 text-violet-600" />}
          label="Cursos"
          value={courses.length.toString()}
          sub={`${published.length} publicados`}
        />
        <StatCard
          icon={<Users className="size-5 text-emerald-600" />}
          label="Alunos"
          value={totalStudents.toLocaleString("pt-BR")}
          sub="total acumulado"
        />
        <StatCard
          icon={<TrendingUp className="size-5 text-amber-600" />}
          label="Aulas publicadas"
          value={courses
            .reduce((acc, c) => acc + (c._count?.lessons ?? 0), 0)
            .toString()}
          sub="em todos os cursos"
        />
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Seus cursos</h2>
        {isLoading ? (
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <GraduationCap className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Você ainda não criou nenhum curso</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Comece criando seu primeiro curso e ganhe STARs por aluno.
            </p>
            <Button asChild className="mt-4">
              <Link href="/nasa-route/criador/curso/novo">Criar primeiro curso</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/nasa-route/criador/curso/${c.id}/editar`}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:shadow-sm"
              >
                <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
                  {c.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgSrc(c.coverUrl)}
                      alt={c.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-violet-500/40">
                      <GraduationCap className="size-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant={c.isPublished ? "default" : "secondary"} className="gap-1">
                      {c.isPublished ? (
                        <>
                          <Eye className="size-3" />
                          Publicado
                        </>
                      ) : (
                        <>
                          <EyeOff className="size-3" />
                          Rascunho
                        </>
                      )}
                    </Badge>
                    <span>·</span>
                    <span>{COURSE_FORMAT_LABELS[c.format] ?? c.format}</span>
                    <span>·</span>
                    <span>{COURSE_LEVEL_LABELS[c.level] ?? c.level}</span>
                  </div>
                  <h3 className="mt-1 truncate text-base font-semibold">{c.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {c._count.lessons} aulas · {c._count.enrollments} alunos
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <PriceStarsDisplay
                    priceBrlCents={(c as any).displayPriceBrlCents}
                    isFree={(c as any).isFree}
                    size="md"
                  />
                  <Pencil className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
