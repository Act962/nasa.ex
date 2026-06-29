"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Search, Sparkles, Youtube } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SpaceHelpSidebarNav() {
  const pathname = usePathname() || "";
  const [query, setQuery] = useState("");
  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.listCategories.queryOptions(),
  });

  const filtered = useMemo(() => {
    if (!data?.categories) return [];
    if (!query.trim()) return data.categories;
    const q = query.toLowerCase();
    return data.categories
      .map((c) => ({
        ...c,
        features: c.features.filter(
          (f) =>
            f.title.toLowerCase().includes(q) ||
            (f.summary?.toLowerCase().includes(q) ?? false),
        ),
      }))
      .filter((c) => c.name.toLowerCase().includes(q) || c.features.length > 0);
  }, [data, query]);

  return (
    <aside className="w-full md:w-72 lg:w-80 shrink-0 border-r border-border bg-card/30">
      <div className="p-4">
        <Link
          href="/space-help"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Sparkles className="size-4 text-violet-600" />
          NASA Space Help
        </Link>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar funcionalidade…"
            className="pl-8 h-9"
          />
        </div>
      </div>

      <nav className="px-2 pb-8 max-h-[calc(100vh-12rem)] overflow-y-auto">
        {isLoading && (
          <div className="space-y-3 px-2 mt-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {filtered.map((cat) => (
          <CategoryNode
            key={cat.id}
            category={cat}
            pathname={pathname}
            forceOpen={!!query.trim()}
          />
        ))}

        {!isLoading && filtered.length === 0 && (
          <p className="px-3 py-6 text-sm text-muted-foreground text-center">
            Nada encontrado para "{query}"
          </p>
        )}
      </nav>
    </aside>
  );
}

function CategoryNode({
  category,
  pathname,
  forceOpen,
}: {
  category: any;
  pathname: string;
  forceOpen: boolean;
}) {
  const isActive = pathname.startsWith(`/space-help/${category.slug}`);
  const [open, setOpen] = useState(isActive || forceOpen);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
          isActive ? "bg-violet-600/10 text-violet-700 dark:text-violet-300" : "hover:bg-muted",
        )}
      >
        <span className="truncate">{category.name}</span>
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            (open || forceOpen) && "rotate-90",
          )}
        />
      </button>

      {(open || forceOpen) && (
        <ul className="mt-0.5 ml-2 border-l border-border pl-2 space-y-0.5">
          {category.features.map((f: any) => {
            const href = `/space-help/${category.slug}/${f.slug}`;
            const active = pathname === href;
            return (
              <li key={f.id}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition",
                    active
                      ? "bg-violet-600 text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <span className="truncate flex-1">{f.title}</span>
                  {f.youtubeUrl && (
                    <Youtube
                      className={cn(
                        "size-3 shrink-0",
                        active ? "text-white" : "text-red-500",
                      )}
                    />
                  )}
                </Link>
              </li>
            );
          })}
          {category.features.length === 0 && (
            <li className="px-2.5 py-1.5 text-[13px] text-muted-foreground">
              (vazia)
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
