"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFiltersStore } from "../store/filters-store";
import {
  usePublicCategories,
  usePublicLocations,
  usePublicOrganizations,
} from "../hooks/use-public-events";
import { BR_STATES } from "../utils/categories";
import { imgSrc } from "../utils/img-src";
import type { EventCategory } from "@/generated/prisma/enums";

export function FiltersSidebar({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const {
    state,
    city,
    category,
    organizationId,
    search,
    setState,
    setCity,
    setCategory,
    setOrganizationId,
    setSearch,
    reset,
  } = useFiltersStore();
  const { data: categoriesData } = usePublicCategories();
  const { data: locationsData } = usePublicLocations();
  const { data: organizationsData } = usePublicOrganizations();

  const citiesForState = state
    ? locationsData?.states.find((s) => s.state === state)?.cities ?? []
    : [];

  const hasActive = !!(search || category || state || city || organizationId);

  return (
    <aside className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition lg:px-5"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Filtros</span>
          {hasActive && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {[search, category, state, city, organizationId].filter(Boolean).length}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="flex flex-col gap-4 px-4 pb-4 pt-1 lg:px-5">
          <div className="space-y-1.5">
            <Label htmlFor="cal-search" className="text-xs">
              Buscar
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cal-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Título ou palavra-chave"
                className="h-9 pl-8"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select
              value={category ?? "__all"}
              onValueChange={(v) =>
                setCategory(v === "__all" ? null : (v as EventCategory))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as categorias</SelectItem>
                {categoriesData?.categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="mr-1.5">{c.emoji}</span>
                    {c.label}
                    {c.count > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({c.count})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Empresa</Label>
            <Select
              value={organizationId ?? "__all"}
              onValueChange={(v) =>
                setOrganizationId(v === "__all" ? null : v)
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as empresas</SelectItem>
                {organizationsData?.organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <span className="flex items-center gap-2">
                      {org.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgSrc(org.logo)}
                          alt={org.name}
                          className="size-4 rounded-full bg-white object-cover ring-1 ring-border"
                        />
                      ) : (
                        <span className="flex size-4 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-[8px] font-bold text-white">
                          {org.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate">{org.name}</span>
                      {org.count > 0 && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          ({org.count})
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Estado (UF)</Label>
            <Select
              value={state ?? "__all"}
              onValueChange={(v) => setState(v === "__all" ? null : v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos os estados</SelectItem>
                {BR_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.value} · {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {state && citiesForState.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Cidade</Label>
              <Select
                value={city ?? "__all"}
                onValueChange={(v) => setCity(v === "__all" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas as cidades</SelectItem>
                  {citiesForState.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="justify-start text-xs text-muted-foreground"
          >
            <RotateCcw className="mr-1.5 h-3 w-3" />
            Limpar filtros
          </Button>
        </div>
      </div>
    </aside>
  );
}
