"use client";

/**
 * Editor das 3 zonas de blocos intermediários (aboveHeading,
 * betweenHeadingAndCards, afterCards) das sections compostas.
 *
 * Cada zona é uma lista drag-reorderable de mini-blocos (text/image/
 * button/divider/spacer/badge). User pode adicionar quantos quiser
 * em cada zona.
 *
 * Convenção JSON: `element.interlude?: { aboveHeading?, betweenHeadingAndCards?, afterCards?: InterludeBlock[] }`.
 *
 * Drag-reorder usa `SortableSectionItem` com `collection` único por
 * zona (ex: `interlude.betweenHeadingAndCards`) — o handleDragEnd
 * global do BuilderSidebar reconhece via dot-notation.
 */
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Type as TypeIcon, Image as ImageIcon, MousePointerClick,
  Minus, SquareStack, Tag, Video as VideoIcon, Code2, Images,
  Plus, Trash2,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SortableSectionItem } from "./sortable-section-item";
import { TypographyEditor } from "./typography-editor";
import { ImageUploaderField } from "./image-uploader-field";
import {
  type InterludeBlock,
  type InterludeBlockKind,
  type InterludeZones,
  createInterludeBlock,
} from "../elements/sections/interlude-block";
import type { ElementBase } from "../../types";

interface Props {
  el: ElementBase;
  update: (patch: Partial<ElementBase>) => void;
}

const ZONE_LABELS: Record<keyof InterludeZones, string> = {
  aboveHeading: "Acima do cabeçalho",
  betweenHeadingAndCards: "Entre cabeçalho e cards",
  afterCards: "Depois dos cards",
};

const KIND_ICONS: Record<InterludeBlockKind, React.ComponentType<{ className?: string }>> = {
  text: TypeIcon,
  image: ImageIcon,
  button: MousePointerClick,
  divider: Minus,
  spacer: SquareStack,
  badge: Tag,
  video: VideoIcon,
  embed: Code2,
  carousel: Images,
};

const KIND_LABELS: Record<InterludeBlockKind, string> = {
  text: "Texto",
  image: "Imagem",
  button: "Botão",
  divider: "Linha",
  spacer: "Espaço",
  badge: "Badge",
  video: "Vídeo",
  embed: "Embed",
  carousel: "Carrossel",
};

export function InterludeZonesEditor({ el, update }: Props) {
  const interlude = (el.interlude as InterludeZones | undefined) ?? {};

  const setZone = (zone: keyof InterludeZones, blocks: InterludeBlock[]) => {
    const next: InterludeZones = { ...interlude, [zone]: blocks };
    // Limpa zonas vazias pra manter JSON enxuto.
    (Object.keys(next) as (keyof InterludeZones)[]).forEach((key) => {
      if (!next[key] || next[key]?.length === 0) delete next[key];
    });
    update({ interlude: next });
  };

  return (
    <div>
      {(["aboveHeading", "betweenHeadingAndCards", "afterCards"] as const).map(
        (zone) => (
          <ZoneEditor
            key={zone}
            zone={zone}
            label={ZONE_LABELS[zone]}
            blocks={interlude[zone] ?? []}
            onChange={(blocks) => setZone(zone, blocks)}
            elementId={el.id}
          />
        ),
      )}
    </div>
  );
}

