"use client";

import { useState, useEffect } from "react";
import { useExtractBrandKitFromLogo, useGoogleFontSuggestions, useOrgBrandKit, useUpdateOrgBrandKit } from "../../hooks/use-planner-org-brand";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon, Upload, X } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { resolveR2Url } from "./popup-shared";
import { AIConfigSection } from "./popup-ai-config";

/** Aba Branding do popup do Planner: logo, paleta, fontes, slogan e tom de voz da empresa ativa. */

export function PopupBrandingTab() {
  const { brandKit, isLoading } = useOrgBrandKit();
  const update = useUpdateOrgBrandKit();
  const extractFromLogo = useExtractBrandKitFromLogo();

  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    try {
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          isImage: true,
        }),
      });
      if (!res.ok) throw new Error("Erro ao obter URL de upload");
      const { presignedUrl, key } = await res.json();
      await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      // Dispara extração automática via Claude Vision (5★)
      await extractFromLogo.mutateAsync({ logoFileKey: key, persist: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload do logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const palette: string[] = (brandKit?.paletteHex as string[] | null) ?? [];
  const fontHeading = brandKit?.fontHeading ?? "";
  const fontBody = brandKit?.fontBody ?? "";
  const slogan = brandKit?.slogan ?? "";
  const voiceTone = brandKit?.voiceTone ?? "";
  const logoUrl = brandKit?.logoUrl ?? null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-lg bg-info/15 border border-info/30 px-4 py-3 text-xs">
        <p className="font-semibold text-info mb-1">
          O que é o brand kit?
        </p>
        <p className="text-muted-foreground leading-relaxed">
          A paleta, fontes, slogan e tom de voz cadastrados aqui são
          injetados <strong>automaticamente</strong> em toda geração de
          imagem e texto pelo Planner. Garante consistência visual em
          todos os posts.
        </p>
      </div>

      {/* ── Configuração de IA inline (sem precisar ir em Integrações) ── */}
      <AIConfigSection />

      {/* ── Upload de logo + extração automática ── */}
      <div className="space-y-2">
        <Label>Logo da marca</Label>
        <div className="flex items-start gap-4 flex-wrap">
          {logoUrl ? (
            <div className="rounded-lg border w-24 h-24 sm:w-32 sm:h-32 overflow-hidden bg-muted flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveR2Url(logoUrl)}
                alt="Logo"
                className="w-full h-full object-contain p-2"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed w-24 h-24 sm:w-32 sm:h-32 bg-muted/30 flex items-center justify-center text-muted-foreground">
              <ImageIcon className="size-8 opacity-40" />
            </div>
          )}
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="cursor-pointer inline-block">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = "";
                }}
                disabled={uploadingLogo || extractFromLogo.isPending}
              />
              <div className="inline-flex items-center gap-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 py-2 transition">
                {uploadingLogo || extractFromLogo.isPending ? (
                  <>
                    <OrbitaSpinner className="size-3.5 " />
                    {uploadingLogo ? "Subindo logo..." : "Extraindo com IA..."}
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    {logoUrl ? "Trocar logo" : "Enviar logo"}
                  </>
                )}
              </div>
            </label>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Ao enviar, a IA <strong>Claude Vision</strong> analisa o logo
              e preenche automaticamente paleta, fontes sugeridas e mood
              (5★ debitados). Você pode editar tudo depois.
            </p>
          </div>
        </div>
      </div>

      {/* ── Paleta ── */}
      <div className="space-y-2">
        <Label>Paleta de cores</Label>
        <PaletteEditor
          colors={palette}
          onChange={(colors) => update.mutate({ paletteHex: colors })}
          saving={update.isPending}
        />
      </div>

      {/* ── Fontes + textos da marca ── */}
      <BrandQuickForm
        initial={{ fontHeading, fontBody, slogan, voiceTone }}
        onSave={(values) => update.mutate(values)}
        saving={update.isPending}
      />
    </div>
  );
}

