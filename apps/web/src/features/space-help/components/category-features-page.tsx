"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Youtube } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function CategoryFeaturesPage({ categorySlug }: { categorySlug: string }) {
  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.listCategories.queryOptions(),
  });

  const category = data?.categories.find((c) => c.slug === categorySlug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center text-muted-foreground">
        Categoria não encontrada.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
      <Link
        href="/space-help"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="size-4" />
        Voltar para Space Help
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-2 text-muted-foreground">{category.description}</p>
        )}
      </header>

      {category.features.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center text-muted-foreground">
          Nenhuma funcionalidade publicada nesta categoria.
        </div>
      ) : (
        <ul className="space-y-2">
          {category.features.map((f) => (
            <li key={f.id}>
              <Link
                href={`/space-help/${category.slug}/${f.slug}`}
                className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 hover:border-violet-500/50 transition group"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold leading-tight group-hover:text-violet-700 dark:group-hover:text-violet-300 transition">
                    {f.title}
                  </h3>
                  {f.summary && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {f.summary}
                    </p>
                  )}
                </div>
                {f.youtubeUrl && (
                  <Youtube className="size-4 shrink-0 text-red-500 mt-1" />
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground mt-1 transition group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
