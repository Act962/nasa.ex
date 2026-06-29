"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Award, Calendar, Eye, GraduationCap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { imgSrc } from "@/features/public-calendar/utils/img-src";

export function CertificatesList() {
  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.listMyCertificates.queryOptions(),
  });

  const certificates = data?.certificates ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-violet-300">
            NASA Route
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
            Meus certificados
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os cursos que você concluiu na plataforma.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/nasa-route">Voltar ao catálogo</Link>
        </Button>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : certificates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-16 text-center">
          <Award className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-base font-semibold">
            Você ainda não possui certificados
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conclua um curso no NASA Route para receber seu primeiro certificado.
          </p>
          <Button asChild className="mt-6">
            <Link href="/nasa-route">Explorar cursos</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {certificates.map((c) => (
            <Link
              key={c.id}
              href={`/nasa-route/certificados/${c.code}`}
              className="group flex overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-violet-400 hover:shadow-lg"
            >
              <div className="relative aspect-[16/9] w-32 shrink-0 bg-gradient-to-br from-violet-600 to-fuchsia-600 sm:w-40">
                {c.course.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgSrc(c.course.coverUrl)}
                    alt={c.courseTitle}
                    className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/40">
                    <GraduationCap className="size-10" />
                  </div>
                )}
                <div className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <Award className="size-3" />
                  Concluído
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <h3 className="line-clamp-2 font-semibold leading-tight">
                  {c.courseTitle}
                </h3>
                <p className="text-xs text-muted-foreground">{c.orgName}</p>
                <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" />
                    {new Date(c.issuedAt).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-violet-700 dark:text-violet-300">
                    <Eye className="size-3" />
                    Ver certificado
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {c.code}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