function PaletteEditor({
  colors,
  onChange,
  saving,
}: {
  colors: string[];
  onChange: (colors: string[]) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState<string[]>(colors);
  useEffect(() => {
    setLocal(colors);
  }, [colors.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateColor = (i: number, value: string) => {
    const next = [...local];
    next[i] = value;
    setLocal(next);
  };

  const addColor = () => {
    if (local.length >= 8) return;
    setLocal([...local, "#000000"]);
  };

  const removeColor = (i: number) => {
    setLocal(local.filter((_, idx) => idx !== i));
  };

  const hasChanges =
    local.length !== colors.length || local.some((c, i) => c !== colors[i]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {local.map((color, i) => (
          <div
            key={i}
            className="rounded-lg border p-1.5 flex flex-col items-center gap-1 group"
          >
            <input
              type="color"
              value={color}
              onChange={(e) => updateColor(i, e.target.value)}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded cursor-pointer border-0 p-0"
              style={{ background: color }}
            />
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={color.toUpperCase()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateColor(i, v);
                }}
                className="text-[10px] font-mono w-16 text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-info rounded"
              />
              <button
                type="button"
                onClick={() => removeColor(i)}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                aria-label="Remover cor"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        ))}
        {local.length < 8 && (
          <button
            type="button"
            onClick={addColor}
            className="rounded-lg border border-dashed w-[88px] sm:w-[120px] h-[88px] sm:h-[104px] hover:bg-muted/40 text-muted-foreground text-xs transition"
          >
            + cor
          </button>
        )}
      </div>
      {hasChanges && (
        <Button
          size="sm"
          onClick={() => onChange(local)}
          disabled={saving}
          className="gap-2"
        >
          {saving ? "Salvando..." : "Salvar paleta"}
        </Button>
      )}
    </div>
  );
}

function BrandQuickForm({
  initial,
  onSave,
  saving,
}: {
  initial: {
    fontHeading: string;
    fontBody: string;
    slogan: string;
    voiceTone: string;
  };
  onSave: (values: typeof initial) => void;
  saving: boolean;
}) {
  const [fontHeading, setFontHeading] = useState(initial.fontHeading);
  const [fontBody, setFontBody] = useState(initial.fontBody);
  const [slogan, setSlogan] = useState(initial.slogan);
  const [voiceTone, setVoiceTone] = useState(initial.voiceTone);

  // Atualiza locais quando a server query atualiza (ex: após extractFromLogo)
  useEffect(() => {
    setFontHeading(initial.fontHeading);
    setFontBody(initial.fontBody);
    setSlogan(initial.slogan);
    setVoiceTone(initial.voiceTone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initial.fontHeading,
    initial.fontBody,
    initial.slogan,
    initial.voiceTone,
  ]);

  // Google Fonts autocomplete
  const [fontQuery, setFontQuery] = useState("");
  const { fontSuggestions } = useGoogleFontSuggestions(fontQuery);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="fh" className="text-xs">
            Fonte heading
          </Label>
          <Input
            id="fh"
            placeholder="Ex: Playfair Display"
            value={fontHeading}
            onChange={(e) => {
              setFontHeading(e.target.value);
              setFontQuery(e.target.value);
            }}
            onBlur={() => setTimeout(() => setFontQuery(""), 200)}
          />
          {fontQuery.length >= 2 && fontSuggestions.length > 0 && (
            <div className="rounded-md border bg-popover shadow-md max-h-40 overflow-y-auto text-xs">
              {fontSuggestions.map((f) => (
                <button
                  key={f.family}
                  type="button"
                  onClick={() => {
                    setFontHeading(f.family);
                    setFontQuery("");
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-accent"
                >
                  <span className="font-medium">{f.family}</span>
                  <span className="text-muted-foreground ml-2">{f.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="fb" className="text-xs">
            Fonte body
          </Label>
          <Input
            id="fb"
            placeholder="Ex: Inter"
            value={fontBody}
            onChange={(e) => setFontBody(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="slogan" className="text-xs">
          Slogan / nome da marca
        </Label>
        <Input
          id="slogan"
          placeholder="Ex: Dra. Thaine Malinowski — Harmonização Corporal"
          value={slogan}
          onChange={(e) => setSlogan(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="voice" className="text-xs">
          Tom de voz
        </Label>
        <Textarea
          id="voice"
          placeholder="Ex: Elegante, profissional, científico mas acessível."
          value={voiceTone}
          onChange={(e) => setVoiceTone(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>
      <Button
        size="sm"
        onClick={() => onSave({ fontHeading, fontBody, slogan, voiceTone })}
        disabled={saving}
      >
        {saving ? "Salvando..." : "Salvar marca"}
      </Button>
    </div>
  );
}
