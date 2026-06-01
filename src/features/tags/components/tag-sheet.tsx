"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateTag } from "@/features/tags/hooks/use-tag";
import {
  useDeleteTag,
  useTags,
  useArchivedTags,
  useRestoreTag,
  usePurgeTag,
  useReferencedWorkflows,
  useUpdateTag,
} from "@/features/tags/hooks/use-tags";
import { tagFormSchema, type TagFormSchema } from "@/features/tags/schema";
import { TagType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { getContrastColor } from "@/utils/get-contrast-color";
import { DEFAULT_UI_COLORS } from "@/utils/whatsapp-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CheckIcon,
  ChevronRightIcon,
  FolderIcon,
  PlusIcon,
  TagIcon,
  Trash2Icon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useRef, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useQueryListTrackings } from "@/features/insights/hooks/use-dashboard";
import { toast } from "sonner";
import { useTagGroups } from "@/features/tags/hooks/use-tag-groups";
import { TagGroupManager } from "@/features/tags/components/tag-group-manager";
import { DuplicateResolver } from "@/features/tags/components/duplicate-resolver";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId?: string;
}

export function TagSheet({ open, onOpenChange, trackingId }: Props) {
  const [trackingSelected, setTrackingSelected] = useState<string | undefined>(
    trackingId,
  );
  // Toggle "Limitar a este tracking" — default OFF (tag org-wide visível
  // em todos os trackings). Quando ON, tag fica scoped no trackingSelected.
  const [scopeToTracking, setScopeToTracking] = useState(false);
  // Tab atual: "active" (default) ou "archived"
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const inputRef = useRef<HTMLInputElement>(null);
  const form = useForm<TagFormSchema>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: "",
      color: DEFAULT_UI_COLORS[0],
      description: "",
    },
  });
  const [showDescription, setShowDescription] = useState(false);

  // Tags ativas (default — picker/listagem padrão) e arquivadas (aba sep)
  const { tags, isLoadingTags } = useTags({ trackingId: "ALL" });
  const { tags: archivedTags, isLoadingTags: isLoadingArchived } =
    useArchivedTags({ trackingId: "ALL" });

  // Grupos de tags pra render agrupada + manager dialog
  const { data: groupsData } = useTagGroups();
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  // Duplicatas detectadas — surface via banner amber clicável
  const { data: dupData } = useQuery(
    orpc.tags.getDuplicateTags.queryOptions({ input: undefined }),
  );
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [selectedGroupForCreate, setSelectedGroupForCreate] = useState<
    string | null
  >(null);

  // Agrupa tags ativas por grupo (lista agrupada na aba Ativas).
  // Forma: [{ group: TagGroup | null, tags: Tag[] }] — null = "Sem categoria"
  const groupedTags = useMemo(() => {
    const groups = groupsData?.groups ?? [];
    const groupMap = new Map<
      string | null,
      { id: string | null; name: string; color: string; tags: typeof tags }
    >();
    // Init: grupo "Sem categoria" por último
    for (const g of groups) {
      groupMap.set(g.id, {
        id: g.id,
        name: g.name,
        color: g.color,
        tags: [],
      });
    }
    groupMap.set(null, {
      id: null,
      name: "Sem categoria",
      color: "#6b7280",
      tags: [],
    });
    for (const tag of tags) {
      const key = tag.tagGroupId ?? null;
      const bucket = groupMap.get(key) ?? groupMap.get(null)!;
      bucket.tags.push(tag);
    }
    // Filtra grupos vazios EXCETO se for "Sem categoria" e há tags lá
    return Array.from(groupMap.values()).filter((b) => b.tags.length > 0);
  }, [tags, groupsData]);

  const { trackings } = useQueryListTrackings();
  const createTag = useCreateTag();
  const { ref: nameInputRegisterRef, ...nameInputProps } = form.register("name");
  const tagName = form.watch("name");
  const tagColor = form.watch("color");

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    setTrackingSelected(trackingId);
  }, [trackingId]);

  const handleCreateTag = (data: TagFormSchema) => {
    // Validação: precisa de tracking só quando scopeToTracking=true.
    // Quando OFF (default), tag é org-wide e trackingId=null.
    if (scopeToTracking && !trackingSelected) {
      toast.error("Selecione um tracking pra limitar a tag");
      return;
    }
    const trimmedDescription = data.description?.trim() ?? "";
    createTag.mutate(
      {
        name: data.name,
        // null = org-wide (visível em todos os trackings da org).
        // Com toggle ON = restrita ao tracking selecionado (legacy mode).
        trackingId: scopeToTracking ? trackingSelected ?? null : null,
        color: data.color,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        // Grupo opcional escolhido no Select acima do form.
        tagGroupId: selectedGroupForCreate,
      },
      {
        onSuccess: () => {
          form.reset({
            name: "",
            color: data.color,
            description: "",
          });
          setShowDescription(false);
          inputRef.current?.focus();
        },
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tags</SheetTitle>
          <SheetDescription>
            Adicione tags para categorizar seus leads.
          </SheetDescription>
        </SheetHeader>

        {/* Banner de duplicatas — só aparece quando há grupos duplicados.
            Operador clica → dialog mostra cards lado-a-lado com leads/
            automações por tag pra escolher conscientemente qual manter. */}
        {dupData && dupData.totalGroups > 0 && (
          <button
            type="button"
            onClick={() => setDuplicatesOpen(true)}
            className="mx-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 px-3 py-2 text-left hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
          >
            <AlertTriangleIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                {dupData.totalGroups} grupo(s) de duplicatas detectado(s)
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Clique pra escolher qual manter (preserva leads + automações).
              </p>
            </div>
          </button>
        )}

        <div className="space-y-4 ">
          {/* Toggle de escopo: Org-wide (default) ↔ Tracking-only.
              Ao ativar, mostra seletor de tracking. */}
          <div className="px-4 space-y-2 border rounded-md p-3 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="scope-toggle" className="cursor-pointer">
                Limitar a este tracking
              </Label>
              <Switch
                id="scope-toggle"
                checked={scopeToTracking}
                onCheckedChange={setScopeToTracking}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {scopeToTracking
                ? "Tag vai existir só no tracking selecionado."
                : "Tag fica disponível em todos os trackings da organização (recomendado)."}
            </p>
            {scopeToTracking && (
              <Select
                disabled={isLoadingTags}
                value={trackingSelected}
                onValueChange={setTrackingSelected}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um tracking" />
                </SelectTrigger>
                <SelectContent>
                  {trackings?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <form
            onSubmit={form.handleSubmit(handleCreateTag)}
            className="px-4 space-y-2"
          >
            {!trackingId && <Label>Nova Tag</Label>}
            <InputGroup>
              <InputGroupAddon>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Selecionar cor"
                      className="size-5 rounded-sm cursor-pointer"
                      style={{ backgroundColor: tagColor }}
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <div className="flex flex-wrap gap-1.5">
                      {DEFAULT_UI_COLORS.map((color) => {
                        const isSelected = tagColor === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Cor ${color}`}
                            className={cn(
                              "size-5 rounded-sm cursor-pointer hover:scale-110 transition-transform",
                              isSelected && "ring-1 ring-offset-1 ring-primary",
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => form.setValue("color", color)}
                          />
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </InputGroupAddon>
              <InputGroupInput
                ref={(element) => {
                  nameInputRegisterRef(element);
                  inputRef.current = element;
                }}
                placeholder="Adicionar tag"
                {...nameInputProps}
                autoFocus
              />
              <InputGroupAddon align="inline-end">
                <Button
                  size="icon-xs"
                  type="submit"
                  disabled={!tagName || tagName.length === 0 || createTag.isPending}
                >
                  <CheckIcon />
                </Button>
              </InputGroupAddon>
            </InputGroup>

            {showDescription ? (
              <Textarea
                placeholder="Descrição da tag"
                rows={3}
                {...form.register("description")}
              />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowDescription(true)}
              >
                <PlusIcon className="size-3" />
                Adicionar descrição
              </Button>
            )}

            {/* Select de grupo + botão "Gerenciar grupos" inline. Default
                "Sem categoria"; user pode pular se não quiser categorizar. */}
            <div className="flex items-center gap-2">
              <Select
                value={selectedGroupForCreate ?? "__none__"}
                onValueChange={(v) =>
                  setSelectedGroupForCreate(v === "__none__" ? null : v)
                }
              >
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {(groupsData?.groups ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: g.color }}
                        />
                        {g.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setGroupManagerOpen(true)}
                title="Gerenciar grupos"
              >
                <FolderIcon className="size-3.5" />
              </Button>
            </div>
          </form>

          <Separator className="my-4" />

          <div className="px-4 h-full">
            {/* Tabs Ativas / Arquivadas. Arquivadas mostra contador no badge. */}
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

            <div className="flex items-center flex-wrap gap-2 mt-2 overflow-y-auto max-h-[calc(100vh-15rem)]">
              {activeTab === "active" && (
                <>
                  {isLoadingTags &&
                    Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="w-12 h-4" />
                    ))}
                  {!isLoadingTags && tags.length > 0 && (
                    <div className="w-full space-y-3">
                      {/* Renderiza tags AGRUPADAS por TagGroup. Cada grupo
                          tem header com nome + cor; tags ficam embaixo em
                          flex-wrap. Grupos vazios são omitidos. */}
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

                  {!isLoadingTags && tags.length === 0 && (
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
                  )}
                </>
              )}

              {activeTab === "archived" && (
                <>
                  {isLoadingArchived &&
                    Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="w-12 h-4" />
                    ))}
                  {!isLoadingArchived &&
                    archivedTags.length > 0 &&
                    archivedTags.map((tag) => (
                      <ArchivedTagItem key={tag.id} {...tag} />
                    ))}
                  {!isLoadingArchived && archivedTags.length === 0 && (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <ArchiveIcon />
                        </EmptyMedia>
                        <EmptyTitle>Nenhuma tag arquivada</EmptyTitle>
                        <EmptyDescription>
                          Tags arquivadas preservam o histórico mas não
                          aparecem nos pickers de criação.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>

      <TagGroupManager
        open={groupManagerOpen}
        onOpenChange={setGroupManagerOpen}
      />
      <DuplicateResolver
        open={duplicatesOpen}
        onOpenChange={setDuplicatesOpen}
      />
    </Sheet>
  );
}

interface TagItemProps {
  color: string;
  type: TagType;
  name: string;
  id: string;
  slug: string;
  description: string | null;
  icon: string | null;
  whatsappId: string | null;
  /** Vem do procedure `tags.listTags` — count de workflows ativos que
   *  referenciam essa tag em algum node TAG/LEAD_TAGGED. Mostra badge
   *  amber e dispara confirm dialog ao arquivar/editar quando > 0. */
  automationCount?: number;
  /** Count de leads vinculados (LeadTag.count) — usado pra exibir stats
   *  no popover de edit (volume de uso) + dialog de mesclar duplicatas. */
  leadCount?: number;
  /** Grupo da tag (null = "Sem categoria"). Vem do procedure list. */
  tagGroupId?: string | null;
  /** True quando archivedAt != null (computado server-side). */
  isArchived?: boolean;
}

export function TagItem(tag: TagItemProps) {
  const [open, setOpen] = useState(false);
  // Confirm dialog antes de arquivar quando automationCount > 0
  const [confirmArchive, setConfirmArchive] = useState(false);
  // Mostra/esconde a lista de workflows referenciadores dentro do popover
  const [showWorkflows, setShowWorkflows] = useState(false);
  const form = useForm<TagFormSchema>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: tag.name,
      color: tag.color,
      description: tag.description ?? "",
    },
  });
  // Grupo selecionado no popover de edit (mover tag pra outro grupo).
  // Inicializado com o grupo atual da tag — null = "Sem categoria".
  const [editGroupId, setEditGroupId] = useState<string | null>(
    tag.tagGroupId ?? null,
  );
  const { data: groupsData } = useTagGroups();
  const [showDescription, setShowDescription] = useState(
    Boolean(tag.description),
  );
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const tagName = form.watch("name");
  const tagColor = form.watch("color");
  const automationCount = tag.automationCount ?? 0;

  // Carrega workflows que referenciam essa tag — só quando dialog
  // de confirmação OU lista expandida no popover estão abertos.
  const { data: workflowsData, isLoading: loadingWorkflows } =
    useReferencedWorkflows(
      confirmArchive || showWorkflows ? tag.id : null,
    );

  const handleArchive = () => {
    if (automationCount > 0) {
      // Tag está em uso — abre dialog de confirmação que lista workflows
      setConfirmArchive(true);
      return;
    }
    // Caminho rápido sem confirmação
    archiveNow();
  };

  const archiveNow = () => {
    deleteTag.mutate(
      { tagId: tag.id },
      {
        onSuccess: () => {
          setOpen(false);
          setConfirmArchive(false);
        },
      },
    );
  };

  const handleUpdateTag = (data: TagFormSchema) => {
    const trimmedDescription = data.description?.trim() ?? "";
    updateTag.mutate(
      {
        tagId: tag.id,
        name: data.name,
        color: data.color,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        // Move pra outro grupo (ou desassocia com null). Backend já
        // aceita esse campo em `tag.update` desde a Fase 1.
        tagGroupId: editGroupId,
      },
      {
        onSuccess: () => {
          setOpen(false);
          form.reset(data);
        },
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge
          key={tag.id}
          style={{
            backgroundColor: tag.color,
            color: getContrastColor(tag.color),
          }}
          className="cursor-pointer focus-visible:ring-0 outline-none gap-1"
        >
          {tag.name}
          {/* Badge de leads (azul) — sempre visível pra dar contexto de
              volume de uso. Click no popover mostra detalhes. */}
          {(tag.leadCount ?? 0) > 0 && (
            <span
              className="inline-flex items-center justify-center size-4 rounded-full bg-blue-500 text-white text-[9px] font-bold leading-none gap-0.5"
              title={`${tag.leadCount} lead(s) vinculado(s)`}
            >
              <UsersIcon className="size-2" />
              {tag.leadCount}
            </span>
          )}
          {/* Badge de automações (amber) — só aparece quando > 0.
              Alerta visual antes do user editar/arquivar pra evitar
              romper workflows inadvertidamente. */}
          {automationCount > 0 && (
            <span
              className="inline-flex items-center justify-center size-4 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none gap-0.5"
              title={`${automationCount} automação${automationCount > 1 ? "ões" : ""} usa(m) essa tag`}
            >
              <ZapIcon className="size-2" />
              {automationCount}
            </span>
          )}
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="p-0">
        <form
          onSubmit={form.handleSubmit(handleUpdateTag)}
          className="flex flex-col gap-2 p-2"
        >
          <InputGroup>
            <InputGroupAddon>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Selecionar cor"
                    className="size-5 rounded-sm cursor-pointer"
                    style={{
                      backgroundColor: tagColor,
                    }}
                  />
                </PopoverTrigger>
                <PopoverContent>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_UI_COLORS.map((color) => {
                      const isSelected = tagColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Cor ${color}`}
                          className={cn(
                            "size-5 rounded-sm cursor-pointer hover:scale-110 transition-transform",
                            isSelected && "ring-1 ring-offset-1 ring-primary",
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => form.setValue("color", color)}
                        />
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Nome da tag"
              {...form.register("name")}
            />
            <InputGroupAddon align="inline-end">
              <Button
                size="icon-xs"
                type="submit"
                disabled={!tagName || tagName.length === 0 || updateTag.isPending}
              >
                <CheckIcon />
              </Button>
            </InputGroupAddon>
          </InputGroup>

          {showDescription ? (
            <Textarea
              placeholder="Descrição da tag"
              rows={3}
              {...form.register("description")}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              onClick={() => setShowDescription(true)}
            >
              <PlusIcon className="size-3" />
              Adicionar descrição
            </Button>
          )}

          {/* Select de grupo — MOVE a tag pra outro grupo (ou tira dela com
              "Sem categoria"). Salva IMEDIATAMENTE ao selecionar (auto-save)
              — antes dependia do botão ✓ que o user esquecia de clicar,
              resultando em "criei grupo mas não salvou nada". */}
          <div className="flex items-center gap-2">
            <FolderIcon className="size-3.5 text-muted-foreground shrink-0" />
            <Select
              value={editGroupId ?? "__none__"}
              onValueChange={(v) => {
                const newGroupId = v === "__none__" ? null : v;
                setEditGroupId(newGroupId);
                // Persiste IMEDIATO — não espera clicar ✓
                updateTag.mutate({
                  tagId: tag.id,
                  name: tag.name,
                  color: tag.color,
                  tagGroupId: newGroupId,
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem categoria</SelectItem>
                {(groupsData?.groups ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: g.color }}
                      />
                      {g.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>
        <Separator />
        {/* Stats — leads + automações lado a lado. Click no count de
            automações expande lista de workflows referenciadores. */}
        <div className="px-2 py-1.5 flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-blue-600">
            <UsersIcon className="size-3" />
            <b>{tag.leadCount ?? 0}</b> lead(s)
          </span>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={() => {
              if (automationCount > 0) setShowWorkflows((v) => !v);
            }}
            className={cn(
              "inline-flex items-center gap-1 transition-colors",
              automationCount > 0
                ? "text-amber-600 hover:text-amber-700 cursor-pointer"
                : "text-muted-foreground",
            )}
            disabled={automationCount === 0}
            title={
              automationCount > 0
                ? "Clique pra ver workflows"
                : undefined
            }
          >
            <ZapIcon className="size-3" />
            <b>{automationCount}</b> integração(ões)
            {automationCount > 0 && (
              <ChevronRightIcon
                className={cn(
                  "size-3 transition-transform",
                  showWorkflows && "rotate-90",
                )}
              />
            )}
          </button>
        </div>

        {/* Lista de workflows — colapsável. Carrega lazy quando expandida. */}
        {showWorkflows && (
          <div className="px-2 pb-2 max-h-32 overflow-y-auto border-t bg-muted/30">
            {loadingWorkflows && (
              <p className="text-[10px] text-muted-foreground py-2">
                Carregando workflows...
              </p>
            )}
            {!loadingWorkflows &&
              workflowsData?.workflows.length === 0 && (
                <p className="text-[10px] text-muted-foreground py-2">
                  Nenhum workflow ativo encontrado.
                </p>
              )}
            {workflowsData?.workflows.map((w) => (
              <div
                key={`${w.workflowId}-${w.nodeType}`}
                className="flex items-center justify-between gap-2 py-1 text-[10px]"
              >
                <span className="truncate" title={w.name}>
                  {w.name}
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1 shrink-0">
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[9px]",
                      w.nodeType === "TAG"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                    )}
                  >
                    {w.nodeType === "TAG" ? "Ação" : "Gatilho"}
                  </span>
                  {w.trackingName && (
                    <span className="truncate max-w-[80px]">
                      · {w.trackingName}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        <Separator />
        <div className="p-2 flex items-center justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={handleArchive}
            title="Arquivar tag (preserva histórico)"
          >
            <ArchiveIcon className="size-4" />
            Arquivar
          </Button>
        </div>
      </PopoverContent>

      {/* Dialog de confirmação — só dispara quando automationCount > 0.
          Lista os workflows afetados pra operador confirmar consciente. */}
      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar tag &ldquo;{tag.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              Essa tag está referenciada em <b>{automationCount}</b> automação
              (ões). Após arquivar:
              <ul className="list-disc list-inside mt-2 text-xs space-y-0.5">
                <li>
                  Automações com <b>ação TAG ADD</b> continuam rodando mas
                  vão pular essa tag (skip silencioso, sem erro)
                </li>
                <li>
                  Automações com <b>gatilho LEAD_TAGGED</b> nunca mais vão
                  disparar (porque ninguém vai anexar essa tag)
                </li>
                <li>
                  Histórico de leads que já tinham a tag <b>permanece</b>{" "}
                  (Jornada, Insights, /contatos)
                </li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-48 overflow-y-auto border rounded-md p-2 bg-muted/30">
            {loadingWorkflows ? (
              <div className="text-xs text-muted-foreground">
                Carregando workflows...
              </div>
            ) : workflowsData?.workflows.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Nenhum workflow ativo encontrado.
              </div>
            ) : (
              <ul className="space-y-1">
                {workflowsData?.workflows.map((w) => (
                  <li
                    key={`${w.workflowId}-${w.nodeType}`}
                    className="text-xs flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{w.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-1">
                      <span
                        className={cn(
                          "rounded px-1 py-0.5",
                          w.nodeType === "TAG"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                        )}
                      >
                        {w.nodeType === "TAG" ? "Ação" : "Gatilho"}
                      </span>
                      {w.trackingName && <span>· {w.trackingName}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmArchive(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={archiveNow}
              disabled={deleteTag.isPending}
            >
              {deleteTag.isPending ? "Arquivando..." : "Arquivar mesmo assim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Popover>
  );
}

// ─── Tag arquivada (aba "Arquivadas") ────────────────────────────────────────
// Renderiza badge translúcido + ações "Restaurar" (zera archivedAt) e
// "Excluir permanente" (chama tag.purge — hard delete irreversível).

interface ArchivedTagItemProps extends TagItemProps {
  isArchived?: boolean;
}

export function ArchivedTagItem(tag: ArchivedTagItemProps) {
  const [confirmPurge, setConfirmPurge] = useState(false);
  const restoreTag = useRestoreTag();
  const purgeTag = usePurgeTag();
  const automationCount = tag.automationCount ?? 0;

  const handleRestore = () => {
    restoreTag.mutate({
      tagId: tag.id,
      name: tag.name,
      color: tag.color,
      restore: true,
    });
  };

  const handlePurge = () => {
    purgeTag.mutate(
      { tagId: tag.id },
      { onSuccess: () => setConfirmPurge(false) },
    );
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Badge
            style={{
              backgroundColor: tag.color,
              color: getContrastColor(tag.color),
            }}
            className="cursor-pointer focus-visible:ring-0 outline-none gap-1 opacity-50 line-through"
            title="Tag arquivada — clique pra restaurar ou excluir permanente"
          >
            <ArchiveIcon className="size-3" />
            {tag.name}
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-2 space-y-2">
          <div className="text-xs space-y-1">
            <p className="font-medium">{tag.name}</p>
            <p className="text-muted-foreground text-[11px]">
              Tag arquivada — histórico preservado em Jornada, Insights e
              /contatos.
            </p>
            {automationCount > 0 && (
              <p className="text-amber-600 text-[11px] inline-flex items-center gap-1">
                <ZapIcon className="size-3" />
                {automationCount} automação(ões) ainda referenciam
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRestore}
              disabled={restoreTag.isPending}
              className="flex-1"
            >
              <ArchiveRestoreIcon className="size-3.5" />
              Restaurar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmPurge(true)}
              className="flex-1"
              title="Hard delete — irreversível"
            >
              <Trash2Icon className="size-3.5" />
              Excluir
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={confirmPurge} onOpenChange={setConfirmPurge}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Excluir permanentemente &ldquo;{tag.name}&rdquo;?
            </DialogTitle>
            <DialogDescription>
              <b>Esta ação não pode ser desfeita.</b> A tag e todos os
              vínculos com leads serão apagados do banco. A Jornada do lead
              ainda mostrará o evento histórico (com nome/cor capturados no
              momento da operação), mas o link clicável vai sumir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPurge(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={purgeTag.isPending}
            >
              {purgeTag.isPending
                ? "Excluindo..."
                : "Sim, excluir permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
