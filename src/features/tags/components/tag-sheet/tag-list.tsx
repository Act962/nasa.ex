import { useMemo, useState } from "react";
import { ArchiveIcon, SearchIcon, TagIcon } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useArchivedTags, useTags } from "@/features/tags/hooks/use-tags";
import { useTagGroups } from "@/features/tags/hooks/use-tag-groups";
import { useDebouncedValue } from "@/hooks/use-debounced";
import { cn } from "@/lib/utils";
import { TagItem } from "./tag-item";
import { ArchivedTagItem } from "./archived-tag-item";

export function TagList() {
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const normalizedSearch = debouncedSearch.trim().toLowerCase();

  const { tags, isLoadingTags } = useTags({ trackingId: "ALL" });
  const { tags: archivedTags, isLoadingTags: isLoadingArchived } =
    useArchivedTags({ trackingId: "ALL" });

  const { data: groupsData } = useTagGroups();

  const filteredTags = useMemo(
    () =>
      normalizedSearch
        ? tags.filter((tag) =>
            tag.name.toLowerCase().includes(normalizedSearch),
          )
        : tags,
    [tags, normalizedSearch],
  );

  const filteredArchivedTags = useMemo(
    () =>
      normalizedSearch
        ? archivedTags.filter((tag) =>
            tag.name.toLowerCase().includes(normalizedSearch),
          )
        : archivedTags,
    [archivedTags, normalizedSearch],
  );

  const groupedTags = useMemo(() => {
    const groups = groupsData?.groups ?? [];
    const groupMap = new Map<
      string | null,
      { id: string | null; name: string; color: string; tags: typeof tags }
    >();
    for (const group of groups) {
      groupMap.set(group.id, {
        id: group.id,
        name: group.name,
        color: group.color,
        tags: [],
      });
    }
    groupMap.set(null, {
      id: null,
      name: "Sem categoria",
      color: "#6b7280",
      tags: [],
    });
    for (const tag of filteredTags) {
      const key = tag.tagGroupId ?? null;
      const bucket = groupMap.get(key) ?? groupMap.get(null)!;
      bucket.tags.push(tag);
    }
    return Array.from(groupMap.values()).filter(
      (bucket) => bucket.tags.length > 0,
    );
  }, [filteredTags, groupsData]);

  return (
    <div className="px-4 flex flex-col flex-1 min-h-0">
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar tag..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="flex items-center gap-2 border-b mb-3">
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={cn(
            "px-2 py-1.5 text-sm font-medium border-b-2 transition-colors",
            activeTab === "active"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Ativas
          {tags.length > 0 && (
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              {tags.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("archived")}
          className={cn(
            "px-2 py-1.5 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-1.5",
            activeTab === "archived"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <ArchiveIcon className="size-3.5" />
          Arquivadas
          {archivedTags.length > 0 && (
            <span className="text-[10px] text-amber-600">
              {archivedTags.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-start content-start flex-wrap gap-2 mt-2 flex-1 min-h-0 pb-4 scroll-cols-tracking">
        {activeTab === "active" && (
          <>
            {isLoadingTags &&
              Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="w-12 h-4" />
              ))}
            {!isLoadingTags && filteredTags.length > 0 && (
              <div className="w-full space-y-3">
                {groupedTags.map((group) => (
                  <div key={group.id ?? "uncat"} className="space-y-1.5">
                    <div className="flex items-center gap-2 pb-1 border-b">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: group.color }}
                      />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">
                        {group.tags.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.tags.map((tag) => (
                        <TagItem key={tag.id} {...tag} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoadingTags &&
              filteredTags.length === 0 &&
              (tags.length > 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma tag encontrada</EmptyTitle>
                    <EmptyDescription>
                      Nenhuma tag ativa corresponde a &ldquo;{debouncedSearch}
                      &rdquo;.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <TagIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma tag cadastrada</EmptyTitle>
                    <EmptyDescription>
                      Adicione tags para categorizar seus leads.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ))}
          </>
        )}

        {activeTab === "archived" && (
          <>
            {isLoadingArchived &&
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="w-12 h-4" />
              ))}
            {!isLoadingArchived &&
              filteredArchivedTags.length > 0 &&
              filteredArchivedTags.map((tag) => (
                <ArchivedTagItem key={tag.id} {...tag} />
              ))}
            {!isLoadingArchived &&
              filteredArchivedTags.length === 0 &&
              (archivedTags.length > 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma tag encontrada</EmptyTitle>
                    <EmptyDescription>
                      Nenhuma tag arquivada corresponde a &ldquo;
                      {debouncedSearch}&rdquo;.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ArchiveIcon />
                    </EmptyMedia>
                    <EmptyTitle>Nenhuma tag arquivada</EmptyTitle>
                    <EmptyDescription>
                      Tags arquivadas preservam o histórico mas não aparecem nos
                      pickers de criação.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
