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

// ─── Navbar (section-navbar) ────────────────────────────────────────────────
//
// Editor dedicado pro section-navbar. Permite trocar logo (texto ou
// imagem), editar links com âncoras, configurar destinos dos CTAs e
// ajustar cores via tokens.

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
      <Label className="text-[10px] text-muted-foreground">
        URL da imagem (deixa vazio pra mostrar texto)
      </Label>
      <Input
        value={(el.logoSrc as string) ?? ""}
        onChange={(e) => update({ logoSrc: e.target.value })}
        placeholder="https://meusite.com/logo.png"
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">
        Texto da logo (fallback)
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
      <Label className="text-[10px] text-muted-foreground">URL da imagem</Label>
      <Input
        value={(el.logoSrc as string) ?? ""}
        onChange={(e) => update({ logoSrc: e.target.value })}
        placeholder="https://..."
        className="text-xs"
      />
      <Label className="text-[10px] text-muted-foreground mt-2">Texto (fallback)</Label>
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
      <Label className="text-[10px] text-muted-foreground mt-2">Imagem (URL)</Label>
      <Input
        value={(el.imageUrl as string) ?? ""}
        onChange={(e) => update({ imageUrl: e.target.value })}
        placeholder="https://..."
        className="text-xs"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Botão primário
      </p>
      <Input
        value={(el.primaryCta as string) ?? ""}
        onChange={(e) => update({ primaryCta: e.target.value })}
        placeholder="Começar agora"
        className="text-xs mb-1.5"
      />
      <Input
        value={(el.primaryCtaHref as string) ?? ""}
        onChange={(e) => update({ primaryCtaHref: e.target.value })}
        placeholder="#planos"
        className="text-xs font-mono"
      />

      <Seg />
      <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide mb-2">
        Botão secundário
      </p>
      <Input
        value={(el.secondaryCta as string) ?? ""}
        onChange={(e) => update({ secondaryCta: e.target.value })}
        placeholder="Ver demo"
        className="text-xs mb-1.5"
      />
      <Input
        value={(el.secondaryCtaHref as string) ?? ""}
        onChange={(e) => update({ secondaryCtaHref: e.target.value })}
        placeholder="#"
        className="text-xs font-mono"
      />

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

// ─── Main panel ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  text: "Texto", image: "Imagem", shape: "Forma", button: "Botão",
  video: "Vídeo", embed: "Embed", icon: "Ícone", divider: "Divisor",
  social: "Social", spacer: "Espaço", svg: "SVG", "nasa-link": "Link NASA", group: "Grupo",
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
        {el.type === "section-navbar" && <NavbarProps el={el} update={update} />}
        {el.type === "section-footer" && <FooterProps el={el} update={update} />}
        {el.type === "section-hero"   && <HeroProps   el={el} update={update} />}
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
