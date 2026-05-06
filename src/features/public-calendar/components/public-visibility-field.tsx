"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Copy, ExternalLink, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { EVENT_CATEGORIES, BR_STATES } from "../utils/categories";
import type { EventCategory } from "@/generated/prisma/enums";

interface PublicVisibilityFieldProps {
  isPublic?: boolean;
  publicSlug?: string | null;
  eventCategory?: EventCategory | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  registrationUrl?: string | null;
  onUpdate: (data: {
    isPublic?: boolean;
    eventCategory?: EventCategory | null;
    state?: string | null;
    city?: string | null;
    address?: string | null;
    registrationUrl?: string | null;
  }) => void;
  disabled?: boolean;
}

export function PublicVisibilityField({
  isPublic = false,
  publicSlug,
  eventCategory,
  state,
  city,
  address,
  registrationUrl,
  onUpdate,
  disabled,
}: PublicVisibilityFieldProps) {
  const [copied, setCopied] = useState(false);
  const [localAddress, setLocalAddress] = useState(address ?? "");
  const [localCity, setLocalCity] = useState(city ?? "");
  const [localUrl, setLocalUrl] = useState(registrationUrl ?? "");

  const publicUrl = publicSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/calendario/evento/${publicSlug}`
    : null;

  // Destaque temporário quando o user vem do fluxo de criação de evento
  // pelo /calendario. Lemos via sessionStorage (definido pelo
  // `actions-view-switcher` no `onCreated`) pra evitar race com nuqs e
  // também via `?highlight=public` (fallback / deep-link).
  const [highlight, setHighlight] = useQueryState("highlight");
  const cardRef = useRef<HTMLDivElement>(null);
  const [sessionFlag, setSessionFlag] = useState(false);

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem("nasa:highlightPublic");
      if (flag) {
        setSessionFlag(true);
        sessionStorage.removeItem("nasa:highlightPublic");
      }
    } catch {
      // ignore
    }
  }, []);

  const isHighlighted = highlight === "public" || sessionFlag;

  useEffect(() => {
    if (!isHighlighted) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => {
      setSessionFlag(false);
      if (highlight === "public") setHighlight(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [isHighlighted, setHighlight, highlight]);

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "space-y-2.5 rounded-lg border border-border/60 bg-card p-3 transition-all",
        isHighlighted &&
          "border-violet-400 ring-4 ring-violet-400/40 shadow-lg shadow-violet-500/20 animate-[publicPulse_1.2s_ease-in-out_infinite]",
      )}
    >
      <style>{`
        @keyframes publicPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.45); }
          50%      { box-shadow: 0 0 0 8px rgba(167, 139, 250, 0); }
        }
      `}</style>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe
            className={cn(
              "h-4 w-4 transition-colors",
              isHighlighted ? "text-violet-500" : "text-muted-foreground",
            )}
          />
          <Label className="cursor-pointer text-sm font-medium">
            Visualização Pública
          </Label>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={(checked) => onUpdate({ isPublic: checked })}
          disabled={disabled}
        />
      </div>

      {isPublic && (
        <div className="space-y-3 pt-2">
          {publicUrl && (
            <div className="flex items-center gap-1.5 rounded border border-border/40 bg-muted/40 p-1.5">
              <div
                className="flex-1 truncate text-xs text-muted-foreground"
                title={publicUrl}
              >
                {publicUrl.length > 30
                  ? `${publicUrl.slice(0, 30)}…`
                  : publicUrl}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                asChild
              >
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Categoria do evento</Label>
            <Select
              value={eventCategory ?? "__none"}
              onValueChange={(v) =>
                onUpdate({
                  eventCategory: v === "__none" ? null : (v as EventCategory),
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sem categoria</SelectItem>
                {EVENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="mr-1.5">{c.emoji}</span>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select
                value={state ?? "__none"}
                onValueChange={(v) =>
                  onUpdate({ state: v === "__none" ? null : v })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {BR_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input
                value={localCity}
                onChange={(e) => setLocalCity(e.target.value)}
                onBlur={() =>
                  (localCity || null) !== (city ?? null) &&
                  onUpdate({ city: localCity || null })
                }
                className="h-8 text-xs"
                placeholder="Cidade"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Endereço</Label>
            <Input
              value={localAddress}
              onChange={(e) => setLocalAddress(e.target.value)}
              onBlur={() =>
                (localAddress || null) !== (address ?? null) &&
                onUpdate({ address: localAddress || null })
              }
              className="h-8 text-xs"
              placeholder="Rua, número, complemento…"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Link de inscrição (opcional)</Label>
            <Input
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              onBlur={() =>
                (localUrl || null) !== (registrationUrl ?? null) &&
                onUpdate({ registrationUrl: localUrl || null })
              }
              className="h-8 text-xs"
              placeholder="https://…"
            />
          </div>
        </div>
      )}
    </div>
  );
}
