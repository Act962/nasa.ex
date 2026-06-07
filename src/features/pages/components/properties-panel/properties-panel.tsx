"use client";

import { useEffect, useRef, useState } from "react";
import {
  Trash2,
  Copy,
  Lock,
  Unlock,
  ExternalLink,
  Crop,
  Wand2,
  ChevronUp,
  ChevronDown,
  CornerDownRight,
} from "lucide-react";
import { ImageCropEditor } from "../elements/image-crop-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc, client } from "@/lib/orpc";
import { usePagesBuilderStore, getActiveLayerElements } from "../../context/pages-builder-store";
import {
  useNasaPageSubpages,
  useBulkApplyElement,
} from "../../hooks/use-nasa-page-subpages";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableSectionItem } from "./sortable-section-item";
import { TypographyEditor } from "./typography-editor";
import { InterludeZonesEditor } from "./interlude-zones-editor";
import { AnchorPicker } from "./anchor-picker";
import { AnimatedBorderEditor } from "./animated-border-editor";
import { CardAnimatedBorderEditor } from "./card-animated-border-editor";
import { ImageUploaderField } from "./image-uploader-field";
import { uploadImage } from "../../lib/upload-image";
import { isFlowSection } from "../../lib/section-flow";
import { getElementDisplayName } from "../../lib/layer-utils";
import { mapElementToInterludeBlock } from "../../lib/visible-section";
import { ScrollRevealEditor } from "./scroll-reveal-editor";
import { MarketingProps } from "./marketing-props";
import type { TextStyle } from "../../lib/text-style";
import {
  legacyToButtonsList,
  type SectionButton,
} from "../elements/sections/buttons";
import type { Device, ElementBase } from "../../types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FONT_FAMILIES = [
  "Inter", "Roboto", "Poppins", "Montserrat", "Open Sans",
  "Lato", "Raleway", "Nunito", "Playfair Display", "Merriweather",
  "Source Code Pro", "Space Grotesk", "DM Sans", "Outfit",
];

const FONT_WEIGHTS = [
  { value: "300", label: "Light 300" },
  { value: "400", label: "Regular 400" },
  { value: "500", label: "Medium 500" },
  { value: "600", label: "Semibold 600" },
  { value: "700", label: "Bold 700" },
  { value: "800", label: "Extrabold 800" },
  { value: "900", label: "Black 900" },
];

const ALIGN_OPTIONS = ["left", "center", "right", "justify"];
const FIT_OPTIONS = ["cover", "contain", "fill", "none"];
const SHAPE_OPTIONS = ["rect", "ellipse", "triangle", "star", "hexagon"];

// ─── helpers ────────────────────────────────────────────────────────────────

function Row({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-1")}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 rounded border cursor-pointer p-0.5 bg-transparent shrink-0"
        />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs font-mono"
          placeholder="#000000"
        />
      </div>
    </Field>
  );
}

function NumField({ label, value, onChange, step = 1, min }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        step={step}
        min={min}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 text-xs"
      />
    </Field>
  );
}

/**
 * Sanitiza um anchor ID digitado. HTML `id` não pode começar com `#`
 * nem ter espaços/caracteres especiais. Browser silenciosamente
 * ignora `id="#planos"` ao procurar destino do `<a href="#planos">`
 * — URL muda mas página não rola. Sanitizando aqui evita bug
 * crônico.
 */
function sanitizeAnchorId(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/^#+/, "") // remove # do começo
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Editor reutilizável de anchor ID. Sanitiza valor onChange, mostra
 * preview do destino real ("vira #X"), explica como usar.
 */
function AnchorIdField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <>
      <Label className="text-[10px] text-muted-foreground mt-2">
        Anchor ID (pra navbar/botões linkarem aqui)
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(sanitizeAnchorId(e.target.value))}
        placeholder={placeholder}
        className="text-xs font-mono"
      />
      <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
        {value ? (
          <>
            ✓ Vira destino <code className="font-mono">#{value}</code> —
            qualquer botão com link <code className="font-mono">#{value}</code>{" "}
            rola até essa seção.
          </>
        ) : (
          <>
            Defina um identificador sem espaços (ex:{" "}
            <code className="font-mono">{placeholder}</code>). Depois use{" "}
            <code className="font-mono">#{placeholder}</code> no link de qualquer
            botão pra rolar até aqui.
          </>
        )}
      </p>
    </>
  );
}

function Seg({ className }: { className?: string }) {
  return <Separator className={cn("my-3", className)} />;
}

/**
 * Botão "Aplicar em todas as páginas do site" — disponível pra
 * navbar/footer. Pega o element atual (o user editou), clona ele
 * em todas as subpages do site E no root.
 *
 * Snapshot copy: cada page mantém sua própria cópia depois (editar
 * uma não afeta as outras). Pra refletir mudanças permanentemente em
 * todas, user roda o botão de novo.
 *
 * Só fica visível quando há ao menos 1 subpage (faz sentido — não há
 * "todas" se só há 1 página).
 */
function ApplyToAllSubpagesButton({
  el,
  type,
}: {
  el: ElementBase;
  type: "section-navbar" | "section-footer";
}) {
  const pageId = usePagesBuilderStore((s) => s.pageId);
  const { data: subpagesData } = useNasaPageSubpages(pageId ?? undefined);
  const { mutate: apply, isPending } = useBulkApplyElement();
  const subpages = subpagesData?.subpages ?? [];
  if (!pageId || subpages.length === 0) return null;
  const label = type === "section-navbar" ? "navbar" : "footer";
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() =>
        apply(
          {
            parentPageId: pageId,
            element: el as unknown as never,
            includeRoot: true,
          },
          {
            onSuccess: (result) =>
              toast.success(
                `${label} aplicada em ${result.affected} página(s) do site`,
              ),
            onError: (error: Error) =>
              toast.error(`Falha ao aplicar em todas: ${error.message}`),
          },
        )
      }
      className="text-xs w-full mt-2"
      title={`Substitui o ${label} em todas as páginas (root + subpages) deste site.`}
    >
      {isPending ? "Aplicando…" : `Aplicar em todas as páginas`}
    </Button>
  );
}

// ─── Type-specific panels ────────────────────────────────────────────────────

