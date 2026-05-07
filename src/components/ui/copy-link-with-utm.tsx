"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Tags } from "lucide-react";
import { toast } from "sonner";

/**
 * Botão "Copiar link com UTM" — abre um dialog mínimo pedindo source/campaign/medium,
 * gera a URL com `?utm_*` colado e copia pra clipboard.
 *
 * Lembra os últimos UTMs usados em `localStorage` (chave `nasa:utm-presets`) pra
 * sugerir presets — assim o dono da agência não retecla "instagram_bio_2026" toda vez.
 *
 * Uso:
 *   <CopyLinkWithUtm baseUrl={`${appUrl}/submit-form/${formId}`} />
 *
 * Renderiza por padrão como Button com ícone Tags. Aceita `trigger` custom pra
 * embutir em DropdownMenuItem ou outros gatilhos.
 */
interface CopyLinkWithUtmProps {
  baseUrl: string;
  /** Ícone/texto custom — se omitido, usa Button padrão. */
  trigger?: React.ReactNode;
  /** Tamanho do button quando trigger não é passado. */
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
}

const STORAGE_KEY = "nasa:utm-presets";

const SOURCE_PRESETS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "google", label: "Google" },
  { value: "meta", label: "Meta Ads" },
  { value: "email", label: "E-mail / Newsletter" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "direct", label: "Direto / outro" },
];

const MEDIUM_BY_SOURCE: Record<string, string> = {
  instagram: "social",
  facebook: "social",
  tiktok: "social",
  linkedin: "social",
  youtube: "video",
  google: "cpc",
  meta: "paid",
  email: "email",
  whatsapp: "messaging",
  direct: "referral",
};

interface SavedPreset {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}

export function CopyLinkWithUtm({
  baseUrl,
  trigger,
  size = "default",
  variant = "outline",
}: CopyLinkWithUtmProps) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("instagram");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [copied, setCopied] = useState(false);

  // Carrega últimos UTMs usados quando abre
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPresets(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [open]);

  // Mantém medium sincronizado com source (sugestão automática)
  useEffect(() => {
    setMedium((m) => MEDIUM_BY_SOURCE[source] ?? m);
  }, [source]);

  const finalUrl = useMemo(() => {
    if (!campaign) return baseUrl;
    const url = new URL(
      baseUrl,
      typeof window !== "undefined" ? window.location.origin : "https://example.com",
    );
    url.searchParams.set("utm_source", source);
    if (medium) url.searchParams.set("utm_medium", medium);
    url.searchParams.set("utm_campaign", slugify(campaign));
    if (content) url.searchParams.set("utm_content", slugify(content));
    return url.toString();
  }, [baseUrl, source, medium, campaign, content]);

  const handleCopy = () => {
    if (!campaign.trim()) {
      toast.error("Informe o nome da campanha");
      return;
    }
    navigator.clipboard
      .writeText(finalUrl)
      .then(() => {
        setCopied(true);
        toast.success("Link copiado com UTMs!");
        // Salva preset
        try {
          const next: SavedPreset = { source, medium, campaign, content };
          const updated = [
            next,
            ...presets.filter(
              (p) => p.campaign !== campaign || p.source !== source,
            ),
          ].slice(0, 6);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          setPresets(updated);
        } catch {
          // ignore
        }
        setTimeout(() => {
          setCopied(false);
          setOpen(false);
        }, 800);
      })
      .catch(() => {
        toast.error("Falha ao copiar");
      });
  };

  const applyPreset = (p: SavedPreset) => {
    setSource(p.source);
    setMedium(p.medium);
    setCampaign(p.campaign);
    setContent(p.content ?? "");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={variant} size={size}>
            <Tags className="size-4 mr-2" />
            Copiar link com UTM
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar link com UTM</DialogTitle>
          <DialogDescription>
            Etiquete a origem do link antes de compartilhar — assim o NASA vai
            saber de qual canal veio cada lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field>
            <FieldLabel>Onde você vai colar?</FieldLabel>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_PRESETS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Nome da campanha *</FieldLabel>
            <Input
              placeholder="ex: blackweek-2026 ou bio-instagram"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Variação (opcional)</FieldLabel>
            <Input
              placeholder="ex: criativo-A ou cta-rosa"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </Field>

          {presets.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Recentes</div>
              <div className="flex flex-wrap gap-1">
                {presets.map((p, i) => (
                  <button
                    key={`${p.source}-${p.campaign}-${i}`}
                    onClick={() => applyPreset(p)}
                    className="text-xs rounded-full border px-2 py-0.5 hover:bg-accent transition-colors"
                  >
                    {p.source} · {p.campaign}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview do link gerado */}
          <div className="rounded-md bg-muted px-2 py-1.5 text-xs break-all font-mono text-muted-foreground">
            {finalUrl}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCopy} disabled={!campaign.trim()}>
            {copied ? (
              <>
                <Check className="size-4 mr-2" /> Copiado
              </>
            ) : (
              <>
                <Copy className="size-4 mr-2" /> Copiar link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Converte texto livre em slug seguro pra URL (lowercase, hifens, sem acento).
 * "Black Week 2026" → "black-week-2026"
 */
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
