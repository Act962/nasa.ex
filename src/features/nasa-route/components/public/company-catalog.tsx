"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { ArrowLeft, GraduationCap, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CourseCard } from "../shared/course-card";

interface CompanyCatalogProps {
  companySlug: string;
}

export function CompanyCatalog({ companySlug }: CompanyCatalogProps) {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    ...orpc.nasaRoute.publicListByCompany.queryOptions({
      input: { companySlug },
    }),
  });

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const backButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className="mb-4 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Voltar
    </Button>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        {backButton}
        <Skeleton className="h-32 rounded-3xl" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="mb-6 text-left">{backButton}</div>
        <div className="text-center">
        <h1 className="text-2xl font-bold">Página não encontrada</h1>
        <p className="mt-2 text-muted-foreground">
          A organização que você procura não existe ou ainda não publicou cursos.
        </p>
        </div>
      </div>
    );
  }

  const { org, courses } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {backButton}
      <header className="rounded-3xl border border-border bg-gradient-to-br from-violet-600/10 via-indigo-500/5 to-fuchsia-500/5 p-8">
        <div className="flex flex-wrap items-center gap-4">
          {org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logo}
              alt={org.name}
              className="size-16 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <GraduationCap className="size-8" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-violet-300">
              Área de Membros · NASA Route
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{org.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {courses.length} {courses.length === 1 ? "curso publicado" : "cursos publicados"}
            </p>
          </div>
        </div>
      </header>

      <section className="mt-8">
        {courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-16 text-center">
            <Search className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Esta organização ainda não publicou cursos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                href={`/c/${org.slug}/${c.slug}`}
                course={{ ...c, creatorOrg: { name: org.name, logo: org.logo } }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
