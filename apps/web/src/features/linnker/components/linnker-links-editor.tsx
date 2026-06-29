"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  LayoutTemplate,
  RectangleHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LinnkerResourceSelector } from "./linnker-resource-selector";
import { LinnkerImageUploader } from "./linnker-image-uploader";
import type {
  LinnkerPage,
  LinnkerLink,
  LinnkerLinkType,
  LinnkerDisplayStyle,
} from "../types";

const LINK_TYPE_LABELS: Record<LinnkerLinkType, string> = {
  EXTERNAL: "🔗 Link externo",
  TRACKING: "📊 Tracking (CRM)",
  FORM: "📋 Formulário",
  CHAT: "💬 Chat",
  AGENDA: "📅 Agenda",
};

const TYPE_DEFAULT_EMOJI: Record<LinnkerLinkType, string> = {
  EXTERNAL: "🔗",
  TRACKING: "📊",
  FORM: "📋",
  CHAT: "💬",
  AGENDA: "📅",
};

const EMOJIS = [
  "🔗",
  "📋",
  "💬",
  "📅",
  "📊",
  "🚀",
  "⭐",
  "🎯",
  "📞",
  "💡",
  "🏆",
  "🎁",
  "🔥",
  "✅",
  "💎",
  "🎪",
];

interface Props {
  page: LinnkerPage;
  onRefetch: () => void;
}

const LINK_COLORS = [
  null, // usa cor da página
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
  "#1e293b",
];

interface NewLinkForm {
  title: string;
  url: string;
  type: LinnkerLinkType;
  emoji: string;
  imageUrl: string | null;
  displayStyle: LinnkerDisplayStyle;
  color: string | null;
  selectedResourceId: string;
}