function TextProps({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">Tipografia</p>
      <Field label="Família da fonte">
        <Select value={(el.fontFamily as string) ?? "Inter"} onValueChange={(v) => update({ fontFamily: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Row>
        <NumField label="Tamanho (px)" value={(el.fontSize as number) ?? 16} onChange={(v) => update({ fontSize: v })} min={6} />
        <Field label="Peso">
          <Select value={(el.fontWeight as string) ?? "400"} onValueChange={(v) => update({ fontWeight: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map((w) => (
                <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Row>
      <Row>
        <NumField label="Altura linha" value={(el.lineHeight as number) ?? 1.5} onChange={(v) => update({ lineHeight: v })} step={0.1} min={1} />
        <NumField label="Espaç. letras" value={(el.letterSpacing as number) ?? 0} onChange={(v) => update({ letterSpacing: v })} step={0.5} />
      </Row>
      <Field label="Alinhamento">
        <div className="flex rounded-md border overflow-hidden">
          {ALIGN_OPTIONS.map((a) => (
            <button
              key={a}
              onClick={() => update({ align: a })}
              className={cn(
                "flex-1 py-1.5 text-[10px] uppercase transition-colors",
                el.align === a ? "bg-indigo-500 text-white" : "hover:bg-muted",
              )}
            >
              {a === "left" ? "←" : a === "center" ? "↔" : a === "right" ? "→" : "≡"}
            </button>
          ))}
        </div>
      </Field>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">Estilo</p>
      <div className="flex gap-1 mb-2">
        {(["italic","underline","strikethrough"] as const).map((s) => (
          <button
            key={s}
            onClick={() => update({ [s]: !(el[s] as boolean) })}
            className={cn(
              "px-2.5 py-1 rounded border text-xs font-medium transition-colors",
              el[s] ? "bg-indigo-500 text-white border-indigo-500" : "hover:bg-muted",
            )}
          >
            {s === "italic" ? "I" : s === "underline" ? "U" : "S̶"}
          </button>
        ))}
      </div>
      <ColorField label="Cor do texto" value={(el.color as string) ?? "#0f172a"} onChange={(v) => update({ color: v })} />
      <ColorField label="Cor de fundo" value={(el.textBg as string) ?? ""} onChange={(v) => update({ textBg: v })} />
      <Seg />
      <Field label="Texto">
        <Textarea
          rows={4}
          className="text-xs resize-none"
          value={typeof el.content === "string" ? el.content : extractText(el.content)}
          onChange={(e) => update({ content: e.target.value })}
          placeholder="Digite o texto..."
        />
      </Field>
    </>
  );
}

function ImageProps({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);

  const handleUpload = async (file: File) => {
    try {
      const url = await uploadImage(file);
      update({ src: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    }
  };

  const handleRemoveBg = async () => {
    const src = el.src as string;
    if (!src) return;
    if (/\.svg(\?|$)/i.test(src)) {
      toast.error("SVG não suportado — use uma imagem PNG ou JPG");
      return;
    }
    setRemovingBg(true);
    try {
      const inputBlob = await toRasterBlob(src);
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(inputBlob, {
        output: { format: "image/png", quality: 1 },
      });
      const file = new File([blob], "sem-fundo.png", { type: "image/png" });
      const url = await uploadImage(file);
      update({ src: url });
      toast.success("Fundo removido!");
    } catch {
      toast.error("Falha ao remover fundo");
    } finally {
      setRemovingBg(false);
    }
  };

  return (
    <>
      {cropOpen && (el.src as string) && (
        <ImageCropEditor
          src={el.src as string}
          initialCrop={el.crop as { x: number; y: number; w: number; h: number } | undefined}
          onApply={(crop) => {
            update({ crop });
            setCropOpen(false);
          }}
          onClose={() => setCropOpen(false)}
        />
      )}
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">Imagem</p>
      <Field label="URL da imagem">
        <Input
          value={(el.src as string) ?? ""}
          onChange={(e) => update({ src: e.target.value })}
          className="h-8 text-xs"
          placeholder="https://..."
        />
      </Field>
      <div className="flex gap-2 mt-1">
        <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => fileRef.current?.click()}>
          Fazer upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-8 gap-1"
          onClick={() => window.open("https://www.canva.com/", "_blank")}
        >
          <ExternalLink className="size-3" />
          Canva
        </Button>
      </div>
      {el.src && (
        <>
          <div className="mt-2 rounded-md overflow-hidden border" style={{ height: 80 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={el.src as string} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-8 gap-1"
              onClick={() => setCropOpen(true)}
            >
              <Crop className="size-3" />
              {el.crop ? "Editar corte" : "Cortar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-8 gap-1"
              onClick={handleRemoveBg}
              disabled={removingBg}
            >
              <Wand2 className="size-3" />
              {removingBg ? "Processando…" : "Remover fundo"}
            </Button>
          </div>
          {el.crop && (
            <button
              className="text-[10px] text-muted-foreground underline mt-1 text-left"
              onClick={() => update({ crop: undefined })}
            >
              Remover corte
            </button>
          )}
        </>
      )}
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">Ajuste</p>
      <Field label="Encaixe">
        <Select value={(el.fit as string) ?? "cover"} onValueChange={(v) => update({ fit: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Row>
        <NumField label="Borda arredondada" value={(el.borderRadius as number) ?? 0} onChange={(v) => update({ borderRadius: v })} min={0} />
        <NumField label="Opacidade %" value={Math.round(((el.imageOpacity as number) ?? 1) * 100)} onChange={(v) => update({ imageOpacity: v / 100 })} step={5} min={0} />
      </Row>
      <ColorField label="Sobreposição de cor" value={(el.colorOverlay as string) ?? ""} onChange={(v) => update({ colorOverlay: v })} />
      {el.colorOverlay && (
        <NumField label="Opac. sobreposição %" value={Math.round(((el.overlayOpacity as number) ?? 0.5) * 100)} onChange={(v) => update({ overlayOpacity: v / 100 })} step={5} min={0} />
      )}
      <Seg />
      <Field label="Texto alternativo (acessibilidade)">
        <Input value={(el.alt as string) ?? ""} onChange={(e) => update({ alt: e.target.value })} className="h-8 text-xs" />
      </Field>

      <LinkEditor el={el} update={update} />
    </>
  );
}

/**
 * Editor compartilhado de link/âncora — usado por Image (e pode ser
 * reusado em outros átomos). Aceita URL externa OU âncora interna
 * (#id). Marca "abrir em nova aba" só pra URLs externas (auto-
 * disabled pra âncoras pelos mesmos motivos do ButtonProps).
 */
function LinkEditor({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  const link =
    (el.link as { kind?: string; href?: string; openInNewTab?: boolean } | undefined) ??
    {};
  const href = link.href ?? "";
  const openInNewTab = link.openInNewTab ?? false;
  const isInternal =
    href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:");
  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Link / âncora (opcional)
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Cole uma URL externa, âncora interna (<code className="font-mono">#planos</code>),
        ou <code className="font-mono">mailto:</code>/<code className="font-mono">tel:</code>.
        Deixe vazio pra não ser clicável.
      </p>
      <Input
        value={href}
        onChange={(e) =>
          update({
            link: { kind: "url", href: e.target.value, openInNewTab },
          })
        }
        placeholder="https://... ou #section-id"
        className="text-xs font-mono"
      />
      {href && (
        <label className="flex items-center gap-2 text-xs mt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={openInNewTab && !isInternal}
            disabled={isInternal}
            onChange={(e) =>
              update({
                link: { kind: "url", href, openInNewTab: e.target.checked },
              })
            }
          />
          <span className={isInternal ? "text-muted-foreground" : ""}>
            Abrir em nova aba
            {isInternal && " (âncora interna sempre na mesma aba)"}
          </span>
        </label>
      )}
    </>
  );
}

function ShapeProps({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">Forma</p>
      <Field label="Tipo">
        <Select value={(el.shape as string) ?? "rect"} onValueChange={(v) => update({ shape: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SHAPE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <ColorField label="Preenchimento" value={(el.fill as string) ?? "#6366f1"} onChange={(v) => update({ fill: v })} />
      <ColorField label="Borda" value={(el.stroke as string) ?? ""} onChange={(v) => update({ stroke: v })} />
      <Row>
        <NumField label="Espessura borda" value={(el.strokeWidth as number) ?? 0} onChange={(v) => update({ strokeWidth: v })} min={0} />
        <NumField label="Arredondamento" value={(el.borderRadius as number) ?? 0} onChange={(v) => update({ borderRadius: v })} min={0} />
      </Row>
    </>
  );
}

function ButtonProps({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  const link = (el.link as { kind?: string; href?: string; openInNewTab?: boolean } | undefined) ?? {};
  const href = link.href ?? "";
  const openInNewTab = link.openInNewTab ?? false;
  // Âncoras (#x), mailto:, tel: nunca abrem em nova aba mesmo se
  // o user marcar — explica isso pra ele.
  const isInternal =
    href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:");

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">Botão</p>
      <Field label="Rótulo">
        <Input value={(el.label as string) ?? ""} onChange={(e) => update({ label: e.target.value })} className="h-8 text-xs" />
      </Field>
      <Row>
        <ColorField label="Fundo" value={(el.bg as string) ?? "#6366f1"} onChange={(v) => update({ bg: v })} />
        <ColorField label="Texto" value={(el.fg as string) ?? "#ffffff"} onChange={(v) => update({ fg: v })} />
      </Row>
      <NumField label="Arredondamento (px)" value={(el.radius as number) ?? 10} onChange={(v) => update({ radius: v })} min={0} />
      <Seg />
      <Field label="Link / âncora">
        <Input
          placeholder="https://... ou #planos ou mailto:..."
          value={href}
          onChange={(e) =>
            update({
              link: { kind: "url", href: e.target.value, openInNewTab },
            })
          }
          className="h-8 text-xs font-mono"
        />
      </Field>
      <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
        Use <code className="font-mono">#id-da-section</code> pra scroll
        interno (precisa que a section tenha esse Anchor ID configurado).
        URL externa abre na mesma aba a menos que você marque abaixo.
      </p>
      <label className="flex items-center gap-2 text-xs mt-2 cursor-pointer">
        <input
          type="checkbox"
          checked={openInNewTab}
          disabled={isInternal}
          onChange={(e) =>
            update({
              link: { kind: "url", href, openInNewTab: e.target.checked },
            })
          }
        />
        <span className={isInternal ? "text-muted-foreground" : ""}>
          Abrir em nova aba
          {isInternal && " (âncora interna sempre rola na mesma página)"}
        </span>
      </label>
    </>
  );
}

function VideoProps({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">Vídeo</p>
      <Field label="URL (YouTube, Vimeo ou direto)">
        <Input
          placeholder="https://www.youtube.com/watch?v=..."
          value={(el.url as string) ?? ""}
          onChange={(e) => update({ url: e.target.value })}
          className="h-8 text-xs"
        />
      </Field>
      <div className="flex gap-4 mt-1">
        {(["autoplay","muted","loop"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={(el[k] as boolean) ?? false}
              onChange={(e) => update({ [k]: e.target.checked })}
              className="rounded"
            />
            {k === "autoplay" ? "Auto" : k === "muted" ? "Mudo" : "Loop"}
          </label>
        ))}
      </div>
    </>
  );
}

function EmbedProps({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">Embed HTML</p>
      <Textarea
        rows={6}
        value={(el.html as string) ?? ""}
        onChange={(e) => update({ html: e.target.value })}
        className="text-xs font-mono resize-none"
        placeholder="<iframe ...></iframe>"
      />
    </>
  );
}

// ─── LogoUploader (helper compartilhado entre Navbar e Footer) ──────────────
//
// Renderiza um uploader de imagem completo: botão "Fazer upload" que
// abre file picker → uploadImage() (R2 server-side em prod, local em dev) → seta o `logoSrc`.
// Mostra preview da imagem atual e botão pra remover.
//
// Reusa a mesma rota usada pelo ImageProps — já validada em produção.

function LogoUploader({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      update({ logoSrc: url });
      toast.success("Logo carregada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const logoSrc = (el.logoSrc as string) ?? "";

  return (
    <>
      <Label className="text-[10px] text-muted-foreground">
        Logo (imagem)
      </Label>

      {/* Botão de upload + preview */}
      <div className="flex gap-2 mt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-8"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Carregando…" : logoSrc ? "Trocar imagem" : "Fazer upload"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.svg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        {logoSrc && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => update({ logoSrc: "" })}
            title="Remover imagem"
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        )}
      </div>

      {/* Preview */}
      {logoSrc && (
        <div className="mt-2 rounded-md border bg-muted/30 p-2 flex items-center justify-center" style={{ height: 64 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Preview da logo"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}

      {/* URL manual (alternativa) */}
      <Label className="text-[10px] text-muted-foreground mt-2">
        ou cola a URL diretamente
      </Label>
      <Input
        value={logoSrc}
        onChange={(e) => update({ logoSrc: e.target.value })}
        placeholder="https://meusite.com/logo.png"
        className="text-xs font-mono"
      />
    </>
  );
}

// ─── Navbar (section-navbar) ────────────────────────────────────────────────
//
// Editor dedicado pro section-navbar. Permite trocar logo (texto ou
// imagem via upload), editar links com âncoras, configurar destinos
// dos CTAs e ajustar cores via tokens.

function NavbarProps({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  type NavLink = {
    id: string;
    label: string;
    href?: string;
    /** Link interno pra subpage do site (multi-page).
     *  Resolvido server-side via context `siblingPages`. */
    subpageId?: string;
  };
  const links = ((el.links as NavLink[] | undefined) ?? []).slice();
  const pageId = usePagesBuilderStore((s) => s.pageId);
  const { data: subpagesData } = useNasaPageSubpages(pageId ?? undefined);
  const subpages = subpagesData?.subpages ?? [];

  const updateLink = (idx: number, patch: Partial<NavLink>) => {
    const next = links.slice();
    next[idx] = { ...next[idx], ...patch };
    update({ links: next });
  };
  const addLink = () => {
    update({
      links: [
        ...links,
        { id: `l${Date.now()}`, label: "Novo link", href: "#" },
      ],
    });
  };
  const removeLink = (idx: number) => {
    update({ links: links.filter((_, i) => i !== idx) });
  };
  // Tipo do link (URL externa / Âncora interna / Página do site)
  // derivado do estado atual do link — não armazenamos `kind`
  // explicitamente pra evitar drift entre fonte de verdade (subpageId
  // OU href) e flag. Single source of truth = qual campo está preenchido.
  const getLinkKind = (link: NavLink): "subpage" | "anchor" | "url" => {
    if (link.subpageId) return "subpage";
    if ((link.href ?? "").trim().startsWith("#")) return "anchor";
    return "url";
  };
  const setLinkKind = (idx: number, kind: "subpage" | "anchor" | "url") => {
    const cur = links[idx];
    if (kind === "subpage") {
      // Limpa href; preserva label/id.
      updateLink(idx, { subpageId: subpages[0]?.id, href: undefined });
    } else if (kind === "anchor") {
      updateLink(idx, {
        subpageId: undefined,
        href: cur.href?.startsWith("#") ? cur.href : "#section-id",
      });
    } else {
      updateLink(idx, {
        subpageId: undefined,
        href: cur.href && !cur.href.startsWith("#") ? cur.href : "https://",
      });
    }
  };

  // Default "fixed" — quando o user clica "Fixado", queremos position:fixed
  // de verdade (sempre visível no topo), não sticky (que depende do
  // ancestor ter altura e overflow correto pra funcionar).
  //
  // Pages legadas que tinham stickyMode = "sticky" continuam funcionando:
  // o renderer trata "sticky" como variante que acompanha o flow (alternativa
  // ao "Fixado"). "static" desliga o pin no topo.
  const stickyMode =
    ((el.stickyMode as "sticky" | "fixed" | "static" | undefined) ?? "fixed");

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Posição e comportamento
      </p>
      <Label className="text-[10px] text-muted-foreground">
        Como a navbar se comporta ao rolar a página
      </Label>
      <div className="grid grid-cols-3 gap-1 mt-1">
        {(
          [
            {
              value: "fixed",
              label: "Fixado",
              hint: "Sempre visível no topo (recomendado)",
            },
            {
              value: "sticky",
              label: "Acompanha",
              hint: "Gruda no topo conforme rola (alternativa CSS sticky)",
            },
            {
              value: "static",
              label: "Estático",
              hint: "Rolagem normal, navbar some quando desce",
            },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => update({ stickyMode: opt.value })}
            title={opt.hint}
            className={cn(
              "rounded border px-2 py-1.5 text-[10px] font-medium transition-colors text-center",
              stickyMode === opt.value
                ? "bg-indigo-500 text-white border-indigo-500"
                : "bg-background text-muted-foreground border-border hover:bg-accent",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/80 mt-1 leading-snug">
        💡 &quot;Fixado&quot; é o padrão moderno — a navbar acompanha a rolagem
        sem cobrir o conteúdo.
      </p>
      {stickyMode === "fixed" && (
        <p className="text-[10px] text-amber-700 mt-1 leading-snug">
          ⚠ No editor o &quot;Fixado&quot; aparece no fluxo normal
          (limitação do canvas com zoom). O comportamento real só
          aparece na página publicada.
        </p>
      )}

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Logo
      </p>
      <LogoUploader el={el} update={update} />
      <Label className="text-[10px] text-muted-foreground mt-3">
        Texto da logo (fallback, mostra se a imagem estiver vazia)
      </Label>
      <Input
        value={(el.logoText as string) ?? ""}
        onChange={(e) => update({ logoText: e.target.value })}
        placeholder="N.A.S.A"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">
        Destino da logo
      </Label>
      <AnchorPicker
        value={(el.logoHref as string) ?? "#top"}
        onChange={(next) => update({ logoHref: next })}
        placeholder="Topo ou outra section…"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Links da navegação
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Cada link tem um <strong>rótulo</strong> (texto visível) e um{" "}
        <strong>destino</strong>. Pra fazer scroll pra uma section da
        própria página, use <code className="font-mono">#id-da-section</code>{" "}
        (esse ID é definido no campo "Anchor ID" da section destino).
      </p>
      {links.map((link, idx) => {
        const kind = getLinkKind(link);
        return (
        <div key={link.id} className="flex flex-col gap-1 p-2 border rounded-md mb-2 bg-muted/30">
          <div className="flex items-center gap-1">
            <Input
              value={link.label}
              onChange={(e) => updateLink(idx, { label: e.target.value })}
              placeholder="Rótulo (ex: Planos)"
              className="text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeLink(idx)}
              className="size-7 shrink-0"
              title="Remover link"
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
          <Label className="text-[10px] text-muted-foreground">
            Tipo do link
          </Label>
          <select
            value={kind}
            onChange={(e) => setLinkKind(idx, e.target.value as typeof kind)}
            className="h-7 w-full rounded border bg-background text-[11px] px-1"
          >
            <option value="anchor">Âncora interna (#id)</option>
            <option value="url">URL externa</option>
            <option value="subpage" disabled={subpages.length === 0}>
              Página do site{subpages.length === 0 ? " (sem subpages)" : ""}
            </option>
          </select>
          {kind === "subpage" ? (
            <>
              <Label className="text-[10px] text-muted-foreground">
                Subpage destino
              </Label>
              <select
                value={link.subpageId ?? ""}
                onChange={(e) =>
                  updateLink(idx, { subpageId: e.target.value })
                }
                className="h-7 w-full rounded border bg-background text-[11px] px-1"
              >
                {subpages.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.title} (/{sub.slug})
                  </option>
                ))}
              </select>
            </>
          ) : kind === "anchor" ? (
            <>
              <Label className="text-[10px] text-muted-foreground">
                Camada destino (âncora)
              </Label>
              <AnchorPicker
                value={link.href ?? ""}
                onChange={(next) => updateLink(idx, { href: next })}
                placeholder="Escolha uma section…"
              />
            </>
          ) : (
            <>
              <Label className="text-[10px] text-muted-foreground">
                URL (https://...)
              </Label>
              <Input
                value={link.href ?? ""}
                onChange={(e) => updateLink(idx, { href: e.target.value })}
                placeholder="https://..."
                className="text-xs font-mono"
              />
            </>
          )}
        </div>
        );
      })}
      <Button variant="outline" size="sm" onClick={addLink} className="text-xs">
        + Adicionar link
      </Button>

      <ApplyToAllSubpagesButton el={el} type="section-navbar" />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Botão primário
      </p>
      <Label className="text-[10px] text-muted-foreground">Texto</Label>
      <Input
        value={(el.primaryCta as string) ?? ""}
        onChange={(e) => update({ primaryCta: e.target.value })}
        placeholder="Começar grátis"
        className="text-xs mb-1.5"
      />
      <Label className="text-[10px] text-muted-foreground">
        Destino do botão primário
      </Label>
      <AnchorPicker
        value={(el.primaryCtaHref as string) ?? ""}
        onChange={(next) => update({ primaryCtaHref: next })}
        placeholder="Escolha uma section ou URL…"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Botão secundário
      </p>
      <Label className="text-[10px] text-muted-foreground">Texto</Label>
      <Input
        value={(el.secondaryCta as string) ?? ""}
        onChange={(e) => update({ secondaryCta: e.target.value })}
        placeholder="Entrar"
        className="text-xs mb-1.5"
      />
      <Label className="text-[10px] text-muted-foreground">
        Destino do botão secundário
      </Label>
      <AnchorPicker
        value={(el.secondaryCtaHref as string) ?? ""}
        onChange={(next) => update({ secondaryCtaHref: next })}
        placeholder="Escolha uma section ou URL…"
      />

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── Footer (section-footer) ────────────────────────────────────────────────

function FooterProps({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  type FooterLink = { id: string; label: string; href: string };
  const links = ((el.links as FooterLink[] | undefined) ?? []).slice();
  const updateLink = (idx: number, patch: Partial<FooterLink>) => {
    const next = links.slice();
    next[idx] = { ...next[idx], ...patch };
    update({ links: next });
  };
  const addLink = () =>
    update({
      links: [
        ...links,
        { id: `l${Date.now()}`, label: "Novo", href: "#" },
      ],
    });
  const removeLink = (idx: number) =>
    update({ links: links.filter((_, i) => i !== idx) });

  return (
    <>
      <Seg />
      <AnchorIdField
        value={(el.anchorId as string) ?? ""}
        onChange={(v) => update({ anchorId: v })}
        placeholder="contato"
      />
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Logo do rodapé
      </p>
      <LogoUploader el={el} update={update} />
      <Label className="text-[10px] text-muted-foreground mt-3">Texto (fallback)</Label>
      <Input
        value={(el.logoText as string) ?? ""}
        onChange={(e) => update({ logoText: e.target.value })}
        placeholder="N.A.S.A"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Tagline</Label>
      <Input
        value={(el.tagline as string) ?? ""}
        onChange={(e) => update({ tagline: e.target.value })}
        placeholder="Powered pelo Método N.A.S.A.®"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Copyright</Label>
      <Input
        value={(el.copyright as string) ?? ""}
        onChange={(e) => update({ copyright: e.target.value })}
        placeholder="© 2026 N.A.S.A"
        className="text-xs"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Links do rodapé
      </p>
      {links.map((link, idx) => (
        <div key={link.id} className="flex flex-col gap-1 p-2 border rounded-md mb-2 bg-muted/30">
          <div className="flex items-center gap-1">
            <Input
              value={link.label}
              onChange={(e) => updateLink(idx, { label: e.target.value })}
              placeholder="Rótulo"
              className="text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeLink(idx)}
              className="size-7 shrink-0"
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
          <Input
            value={link.href}
            onChange={(e) => updateLink(idx, { href: e.target.value })}
            placeholder="#"
            className="text-xs font-mono"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addLink} className="text-xs">
        + Adicionar link
      </Button>

      <ApplyToAllSubpagesButton el={el} type="section-footer" />

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── Hero image uploader (mesmo padrão do LogoUploader mas pro field
//      `imageUrl` do section-hero) ────────────────────────────────────────────
function HeroImageUploader({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      update({ imageUrl: url });
      toast.success("Imagem do hero carregada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };
  const imageUrl = (el.imageUrl as string) ?? "";
  return (
    <>
      <div className="flex gap-2 mt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-8"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Carregando…" : imageUrl ? "Trocar imagem" : "Fazer upload"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        {imageUrl && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => update({ imageUrl: "" })}
            title="Remover"
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        )}
      </div>
      {imageUrl && (
        <div className="mt-2 rounded-md overflow-hidden border" style={{ height: 80 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}
      <Label className="text-[10px] text-muted-foreground mt-2">
        ou cola a URL
      </Label>
      <Input
        value={imageUrl}
        onChange={(e) => update({ imageUrl: e.target.value })}
        placeholder="https://..."
        className="text-xs font-mono"
      />
    </>
  );
}

// ─── Hero background uploader (cobre o fundo da section toda,
//      estilo A MINA / drathaine) ──────────────────────────────────
function HeroBackgroundUploader({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const bgUrl = (el.backgroundImage as string) ?? "";

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file);
      update({ backgroundImage: url });
      toast.success("Imagem de fundo aplicada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 mt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-8"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Carregando…" : bgUrl ? "Trocar fundo" : "Fazer upload"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        {bgUrl && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => update({ backgroundImage: "" })}
            title="Remover fundo"
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        )}
      </div>
      {bgUrl && (
        <div
          className="mt-2 rounded-md overflow-hidden border relative"
          style={{ height: 80 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgUrl}
            alt="Preview fundo"
            className="w-full h-full object-cover"
          />
          {/* overlay preview pra mostrar como vai parecer com texto */}
          <div
            className="absolute inset-0"
            style={{
              background:
                (el.backgroundOverlay as string) ??
                "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.80) 100%)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold uppercase tracking-wider">
            Preview com overlay
          </div>
        </div>
      )}
      <Label className="text-[10px] text-muted-foreground mt-2">ou cola a URL</Label>
      <Input
        value={bgUrl}
        onChange={(e) => update({ backgroundImage: e.target.value })}
        placeholder="https://..."
        className="text-xs font-mono"
      />
      {bgUrl && (
        <>
          <Label className="text-[10px] text-muted-foreground mt-3">
            Escurecimento da imagem (overlay)
          </Label>
          <select
            value={(el.backgroundOverlay as string) ?? ""}
            onChange={(e) => update({ backgroundOverlay: e.target.value })}
            className="w-full text-xs border rounded-md bg-background h-8 px-2"
          >
            <option value="linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.40) 100%)">
              Claro (texto + visível)
            </option>
            <option value="linear-gradient(180deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.60) 100%)">
              Médio
            </option>
            <option value="linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.80) 100%)">
              Escuro (padrão)
            </option>
            <option value="linear-gradient(180deg, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.90) 100%)">
              Muito escuro
            </option>
            <option value="linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.10) 100%)">
              Esquerda → direita (texto à esq.)
            </option>
            <option value="linear-gradient(270deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.10) 100%)">
              Direita → esquerda (texto à dir.)
            </option>
          </select>
          <Label className="text-[10px] text-muted-foreground mt-2">
            Posição da imagem
          </Label>
          <select
            value={(el.backgroundPosition as string) ?? "center"}
            onChange={(e) => update({ backgroundPosition: e.target.value })}
            className="w-full text-xs border rounded-md bg-background h-8 px-2"
          >
            <option value="center">Centro</option>
            <option value="top">Topo</option>
            <option value="bottom">Embaixo</option>
            <option value="left">Esquerda</option>
            <option value="right">Direita</option>
            <option value="top left">Topo esquerda</option>
            <option value="top right">Topo direita</option>
            <option value="bottom left">Embaixo esquerda</option>
            <option value="bottom right">Embaixo direita</option>
          </select>
        </>
      )}
    </>
  );
}

// ─── Hero (section-hero) ────────────────────────────────────────────────────

function HeroProps({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Conteúdo do Hero
      </p>
      <Label className="text-[10px] text-muted-foreground">Badge (acima do título)</Label>
      <Input
        value={(el.badge as string) ?? ""}
        onChange={(e) => update({ badge: e.target.value })}
        placeholder="★ Novo"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Título — linha 1</Label>
      <Input
        value={(el.titleLine1 as string) ?? ""}
        onChange={(e) => update({ titleLine1: e.target.value })}
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">
        Título — linha 2 (acento)
      </Label>
      <Input
        value={(el.titleLine2 as string) ?? ""}
        onChange={(e) => update({ titleLine2: e.target.value })}
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Subtítulo</Label>
      <Textarea
        rows={3}
        value={(el.subtitle as string) ?? ""}
        onChange={(e) => update({ subtitle: e.target.value })}
        className="text-xs"
      />
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Imagem de fundo (full-bleed)
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Cobre todo o fundo da section. Use pra criar heros estilo "A
        MINA" / evento — imagem + texto sobreposto. Mobile e desktop
        recebem a mesma imagem com ajuste automático.
      </p>
      <HeroBackgroundUploader el={el} update={update} />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Imagem central (abaixo do texto)
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Mockup / produto que aparece embaixo do título. Pode usar
        junto com imagem de fundo ou sozinho.
      </p>
      <HeroImageUploader el={el} update={update} />

      <ButtonsListEditor el={el} update={update} />

      <Seg />
      <AnchorIdField
        value={(el.anchorId as string) ?? ""}
        onChange={(v) => update({ anchorId: v })}
        placeholder="hero"
      />

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── Bloco genérico de cores (compartilhado) ────────────────────────────────

function ColorBlock({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Cores
      </p>
      <Row>
        <ColorField label="Fundo" value={(el.bgColor as string) ?? ""} onChange={(v) => update({ bgColor: v })} />
        <ColorField label="Texto" value={(el.fgColor as string) ?? ""} onChange={(v) => update({ fgColor: v })} />
      </Row>
      <Row>
        <ColorField label="Primária" value={(el.primaryColor as string) ?? ""} onChange={(v) => update({ primaryColor: v })} />
        <ColorField label="Secundária" value={(el.mutedColor as string) ?? ""} onChange={(v) => update({ mutedColor: v })} />
      </Row>
    </>
  );
}

// (ColorField já está definido em outro lugar do arquivo — usa a versão existente)

// ─── Responsive section ──────────────────────────────────────────────────────

function ResponsiveProps({ el, update }: { el: ElementBase; update: (p: Partial<ElementBase>) => void }) {
  const hiddenOn: Device[] = (el.responsive?.hiddenOn as Device[]) ?? [];

  const toggle = (d: Device) => {
    const next = hiddenOn.includes(d)
      ? hiddenOn.filter((x) => x !== d)
      : [...hiddenOn, d];
    update({
      responsive: {
        ...(el.responsive ?? {}),
        hiddenOn: next.length > 0 ? next : undefined,
      } as ElementBase["responsive"],
    });
  };

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Responsividade
      </p>
      <Field label="Ocultar em:">
        <div className="flex gap-1.5">
          {(["mobile", "tablet"] as Device[]).map((d) => (
            <button
              key={d}
              onClick={() => toggle(d)}
              className={cn(
                "flex-1 py-1.5 rounded border text-xs font-medium transition-colors",
                hiddenOn.includes(d)
                  ? "bg-red-50 text-red-600 border-red-300"
                  : "hover:bg-muted border-border",
              )}
            >
              {d === "mobile" ? "📱 Mobile" : "⬜ Tablet"}
            </button>
          ))}
        </div>
      </Field>
      {hiddenOn.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Oculto em: {hiddenOn.join(", ")}. Visível nos demais devices.
        </p>
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// EDITORES DAS DEMAIS SECTIONS (Fase 2)
//
// Cada section type tem props específicas (heading, listas de cards,
// planos, depoimentos, FAQ, stats, CTA). Sem esses editores, o user
// clica num bloco section-* e o painel não mostra os campos — só os
// genéricos (x/y/w/h). Esses 7 editores resolvem essa lacuna.
// ───────────────────────────────────────────────────────────────────────────

// ─── Lista de botões (Hero, CTA) ─────────────────────────────────────────
// User reclamou que não dava pra adicionar/remover botões nesses
// blocos — só editava os 2 fixos (primary/secondary). Agora é lista
// dinâmica com variants. Usa `legacyToButtonsList` pra inicializar
// a partir dos campos legados (primaryCta/secondaryCta) na primeira
// vez que o user mexe.
function ButtonsListEditor({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  const buttons = legacyToButtonsList(el);
  const writeButtons = (next: SectionButton[]) => {
    // Ao primeira edição, persistimos buttons[] e zeramos os legados
    // pra não ficar source-of-truth duplo.
    update({
      buttons: next,
      primaryCta: undefined,
      primaryCtaHref: undefined,
      secondaryCta: undefined,
      secondaryCtaHref: undefined,
    } as Partial<ElementBase>);
  };
  const patch = (idx: number, p: Partial<SectionButton>) => {
    const next = buttons.slice();
    next[idx] = { ...next[idx], ...p };
    writeButtons(next);
  };
  const add = () =>
    writeButtons([
      ...buttons,
      {
        id: `b${Date.now()}`,
        label: "Novo botão",
        href: "#",
        variant: buttons.length === 0 ? "primary" : "outline",
      },
    ]);
  const remove = (idx: number) =>
    writeButtons(buttons.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= buttons.length) return;
    const next = buttons.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    writeButtons(next);
  };

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Botões ({buttons.length})
      </p>
      {buttons.map((b, idx) => (
        <div
          key={b.id}
          className="p-2 border rounded-md mb-2 bg-muted/30 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1">
            <Input
              value={b.label}
              onChange={(e) => patch(idx, { label: e.target.value })}
              placeholder="Texto do botão"
              className="text-xs flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              className="size-7 shrink-0"
              title="Subir"
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => move(idx, 1)}
              disabled={idx === buttons.length - 1}
              className="size-7 shrink-0"
              title="Descer"
            >
              ↓
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(idx)}
              className="size-7 shrink-0"
              title="Remover"
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
          <Label className="text-[10px] text-muted-foreground">
            Link (âncora #, URL, mailto, tel:)
          </Label>
          <Input
            value={b.href}
            onChange={(e) => patch(idx, { href: e.target.value })}
            placeholder="#cta-final ou https://..."
            className="text-xs font-mono"
          />
          <Label className="text-[10px] text-muted-foreground">Estilo</Label>
          <select
            value={b.variant}
            onChange={(e) =>
              patch(idx, {
                variant: e.target.value as SectionButton["variant"],
              })
            }
            className="w-full text-xs border rounded-md bg-background h-8 px-2"
          >
            <option value="primary">Primário (sólido)</option>
            <option value="outline">Outline (borda)</option>
            <option value="ghost">Ghost (link sublinhado)</option>
          </select>

          {/* Cores opcionais por botão. Override do variant — útil
              quando o user quer destacar 1 botão sem mexer nos
              tokens globais da section. */}
          <Row cols={2}>
            <ColorField
              label="Fundo (opc)"
              value={b.bgColor ?? ""}
              onChange={(v) => patch(idx, { bgColor: v || undefined })}
            />
            <ColorField
              label="Texto (opc)"
              value={b.fgColor ?? ""}
              onChange={(v) => patch(idx, { fgColor: v || undefined })}
            />
          </Row>
          {(b.bgColor || b.fgColor) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-6 -mt-1"
              onClick={() =>
                patch(idx, { bgColor: undefined, fgColor: undefined })
              }
            >
              Resetar cores (usar do tema)
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="text-xs">
        + Adicionar botão
      </Button>
    </>
  );
}

// ─── Features (section-features) ──────────────────────────────────────────
function FeaturesProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  type Feature = {
    id: string;
    icon: string;
    title: string;
    description: string;
    titleStyle?: TextStyle;
    descriptionStyle?: TextStyle;
    cardBg?: string;
    cardBorder?: string;
  };
  const items = ((el.features as Feature[] | undefined) ?? []).slice();
  const patch = (idx: number, p: Partial<Feature>) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...p };
    update({ features: next });
  };
  const add = () =>
    update({
      features: [
        ...items,
        {
          id: `f${Date.now()}`,
          icon: "✨",
          title: "Novo card",
          description: "Descrição do card",
        },
      ],
    });
  const remove = (idx: number) =>
    update({ features: items.filter((_, i) => i !== idx) });
  const duplicate = (idx: number) => {
    const clone = {
      ...items[idx],
      id: `f${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    update({
      features: [...items.slice(0, idx + 1), clone, ...items.slice(idx + 1)],
    });
  };

  // Reorder: orquestrado pelo DndContext global do BuilderSidebar (handleDragEnd reconhece data.kind="section-item")

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Cabeçalho da seção
      </p>
      <Label className="text-[10px] text-muted-foreground">Título</Label>
      <Input
        value={(el.heading as string) ?? ""}
        onChange={(e) => update({ heading: e.target.value })}
        placeholder="Por que escolher a gente"
        className="text-xs mb-2"
      />
      <TypographyEditor
        label="Tipografia do título"
        value={el.headingStyle as TextStyle | undefined}
        onChange={(v) => update({ headingStyle: v })}
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Subtítulo</Label>
      <Textarea
        rows={2}
        value={(el.subheading as string) ?? ""}
        onChange={(e) => update({ subheading: e.target.value })}
        className="text-xs mb-2"
      />
      <TypographyEditor
        label="Tipografia do subtítulo"
        value={el.subheadingStyle as TextStyle | undefined}
        onChange={(v) => update({ subheadingStyle: v })}
      />
      <AnchorIdField
        value={(el.anchorId as string) ?? ""}
        onChange={(v) => update({ anchorId: v })}
        placeholder="por-que"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Tipografia padrão dos cards
      </p>
      <TypographyEditor
        label="Padrão do título do card"
        value={el.titleStyle as TextStyle | undefined}
        onChange={(v) => update({ titleStyle: v })}
      />
      <TypographyEditor
        label="Padrão da descrição"
        value={el.descriptionStyle as TextStyle | undefined}
        onChange={(v) => update({ descriptionStyle: v })}
      />

      <CardAnimatedBorderEditor el={el} update={update} />
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Aparência dos cards
      </p>
      <Row cols={2}>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Fundo (padrão)
          </Label>
          <Input
            value={(el.cardBg as string) ?? ""}
            onChange={(e) => update({ cardBg: e.target.value || undefined })}
            placeholder="rgba(...)"
            className="text-[11px] font-mono"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Borda</Label>
          <Input
            value={(el.cardBorder as string) ?? ""}
            onChange={(e) => update({ cardBorder: e.target.value || undefined })}
            placeholder="rgba(...)"
            className="text-[11px] font-mono"
          />
        </div>
      </Row>
      <Row cols={3}>
        <div>
          <Label className="text-[10px] text-muted-foreground">Raio</Label>
          <Input
            type="number"
            min={0}
            max={64}
            value={(el.cardRadius as number) ?? 16}
            onChange={(e) => update({ cardRadius: Number(e.target.value) })}
            className="text-[11px]"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Padding</Label>
          <Input
            type="number"
            min={0}
            max={64}
            value={(el.cardPadding as number) ?? 24}
            onChange={(e) => update({ cardPadding: Number(e.target.value) })}
            className="text-[11px]"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Ícone</Label>
          <Input
            type="number"
            min={12}
            max={96}
            value={(el.iconSize as number) ?? 32}
            onChange={(e) => update({ iconSize: Number(e.target.value) })}
            className="text-[11px]"
          />
        </div>
      </Row>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Cards ({items.length})
      </p>
        <SortableContext
          items={items.map((it) => it.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item, idx) => (
            <SortableSectionItem
              key={item.id}
              id={item.id}
              collection="features"
              elementId={el.id}
              label={`#${idx + 1}`}
              summary={item.title}
              onDuplicate={() => duplicate(idx)}
              onRemove={() => remove(idx)}
            >
              <Row cols={2}>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Ícone
                  </Label>
                  <Input
                    value={item.icon}
                    onChange={(e) => patch(idx, { icon: e.target.value })}
                    placeholder="🎯"
                    className="text-base text-center"
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Título
                  </Label>
                  <Input
                    value={item.title}
                    onChange={(e) => patch(idx, { title: e.target.value })}
                    placeholder="Rápido"
                    className="text-xs"
                  />
                </div>
              </Row>
              <Label className="text-[10px] text-muted-foreground">
                Descrição
              </Label>
              <Textarea
                rows={2}
                value={item.description}
                onChange={(e) => patch(idx, { description: e.target.value })}
                placeholder="Descrição"
                className="text-xs"
              />
              <div className="mt-2">
                <TypographyEditor
                  label="Título"
                  value={item.titleStyle}
                  inherited={el.titleStyle as TextStyle | undefined}
                  onChange={(v) => patch(idx, { titleStyle: v })}
                />
                <TypographyEditor
                  label="Descrição"
                  value={item.descriptionStyle}
                  inherited={el.descriptionStyle as TextStyle | undefined}
                  onChange={(v) => patch(idx, { descriptionStyle: v })}
                />
              </div>
              <Row cols={2}>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Fundo
                  </Label>
                  <Input
                    value={item.cardBg ?? ""}
                    onChange={(e) =>
                      patch(idx, { cardBg: e.target.value || undefined })
                    }
                    placeholder="(herda)"
                    className="text-[10px] font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Borda
                  </Label>
                  <Input
                    value={item.cardBorder ?? ""}
                    onChange={(e) =>
                      patch(idx, { cardBorder: e.target.value || undefined })
                    }
                    placeholder="(herda)"
                    className="text-[10px] font-mono"
                  />
                </div>
              </Row>
            </SortableSectionItem>
          ))}
        </SortableContext>
      <Button variant="outline" size="sm" onClick={add} className="text-xs w-full">
        + Adicionar card
      </Button>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Blocos intermediários
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Insira texto, imagem, botão, badge etc. <strong>entre</strong> o
        cabeçalho e os cards, ou em outras zonas da section.
      </p>
      <InterludeZonesEditor el={el} update={update} />

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── Pricing (section-pricing) ────────────────────────────────────────────
function PricingProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  type Plan = {
    id: string;
    name: string;
    price: string;
    period?: string;
    slogan?: string;
    features: string[];
    ctaLabel: string;
    ctaHref?: string;
    highlighted?: boolean;
    badge?: string;
    nameStyle?: TextStyle;
    sloganStyle?: TextStyle;
    priceStyle?: TextStyle;
    periodStyle?: TextStyle;
    featureStyle?: TextStyle;
    ctaStyle?: TextStyle;
    cardBg?: string;
    cardBorder?: string;
  };
  const plans = ((el.plans as Plan[] | undefined) ?? []).slice();
  const patch = (idx: number, p: Partial<Plan>) => {
    const next = plans.slice();
    next[idx] = { ...next[idx], ...p };
    update({ plans: next });
  };
  const add = () =>
    update({
      plans: [
        ...plans,
        {
          id: `p${Date.now()}`,
          name: "Novo plano",
          price: "R$ 0",
          period: "/mês",
          slogan: "",
          features: ["Recurso 1"],
          ctaLabel: "Assinar",
        },
      ],
    });
  const remove = (idx: number) =>
    update({ plans: plans.filter((_, i) => i !== idx) });
  const duplicate = (idx: number) => {
    const clone = {
      ...plans[idx],
      id: `p${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    update({
      plans: [...plans.slice(0, idx + 1), clone, ...plans.slice(idx + 1)],
    });
  };

  // Reorder: orquestrado pelo DndContext global do BuilderSidebar (handleDragEnd reconhece data.kind="section-item")

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Cabeçalho
      </p>
      <Label className="text-[10px] text-muted-foreground">Título</Label>
      <Input
        value={(el.heading as string) ?? ""}
        onChange={(e) => update({ heading: e.target.value })}
        placeholder="Escolha seu plano"
        className="text-xs mb-2"
      />
      <TypographyEditor
        label="Tipografia do título"
        value={el.headingStyle as TextStyle | undefined}
        onChange={(v) => update({ headingStyle: v })}
      />
      <Label className="text-[10px] text-muted-foreground mt-2">
        Subtítulo
      </Label>
      <Textarea
        rows={2}
        value={(el.subheading as string) ?? ""}
        onChange={(e) => update({ subheading: e.target.value })}
        className="text-xs mb-2"
      />
      <TypographyEditor
        label="Tipografia do subtítulo"
        value={el.subheadingStyle as TextStyle | undefined}
        onChange={(v) => update({ subheadingStyle: v })}
      />
      <AnchorIdField
        value={(el.anchorId as string) ?? "planos"}
        onChange={(v) => update({ anchorId: v })}
        placeholder="planos"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Tipografia padrão dos planos
      </p>
      <TypographyEditor label="Nome do plano" value={el.nameStyle as TextStyle | undefined} onChange={(v) => update({ nameStyle: v })} />
      <TypographyEditor label="Slogan" value={el.sloganStyle as TextStyle | undefined} onChange={(v) => update({ sloganStyle: v })} />
      <TypographyEditor label="Preço" value={el.priceStyle as TextStyle | undefined} onChange={(v) => update({ priceStyle: v })} />
      <TypographyEditor label="Período" value={el.periodStyle as TextStyle | undefined} onChange={(v) => update({ periodStyle: v })} />
      <TypographyEditor label="Feature" value={el.featureStyle as TextStyle | undefined} onChange={(v) => update({ featureStyle: v })} />
      <TypographyEditor label="Botão CTA" value={el.ctaStyle as TextStyle | undefined} onChange={(v) => update({ ctaStyle: v })} />

      <CardAnimatedBorderEditor el={el} update={update} />

      <Seg />
      <Row cols={2}>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Raio (px)
          </Label>
          <Input
            type="number"
            min={0}
            max={64}
            value={(el.cardRadius as number) ?? 16}
            onChange={(e) => update({ cardRadius: Number(e.target.value) })}
            className="text-[11px]"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Padding (px)
          </Label>
          <Input
            type="number"
            min={0}
            max={64}
            value={(el.cardPadding as number) ?? 24}
            onChange={(e) => update({ cardPadding: Number(e.target.value) })}
            className="text-[11px]"
          />
        </div>
      </Row>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Planos ({plans.length})
      </p>
        <SortableContext
          items={plans.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {plans.map((plan, idx) => (
            <SortableSectionItem
              key={plan.id}
              id={plan.id}
              collection="plans"
              elementId={el.id}
              label={`#${idx + 1}`}
              summary={`${plan.name} · ${plan.price}`}
              onDuplicate={() => duplicate(idx)}
              onRemove={() => remove(idx)}
            >
              <Label className="text-[10px] text-muted-foreground">Nome</Label>
              <Input
                value={plan.name}
                onChange={(e) => patch(idx, { name: e.target.value })}
                placeholder="Pro"
                className="text-xs"
              />
              <Row cols={2}>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Preço
                  </Label>
                  <Input
                    value={plan.price}
                    onChange={(e) => patch(idx, { price: e.target.value })}
                    placeholder="R$ 197"
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Período
                  </Label>
                  <Input
                    value={plan.period ?? ""}
                    onChange={(e) => patch(idx, { period: e.target.value })}
                    placeholder="/mês"
                    className="text-xs"
                  />
                </div>
              </Row>
              <Label className="text-[10px] text-muted-foreground">
                Slogan
              </Label>
              <Input
                value={plan.slogan ?? ""}
                onChange={(e) => patch(idx, { slogan: e.target.value })}
                placeholder="Pra equipes pequenas"
                className="text-xs"
              />
              <Label className="text-[10px] text-muted-foreground">
                Features (uma por linha)
              </Label>
              <Textarea
                rows={4}
                value={plan.features.join("\n")}
                onChange={(e) =>
                  patch(idx, {
                    features: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Recurso 1&#10;Recurso 2"
                className="text-xs"
              />
              <Row cols={2}>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Texto do botão
                  </Label>
                  <Input
                    value={plan.ctaLabel}
                    onChange={(e) => patch(idx, { ctaLabel: e.target.value })}
                    placeholder="Assinar"
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Link do botão
                  </Label>
                  <Input
                    value={plan.ctaHref ?? ""}
                    onChange={(e) => patch(idx, { ctaHref: e.target.value })}
                    placeholder="#cta-final"
                    className="text-xs font-mono"
                  />
                </div>
              </Row>
              <Row cols={2}>
                <div>
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={plan.highlighted ?? false}
                      onChange={(e) =>
                        patch(idx, { highlighted: e.target.checked })
                      }
                    />
                    Em destaque
                  </Label>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Badge
                  </Label>
                  <Input
                    value={plan.badge ?? ""}
                    onChange={(e) => patch(idx, { badge: e.target.value })}
                    placeholder="Mais popular"
                    className="text-xs"
                  />
                </div>
              </Row>
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground mb-1 leading-relaxed">
                  Sobrescreve a tipografia padrão SÓ deste plano.
                </p>
                <TypographyEditor label="Nome" value={plan.nameStyle} inherited={el.nameStyle as TextStyle | undefined} onChange={(v) => patch(idx, { nameStyle: v })} />
                <TypographyEditor label="Slogan" value={plan.sloganStyle} inherited={el.sloganStyle as TextStyle | undefined} onChange={(v) => patch(idx, { sloganStyle: v })} />
                <TypographyEditor label="Preço" value={plan.priceStyle} inherited={el.priceStyle as TextStyle | undefined} onChange={(v) => patch(idx, { priceStyle: v })} />
                <TypographyEditor label="Período" value={plan.periodStyle} inherited={el.periodStyle as TextStyle | undefined} onChange={(v) => patch(idx, { periodStyle: v })} />
                <TypographyEditor label="Feature" value={plan.featureStyle} inherited={el.featureStyle as TextStyle | undefined} onChange={(v) => patch(idx, { featureStyle: v })} />
                <TypographyEditor label="Botão" value={plan.ctaStyle} inherited={el.ctaStyle as TextStyle | undefined} onChange={(v) => patch(idx, { ctaStyle: v })} />
              </div>
              <Row cols={2}>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Fundo do card
                  </Label>
                  <Input
                    value={plan.cardBg ?? ""}
                    onChange={(e) =>
                      patch(idx, { cardBg: e.target.value || undefined })
                    }
                    placeholder="(herda)"
                    className="text-[10px] font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Borda
                  </Label>
                  <Input
                    value={plan.cardBorder ?? ""}
                    onChange={(e) =>
                      patch(idx, { cardBorder: e.target.value || undefined })
                    }
                    placeholder="(herda)"
                    className="text-[10px] font-mono"
                  />
                </div>
              </Row>
            </SortableSectionItem>
          ))}
        </SortableContext>
      <Button variant="outline" size="sm" onClick={add} className="text-xs w-full">
        + Adicionar plano
      </Button>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Blocos intermediários
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Insira texto, imagem, botão, badge etc. <strong>entre</strong> o
        cabeçalho e os cards, ou em outras zonas da section.
      </p>
      <InterludeZonesEditor el={el} update={update} />

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── Testimonials (section-testimonials) ──────────────────────────────────
//
// Editor completo:
//   • Cabeçalho da section com TypographyEditor próprio.
//   • Tipografia "padrão" pros campos dos cards (quote/author/role) —
//     aplica em todos sem override individual.
//   • Lista de depoimentos com drag-reorder, duplicar, colapsar.
//   • Cada card: campos texto + avatar + overrides tipográficos
//     próprios (sobrescrevem o "padrão").
//   • Aparência dos cards (background, borda, raio, padding) — também
//     overridável por card.
function TestimonialsProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  type T = {
    id: string;
    quote: string;
    author: string;
    role?: string;
    avatar?: string;
    quoteStyle?: TextStyle;
    authorStyle?: TextStyle;
    roleStyle?: TextStyle;
    cardBg?: string;
    cardBorder?: string;
  };
  const items = ((el.testimonials as T[] | undefined) ?? []).slice();
  const patch = (idx: number, p: Partial<T>) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...p };
    update({ testimonials: next });
  };
  const add = () =>
    update({
      testimonials: [
        ...items,
        {
          id: `t${Date.now()}`,
          quote: "Depoimento incrível.",
          author: "Nome",
          role: "Cargo",
          avatar: `https://i.pravatar.cc/120?img=${
            (items.length + 1) * 7
          }`,
        },
      ],
    });
  const remove = (idx: number) =>
    update({ testimonials: items.filter((_, i) => i !== idx) });
  const duplicate = (idx: number) => {
    const clone = {
      ...items[idx],
      id: `t${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    const next = [...items.slice(0, idx + 1), clone, ...items.slice(idx + 1)];
    update({ testimonials: next });
  };

  // Reorder é orquestrado pelo `DndContext` global do BuilderSidebar
  // via `handleDragEnd` (data.kind="section-item" + collection). Sem
  // DndContext local — nested DndContexts no @dnd-kit fazem o de fora
  // engolir eventos do de dentro.

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Cabeçalho
      </p>
      <Label className="text-[10px] text-muted-foreground">Título</Label>
      <Input
        value={(el.heading as string) ?? ""}
        onChange={(e) => update({ heading: e.target.value })}
        placeholder="O que dizem"
        className="text-xs mb-2"
      />
      <TypographyEditor
        label="Tipografia do título"
        value={el.headingStyle as TextStyle | undefined}
        onChange={(v) => update({ headingStyle: v })}
      />
      <AnchorIdField
        value={(el.anchorId as string) ?? ""}
        onChange={(v) => update({ anchorId: v })}
        placeholder="depoimentos"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Tipografia padrão dos cards
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Aplica em <strong>todos os depoimentos</strong>. Cada card pode
        sobrescrever individualmente abaixo.
      </p>
      <TypographyEditor
        label="Padrão da citação"
        value={el.quoteStyle as TextStyle | undefined}
        onChange={(v) => update({ quoteStyle: v })}
      />
      <TypographyEditor
        label="Padrão do autor"
        value={el.authorStyle as TextStyle | undefined}
        onChange={(v) => update({ authorStyle: v })}
      />
      <TypographyEditor
        label="Padrão do cargo"
        value={el.roleStyle as TextStyle | undefined}
        onChange={(v) => update({ roleStyle: v })}
      />

      <CardAnimatedBorderEditor el={el} update={update} />
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Aparência dos cards
      </p>
      <Row cols={2}>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Fundo (padrão)
          </Label>
          <Input
            value={(el.cardBg as string) ?? ""}
            onChange={(e) =>
              update({ cardBg: e.target.value || undefined })
            }
            placeholder="rgba(...)"
            className="text-[11px] font-mono"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Borda</Label>
          <Input
            value={(el.cardBorder as string) ?? ""}
            onChange={(e) =>
              update({ cardBorder: e.target.value || undefined })
            }
            placeholder="rgba(...)"
            className="text-[11px] font-mono"
          />
        </div>
      </Row>
      <Row cols={2}>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Raio (px)
          </Label>
          <Input
            type="number"
            min={0}
            max={64}
            value={(el.cardRadius as number) ?? 16}
            onChange={(e) =>
              update({ cardRadius: Number(e.target.value) })
            }
            className="text-[11px]"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Padding (px)
          </Label>
          <Input
            type="number"
            min={0}
            max={64}
            value={(el.cardPadding as number) ?? 24}
            onChange={(e) =>
              update({ cardPadding: Number(e.target.value) })
            }
            className="text-[11px]"
          />
        </div>
      </Row>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Depoimentos ({items.length})
      </p>
      <SortableContext
        items={items.map((it) => it.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item, idx) => (
            <SortableSectionItem
              key={item.id}
              id={item.id}
              collection="testimonials"
              elementId={el.id}
              label={`#${idx + 1}`}
              summary={item.author}
              onDuplicate={() => duplicate(idx)}
              onRemove={() => remove(idx)}
            >
              <Label className="text-[10px] text-muted-foreground">
                Citação
              </Label>
              <Textarea
                rows={3}
                value={item.quote}
                onChange={(e) => patch(idx, { quote: e.target.value })}
                placeholder="Mudou minha rotina completamente"
                className="text-xs"
              />
              <Row cols={2}>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Autor
                  </Label>
                  <Input
                    value={item.author}
                    onChange={(e) => patch(idx, { author: e.target.value })}
                    placeholder="Mariana F."
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Cargo
                  </Label>
                  <Input
                    value={item.role ?? ""}
                    onChange={(e) => patch(idx, { role: e.target.value })}
                    placeholder="Designer"
                    className="text-xs"
                  />
                </div>
              </Row>
              <Label className="text-[10px] text-muted-foreground">
                Avatar (URL)
              </Label>
              <Input
                value={item.avatar ?? ""}
                onChange={(e) => patch(idx, { avatar: e.target.value })}
                placeholder="https://..."
                className="text-[10px] font-mono"
              />
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground mb-1.5 leading-relaxed">
                  Sobrescreve a tipografia padrão SÓ pra este card.
                </p>
                <TypographyEditor
                  label="Citação"
                  value={item.quoteStyle}
                  inherited={el.quoteStyle as TextStyle | undefined}
                  onChange={(v) => patch(idx, { quoteStyle: v })}
                />
                <TypographyEditor
                  label="Autor"
                  value={item.authorStyle}
                  inherited={el.authorStyle as TextStyle | undefined}
                  onChange={(v) => patch(idx, { authorStyle: v })}
                />
                <TypographyEditor
                  label="Cargo"
                  value={item.roleStyle}
                  inherited={el.roleStyle as TextStyle | undefined}
                  onChange={(v) => patch(idx, { roleStyle: v })}
                />
              </div>
              <div className="mt-1">
                <Row cols={2}>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Fundo do card
                    </Label>
                    <Input
                      value={item.cardBg ?? ""}
                      onChange={(e) =>
                        patch(idx, { cardBg: e.target.value || undefined })
                      }
                      placeholder="(herda)"
                      className="text-[10px] font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Borda
                    </Label>
                    <Input
                      value={item.cardBorder ?? ""}
                      onChange={(e) =>
                        patch(idx, { cardBorder: e.target.value || undefined })
                      }
                      placeholder="(herda)"
                      className="text-[10px] font-mono"
                    />
                  </div>
                </Row>
              </div>
            </SortableSectionItem>
          ))}
        </SortableContext>
      <Button variant="outline" size="sm" onClick={add} className="text-xs w-full">
        + Adicionar depoimento
      </Button>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Blocos intermediários
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Insira texto, imagem, botão, badge etc. <strong>entre</strong> o
        cabeçalho e os cards, ou em outras zonas da section.
      </p>
      <InterludeZonesEditor el={el} update={update} />

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── Stats (section-stats) ────────────────────────────────────────────────
function StatsProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  type Stat = {
    id: string;
    value: string;
    label: string;
    valueStyle?: TextStyle;
    labelStyle?: TextStyle;
  };
  const items = ((el.stats as Stat[] | undefined) ?? []).slice();
  const patch = (idx: number, p: Partial<Stat>) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...p };
    update({ stats: next });
  };
  const add = () =>
    update({
      stats: [
        ...items,
        { id: `s${Date.now()}`, value: "100+", label: "Novo stat" },
      ],
    });
  const remove = (idx: number) =>
    update({ stats: items.filter((_, i) => i !== idx) });
  const duplicate = (idx: number) => {
    const clone = {
      ...items[idx],
      id: `s${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    update({
      stats: [...items.slice(0, idx + 1), clone, ...items.slice(idx + 1)],
    });
  };

  // Reorder: orquestrado pelo DndContext global do BuilderSidebar (handleDragEnd reconhece data.kind="section-item")

  return (
    <>
      <Seg />
      <AnchorIdField
        value={(el.anchorId as string) ?? ""}
        onChange={(v) => update({ anchorId: v })}
        placeholder="numeros"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Tipografia padrão
      </p>
      <TypographyEditor
        label="Padrão do valor (número grande)"
        value={el.valueStyle as TextStyle | undefined}
        onChange={(v) => update({ valueStyle: v })}
      />
      <TypographyEditor
        label="Padrão do rótulo (legenda)"
        value={el.labelStyle as TextStyle | undefined}
        onChange={(v) => update({ labelStyle: v })}
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Estatísticas ({items.length})
      </p>
        <SortableContext
          items={items.map((it) => it.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item, idx) => (
            <SortableSectionItem
              key={item.id}
              id={item.id}
              collection="stats"
              elementId={el.id}
              label={`#${idx + 1}`}
              summary={`${item.value} · ${item.label}`}
              onDuplicate={() => duplicate(idx)}
              onRemove={() => remove(idx)}
            >
              <Row cols={2}>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Valor
                  </Label>
                  <Input
                    value={item.value}
                    onChange={(e) => patch(idx, { value: e.target.value })}
                    placeholder="2.3k+"
                    className="text-xs font-bold"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Rótulo
                  </Label>
                  <Input
                    value={item.label}
                    onChange={(e) => patch(idx, { label: e.target.value })}
                    placeholder="Clientes"
                    className="text-xs"
                  />
                </div>
              </Row>
              <div className="mt-2">
                <TypographyEditor
                  label="Valor"
                  value={item.valueStyle}
                  inherited={el.valueStyle as TextStyle | undefined}
                  onChange={(v) => patch(idx, { valueStyle: v })}
                />
                <TypographyEditor
                  label="Rótulo"
                  value={item.labelStyle}
                  inherited={el.labelStyle as TextStyle | undefined}
                  onChange={(v) => patch(idx, { labelStyle: v })}
                />
              </div>
            </SortableSectionItem>
          ))}
        </SortableContext>
      <Button variant="outline" size="sm" onClick={add} className="text-xs w-full">
        + Adicionar estatística
      </Button>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Blocos intermediários
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Insira texto, imagem, botão, badge etc. <strong>entre</strong> o
        cabeçalho e os cards, ou em outras zonas da section.
      </p>
      <InterludeZonesEditor el={el} update={update} />

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── FAQ (section-faq) ────────────────────────────────────────────────────
function FaqProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  type Item = {
    id: string;
    question: string;
    answer: string;
    questionStyle?: TextStyle;
    answerStyle?: TextStyle;
    cardBg?: string;
    cardBorder?: string;
  };
  const items = ((el.items as Item[] | undefined) ?? []).slice();
  const patch = (idx: number, p: Partial<Item>) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...p };
    update({ items: next });
  };
  const add = () =>
    update({
      items: [
        ...items,
        {
          id: `q${Date.now()}`,
          question: "Nova pergunta?",
          answer: "Resposta…",
        },
      ],
    });
  const remove = (idx: number) =>
    update({ items: items.filter((_, i) => i !== idx) });
  const duplicate = (idx: number) => {
    const clone = {
      ...items[idx],
      id: `q${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    update({
      items: [...items.slice(0, idx + 1), clone, ...items.slice(idx + 1)],
    });
  };

  // Reorder: orquestrado pelo DndContext global do BuilderSidebar (handleDragEnd reconhece data.kind="section-item")

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Cabeçalho
      </p>
      <Label className="text-[10px] text-muted-foreground">Título</Label>
      <Input
        value={(el.heading as string) ?? ""}
        onChange={(e) => update({ heading: e.target.value })}
        placeholder="Perguntas frequentes"
        className="text-xs mb-2"
      />
      <TypographyEditor
        label="Tipografia do título"
        value={el.headingStyle as TextStyle | undefined}
        onChange={(v) => update({ headingStyle: v })}
      />
      <AnchorIdField
        value={(el.anchorId as string) ?? "faq"}
        onChange={(v) => update({ anchorId: v })}
        placeholder="faq"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Tipografia padrão dos itens
      </p>
      <TypographyEditor
        label="Padrão da pergunta"
        value={el.questionStyle as TextStyle | undefined}
        onChange={(v) => update({ questionStyle: v })}
      />
      <TypographyEditor
        label="Padrão da resposta"
        value={el.answerStyle as TextStyle | undefined}
        onChange={(v) => update({ answerStyle: v })}
      />

      <CardAnimatedBorderEditor el={el} update={update} />
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Aparência dos cards
      </p>
      <Row cols={2}>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Fundo (padrão)
          </Label>
          <Input
            value={(el.cardBg as string) ?? ""}
            onChange={(e) => update({ cardBg: e.target.value || undefined })}
            placeholder="rgba(...)"
            className="text-[11px] font-mono"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Borda</Label>
          <Input
            value={(el.cardBorder as string) ?? ""}
            onChange={(e) => update({ cardBorder: e.target.value || undefined })}
            placeholder="rgba(...)"
            className="text-[11px] font-mono"
          />
        </div>
      </Row>
      <Row cols={2}>
        <div>
          <Label className="text-[10px] text-muted-foreground">Raio (px)</Label>
          <Input
            type="number"
            min={0}
            max={64}
            value={(el.cardRadius as number) ?? 12}
            onChange={(e) => update({ cardRadius: Number(e.target.value) })}
            className="text-[11px]"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Padding (px)
          </Label>
          <Input
            type="number"
            min={0}
            max={64}
            value={(el.cardPadding as number) ?? 20}
            onChange={(e) => update({ cardPadding: Number(e.target.value) })}
            className="text-[11px]"
          />
        </div>
      </Row>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Perguntas ({items.length})
      </p>
        <SortableContext
          items={items.map((it) => it.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item, idx) => (
            <SortableSectionItem
              key={item.id}
              id={item.id}
              collection="items"
              elementId={el.id}
              label={`#${idx + 1}`}
              summary={item.question}
              onDuplicate={() => duplicate(idx)}
              onRemove={() => remove(idx)}
            >
              <Label className="text-[10px] text-muted-foreground">
                Pergunta
              </Label>
              <Input
                value={item.question}
                onChange={(e) => patch(idx, { question: e.target.value })}
                placeholder="Pergunta?"
                className="text-xs"
              />
              <Label className="text-[10px] text-muted-foreground">
                Resposta
              </Label>
              <Textarea
                rows={3}
                value={item.answer}
                onChange={(e) => patch(idx, { answer: e.target.value })}
                placeholder="Resposta"
                className="text-xs"
              />
              <div className="mt-2">
                <TypographyEditor
                  label="Pergunta"
                  value={item.questionStyle}
                  inherited={el.questionStyle as TextStyle | undefined}
                  onChange={(v) => patch(idx, { questionStyle: v })}
                />
                <TypographyEditor
                  label="Resposta"
                  value={item.answerStyle}
                  inherited={el.answerStyle as TextStyle | undefined}
                  onChange={(v) => patch(idx, { answerStyle: v })}
                />
              </div>
            </SortableSectionItem>
          ))}
        </SortableContext>
      <Button variant="outline" size="sm" onClick={add} className="text-xs w-full">
        + Adicionar pergunta
      </Button>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Blocos intermediários
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Insira texto, imagem, botão, badge etc. <strong>entre</strong> o
        cabeçalho e os cards, ou em outras zonas da section.
      </p>
      <InterludeZonesEditor el={el} update={update} />

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── CTA (section-cta) ────────────────────────────────────────────────────
function CtaProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  const guarantees = ((el.guarantees as string[] | undefined) ?? []).slice();
  const updateGuarantees = (next: string[]) =>
    update({ guarantees: next });

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Cabeçalho
      </p>
      <Label className="text-[10px] text-muted-foreground">Título</Label>
      <Input
        value={(el.heading as string) ?? ""}
        onChange={(e) => update({ heading: e.target.value })}
        placeholder="Pronto pra começar?"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">
        Acento do título (colorido)
      </Label>
      <Input
        value={(el.headingAccent as string) ?? ""}
        onChange={(e) => update({ headingAccent: e.target.value })}
        placeholder="Vamos decolar."
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Subtítulo</Label>
      <Textarea
        rows={2}
        value={(el.subtitle as string) ?? ""}
        onChange={(e) => update({ subtitle: e.target.value })}
        className="text-xs"
      />
      <AnchorIdField
        value={(el.anchorId as string) ?? "cta-final"}
        onChange={(v) => update({ anchorId: v })}
        placeholder="cta-final"
      />

      <ButtonsListEditor el={el} update={update} />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Garantias (selos abaixo do CTA)
      </p>
      <Textarea
        rows={3}
        value={guarantees.join("\n")}
        onChange={(e) =>
          updateGuarantees(
            e.target.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        placeholder={"🛡 LGPD\n🌎 Brasil\n⚡ 5 min"}
        className="text-xs"
      />

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── Logo Cloud (section-logo-cloud) ──────────────────────────────────────
function LogoCloudProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  type Logo = { id: string; imageUrl: string; alt: string };
  const items = ((el.logos as Logo[] | undefined) ?? []).slice();
  const patch = (idx: number, p: Partial<Logo>) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...p };
    update({ logos: next });
  };
  const add = () =>
    update({
      logos: [
        ...items,
        { id: `lg${Date.now()}`, imageUrl: "", alt: "Marca" },
      ],
    });
  const remove = (idx: number) =>
    update({ logos: items.filter((_, i) => i !== idx) });
  const duplicate = (idx: number) => {
    const clone = {
      ...items[idx],
      id: `lg${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    update({
      logos: [...items.slice(0, idx + 1), clone, ...items.slice(idx + 1)],
    });
  };

  // Reorder: orquestrado pelo DndContext global do BuilderSidebar (handleDragEnd reconhece data.kind="section-item")

  return (
    <>
      <Seg />
      <Label className="text-[10px] text-muted-foreground">Título</Label>
      <Input
        value={(el.heading as string) ?? ""}
        onChange={(e) => update({ heading: e.target.value })}
        placeholder="Empresas que confiam em nós"
        className="text-xs mb-2"
      />
      <TypographyEditor
        label="Tipografia do título"
        value={el.headingStyle as TextStyle | undefined}
        onChange={(v) => update({ headingStyle: v })}
      />
      <AnchorIdField
        value={(el.anchorId as string) ?? ""}
        onChange={(v) => update({ anchorId: v })}
        placeholder="parceiros"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Aparência dos logos
      </p>
      <Row cols={2}>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Altura (px)
          </Label>
          <Input
            type="number"
            min={16}
            max={120}
            value={(el.logoHeight as number) ?? 32}
            onChange={(e) => update({ logoHeight: Number(e.target.value) })}
            className="text-[11px]"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Opacidade (0–1)
          </Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={(el.logoOpacity as number) ?? 0.6}
            onChange={(e) => update({ logoOpacity: Number(e.target.value) })}
            className="text-[11px]"
          />
        </div>
      </Row>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Logos ({items.length})
      </p>
        <SortableContext
          items={items.map((it) => it.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((logo, idx) => (
            <SortableSectionItem
              key={logo.id}
              id={logo.id}
              collection="logos"
              elementId={el.id}
              label={`#${idx + 1}`}
              summary={logo.alt}
              onDuplicate={() => duplicate(idx)}
              onRemove={() => remove(idx)}
            >
              <Label className="text-[10px] text-muted-foreground">
                Nome (alt)
              </Label>
              <Input
                value={logo.alt}
                onChange={(e) => patch(idx, { alt: e.target.value })}
                placeholder="Nome da marca"
                className="text-xs"
              />
              <Label className="text-[10px] text-muted-foreground">URL</Label>
              <Input
                value={logo.imageUrl}
                onChange={(e) => patch(idx, { imageUrl: e.target.value })}
                placeholder="https://…"
                className="text-[11px] font-mono"
              />
              {logo.imageUrl && (
                <div className="rounded border bg-white p-2 flex items-center justify-center h-14 mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.imageUrl}
                    alt={logo.alt}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
            </SortableSectionItem>
          ))}
        </SortableContext>
      <Button variant="outline" size="sm" onClick={add} className="text-xs w-full">
        + Adicionar logo
      </Button>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Blocos intermediários
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        Insira texto, imagem, botão, badge etc. <strong>entre</strong> o
        cabeçalho e os cards, ou em outras zonas da section.
      </p>
      <InterludeZonesEditor el={el} update={update} />

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── Carousel (carousel) ───────────────────────────────────────────────────
function CarouselProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  type Slide = {
    id: string;
    imageUrl: string;
    alt?: string;
    caption?: string;
    link?: string;
    aspectRatio?: string;
  };
  const slides = ((el.slides as Slide[] | undefined) ?? []).slice();
  const mode = (el.carouselMode as string) ?? "slide";

  const patch = (idx: number, p: Partial<Slide>) => {
    const next = slides.slice();
    next[idx] = { ...next[idx], ...p };
    update({ slides: next });
  };
  const add = () =>
    update({
      slides: [
        ...slides,
        { id: `s${Date.now()}`, imageUrl: "", alt: "", aspectRatio: "16:9" },
      ],
    });
  const remove = (idx: number) =>
    update({ slides: slides.filter((_, i) => i !== idx) });
  const move = (idx: number, dir: -1 | 1) => {
    const t = idx + dir;
    if (t < 0 || t >= slides.length) return;
    const next = slides.slice();
    [next[idx], next[t]] = [next[t], next[idx]];
    update({ slides: next });
  };

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Modo
      </p>
      <select
        value={mode}
        onChange={(e) => update({ carouselMode: e.target.value })}
        className="w-full text-xs border rounded-md bg-background h-8 px-2"
      >
        <option value="slide">Slide animado (auto-play)</option>
        <option value="static">Grid estático (todas visíveis)</option>
      </select>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Imagens visíveis por vez
      </p>
      <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
        {mode === "slide"
          ? "Quantos slides aparecem na tela ao mesmo tempo. 1 = clássico (1 imagem grande). 2-4 = mini-galeria."
          : "Quantas colunas o grid terá. Mobile pode ter menos pra não ficar apertado."}
      </p>
      <Row cols={2}>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Desktop
          </Label>
          <select
            value={(el.slidesPerView as number) ?? 1}
            onChange={(e) =>
              update({ slidesPerView: Number(e.target.value) })
            }
            className="w-full text-xs border rounded-md bg-background h-8 px-2"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "imagem" : "imagens"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Mobile
          </Label>
          <select
            value={(el.slidesPerViewMobile as number) ?? 1}
            onChange={(e) =>
              update({ slidesPerViewMobile: Number(e.target.value) })
            }
            className="w-full text-xs border rounded-md bg-background h-8 px-2"
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "imagem" : "imagens"}
              </option>
            ))}
          </select>
        </div>
      </Row>

      {/* ─── Modo de exibição das imagens (uniform/original/custom) ─── */}
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Exibição da imagem
      </p>
      <Label className="text-[10px] text-muted-foreground">Modo</Label>
      <select
        value={(el.imageMode as string) ?? "uniform"}
        onChange={(e) => update({ imageMode: e.target.value })}
        className="w-full text-xs border rounded-md bg-background h-8 px-2 mt-1"
      >
        <option value="uniform">Altura uniforme (recomendado)</option>
        <option value="original">Proporção original da imagem</option>
        <option value="custom">Largura e altura personalizadas</option>
      </select>
      <p className="text-[10px] text-muted-foreground/80 mt-1 leading-snug">
        {(el.imageMode ?? "uniform") === "uniform"
          ? "Todas as imagens com a mesma altura, cortadas proporcionalmente pra preencher (object-cover)."
          : (el.imageMode ?? "uniform") === "original"
            ? "Cada imagem mantém sua proporção natural. Útil pra screenshots/infográficos/logos."
            : "Largura e altura fixas pra todas as imagens. Pode esticar/comprimir."}
      </p>

      {/* Campos contextuais — só aparecem quando relevantes */}
      {(el.imageMode ?? "uniform") === "uniform" && (
        <div className="mt-2">
          <Label className="text-[10px] text-muted-foreground">
            Altura padrão (px)
          </Label>
          <Input
            type="number"
            min={80}
            max={1200}
            value={(el.imageHeight as number | undefined) ?? 240}
            onChange={(e) => update({ imageHeight: Number(e.target.value) })}
            className="text-xs h-8"
          />
        </div>
      )}
      {(el.imageMode as string) === "custom" && (
        <Row cols={2}>
          <div>
            <Label className="text-[10px] text-muted-foreground">
              Largura (px)
            </Label>
            <Input
              type="number"
              min={40}
              max={1600}
              value={(el.imageWidth as number | undefined) ?? 320}
              onChange={(e) => update({ imageWidth: Number(e.target.value) })}
              className="text-xs h-8"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">
              Altura (px)
            </Label>
            <Input
              type="number"
              min={40}
              max={1200}
              value={(el.imageHeight as number | undefined) ?? 240}
              onChange={(e) => update({ imageHeight: Number(e.target.value) })}
              className="text-xs h-8"
            />
          </div>
        </Row>
      )}

      {mode === "slide" && (
        <>
          <Row cols={2}>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Velocidade (ms)
              </Label>
              <Input
                type="number"
                min={1000}
                step={500}
                value={(el.intervalMs as number) ?? 4000}
                onChange={(e) =>
                  update({ intervalMs: Number(e.target.value) })
                }
                className="text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs flex items-center gap-1.5 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(el.autoplay as boolean) ?? true}
                  onChange={(e) => update({ autoplay: e.target.checked })}
                />
                Auto-play
              </label>
            </div>
          </Row>
          <Row cols={2}>
            <label className="text-xs flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={(el.showDots as boolean) ?? true}
                onChange={(e) => update({ showDots: e.target.checked })}
              />
              Bolinhas
            </label>
            <label className="text-xs flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={(el.showArrows as boolean) ?? true}
                onChange={(e) => update({ showArrows: e.target.checked })}
              />
              Setas
            </label>
          </Row>
        </>
      )}

      <Row cols={2}>
        <NumField
          label="Espaço entre (px)"
          value={(el.gap as number) ?? 12}
          onChange={(v) => update({ gap: v })}
          min={0}
        />
        <NumField
          label="Borda (px)"
          value={(el.radius as number) ?? 8}
          onChange={(v) => update({ radius: v })}
          min={0}
        />
      </Row>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Imagens ({slides.length})
      </p>
      {slides.map((s, idx) => (
        <CarouselSlideEditor
          key={s.id}
          slide={s}
          onChange={(p) => patch(idx, p)}
          onRemove={() => remove(idx)}
          onUp={() => move(idx, -1)}
          onDown={() => move(idx, 1)}
          isFirst={idx === 0}
          isLast={idx === slides.length - 1}
        />
      ))}
      <Button variant="outline" size="sm" onClick={add} className="text-xs">
        + Adicionar imagem
      </Button>
    </>
  );
}

function CarouselSlideEditor({
  slide,
  onChange,
  onRemove,
  onUp,
  onDown,
  isFirst,
  isLast,
}: {
  slide: {
    id: string;
    imageUrl: string;
    alt?: string;
    caption?: string;
    link?: string;
    aspectRatio?: string;
  };
  onChange: (p: Partial<typeof slide>) => void;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="p-2 border rounded-md mb-2 bg-muted/30 flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground flex-1">
          {slide.alt || "(sem alt)"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onUp}
          disabled={isFirst}
          className="size-7 shrink-0"
          title="Subir"
        >
          ↑
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDown}
          disabled={isLast}
          className="size-7 shrink-0"
          title="Descer"
        >
          ↓
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="size-7 shrink-0"
          title="Remover"
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
      {/* Upload + preview + URL fallback unificado num só componente.
          Usa mesmo endpoint `/api/upload-local` que o LogoUploader. */}
      <ImageUploaderField
        value={slide.imageUrl ?? ""}
        onChange={(url) => onChange({ imageUrl: url })}
        label="Imagem do slide"
        uploadLabel="Fazer upload"
        previewHeight={80}
      />
      <Row cols={2}>
        <div>
          <Label className="text-[10px] text-muted-foreground">Proporção</Label>
          <select
            value={slide.aspectRatio ?? "16:9"}
            onChange={(e) => onChange({ aspectRatio: e.target.value })}
            className="w-full text-xs border rounded-md bg-background h-7 px-2"
          >
            <option value="16:9">16:9 (widescreen)</option>
            <option value="4:3">4:3 (clássica)</option>
            <option value="1:1">1:1 (quadrada)</option>
            <option value="3:4">3:4 (vertical)</option>
            <option value="9:16">9:16 (stories)</option>
            <option value="free">Livre (sem ratio)</option>
          </select>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Alt</Label>
          <Input
            value={slide.alt ?? ""}
            onChange={(e) => onChange({ alt: e.target.value })}
            placeholder="Descrição"
            className="text-xs"
          />
        </div>
      </Row>
      <Label className="text-[10px] text-muted-foreground">Legenda (opc)</Label>
      <Input
        value={slide.caption ?? ""}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Legenda da imagem"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground">Link (opc)</Label>
      <Input
        value={slide.link ?? ""}
        onChange={(e) => onChange({ link: e.target.value })}
        placeholder="https://… ou #section"
        className="text-xs font-mono"
      />
    </div>
  );
}

// ─── NASA Link (nasa-link) ─────────────────────────────────────────────────
//
// Permite escolher um App NASA (tracking/form/agenda/linnker/chat/
// payment/forge/page) + resource específico da org. Pra "linnker",
// busca lista de LinnkerPages via orpc.linnker.listPages e mostra
// dropdown.

const NASA_APPS: Array<{ id: string; label: string }> = [
  { id: "linnker", label: "Linnker" },
  { id: "tracking", label: "Tracking (CRM)" },
  { id: "form", label: "Formulário" },
  { id: "agenda", label: "Agenda" },
  { id: "chat", label: "In-Chat" },
  { id: "payment", label: "Payment" },
  { id: "forge", label: "Forge" },
  { id: "page", label: "Outra page NASA" },
];

function NasaLinkProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  const appId = (el.appId as string) ?? "linnker";
  const resourceId = (el.resourceId as string) ?? "";

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Link NASA
      </p>
      <Field label="Rótulo">
        <Input
          value={(el.label as string) ?? ""}
          onChange={(e) => update({ label: e.target.value })}
          placeholder="Acesse meu Linnker"
          className="h-8 text-xs"
        />
      </Field>

      <Label className="text-[10px] text-muted-foreground mt-2">
        App NASA de destino
      </Label>
      <select
        value={appId}
        onChange={(e) => update({ appId: e.target.value, resourceId: "" })}
        className="w-full text-xs border rounded-md bg-background h-8 px-2"
      >
        {NASA_APPS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>

      {appId === "linnker" && (
        <LinnkerSelector
          value={resourceId}
          onChange={(v) => update({ resourceId: v })}
        />
      )}

      {appId !== "linnker" && (
        <>
          <Label className="text-[10px] text-muted-foreground mt-2">
            ID do recurso (opcional — deixe vazio pra ir pra home do app)
          </Label>
          <Input
            value={resourceId}
            onChange={(e) => update({ resourceId: e.target.value })}
            placeholder="ID ou slug"
            className="text-xs font-mono"
          />
        </>
      )}

      <Seg />
      <Row>
        <ColorField
          label="Fundo"
          value={(el.bg as string) ?? "#ffffff"}
          onChange={(v) => update({ bg: v })}
        />
        <ColorField
          label="Texto"
          value={(el.fg as string) ?? "#0f172a"}
          onChange={(v) => update({ fg: v })}
        />
      </Row>
    </>
  );
}

/** Dropdown que busca Linnkers da org logada. */
function LinnkerSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Tenta usar orpc.linnker.listPages. Se falhar (org sem linnkers),
  // cai pra input livre.
  const { data, isLoading, error } = useQuery(
    orpc.linnker.listPages.queryOptions({ input: {} }),
  );
  const linnkers =
    ((data as { pages?: Array<{ id: string; slug: string; title: string }> })
      ?.pages ?? []) as Array<{ id: string; slug: string; title: string }>;

  return (
    <>
      <Label className="text-[10px] text-muted-foreground mt-2">
        Qual Linnker da empresa?
      </Label>
      {isLoading ? (
        <p className="text-[10px] text-muted-foreground">Carregando…</p>
      ) : error ? (
        <p className="text-[10px] text-destructive">
          Falha ao carregar. Cole o slug manualmente:
        </p>
      ) : linnkers.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Você ainda não tem Linnkers — crie em /linnker primeiro.
        </p>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs border rounded-md bg-background h-8 px-2"
        >
          <option value="">— Escolha um Linnker —</option>
          {linnkers.map((l) => (
            <option key={l.id} value={l.slug}>
              {l.title} (/{l.slug})
            </option>
          ))}
        </select>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">
        Link público vira <code className="font-mono">/l/{value || "<slug>"}</code>
      </p>
    </>
  );
}

/**
 * Setup inline do slug da organização — usado pelo ChatButtonProps
 * quando a org NÃO tem slug salvo no banco. Sem slug, o endpoint
 * `/api/in-chat/[slug]/identify` retorna 404 e o chat IA não
 * funciona.
 *
 * Em vez de só mostrar erro, sugere um slug derivado do nome da org
 * (lowercase, sem acentos, espaços → hífens) e oferece input
 * editável + botão "Usar este slug" que dispara mutation. Após
 * salvar, refetch da org → o componente pai automaticamente sai
 * desse estado pro estado normal (card com slug).
 */
function OrgSlugSetup({ orgName }: { orgName: string }) {
  const qc = useQueryClient();
  // Sugestão inicial baseada no nome da org
  const initialSuggestion =
    suggestSlug(orgName) || `org-${Math.random().toString(36).slice(2, 8)}`;
  const [slug, setSlug] = useState(initialSuggestion);
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: (s: string) => client.orgs.setSlug({ slug: s }),
    onSuccess: () => {
      toast.success("Slug da organização configurado!");
      // Invalida getCurrentCompany pra refetch automático
      qc.invalidateQueries({
        queryKey: orpc.orgs.getCurrentCompany.queryKey(),
      });
      setError(null);
    },
    onError: (e: Error) => {
      setError(e.message ?? "Falha ao salvar slug");
    },
  });

  const isValid = /^[a-z0-9][a-z0-9-]+[a-z0-9]$/.test(slug);

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 flex flex-col gap-2">
      <p className="text-[11px] text-amber-900 leading-relaxed">
        Sua organização não tem <strong>slug público</strong> configurado.
        Esse slug é o que vai aparecer no link público do chat IA (
        <code className="font-mono">/whatsapp/&lt;slug&gt;</code>).
        Sugerimos um nome baseado no seu cadastro — você pode aceitar ou
        editar.
      </p>
      <Label className="text-[10px] text-muted-foreground">
        Slug sugerido
      </Label>
      <div className="flex items-center gap-1 rounded-md border bg-background px-2">
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          /whatsapp/
        </span>
        <input
          type="text"
          value={slug}
          onChange={(e) => {
            setSlug(sanitizeOrgSlug(e.target.value));
            setError(null);
          }}
          className="flex-1 h-8 bg-transparent border-0 text-xs font-mono focus:outline-none"
          maxLength={32}
        />
      </div>
      {!isValid && slug.length > 0 && (
        <p className="text-[10px] text-amber-700">
          Use 3-32 caracteres: letras minúsculas, números, hífens. Não
          pode começar/terminar com hífen.
        </p>
      )}
      {error && (
        <p className="text-[10px] text-destructive">{error}</p>
      )}
      <Button
        size="sm"
        className="w-full text-xs h-8"
        disabled={!isValid || isPending}
        onClick={() => mutate(slug)}
      >
        {isPending ? "Salvando…" : `Usar "${slug}" como slug`}
      </Button>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        ⚠ Slug é definitivo — não pode trocar depois sem suporte.
      </p>
    </div>
  );
}

/**
 * Deriva sugestão de slug a partir do nome da org. Igual ao
 * `sanitizeAnchorId` mas com regra extra: mínimo 3 chars, máximo 32,
 * remove dupla-hífen.
 */
function suggestSlug(name: string): string {
  return sanitizeOrgSlug(name).slice(0, 32);
}
function sanitizeOrgSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/**
 * Dropdown reusável de Tracking — usado por ChatButton e
 * EmbeddedForm. Mostra status do WhatsApp inline pra dar feedback
 * visual ("✓" se conectado, "(DISCONNECTED)" se off).
 */
function TrackingSelector({
  value,
  onChange,
  emptyLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  emptyLabel: string;
}) {
  const { data, isLoading } = useQuery(
    orpc.tracking.list.queryOptions({}),
  );
  // tracking.list retorna array direto (não { trackings: [...] })
  const trackings = (Array.isArray(data) ? data : []) as Array<{
    id: string;
    name: string;
    whatsappInstance?: { status?: string } | null;
  }>;

  if (isLoading) {
    return <p className="text-[10px] text-muted-foreground">Carregando…</p>;
  }
  if (trackings.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground">
        Você não participa de nenhum tracking. Crie um em{" "}
        <a href="/tracking" className="underline">
          Tracking
        </a>
        .
      </p>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs border rounded-md bg-background h-8 px-2"
    >
      <option value="">{emptyLabel}</option>
      {trackings.map((t) => {
        const wpp = t.whatsappInstance;
        const wppStatus = wpp
          ? wpp.status === "CONNECTED"
            ? " ✓"
            : wpp.status
              ? ` (${wpp.status})`
              : ""
          : " (sem WhatsApp)";
        return (
          <option key={t.id} value={t.id}>
            {t.name}
            {wppStatus}
          </option>
        );
      })}
    </select>
  );
}

// ─── Chat Button (chat-button) ──────────────────────────────────────────
function ChatButtonProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  // Org slug auto: vem da org ativa do user. NÃO é editável — o
  // chat IA só conecta na própria org. Persistimos em `el.orgSlug`
  // pra que o renderer público (servido pra visitantes anônimos)
  // saiba qual org chamar.
  const orgQ = useQuery(orpc.orgs.getCurrentCompany.queryOptions());
  const org = (orgQ.data as { organization?: { slug?: string; name?: string } })
    ?.organization;
  const orgSlug = org?.slug ?? "";

  // Sincroniza orgSlug do element com a org ativa toda vez que ela
  // for resolvida — evita ficar com slug stale se o user trocar de
  // org no NASA antes de publicar.
  useEffect(() => {
    if (orgSlug && el.orgSlug !== orgSlug) {
      update({ orgSlug });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug]);

  // Detecta duplicatas (page com >1 chat-button — bug histórico do
  // editor antigo). Oferece cleanup com 1 clique. Antes dessa fase
  // o renderer público dedupa silenciosamente; mas no JSON ainda
  // ficam N entries acumulando peso/erros de seleção.
  const layout = usePagesBuilderStore((s) => s.layout);
  const activeLayer = usePagesBuilderStore((s) => s.activeLayer);
  const removeElement = usePagesBuilderStore((s) => s.removeElement);
  const allChatButtons = layout
    ? getActiveLayerElements(layout, activeLayer).filter(
        (e) => e.type === "chat-button",
      )
    : [];
  const dupCount = Math.max(0, allChatButtons.length - 1);
  const removeDuplicates = () => {
    // Remove tudo exceto o próprio (o que o user está editando agora)
    allChatButtons
      .filter((e) => e.id !== el.id)
      .forEach((e) => removeElement(e.id));
    toast.success(`${dupCount} duplicata${dupCount === 1 ? "" : "s"} removida${dupCount === 1 ? "" : "s"}`);
  };

  const trackingId = (el.trackingId as string) ?? "";

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Botão Chat IA
      </p>
      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        Fica fixo no canto inferior direito. Lead criado vai pro
        tracking selecionado, com nome/número pedidos no próprio
        popover quando o user ainda não foi identificado.
      </p>

      {dupCount > 0 && (
        <div className="mb-3 p-2 rounded-md border border-amber-500/40 bg-amber-500/10">
          <p className="text-[10px] text-amber-900 leading-relaxed mb-2">
            ⚠ Você tem <strong>{allChatButtons.length} botões Chat IA</strong> nessa
            page. Só pode existir 1 — o público mostra só este, mas
            os outros {dupCount} entram no JSON e podem causar
            confusão. Limpe agora.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 w-full"
            onClick={removeDuplicates}
          >
            🧹 Remover {dupCount} duplicata{dupCount === 1 ? "" : "s"}
          </Button>
        </div>
      )}

      <Label className="text-[10px] text-muted-foreground">Organização</Label>
      {orgQ.isLoading ? (
        <p className="text-[10px] text-muted-foreground">Carregando…</p>
      ) : !org?.slug ? (
        <OrgSlugSetup orgName={org?.name ?? ""} />
      ) : (
        <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
          <div className="size-7 rounded bg-violet-500/20 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">
            {org.name?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">{org.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              /whatsapp/{org.slug}
            </p>
          </div>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">
        Detectado automaticamente da sua sessão.
      </p>

      <Label className="text-[10px] text-muted-foreground mt-3">
        Tracking de destino
      </Label>
      <TrackingSelector
        value={trackingId}
        onChange={(v) => update({ trackingId: v })}
        emptyLabel="— Usar tracking padrão da org —"
      />
      <p className="text-[10px] text-muted-foreground mt-1">
        Leads gerados pelo chat caem aqui. Se vazio, usa o tracking
        ativo padrão da organização (mesmo fluxo do /whatsapp/{org?.slug ?? "[slug]"}).
      </p>

      <Seg />
      <Label className="text-[10px] text-muted-foreground">
        Mensagem de boas-vindas
      </Label>
      <Textarea
        rows={2}
        value={(el.welcomeMessage as string) ?? ""}
        onChange={(e) => update({ welcomeMessage: e.target.value })}
        placeholder="Olá! 👋 Como posso ajudar?"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">
        Nome do atendente
      </Label>
      <Input
        value={(el.agentName as string) ?? ""}
        onChange={(e) => update({ agentName: e.target.value })}
        placeholder="Atendente"
        className="text-xs"
      />

      <Seg />
      <Row>
        <ColorField
          label="Cor do botão"
          value={(el.bgColor as string) ?? "#6366f1"}
          onChange={(v) => update({ bgColor: v })}
        />
        <ColorField
          label="Cor do ícone"
          value={(el.fgColor as string) ?? "#ffffff"}
          onChange={(v) => update({ fgColor: v })}
        />
      </Row>
    </>
  );
}

// ─── Embedded Form (embedded-form) ──────────────────────────────────────
function EmbeddedFormProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  // Lista forms da org
  const { data, isLoading } = useQuery(
    orpc.form.list.queryOptions({ input: {} }),
  );
  const forms =
    ((data as { forms?: Array<{ id: string; name: string }> })?.forms ?? []) as
      Array<{ id: string; name: string }>;

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Formulário NASA
      </p>
      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        Embeda um formulário existente. Submissão cria lead no
        tracking definido (override ou o do form).
      </p>

      <Label className="text-[10px] text-muted-foreground">
        Formulário
      </Label>
      {isLoading ? (
        <p className="text-[10px] text-muted-foreground">Carregando…</p>
      ) : forms.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Você ainda não tem formulários. Crie em /forms primeiro.
        </p>
      ) : (
        <select
          value={(el.formId as string) ?? ""}
          onChange={(e) => update({ formId: e.target.value })}
          className="w-full text-xs border rounded-md bg-background h-8 px-2"
        >
          <option value="">— Escolha um formulário —</option>
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      )}

      <Label className="text-[10px] text-muted-foreground mt-3">
        Tracking de destino (override, opcional)
      </Label>
      <TrackingSelector
        value={(el.trackingId as string) ?? ""}
        onChange={(v) => update({ trackingId: v })}
        emptyLabel="— Usar o tracking do form —"
      />
      <p className="text-[10px] text-muted-foreground mt-1">
        Se selecionado, sobrescreve o tracking configurado no
        próprio form. Útil quando o mesmo form aparece em pages
        diferentes que devem cair em pipelines distintos.
      </p>

      <Seg />
      <ColorField
        label="Fundo do container"
        value={(el.bgColor as string) ?? "#ffffff"}
        onChange={(v) => update({ bgColor: v })}
      />
    </>
  );
}

// ─── Exit Intent (exit-intent) ──────────────────────────────────────────
function ExitIntentProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Popover de saída
      </p>
      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        Aparece quando o usuário move o mouse pra fora do topo (intent
        de fechar a aba). Mostra cupom + CTA.
      </p>

      <Label className="text-[10px] text-muted-foreground">Título</Label>
      <Input
        value={(el.heading as string) ?? ""}
        onChange={(e) => update({ heading: e.target.value })}
        placeholder="Espera! Antes de sair…"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Mensagem</Label>
      <Textarea
        rows={2}
        value={(el.subtitle as string) ?? ""}
        onChange={(e) => update({ subtitle: e.target.value })}
        placeholder="Ganha 10% de desconto…"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">
        Código de cupom (opcional)
      </Label>
      <Input
        value={(el.couponCode as string) ?? ""}
        onChange={(e) => update({ couponCode: e.target.value })}
        placeholder="VOLTA10"
        className="text-xs font-mono"
      />

      <Seg />
      <Label className="text-[10px] text-muted-foreground">Botão — texto</Label>
      <Input
        value={(el.ctaLabel as string) ?? ""}
        onChange={(e) => update({ ctaLabel: e.target.value })}
        placeholder="Aproveitar agora"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Botão — link</Label>
      <Input
        value={(el.ctaHref as string) ?? ""}
        onChange={(e) => update({ ctaHref: e.target.value })}
        placeholder="#planos ou URL"
        className="text-xs font-mono"
      />

      <Seg />
      <Row cols={2}>
        <NumField
          label="Espera inicial (ms)"
          value={(el.triggerDelayMs as number) ?? 2000}
          onChange={(v) => update({ triggerDelayMs: v })}
          step={500}
          min={0}
        />
        <label className="text-xs flex items-center gap-1.5 mt-5 cursor-pointer">
          <input
            type="checkbox"
            checked={(el.showOnce as boolean) ?? true}
            onChange={(e) => update({ showOnce: e.target.checked })}
          />
          Só 1× por sessão
        </label>
      </Row>

      <Seg />
      <Row>
        <ColorField
          label="Fundo"
          value={(el.bgColor as string) ?? "#0f172a"}
          onChange={(v) => update({ bgColor: v })}
        />
        <ColorField
          label="Texto"
          value={(el.fgColor as string) ?? "#ffffff"}
          onChange={(v) => update({ fgColor: v })}
        />
      </Row>
      <ColorField
        label="Cor primária (cupom + CTA)"
        value={(el.primaryColor as string) ?? "#7C3AED"}
        onChange={(v) => update({ primaryColor: v })}
      />
    </>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  text: "Texto", image: "Imagem", shape: "Forma", button: "Botão",
  video: "Vídeo", embed: "Embed", icon: "Ícone", divider: "Divisor",
  social: "Social", spacer: "Espaço", svg: "SVG", "nasa-link": "Link NASA", group: "Grupo",
  // Sections — labels editor-friendly pra usuário identificar
  "section-navbar": "Navbar / Cabeçalho",
  "section-hero": "Hero (cabeçalho da landing)",
  "section-features": "Cards / Features",
  "section-pricing": "Planos / Pricing",
  "section-testimonials": "Depoimentos",
  "section-stats": "Estatísticas / Números",
  "section-faq": "Perguntas Frequentes (FAQ)",
  "section-cta": "Call to Action (CTA)",
  "section-logo-cloud": "Logos / Marcas",
  "section-footer": "Footer / Rodapé",
  marquee: "Marquee (texto rolando)",
  marketing: "Marketing (conversão)",
};

/** Renders just the properties content (no outer wrapper) — for embedding inside the sidebar */
export function PropertiesPanelContent() {
  const layout = usePagesBuilderStore((s) => s.layout);
  const activeLayer = usePagesBuilderStore((s) => s.activeLayer);
  const selected = usePagesBuilderStore((s) => s.selected);
  const updateElement = usePagesBuilderStore((s) => s.updateElement);
  const removeElement = usePagesBuilderStore((s) => s.removeElement);
  const duplicateSelected = usePagesBuilderStore((s) => s.duplicateSelected);

  if (!layout || selected.length !== 1) {
    if (selected.length > 1) {
      return (
        <div className="px-3 py-3 text-xs text-muted-foreground">
          {selected.length} elementos selecionados
        </div>
      );
    }
    return null;
  }

  const el = getActiveLayerElements(layout, activeLayer).find((e) => e.id === selected[0]);
  if (!el) return null;

  const update = (patch: Partial<ElementBase>) => updateElement(el.id, patch);

  return (
    <div className="flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-b bg-muted/40">
        <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">
          {TYPE_LABELS[el.type] ?? el.type}
        </span>
        <div className="flex gap-0.5">
          <Button size="icon" variant="ghost" className="size-6" onClick={duplicateSelected} title="Duplicar (Ctrl+D)">
            <Copy className="size-3" />
          </Button>
          <Button size="icon" variant="ghost" className="size-6" onClick={() => update({ locked: !el.locked })} title={el.locked ? "Desbloquear" : "Bloquear"}>
            {el.locked ? <Lock className="size-3 text-amber-500" /> : <Unlock className="size-3" />}
          </Button>
          <Button size="icon" variant="ghost" className="size-6" onClick={() => removeElement(el.id)} title="Excluir (Del)">
            <Trash2 className="size-3 text-destructive" />
          </Button>
        </div>
      </div>

      {/* body */}
      <div className="px-3 py-3 flex flex-col gap-2">
        {/* Ordem e localização — botões ⬆/⬇ pra reordenar no fluxo +
            dropdown "Adicionar à camada" pra mover o element pra DENTRO
            de outra section como interlude block. Funciona pra qualquer
            tipo de element (incluindo flow sections — Subir/Descer
            espelha o drag da aba Camadas). */}
        <ElementOrderControls element={el} />
        <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-1">Posição e tamanho</p>
        <Row>
          <NumField label="X" value={el.x} onChange={(v) => update({ x: v })} />
          <NumField label="Y" value={el.y} onChange={(v) => update({ y: v })} />
          <NumField label="W" value={el.w} onChange={(v) => update({ w: Math.max(4, v) })} />
          <NumField label="H" value={el.h} onChange={(v) => update({ h: Math.max(4, v) })} />
        </Row>
        <Row cols={3}>
          <NumField label="Rotação °" value={el.rotation ?? 0} onChange={(v) => update({ rotation: v })} step={1} />
          <NumField label="Opac. %" value={Math.round((el.opacity ?? 1) * 100)} onChange={(v) => update({ opacity: Math.min(1, Math.max(0, v / 100)) })} step={5} min={0} />
          <NumField label="Z-index" value={el.zIndex ?? 1} onChange={(v) => update({ zIndex: v })} min={0} />
        </Row>
        {/* Borda animada — efeito Explorer reusável. Funciona pra
            qualquer element. Toggle off por default. */}
        <AnimatedBorderEditor el={el} update={update} />
        {/* Scroll reveal — animação suave de entrada/saída ao rolar a
            página. Aceita preset (slide/fade/zoom/blur), distância,
            duração, atraso e threshold. Toggle off por default. */}
        <ScrollRevealEditor el={el} update={update} />
        {el.type === "text"   && <TextProps   el={el} update={update} />}
        {el.type === "image"  && <ImageProps  el={el} update={update} />}
        {el.type === "shape"  && <ShapeProps  el={el} update={update} />}
        {el.type === "button" && <ButtonProps el={el} update={update} />}
        {el.type === "video"  && <VideoProps  el={el} update={update} />}
        {el.type === "embed"  && <EmbedProps  el={el} update={update} />}
        {el.type === "nasa-link" && <NasaLinkProps el={el} update={update} />}
        {el.type === "social" && <SocialProps el={el} update={update} />}
        {el.type === "carousel"      && <CarouselProps     el={el} update={update} />}
        {el.type === "chat-button"   && <ChatButtonProps   el={el} update={update} />}
        {el.type === "embedded-form" && <EmbeddedFormProps el={el} update={update} />}
        {el.type === "exit-intent"   && <ExitIntentProps   el={el} update={update} />}
        {el.type === "marketing"     && <MarketingProps    el={el} update={update} />}
        {/* Sections novas (Fase 1 do builder evoluído) */}
        {el.type === "section-navbar"        && <NavbarProps        el={el} update={update} />}
        {el.type === "section-footer"        && <FooterProps        el={el} update={update} />}
        {el.type === "section-hero"          && <HeroProps          el={el} update={update} />}
        {el.type === "section-features"      && <FeaturesProps      el={el} update={update} />}
        {el.type === "section-pricing"       && <PricingProps       el={el} update={update} />}
        {el.type === "section-testimonials"  && <TestimonialsProps  el={el} update={update} />}
        {el.type === "section-stats"         && <StatsProps         el={el} update={update} />}
        {el.type === "section-faq"           && <FaqProps           el={el} update={update} />}
        {el.type === "section-cta"           && <CtaProps           el={el} update={update} />}
        {el.type === "section-logo-cloud"    && <LogoCloudProps     el={el} update={update} />}
        <ResponsiveProps el={el} update={update} />
      </div>
    </div>
  );
}

/** Standalone right panel (kept for backwards compat if needed) */
export function PropertiesPanel() {
  return (
    <aside className="w-72 border-l bg-card shrink-0 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <PropertiesPanelContent />
      </div>
    </aside>
  );
}

async function toRasterBlob(src: string): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
  const w = img.naturalWidth || img.width || 1024;
  const h = img.naturalHeight || img.height || 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))), "image/png"),
  );
}

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (Array.isArray(n.content)) return n.content.map(extractText).join(" ");
  return "";
}

// ─── ElementOrderControls — bloco no topo do painel de propriedades
//     com 2 utilitários de organização visual: ────────────────────────
//
//   1. Botões ⬆ Subir / ⬇ Descer — chamam `moveElement(id, idx ± 1)`
//      no store. Pra flow sections, isso reordena o fluxo vertical da
//      landing (com reindex Y em cascata). Pra átomos, reordena no
//      array mas mantém posição absoluta (afeta z-stack quando
//      sobrepostos).
//
//   2. Dropdown "Adicionar à camada" — lista todas as flow sections do
//      canvas (exceto o próprio element). Ao escolher uma, o element
//      atual é REMOVIDO do top-level e RE-INSERIDO como InterludeBlock
//      no fim da section escolhida (zona "afterCards"). Funciona com
//      mapElementToInterludeBlock — átomos sem mapeamento (chat-button,
//      marketing, etc) ficam desabilitados.
function ElementOrderControls({ element }: { element: ElementBase }) {
  const layout = usePagesBuilderStore((s) => s.layout);
  const activeLayer = usePagesBuilderStore((s) => s.activeLayer);
  const moveElement = usePagesBuilderStore((s) => s.moveElement);
  const removeElement = usePagesBuilderStore((s) => s.removeElement);
  const appendInterludeBlockToSection = usePagesBuilderStore(
    (s) => s.appendInterludeBlockToSection,
  );

  if (!layout) return null;
  const allElements = getActiveLayerElements(layout, activeLayer);
  const currentIndex = allElements.findIndex((e) => e.id === element.id);
  const canMoveUp = currentIndex > 0;
  const canMoveDown =
    currentIndex >= 0 && currentIndex < allElements.length - 1;

  // Candidatas a receber o element como interlude block: flow sections
  // que NÃO são o próprio element. Inclui navbar/footer pq também têm
  // interlude zones (ainda que faça menos sentido).
  const candidateSections = allElements.filter(
    (candidate) =>
      candidate.id !== element.id && isFlowSection(candidate.type),
  );

  // Tenta gerar um InterludeBlock equivalente do element. Quando null,
  // o dropdown fica desabilitado (átomo sem mapeamento — chat-button,
  // marketing, sticky-cta, formulário, etc).
  const candidateBlock = mapElementToInterludeBlock(element.type, element);
  const canMoveIntoSection =
    candidateBlock !== null && candidateSections.length > 0;

  const moveIntoSection = (sectionId: string) => {
    if (!candidateBlock) return;
    const ok = appendInterludeBlockToSection(
      sectionId,
      candidateBlock as unknown as Record<string, unknown>,
      "after",
    );
    if (!ok) {
      toast.error("Não consegui mover esse element pra essa camada");
      return;
    }
    // Remove o element original do top-level — ele agora vive só dentro
    // da section escolhida.
    removeElement(element.id);
    const targetLabel =
      getElementDisplayName(
        allElements.find((e) => e.id === sectionId) ?? element,
      ) ?? "camada";
    toast.success(`Movido pra dentro de ${targetLabel}`, {
      description:
        "Edite a ordem dentro da camada no painel direito da section.",
    });
  };

  return (
    <div className="rounded border bg-muted/30 px-2 py-2 mb-2">
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-1.5">
        Organização
      </p>
      {/* Subir/Descer no fluxo */}
      <div className="grid grid-cols-2 gap-1 mb-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1"
          disabled={!canMoveUp}
          onClick={() => moveElement(element.id, Math.max(0, currentIndex - 1))}
          title="Mover pra cima no fluxo"
        >
          <ChevronUp className="size-3" />
          Subir
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1"
          disabled={!canMoveDown}
          onClick={() =>
            moveElement(
              element.id,
              Math.min(allElements.length - 1, currentIndex + 1),
            )
          }
          title="Mover pra baixo no fluxo"
        >
          <ChevronDown className="size-3" />
          Descer
        </Button>
      </div>

      {/* Adicionar à camada — converte element em InterludeBlock e
          insere como último filho da section escolhida. */}
      <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
        <CornerDownRight className="size-3" />
        Adicionar à camada
      </Label>
      <Select
        value=""
        onValueChange={(value) => {
          if (value) moveIntoSection(value);
        }}
        disabled={!canMoveIntoSection}
      >
        <SelectTrigger className="h-7 text-[11px]">
          <SelectValue
            placeholder={
              !candidateBlock
                ? "Esse tipo não pode entrar em camadas"
                : candidateSections.length === 0
                  ? "Sem camadas disponíveis"
                  : "Escolher camada…"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {candidateSections.map((section) => (
            <SelectItem
              key={section.id}
              value={section.id}
              className="text-[11px]"
            >
              {getElementDisplayName(section)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[9px] text-muted-foreground/70 mt-1 leading-snug">
        Move este elemento como último item dentro da camada escolhida.
      </p>
    </div>
  );
}

// ─── SocialProps — editor de plataformas + URLs do elemento "social" ──
//
// Migra automaticamente do formato legacy (`platforms: string[]`) pro
// novo (`links: { id, platform, url }[]`) na primeira edição. Aceita 9
// plataformas comuns + opção custom.

const SOCIAL_PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "spotify", label: "Spotify" },
  { value: "github", label: "GitHub" },
  { value: "custom", label: "Outro" },
];

interface SocialLink {
  id: string;
  platform: string;
  url?: string;
}

function SocialProps({
  el,
  update,
}: {
  el: ElementBase;
  update: (p: Partial<ElementBase>) => void;
}) {
  // Migração: se há `platforms` legado mas não `links`, converte
  // automaticamente. Isso roda no primeiro render do painel.
  const links = (el.links as SocialLink[] | undefined) ?? null;
  const legacyPlatforms = (el.platforms as string[] | undefined) ?? [];
  const effectiveLinks: SocialLink[] = links
    ? links
    : legacyPlatforms.map((p, i) => ({
        id: `lg_${i}_${Math.random().toString(36).slice(2, 5)}`,
        platform: p,
      }));

  const updateLinks = (next: SocialLink[]) => {
    // Sempre salva no formato novo. Limpa o `platforms` legacy.
    update({ links: next, platforms: undefined });
  };

  const addLink = () => {
    const nextLink: SocialLink = {
      id: `sl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      platform: "instagram",
      url: "",
    };
    updateLinks([...effectiveLinks, nextLink]);
  };

  const updateLink = (idx: number, patch: Partial<SocialLink>) => {
    const next = effectiveLinks.slice();
    next[idx] = { ...next[idx], ...patch };
    updateLinks(next);
  };

  const removeLink = (idx: number) => {
    updateLinks(effectiveLinks.filter((_, i) => i !== idx));
  };

  const moveLink = (idx: number, delta: number) => {
    const next = effectiveLinks.slice();
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= next.length) return;
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    updateLinks(next);
  };

  return (
    <>
      <Separator className="my-2" />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Plataformas e links
      </p>

      <div className="flex flex-col gap-2">
        {effectiveLinks.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">
            Nenhum link ainda. Use o botão abaixo pra adicionar.
          </p>
        )}
        {effectiveLinks.map((link, idx) => (
          <div
            key={link.id}
            className="border rounded p-1.5 bg-muted/30 flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground flex-1">
                #{idx + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => moveLink(idx, -1)}
                disabled={idx === 0}
                className="size-6 shrink-0"
                title="Subir"
              >
                <ChevronUp className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => moveLink(idx, 1)}
                disabled={idx === effectiveLinks.length - 1}
                className="size-6 shrink-0"
                title="Descer"
              >
                <ChevronDown className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeLink(idx)}
                className="size-6 shrink-0"
                title="Remover"
              >
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </div>
            <Select
              value={link.platform}
              onValueChange={(value) => updateLink(idx, { platform: value })}
            >
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-[11px]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={link.url ?? ""}
              onChange={(e) => updateLink(idx, { url: e.target.value })}
              placeholder="https://instagram.com/seu-perfil"
              className="text-[10px] font-mono"
            />
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={addLink}
        className="text-[10px] w-full gap-1 mt-2"
      >
        + Adicionar plataforma
      </Button>

      <Separator className="my-3" />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Aparência
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Tamanho (px)
          </Label>
          <Input
            type="number"
            value={(el.size as number | undefined) ?? 32}
            onChange={(e) => update({ size: Number(e.target.value) })}
            className="text-[11px]"
            min={16}
            max={96}
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">
            Espaçamento
          </Label>
          <Input
            type="number"
            value={(el.gap as number | undefined) ?? 12}
            onChange={(e) => update({ gap: Number(e.target.value) })}
            className="text-[11px]"
            min={0}
            max={48}
          />
        </div>
      </div>
      <Label className="text-[10px] text-muted-foreground mt-2">
        Cor dos ícones
      </Label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          value={(el.iconColor as string | undefined) ?? "#0f172a"}
          onChange={(e) => update({ iconColor: e.target.value })}
          className="size-7 rounded border cursor-pointer p-0.5 bg-transparent shrink-0"
        />
        <Input
          value={(el.iconColor as string | undefined) ?? "#0f172a"}
          onChange={(e) => update({ iconColor: e.target.value })}
          className="text-[10px] font-mono"
        />
      </div>
    </>
  );
}
