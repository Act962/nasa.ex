"use client";

/**
 * Painel da 5ª aba "Páginas" — gerencia as subpages do site atual.
 *
 * Mostra:
 *   - Card destacado da HOME (root) no topo, com ★.
 *   - Lista das subpages (Sobre / Contato / etc) com drag handle
 *     pra reordenar.
 *   - Botão "+ Nova página" abre dialog (título + slug) e cria
 *     subpage filha do root atual.
 *
 * Comportamento:
 *   - Click numa página → router.push(`/pages/<id>`) (carrega editor
 *     da page selecionada).
 *   - Drag handle → reorder via `useReorderSubpages`.
 *   - Kebab por linha → Renomear · Excluir · Definir como home.
 *
 * Restrição MVP: o painel só funciona quando o editor está aberto no
 * ROOT do site (parentPageId NULL). Subpages mostram aviso "Esse
 * painel só está disponível na página principal do site".
 *
 * Implementação do parent: o componente lê `pageId` do store; o
 * server (`listSubpages`) retorna 404 se a page não é root, e nesse
 * caso o `useQuery` devolve undefined → renderiza aviso.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Star, GripVertical, MoreVertical, Home, FileText,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { usePagesBuilderStore } from "../../context/pages-builder-store";
import {
  useNasaPageSubpages,
  useCreateSubpage,
  useReorderSubpages,
  useSetPageAsHome,
} from "../../hooks/use-nasa-page-subpages";
import { useDeletePage } from "../../hooks/use-pages";

export function PagesPanel() {
  const router = useRouter();
  const pageId = usePagesBuilderStore((s) => s.pageId);
  const { data, isLoading, isError } = useNasaPageSubpages(pageId ?? undefined);
  const { mutate: reorder } = useReorderSubpages();
  const { mutate: setAsHome } = useSetPageAsHome();
  const { mutate: deletePage } = useDeletePage();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  if (!pageId) {
    return (
      <PanelWrapper>
        <p className="text-xs text-muted-foreground text-center px-3 py-8">
          Abra um site pra ver suas páginas.
        </p>
      </PanelWrapper>
    );
  }

  if (isLoading) {
    return (
      <PanelWrapper>
        <p className="text-xs text-muted-foreground text-center px-3 py-8">
          Carregando…
        </p>
      </PanelWrapper>
    );
  }

  if (isError || !data) {
    return (
      <PanelWrapper>
        <div className="mx-3 mt-3 mb-2 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-3 text-center">
          <FileText className="size-5 mx-auto text-amber-700 mb-1" />
          <p className="text-[11px] text-amber-900 font-medium">
            Esse painel só está disponível na página principal do site.
          </p>
          <p className="text-[10px] text-amber-800/80 mt-1.5 leading-relaxed">
            Você está editando uma subpage. Volte pro site principal pra
            criar / reordenar / excluir páginas.
          </p>
        </div>
      </PanelWrapper>
    );
  }

  const subpages = data.subpages;

  const handleReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = subpages.findIndex((sub) => sub.id === active.id);
    const newIdx = subpages.findIndex((sub) => sub.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const orderedIds = [...subpages.map((sub) => sub.id)];
    const [moved] = orderedIds.splice(oldIdx, 1);
    orderedIds.splice(newIdx, 0, moved);
    reorder(
      { parentPageId: pageId, orderedIds },
      { onError: (error: Error) => toast.error(error.message) },
    );
  };

  return (
    <PanelWrapper>
      <div className="px-3 mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">
          Páginas deste site
        </p>
        <CreateSubpageDialog parentPageId={pageId} />
      </div>

      {/* Home (root) — sempre no topo */}
      <div className="px-2 mb-1.5">
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-2 rounded-md text-xs bg-indigo-50 ring-1 ring-indigo-200 cursor-pointer hover:bg-indigo-100/80",
          )}
          onClick={() => router.push(`/pages/${pageId}`)}
          title="Editar página principal"
        >
          <Star className="size-3.5 text-amber-500 fill-amber-400 shrink-0" />
          <Home className="size-3.5 shrink-0 text-indigo-700" />
          <span className="font-medium text-indigo-900 flex-1 truncate">
            Página principal
          </span>
          <span className="text-[10px] text-indigo-600/80">/</span>
        </div>
      </div>

      {/* Subpages — drag-to-reorder */}
      <div className="px-2 flex flex-col gap-0.5">
        {subpages.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4 leading-relaxed">
            Nenhuma subpage ainda. Clique em{" "}
            <strong>+ Nova página</strong> pra adicionar Sobre, Contato,
            etc — todas acessíveis por menu navegável.
          </p>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleReorder}>
            <SortableContext
              items={subpages.map((sub) => sub.id)}
              strategy={verticalListSortingStrategy}
            >
              {subpages.map((sub) => (
                <SubpageRow
                  key={sub.id}
                  id={sub.id}
                  title={sub.title}
                  slug={sub.slug}
                  status={sub.status}
                  onClick={() => router.push(`/pages/${sub.id}`)}
                  onSetAsHome={() =>
                    setAsHome(
                      { pageId: sub.id },
                      {
                        onSuccess: () =>
                          toast.success(`"${sub.title}" é a nova página principal`),
                        onError: (error: Error) => toast.error(error.message),
                      },
                    )
                  }
                  onDelete={() => {
                    if (
                      !window.confirm(
                        `Excluir a subpage "${sub.title}"? Esta ação não pode ser desfeita.`,
                      )
                    )
                      return;
                    deletePage(
                      { id: sub.id },
                      {
                        onSuccess: () => toast.success("Subpage excluída"),
                        onError: (error: Error) => toast.error(error.message),
                      },
                    );
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </PanelWrapper>
  );
}

function PanelWrapper({ children }: { children: React.ReactNode }) {
  return <div className="py-2">{children}</div>;
}

function SubpageRow(props: {
  id: string;
  title: string;
  slug: string;
  status: string;
  onClick: () => void;
  onSetAsHome: () => void;
  onDelete: () => void;
}) {
  const sortable = useSortable({ id: props.id });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    sortable;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-1.5 px-2 py-2 rounded-md text-xs hover:bg-accent cursor-pointer"
      onClick={props.onClick}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Reordenar"
        className="shrink-0 text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="truncate">{props.title}</div>
        <div className="text-[10px] text-muted-foreground/70 truncate font-mono">
          /{props.slug}
          {props.status === "DRAFT" && (
            <span className="ml-1 text-amber-600">· rascunho</span>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            aria-label="Mais ações"
            className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={props.onSetAsHome}>
            <Star className="size-3.5 mr-2" />
            Definir como home
          </DropdownMenuItem>
          <DropdownMenuItem onClick={props.onClick}>
            <ExternalLink className="size-3.5 mr-2" />
            Abrir editor
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={props.onDelete}
            className="text-destructive focus:text-destructive"
          >
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Dialog pra criar uma nova subpage filha do site atual. */
function CreateSubpageDialog({ parentPageId }: { parentPageId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const { mutate: create, isPending } = useCreateSubpage();

  // Auto-gera slug a partir do title enquanto user não toca em slug.
  const [slugDirty, setSlugDirty] = useState(false);
  const autoSlug = (raw: string) =>
    raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);

  const submit = () => {
    create(
      { parentPageId, title: title.trim(), slug: slug.trim() },
      {
        onSuccess: () => {
          toast.success(`Subpage "${title}" criada`);
          setOpen(false);
          setTitle("");
          setSlug("");
          setSlugDirty(false);
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1">
          <Plus className="size-3.5" />
          Nova página
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova subpage</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              value={title}
              autoFocus
              onChange={(e) => {
                const next = e.target.value;
                setTitle(next);
                if (!slugDirty) setSlug(autoSlug(next));
              }}
              placeholder="Sobre"
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Slug</Label>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugDirty(true);
              }}
              placeholder="sobre"
              className="text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              URL final: <code className="font-mono">/s/&lt;site&gt;/{slug || "..."}</code>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={isPending || !title.trim() || !slug.trim()}
            onClick={submit}
          >
            {isPending ? "Criando…" : "Criar subpage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
