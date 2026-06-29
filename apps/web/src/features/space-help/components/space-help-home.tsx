"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, GraduationCap, Sparkles, Youtube } from "lucide-react";
import { TracksGrid } from "./tracks-grid";
import { SetupProgressWidget } from "./setup-progress-widget";

export function SpaceHelpHome() {
  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.listCategories.queryOptions(),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-violet-600/10 via-fuchsia-500/5 to-amber-500/5 p-6 md:p-10">
        <div className="flex items-center gap-2 text-xs font-medium text-violet-700 dark:text-violet-300">
          <Sparkles className="size-4" />
          NASA Space Help
        </div>
        <h1 className="mt-2 text-3xl md:text-5xl font-bold tracking-tight">
          Aprenda. Evolua. Domine o NASA.
        </h1>
        <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-3xl">
          Rotas de Conhecimento para escalar seu negócio + tutoriais práticos de cada
          funcionalidade da plataforma. Conclua rotas e ganhe Stars, Space Points e
          selos exclusivos.
        </p>
      </div>

      {/* Widget de progresso do Setup Inicial NASA — gamifica os 5 passos críticos */}
      <div className="mt-6">
        <SetupProgressWidget />
      </div>

      <Tabs defaultValue="tracks" className="mt-8">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="tracks" className="data-[state=active]:bg-background">
            <GraduationCap className="size-4 mr-2" />
            Rotas de Conhecimento
          </TabsTrigger>
          <TabsTrigger value="features" className="data-[state=active]:bg-background">
            <BookOpen className="size-4 mr-2" />
            Funcionalidades
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="mt-6">
          <TracksGrid />
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : !data?.categories.length ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center text-muted-foreground">
              Nenhuma categoria publicada ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {data.categories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <h3 className="text-lg font-bold tracking-tight">{cat.name}</h3>
                  {cat.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {cat.description}
                    </p>
                  )}
                  <ul className="mt-4 space-y-1">
                    {cat.features.slice(0, 5).map((f) => (
                      <li key={f.id}>
                        <Link
                          href={`/space-help/${cat.slug}/${f.slug}`}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition"
                        >
                          <span className="flex-1 truncate">{f.title}</span>
                          {f.youtubeUrl && (
                            <Youtube className="size-3.5 text-red-500" />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {cat.features.length > 5 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      + {cat.features.length - 5} outras funcionalidades
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