function ZoneEditor({
  zone,
  label,
  blocks,
  onChange,
  elementId,
}: {
  zone: keyof InterludeZones;
  label: string;
  blocks: InterludeBlock[];
  onChange: (next: InterludeBlock[]) => void;
  elementId: string;
}) {
  const collection = `interlude.${zone}`;

  const addOf = (kind: InterludeBlockKind) =>
    onChange([...blocks, createInterludeBlock(kind)]);
  const patch = (idx: number, p: Partial<InterludeBlock>) => {
    const next = blocks.slice();
    next[idx] = { ...next[idx], ...p };
    onChange(next);
  };
  const remove = (idx: number) =>
    onChange(blocks.filter((_, i) => i !== idx));
  const duplicate = (idx: number) => {
    const clone = {
      ...blocks[idx],
      id: `ib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    onChange([...blocks.slice(0, idx + 1), clone, ...blocks.slice(idx + 1)]);
  };

  return (
    <div className="mb-3 border rounded-md bg-muted/10">
      <div className="px-2 py-1.5 border-b bg-muted/30">
        <p className="text-[11px] font-semibold text-foreground/80">
          {label} ({blocks.length})
        </p>
      </div>
      <div className="p-2">
        <SortableContext
          items={blocks.map((block) => block.id)}
          strategy={verticalListSortingStrategy}
        >
          {blocks.map((block, idx) => {
            const Icon = KIND_ICONS[block.kind];
            return (
              <SortableSectionItem
                key={block.id}
                id={block.id}
                collection={collection}
                elementId={elementId}
                label={`${KIND_LABELS[block.kind]}`}
                summary={
                  block.kind === "text" || block.kind === "badge"
                    ? block.text
                    : block.kind === "button"
                      ? block.label
                      : undefined
                }
                onDuplicate={() => duplicate(idx)}
                onRemove={() => remove(idx)}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                    {KIND_LABELS[block.kind]}
                  </span>
                </div>
                <BlockEditor block={block} onPatch={(p) => patch(idx, p)} />
              </SortableSectionItem>
            );
          })}
        </SortableContext>
        <div className="mt-1">
          <p className="text-[10px] text-muted-foreground mb-1">
            Adicionar novo bloco nesta zona:
          </p>
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(KIND_LABELS) as InterludeBlockKind[]).map((kind) => {
              const Icon = KIND_ICONS[kind];
              return (
                <Button
                  key={kind}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addOf(kind)}
                  className="text-[10px] flex flex-col h-auto py-1.5 gap-0.5"
                >
                  <Icon className="size-3.5" />
                  {KIND_LABELS[kind]}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  onPatch,
}: {
  block: InterludeBlock;
  onPatch: (p: Partial<InterludeBlock>) => void;
}) {
  switch (block.kind) {
    case "text":
      return (
        <>
          <Label className="text-[10px] text-muted-foreground">Texto</Label>
          <Textarea
            rows={2}
            value={block.text ?? ""}
            onChange={(e) => onPatch({ text: e.target.value })}
            className="text-xs"
          />
          <div className="mt-2">
            <TypographyEditor
              label="Tipografia"
              value={block.textStyle}
              onChange={(v) => onPatch({ textStyle: v })}
            />
          </div>
        </>
      );
    case "image":
      return (
        <>
          <ImageUploaderField
            value={block.src ?? ""}
            onChange={(url) => onPatch({ src: url })}
            label="Imagem"
            previewHeight={80}
          />
          <Label className="text-[10px] text-muted-foreground mt-2">Alt</Label>
          <Input
            value={block.alt ?? ""}
            onChange={(e) => onPatch({ alt: e.target.value })}
            placeholder="Descrição da imagem"
            className="text-xs"
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Largura
              </Label>
              <Input
                type="number"
                value={block.width ?? ""}
                onChange={(e) =>
                  onPatch({
                    width: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="auto"
                className="text-[11px]"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Altura
              </Label>
              <Input
                type="number"
                value={block.height ?? ""}
                onChange={(e) =>
                  onPatch({
                    height: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                placeholder="auto"
                className="text-[11px]"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Raio</Label>
              <Input
                type="number"
                value={block.borderRadius ?? 0}
                onChange={(e) => onPatch({ borderRadius: Number(e.target.value) })}
                className="text-[11px]"
              />
            </div>
          </div>
        </>
      );
    case "button":
      return (
        <>
          <Label className="text-[10px] text-muted-foreground">Texto</Label>
          <Input
            value={block.label ?? ""}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder="Clique aqui"
            className="text-xs"
          />
          <Label className="text-[10px] text-muted-foreground">Link</Label>
          <Input
            value={block.href ?? ""}
            onChange={(e) => onPatch({ href: e.target.value })}
            placeholder="#anchor ou https://…"
            className="text-[11px] font-mono"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Fundo</Label>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={block.bg ?? "#6366f1"}
                  onChange={(e) => onPatch({ bg: e.target.value })}
                  className="size-6 rounded border cursor-pointer p-0.5"
                />
                <Input
                  value={block.bg ?? ""}
                  onChange={(e) => onPatch({ bg: e.target.value })}
                  className="text-[10px] font-mono"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Texto</Label>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={block.fg ?? "#ffffff"}
                  onChange={(e) => onPatch({ fg: e.target.value })}
                  className="size-6 rounded border cursor-pointer p-0.5"
                />
                <Input
                  value={block.fg ?? ""}
                  onChange={(e) => onPatch({ fg: e.target.value })}
                  className="text-[10px] font-mono"
                />
              </div>
            </div>
          </div>
        </>
      );
    case "divider":
      return (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Cor</Label>
              <Input
                value={block.color ?? ""}
                onChange={(e) => onPatch({ color: e.target.value })}
                placeholder="currentColor"
                className="text-[11px] font-mono"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Espessura (px)
              </Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={block.thickness ?? 1}
                onChange={(e) => onPatch({ thickness: Number(e.target.value) })}
                className="text-[11px]"
              />
            </div>
          </div>
        </>
      );
    case "spacer":
      return (
        <>
          <Label className="text-[10px] text-muted-foreground">
            Altura (px)
          </Label>
          <Input
            type="number"
            min={4}
            max={300}
            value={block.spaceHeight ?? 24}
            onChange={(e) => onPatch({ spaceHeight: Number(e.target.value) })}
            className="text-[11px]"
          />
        </>
      );
    case "badge":
      return (
        <>
          <Label className="text-[10px] text-muted-foreground">Texto</Label>
          <Input
            value={block.text ?? ""}
            onChange={(e) => onPatch({ text: e.target.value })}
            placeholder="NOVO"
            className="text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Fundo</Label>
              <Input
                value={block.badgeBg ?? ""}
                onChange={(e) => onPatch({ badgeBg: e.target.value })}
                placeholder="rgba(...)"
                className="text-[10px] font-mono"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Texto</Label>
              <Input
                value={block.badgeColor ?? ""}
                onChange={(e) => onPatch({ badgeColor: e.target.value })}
                placeholder="#6366f1"
                className="text-[10px] font-mono"
              />
            </div>
          </div>
        </>
      );
    case "video":
      return (
        <>
          <Label className="text-[10px] text-muted-foreground">Provedor</Label>
          <select
            value={block.videoProvider ?? "yt"}
            onChange={(e) =>
              onPatch({
                videoProvider: e.target.value as "yt" | "vimeo" | "mp4",
              })
            }
            className="h-7 w-full rounded border bg-background text-[11px] px-1"
          >
            <option value="yt">YouTube</option>
            <option value="vimeo">Vimeo</option>
            <option value="mp4">MP4 (arquivo direto)</option>
          </select>
          <Label className="text-[10px] text-muted-foreground">URL</Label>
          <Input
            value={block.videoUrl ?? ""}
            onChange={(e) => onPatch({ videoUrl: e.target.value })}
            placeholder={
              block.videoProvider === "vimeo"
                ? "https://vimeo.com/123…"
                : block.videoProvider === "mp4"
                  ? "https://… .mp4"
                  : "https://youtube.com/watch?v=… ou youtu.be/…"
            }
            className="text-[11px] font-mono"
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Largura
              </Label>
              <Input
                type="number"
                value={block.width ?? 720}
                onChange={(e) => onPatch({ width: Number(e.target.value) })}
                className="text-[11px]"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Altura
              </Label>
              <Input
                type="number"
                value={block.height ?? 405}
                onChange={(e) => onPatch({ height: Number(e.target.value) })}
                className="text-[11px]"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Raio</Label>
              <Input
                type="number"
                value={block.borderRadius ?? 12}
                onChange={(e) =>
                  onPatch({ borderRadius: Number(e.target.value) })
                }
                className="text-[11px]"
              />
            </div>
          </div>
        </>
      );
    case "embed":
      return (
        <>
          <Label className="text-[10px] text-muted-foreground">
            HTML / código de embed
          </Label>
          <Textarea
            rows={5}
            value={block.embedHtml ?? ""}
            onChange={(e) => onPatch({ embedHtml: e.target.value })}
            placeholder='<iframe src="..." />, <script>...</script>, etc.'
            className="text-[10px] font-mono"
          />
          <p className="text-[10px] text-muted-foreground leading-snug">
            ⚠ Cuidado com código de origem desconhecida — embed roda no
            contexto da sua página.
          </p>
          <Label className="text-[10px] text-muted-foreground">
            Largura máx (px)
          </Label>
          <Input
            type="number"
            value={block.width ?? 720}
            onChange={(e) => onPatch({ width: Number(e.target.value) })}
            className="text-[11px]"
          />
        </>
      );
    case "carousel":
      return <CarouselSlidesEditor block={block} onPatch={onPatch} />;
  }
}

/**
 * Sub-editor pra slides do carrossel intermediário — lista de imagens
 * com URL + caption + ações de add/remove (sem drag-reorder pra
 * simplicidade — usa setas).
 */
function CarouselSlidesEditor({
  block,
  onPatch,
}: {
  block: InterludeBlock;
  onPatch: (p: Partial<InterludeBlock>) => void;
}) {
  const slides = block.slides ?? [];
  const updateSlide = (idx: number, patch: Partial<typeof slides[number]>) => {
    const next = slides.slice();
    next[idx] = { ...next[idx], ...patch };
    onPatch({ slides: next });
  };
  const addSlide = () =>
    onPatch({
      slides: [
        ...slides,
        {
          id: `sl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          imageUrl: "",
          caption: "",
        },
      ],
    });
  const removeSlide = (idx: number) =>
    onPatch({ slides: slides.filter((_, i) => i !== idx) });

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Slides por viewport
          </Label>
          <Input
            type="number"
            min={1}
            max={6}
            value={block.slidesPerView ?? 3}
            onChange={(e) =>
              onPatch({ slidesPerView: Number(e.target.value) })
            }
            className="text-[11px]"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Altura (px)
          </Label>
          <Input
            type="number"
            value={block.height ?? 240}
            onChange={(e) => onPatch({ height: Number(e.target.value) })}
            className="text-[11px]"
          />
        </div>
      </div>
      <Label className="text-[10px] text-muted-foreground mt-2">
        Slides ({slides.length})
      </Label>
      <div className="flex flex-col gap-1.5">
        {slides.map((slide, idx) => (
          <div
            key={slide.id}
            className="border rounded p-1.5 bg-muted/30 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground flex-1">
                #{idx + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSlide(idx)}
                className="size-6 shrink-0"
                title="Remover"
              >
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </div>
            {/* Upload + preview + URL fallback unificado. */}
            <ImageUploaderField
              value={slide.imageUrl ?? ""}
              onChange={(url) => updateSlide(idx, { imageUrl: url })}
              previewHeight={60}
            />
            <Input
              value={slide.caption ?? ""}
              onChange={(e) => updateSlide(idx, { caption: e.target.value })}
              placeholder="Legenda (opcional)"
              className="text-[10px] mt-1"
            />
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={addSlide}
        className="text-[10px] w-full gap-1 mt-1"
      >
        <Plus className="size-3" /> Adicionar slide
      </Button>
    </>
  );
}