export function LinnkerLinksEditor({ page, onRefetch }: Props) {
  const [adding, setAdding] = useState(false);
  const [localLinks, setLocalLinks] = useState<LinnkerLink[]>(page.links);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setLocalLinks(page.links);
  }, [page.links]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { mutate: reorderLinks } = useMutation({
    mutationFn: (orderedIds: string[]) =>
      client.linnker.reorderLinks({ pageId: page.id, orderedIds }),
    onError: () => {
      toast.error("Erro ao reordenar");
      onRefetch();
    },
    onSuccess: () => onRefetch(),
  });

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = localLinks.findIndex((l) => l.id === active.id);
    const newIndex = localLinks.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(localLinks, oldIndex, newIndex);
    setLocalLinks(next);
    reorderLinks(next.map((l) => l.id));
  };

  const activeLink = activeId
    ? localLinks.find((l) => l.id === activeId)
    : null;

  const [newLink, setNewLink] = useState<NewLinkForm>({
    title: "",
    url: "",
    type: "EXTERNAL",
    emoji: "🔗",
    imageUrl: null,
    displayStyle: "button",
    color: null,
    selectedResourceId: "",
  });

  const isExternal = newLink.type === "EXTERNAL";
  const isBanner = newLink.displayStyle === "banner";
  const canSubmit =
    newLink.title.trim() &&
    (isExternal ? newLink.url.trim() : newLink.selectedResourceId);

  const handleTypeChange = (type: LinnkerLinkType) => {
    setNewLink((p) => ({
      ...p,
      type,
      emoji: TYPE_DEFAULT_EMOJI[type],
      url: "",
      selectedResourceId: "",
    }));
  };

  const handleResourceSelect = (resource: {
    id: string;
    name: string;
    url: string;
  }) => {
    setNewLink((p) => ({
      ...p,
      selectedResourceId: resource.id,
      url: resource.url,
      title: p.title || resource.name,
    }));
  };

  const { mutate: createLink, isPending: creating } = useMutation({
    mutationFn: () =>
      client.linnker.createLink({
        pageId: page.id,
        title: newLink.title,
        url: newLink.url,
        type: newLink.type,
        emoji: newLink.emoji || undefined,
        imageUrl: newLink.imageUrl || undefined,
        displayStyle: newLink.displayStyle,
        color: newLink.color || undefined,
      }),
    onSuccess: async (data: any) => {
      if (
        newLink.type === "TRACKING" &&
        data?.link?.id &&
        newLink.url.includes("__LINK__")
      ) {
        await client.linnker.updateLink({
          id: data.link.id,
          url: newLink.url.replace("__LINK__", data.link.id),
        });
      }
      toast.success("Link adicionado!");
      setNewLink({
        title: "",
        url: "",
        type: "EXTERNAL",
        emoji: "🔗",
        imageUrl: null,
        displayStyle: "button",
        color: null,
        selectedResourceId: "",
      });
      setAdding(false);
      onRefetch();
    },
    onError: () => toast.error("Erro ao criar link"),
  });

  const { mutate: deleteLink } = useMutation({
    mutationFn: (id: string) => client.linnker.deleteLink({ id }),
    onSuccess: () => {
      toast.success("Link removido");
      onRefetch();
    },
  });

  const { mutate: toggleLink } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      client.linnker.updateLink({ id, isActive }),
    onSuccess: onRefetch,
  });

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext
          items={localLinks.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-3 list-none p-0 m-0">
            {localLinks.map((link) => (
              <LinnkerLinkRow
                key={link.id}
                link={link}
                pageSlug={page.slug}
                onDelete={() => deleteLink(link.id)}
                onToggle={(isActive) => toggleLink({ id: link.id, isActive })}
                onRefetch={onRefetch}
              />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay>
          {activeLink ? (
            <div className="border-2 border-primary rounded-xl bg-card shadow-2xl ring-4 ring-primary/20 cursor-grabbing">
              <div className="flex items-center gap-3 p-3">
                <GripVertical className="size-4 text-primary shrink-0" />
                {activeLink.imageUrl ? (
                  <img
                    src={activeLink.imageUrl}
                    alt=""
                    className="size-10 rounded-md object-cover shrink-0 border border-border"
                  />
                ) : (
                  <span className="text-xl shrink-0">
                    {activeLink.emoji ?? "🔗"}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {activeLink.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activeLink.url}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {adding ? (
        <div className="border rounded-xl p-4 space-y-4 bg-muted/30">
          <p className="text-sm font-medium">Novo link</p>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={newLink.type}
              onValueChange={(v) => handleTypeChange(v as LinnkerLinkType)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LINK_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estilo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Estilo de exibição</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: "button",
                  label: "Botão",
                  icon: LayoutTemplate,
                  desc: "Botão colorido com texto",
                },
                {
                  value: "banner",
                  label: "Banner",
                  icon: RectangleHorizontal,
                  desc: "Imagem clicável",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setNewLink((p) => ({
                      ...p,
                      displayStyle: opt.value as LinnkerDisplayStyle,
                    }))
                  }
                  className={`flex flex-col items-center gap-1.5 p-3 border-2 rounded-lg transition-colors ${
                    newLink.displayStyle === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <opt.icon className="size-5 text-muted-foreground" />
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground text-center">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Recurso (não-externo) */}
          {!isExternal && (
            <LinnkerResourceSelector
              type={newLink.type}
              pageSlug={page.slug}
              selectedId={newLink.selectedResourceId}
              onSelect={handleResourceSelect}
            />
          )}

          {/* Imagem (banner ou botão com ícone) */}
          <LinnkerImageUploader
            value={newLink.imageUrl}
            onChange={(url) => setNewLink((p) => ({ ...p, imageUrl: url }))}
            label={
              isBanner ? "Imagem do banner *" : "Imagem do ícone (opcional)"
            }
            aspectRatio={isBanner ? "banner" : "wide"}
          />

          {/* Emoji (apenas botão sem imagem) */}
          {!isBanner && !newLink.imageUrl && (
            <div className="space-y-1.5">
              <Label className="text-xs">Ou escolha um emoji</Label>
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNewLink((p) => ({ ...p, emoji: e }))}
                    className={`text-lg p-1 rounded hover:bg-muted ${newLink.emoji === e ? "ring-2 ring-primary" : ""}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              placeholder="Ex: Fale conosco"
              value={newLink.title}
              onChange={(e) =>
                setNewLink((p) => ({ ...p, title: e.target.value }))
              }
            />
          </div>

          {/* Cor do botão */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cor do botão</Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {LINK_COLORS.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setNewLink((p) => ({ ...p, color: c }))}
                  className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    newLink.color === c
                      ? "border-foreground scale-110"
                      : "border-border"
                  }`}
                  style={{ background: c ?? page.coverColor }}
                  title={c === null ? "Cor da página" : c}
                />
              ))}
              <input
                type="color"
                value={newLink.color ?? page.coverColor}
                onChange={(e) =>
                  setNewLink((p) => ({ ...p, color: e.target.value }))
                }
                className="size-7 rounded cursor-pointer border"
              />
            </div>
            {newLink.color === null && (
              <p className="text-[10px] text-muted-foreground">
                Usando cor principal da página
              </p>
            )}
          </div>

          {/* URL manual */}
          {isExternal && (
            <div className="space-y-1.5">
              <Label className="text-xs">URL de destino</Label>
              <Input
                placeholder="https://..."
                value={newLink.url}
                onChange={(e) =>
                  setNewLink((p) => ({ ...p, url: e.target.value }))
                }
              />
            </div>
          )}

          {/* URL gerada */}
          {!isExternal && newLink.url && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                URL gerada automaticamente
              </Label>
              <p className="text-xs bg-muted rounded-lg px-3 py-2 font-mono break-all text-muted-foreground">
                {newLink.url}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => createLink()}
              disabled={creating || !canSubmit}
            >
              {creating ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full border-dashed mt-2"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4 mr-2" /> Adicionar link
        </Button>
      )}
    </div>
  );
}

function LinnkerLinkRow({
  link,
  pageSlug,
  onDelete,
  onToggle,
  onRefetch,
}: {
  link: LinnkerLink;
  pageSlug: string;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
  onRefetch: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [imageUrl, setImageUrl] = useState<string | null>(
    link.imageUrl ?? null,
  );
  const [color, setColor] = useState<string | null>(link.color ?? null);
  const [selectedResourceId, setSelectedResourceId] = useState("");

  const isExternal = link.type === "EXTERNAL";
  const isBanner = link.displayStyle === "banner";

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      client.linnker.updateLink({ id: link.id, title, url, imageUrl, color }),
    onSuccess: () => {
      toast.success("Salvo!");
      setEditing(false);
      onRefetch();
    },
    onError: () => toast.error("Erro ao salvar link"),
  });

  return (
    <Collapsible open={editing} onOpenChange={setEditing} asChild>
      <li
        ref={setNodeRef}
        style={style}
        className={`border rounded-xl bg-card overflow-hidden list-none ${isDragging ? "opacity-30" : ""}`}
      >
        <div className="flex items-center gap-3 p-3">
          <div
            ref={setActivatorNodeRef}
            aria-label="Arrastar para reordenar"
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab active:cursor-grabbing shrink-0 p-1 -m-1 rounded hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring select-none"
          >
            <GripVertical className="size-4 text-muted-foreground pointer-events-none" />
          </div>

          {/* Ícone / thumbnail */}
          {link.imageUrl ? (
            <img
              src={link.imageUrl}
              alt=""
              className="size-10 rounded-md object-cover shrink-0 border border-border"
            />
          ) : (
            <span className="text-xl shrink-0">{link.emoji ?? "🔗"}</span>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-sm truncate">{link.title}</p>
              {isBanner && (
                <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-medium text-muted-foreground shrink-0">
                  Banner
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{link.url}</p>
          </div>

          <Switch
            checked={link.isActive}
            onCheckedChange={onToggle}
            className="shrink-0"
          />
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0">
              <ChevronDown
                className={`size-4 transition-transform ${editing ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive shrink-0"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        <CollapsibleContent>
          <div className="border-t p-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            {/* Cor do botão */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cor do botão</Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {LINK_COLORS.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? "border-foreground scale-110" : "border-border"}`}
                    style={{ background: c ?? "#6366f1" }}
                    title={c === null ? "Cor da página" : c}
                  />
                ))}
                <input
                  type="color"
                  value={color ?? "#6366f1"}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-7 rounded cursor-pointer border"
                />
              </div>
              {color === null && (
                <p className="text-[10px] text-muted-foreground">
                  Usando cor principal da página
                </p>
              )}
            </div>

            {/* Imagem */}
            <LinnkerImageUploader
              value={imageUrl}
              onChange={setImageUrl}
              label={
                isBanner ? "Imagem do banner" : "Imagem do ícone (opcional)"
              }
              aspectRatio={isBanner ? "banner" : "wide"}
            />

            {/* Recurso não-externo */}
            {!isExternal && (
              <LinnkerResourceSelector
                type={link.type}
                pageSlug={pageSlug}
                selectedId={selectedResourceId}
                onSelect={(r) => {
                  setSelectedResourceId(r.id);
                  setUrl(r.url);
                }}
              />
            )}

            {isExternal && (
              <div className="space-y-1.5">
                <Label className="text-xs">URL de destino</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
            )}

            {!isExternal && url && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  URL gerada
                </Label>
                <p className="text-xs bg-muted rounded-lg px-3 py-2 font-mono break-all text-muted-foreground">
                  {url}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={() => save()} disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}
