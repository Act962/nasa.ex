"use client";

import { useRef, useState } from "react";
import { Trash2, Copy, Lock, Unlock, ExternalLink, Crop, Wand2 } from "lucide-react";
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
import { usePagesBuilderStore, getActiveLayerElements } from "../../context/pages-builder-store";
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

function Seg({ className }: { className?: string }) {
  return <Separator className={cn("my-3", className)} />;
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
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload-local", { method: "POST", body: form });
      const { url } = await res.json();
      update({ src: url });
    } catch {
      toast.error("Falha no upload");
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
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload-local", { method: "POST", body: form });
      const { url } = await res.json();
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
      <Field label="Link">
        <Input
          placeholder="https://..."
          value={((el.link as { href?: string })?.href) ?? ""}
          onChange={(e) => update({ link: { kind: "url", href: e.target.value, openInNewTab: true } })}
          className="h-8 text-xs"
        />
      </Field>
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
// abre file picker → POST em /api/upload-local → seta o `logoSrc`.
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
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload-local", {
        method: "POST",
        body: form,
      });
      const { url } = await res.json();
      update({ logoSrc: url });
      toast.success("Logo carregada");
    } catch {
      toast.error("Falha no upload");
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
  type NavLink = { id: string; label: string; href: string };
  const links = ((el.links as NavLink[] | undefined) ?? []).slice();

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

  return (
    <>
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
        Destino da logo (href)
      </Label>
      <Input
        value={(el.logoHref as string) ?? "#top"}
        onChange={(e) => update({ logoHref: e.target.value })}
        placeholder="#top"
        className="text-xs"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Links da navegação
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
              title="Remover link"
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
          <Input
            value={link.href}
            onChange={(e) => updateLink(idx, { href: e.target.value })}
            placeholder="#planos ou https://..."
            className="text-xs font-mono"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addLink} className="text-xs">
        + Adicionar link
      </Button>

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Botão primário
      </p>
      <Input
        value={(el.primaryCta as string) ?? ""}
        onChange={(e) => update({ primaryCta: e.target.value })}
        placeholder="Começar grátis"
        className="text-xs mb-1.5"
      />
      <Input
        value={(el.primaryCtaHref as string) ?? ""}
        onChange={(e) => update({ primaryCtaHref: e.target.value })}
        placeholder="#cta-final"
        className="text-xs font-mono"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Botão secundário
      </p>
      <Input
        value={(el.secondaryCta as string) ?? ""}
        onChange={(e) => update({ secondaryCta: e.target.value })}
        placeholder="Entrar"
        className="text-xs mb-1.5"
      />
      <Input
        value={(el.secondaryCtaHref as string) ?? ""}
        onChange={(e) => update({ secondaryCtaHref: e.target.value })}
        placeholder="/sign-in"
        className="text-xs font-mono"
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
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload-local", { method: "POST", body: form });
      const { url } = await res.json();
      update({ imageUrl: url });
      toast.success("Imagem do hero carregada");
    } catch {
      toast.error("Falha no upload");
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
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload-local", { method: "POST", body: form });
      const { url } = await res.json();
      update({ backgroundImage: url });
      toast.success("Imagem de fundo aplicada");
    } catch {
      toast.error("Falha no upload");
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
      <Label className="text-[10px] text-muted-foreground">
        Anchor ID (pra outros botões linkarem aqui)
      </Label>
      <Input
        value={(el.anchorId as string) ?? ""}
        onChange={(e) => update({ anchorId: e.target.value })}
        placeholder="hero"
        className="text-xs font-mono"
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
  };
  const items = ((el.features as Feature[] | undefined) ?? []).slice();
  const patch = (idx: number, p: Partial<Feature>) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...p };
    update({ features: next });
  };
  const add = () => {
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
  };
  const remove = (idx: number) =>
    update({ features: items.filter((_, i) => i !== idx) });
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    update({ features: next });
  };

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Cabeçalho da seção
      </p>
      <Label className="text-[10px] text-muted-foreground">Título (heading)</Label>
      <Input
        value={(el.heading as string) ?? ""}
        onChange={(e) => update({ heading: e.target.value })}
        placeholder="Por que escolher a gente"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Subtítulo</Label>
      <Textarea
        rows={2}
        value={(el.subheading as string) ?? ""}
        onChange={(e) => update({ subheading: e.target.value })}
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">
        Anchor ID (pra link via #)
      </Label>
      <Input
        value={(el.anchorId as string) ?? ""}
        onChange={(e) => update({ anchorId: e.target.value })}
        placeholder="por-que"
        className="text-xs font-mono"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Cards ({items.length})
      </p>
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="p-2 border rounded-md mb-2 bg-muted/30 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1">
            <Input
              value={item.icon}
              onChange={(e) => patch(idx, { icon: e.target.value })}
              placeholder="🎯"
              className="text-base w-12 text-center"
              maxLength={4}
            />
            <Input
              value={item.title}
              onChange={(e) => patch(idx, { title: e.target.value })}
              placeholder="Título do card"
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
              disabled={idx === items.length - 1}
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
          <Textarea
            rows={2}
            value={item.description}
            onChange={(e) => patch(idx, { description: e.target.value })}
            placeholder="Descrição"
            className="text-xs"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="text-xs">
        + Adicionar card
      </Button>

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
  };
  const plans = ((el.plans as Plan[] | undefined) ?? []).slice();
  const patch = (idx: number, p: Partial<Plan>) => {
    const next = plans.slice();
    next[idx] = { ...next[idx], ...p };
    update({ plans: next });
  };
  const add = () => {
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
  };
  const remove = (idx: number) =>
    update({ plans: plans.filter((_, i) => i !== idx) });

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
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Subtítulo</Label>
      <Textarea
        rows={2}
        value={(el.subheading as string) ?? ""}
        onChange={(e) => update({ subheading: e.target.value })}
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Anchor ID</Label>
      <Input
        value={(el.anchorId as string) ?? "planos"}
        onChange={(e) => update({ anchorId: e.target.value })}
        placeholder="planos"
        className="text-xs font-mono"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Planos ({plans.length})
      </p>
      {plans.map((plan, idx) => (
        <div
          key={plan.id}
          className="p-2 border rounded-md mb-3 bg-muted/30 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1">
            <Input
              value={plan.name}
              onChange={(e) => patch(idx, { name: e.target.value })}
              placeholder="Nome (Silver, VIP, Master…)"
              className="text-xs font-semibold flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(idx)}
              className="size-7 shrink-0"
              title="Remover plano"
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
          <Row cols={2}>
            <div>
              <Label className="text-[10px] text-muted-foreground">Preço</Label>
              <Input
                value={plan.price}
                onChange={(e) => patch(idx, { price: e.target.value })}
                placeholder="R$ 197"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Período</Label>
              <Input
                value={plan.period ?? ""}
                onChange={(e) => patch(idx, { period: e.target.value })}
                placeholder="/mês"
                className="text-xs"
              />
            </div>
          </Row>
          <Label className="text-[10px] text-muted-foreground">Slogan</Label>
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
                  onChange={(e) => patch(idx, { highlighted: e.target.checked })}
                />
                Em destaque
              </Label>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Badge</Label>
              <Input
                value={plan.badge ?? ""}
                onChange={(e) => patch(idx, { badge: e.target.value })}
                placeholder="Mais popular"
                className="text-xs"
              />
            </div>
          </Row>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="text-xs">
        + Adicionar plano
      </Button>

      <ColorBlock el={el} update={update} />
    </>
  );
}

// ─── Testimonials (section-testimonials) ──────────────────────────────────
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
        className="text-xs"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Depoimentos ({items.length})
      </p>
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="p-2 border rounded-md mb-2 bg-muted/30 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground flex-1">
              #{idx + 1}
            </span>
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
          <Label className="text-[10px] text-muted-foreground">Citação</Label>
          <Textarea
            rows={3}
            value={item.quote}
            onChange={(e) => patch(idx, { quote: e.target.value })}
            placeholder="Mudou minha rotina completamente"
            className="text-xs"
          />
          <Row cols={2}>
            <div>
              <Label className="text-[10px] text-muted-foreground">Autor</Label>
              <Input
                value={item.author}
                onChange={(e) => patch(idx, { author: e.target.value })}
                placeholder="Mariana F."
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Cargo</Label>
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
            className="text-xs font-mono"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="text-xs">
        + Adicionar depoimento
      </Button>

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
  type Stat = { id: string; value: string; label: string };
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

  return (
    <>
      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Estatísticas ({items.length})
      </p>
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="p-2 border rounded-md mb-2 bg-muted/30 flex flex-col gap-1.5"
        >
          <Row cols={2}>
            <div>
              <Label className="text-[10px] text-muted-foreground">Valor</Label>
              <Input
                value={item.value}
                onChange={(e) => patch(idx, { value: e.target.value })}
                placeholder="2.3k+"
                className="text-xs font-bold"
              />
            </div>
            <div className="flex items-end gap-1">
              <div className="flex-1">
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
          </Row>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="text-xs">
        + Adicionar estatística
      </Button>

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
  type Item = { id: string; question: string; answer: string };
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
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Anchor ID</Label>
      <Input
        value={(el.anchorId as string) ?? "faq"}
        onChange={(e) => update({ anchorId: e.target.value })}
        placeholder="faq"
        className="text-xs font-mono"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Perguntas ({items.length})
      </p>
      {items.map((item, idx) => (
        <div
          key={item.id}
          className="p-2 border rounded-md mb-2 bg-muted/30 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1">
            <Input
              value={item.question}
              onChange={(e) => patch(idx, { question: e.target.value })}
              placeholder="Pergunta?"
              className="text-xs font-semibold flex-1"
            />
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
          <Textarea
            rows={3}
            value={item.answer}
            onChange={(e) => patch(idx, { answer: e.target.value })}
            placeholder="Resposta"
            className="text-xs"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="text-xs">
        + Adicionar pergunta
      </Button>

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
      <Label className="text-[10px] text-muted-foreground mt-2">Anchor ID</Label>
      <Input
        value={(el.anchorId as string) ?? "cta-final"}
        onChange={(e) => update({ anchorId: e.target.value })}
        placeholder="cta-final"
        className="text-xs font-mono"
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

  return (
    <>
      <Seg />
      <Label className="text-[10px] text-muted-foreground">Título</Label>
      <Input
        value={(el.heading as string) ?? ""}
        onChange={(e) => update({ heading: e.target.value })}
        placeholder="Empresas que confiam em nós"
        className="text-xs"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Logos ({items.length})
      </p>
      {items.map((logo, idx) => (
        <div
          key={logo.id}
          className="p-2 border rounded-md mb-2 bg-muted/30 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1">
            <Input
              value={logo.alt}
              onChange={(e) => patch(idx, { alt: e.target.value })}
              placeholder="Nome da marca (alt)"
              className="text-xs flex-1"
            />
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
          <Input
            value={logo.imageUrl}
            onChange={(e) => patch(idx, { imageUrl: e.target.value })}
            placeholder="https://… (URL da logo)"
            className="text-xs font-mono"
          />
          {logo.imageUrl && (
            <div className="rounded border bg-white p-2 flex items-center justify-center h-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo.imageUrl}
                alt={logo.alt}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="text-xs">
        + Adicionar logo
      </Button>

      <ColorBlock el={el} update={update} />
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
        {el.type === "text"   && <TextProps   el={el} update={update} />}
        {el.type === "image"  && <ImageProps  el={el} update={update} />}
        {el.type === "shape"  && <ShapeProps  el={el} update={update} />}
        {el.type === "button" && <ButtonProps el={el} update={update} />}
        {el.type === "video"  && <VideoProps  el={el} update={update} />}
        {el.type === "embed"  && <EmbedProps  el={el} update={update} />}
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
