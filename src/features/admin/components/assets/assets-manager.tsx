"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import {
  Upload,
  Trash2,
  Pencil,
  Check,
  X,
  Search,
  ImageIcon,
  Rocket,
  Puzzle,
  Palette,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PopupTemplatesManager } from "@/features/admin/components/popup-templates-manager";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Level {
  id: string;
  order: number;
  name: string;
  requiredPoints: number;
  badgeNumber: number;
  planetEmoji: string;
}
interface AppEntry {
  slug: string;
  label: string;
  emoji: string;
}
interface IntegrationEntry {
  slug: string;
  name: string;
  category: string;
  icon: string;
}
interface PlatformKey {
  key: string;
  label: string;
  hint: string;
}

interface Props {
  levels: Level[];
  apps: AppEntry[];
  integrations: IntegrationEntry[];
  platformKeys: PlatformKey[];
  assetsMap: Record<string, string>;
}

// ── Upload helper (S3 com fallback local) ─────────────────────────────────────
async function uploadFile(file: File): Promise<string> {
  // Try S3 first
  const s3Res = await fetch("/api/s3/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      isImage: true,
    }),
  });

  if (s3Res.ok) {
    const { presignedUrl, key } = await s3Res.json();
    const put = await fetch(presignedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!put.ok) throw new Error("Falha ao enviar arquivo para S3");
    return `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;
  }

  // S3 not configured — fall back to local upload
  const s3Err = await s3Res.json().catch(() => ({}));
  if (s3Res.status === 503) {
    const form = new FormData();
    form.append("file", file);
    const localRes = await fetch("/api/upload-local", {
      method: "POST",
      body: form,
    });
    if (!localRes.ok) {
      const localErr = await localRes.json().catch(() => ({}));
      throw new Error(localErr.error ?? "Erro ao enviar arquivo localmente");
    }
    const { url } = await localRes.json();
    // Convert relative path to absolute URL so z.string().url() passes
    return `${window.location.origin}${url}`;
  }

  throw new Error(
    (s3Err as { error?: string }).error ?? "Erro ao gerar URL de upload",
  );
}

// ── Upload button ──────────────────────────────────────────────────────────────
function UploadButton({
  assetKey,
  currentUrl,
  label,
  onUploaded,
  onDeleted,
  size = "sm",
}: {
  assetKey: string;
  currentUrl?: string;
  label?: string;
  onUploaded: (key: string, url: string) => void;
  onDeleted: (key: string) => void;
  size?: "sm" | "md";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentUrl);
  const setMut = useMutation({
    mutationFn: (vars: { key: string; url: string }) =>
      orpc.admin.setPlatformAsset.call(vars),
  });
  const delMut = useMutation({
    mutationFn: (key: string) => orpc.admin.deletePlatformAsset.call({ key }),
  });

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      const MAX = 10 * 1024 * 1024;
      if (file.size > MAX) {
        toast.error("Arquivo muito grande. Máx 10MB.");
        return;
      }
      setUploading(true);
      try {
        const url = await uploadFile(file);
        await setMut.mutateAsync({ key: assetKey, url });
        setPreviewUrl(url);
        onUploaded(assetKey, url);
        toast.success("Imagem atualizada!");
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Erro ao enviar imagem",
        );
      } finally {
        setUploading(false);
      }
    },
    [assetKey, onUploaded, setMut],
  );

  const handleDelete = async () => {
    await delMut.mutateAsync(assetKey);
    setPreviewUrl(undefined);
    onDeleted(assetKey);
    toast.success("Imagem removida");
  };

  return (
    <div
      className={cn("flex flex-col gap-1.5", size === "sm" ? "mt-1" : "mt-2")}
    >
      {previewUrl && (
        <div
          className="w-full rounded-lg overflow-hidden bg-panel border border-border flex items-center justify-center"
          style={{ height: size === "md" ? "80px" : "48px" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="preview"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.svg,.png,.jpg,.jpeg,.gif,.webp"
          className="hidden"
          onChange={handleFile}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex items-center gap-1 rounded-lg bg-info/20 hover:bg-info/40 text-info hover:text-foreground transition-all disabled:opacity-50",
            size === "sm" ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs",
          )}
        >
          <Upload className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
          {uploading ? "Enviando..." : (label ?? "Trocar")}
        </button>
        {previewUrl && (
          <button
            onClick={handleDelete}
            disabled={delMut.isPending}
            className={cn(
              "flex items-center gap-1 rounded-lg bg-destructive/10 hover:bg-destructive/25 text-destructive hover:text-destructive transition-all disabled:opacity-50",
              size === "sm" ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs",
            )}
          >
            <Trash2 className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Selos tab ─────────────────────────────────────────────────────────────────
function SelosTab({
  levels,
  assetsMap,
  onAssetChange,
}: {
  levels: Level[];
  assetsMap: Record<string, string>;
  onAssetChange: (key: string, url: string | null) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<{
    name: string;
    requiredPoints: string;
    planetEmoji: string;
  }>({ name: "", requiredPoints: "", planetEmoji: "" });
  const [localLevels, setLocalLevels] = useState(levels);

  const saveMut = useMutation({
    mutationFn: (vars: {
      id: string;
      name: string;
      requiredPoints: number;
      planetEmoji: string;
    }) => orpc.admin.updateSpaceLevel.call(vars),
    onSuccess: (_, vars) => {
      setLocalLevels((prev) =>
        prev.map((l) => (l.id === vars.id ? { ...l, ...vars } : l)),
      );
      setEditingId(null);
      toast.success("Nível atualizado!");
    },
    onError: () => toast.error("Erro ao salvar nível"),
  });

  const startEdit = (level: Level) => {
    setEditVals({
      name: level.name,
      requiredPoints: String(level.requiredPoints),
      planetEmoji: level.planetEmoji,
    });
    setEditingId(level.id);
  };

  const saveEdit = (level: Level) => {
    saveMut.mutate({
      id: level.id,
      name: editVals.name,
      requiredPoints: parseInt(editVals.requiredPoints) || 0,
      planetEmoji: editVals.planetEmoji,
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {localLevels.map((level) => {
        const assetKey = `badge:${level.badgeNumber}`;
        const customUrl = assetsMap[assetKey];
        const badgeUrl =
          customUrl ?? `/space-point/badges/${level.badgeNumber}.svg`;
        const isEditing = editingId === level.id;

        return (
          <div
            key={level.id}
            className="bg-card border border-border rounded-2xl p-3 flex flex-col items-center gap-2 hover:border-knob transition-all"
          >
            {/* Badge preview */}
            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-panel flex items-center justify-center">
              <Image
                src={badgeUrl}
                alt={level.name}
                fill
                className="object-contain p-1"
                unoptimized
              />
              {customUrl && (
                <div
                  className="absolute top-0 right-0 w-3 h-3 rounded-full bg-success border border-card"
                  title="Imagem personalizada"
                />
              )}
            </div>

            {/* Level info / edit */}
            {isEditing ? (
              <div className="w-full space-y-1.5">
                <div className="flex items-center gap-1">
                  <input
                    value={editVals.planetEmoji}
                    onChange={(e) =>
                      setEditVals((v) => ({
                        ...v,
                        planetEmoji: e.target.value,
                      }))
                    }
                    className="w-10 text-center text-sm bg-panel border border-border rounded-lg px-1 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="🌍"
                  />
                  <input
                    value={editVals.name}
                    onChange={(e) =>
                      setEditVals((v) => ({ ...v, name: e.target.value }))
                    }
                    className="flex-1 text-xs bg-panel border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Nome"
                  />
                </div>
                <input
                  type="number"
                  value={editVals.requiredPoints}
                  onChange={(e) =>
                    setEditVals((v) => ({
                      ...v,
                      requiredPoints: e.target.value,
                    }))
                  }
                  className="w-full text-xs bg-panel border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Pontos necessários"
                />
                <div className="flex gap-1 justify-end">
                  <button
                    onClick={() => setEditingId(null)}
                    className="h-6 w-6 flex items-center justify-center rounded-md bg-muted hover:bg-knob text-muted-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => saveEdit(level)}
                    disabled={saveMut.isPending}
                    className="h-6 w-6 flex items-center justify-center rounded-md bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center w-full">
                <div className="flex items-center justify-center gap-1">
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {level.planetEmoji} {level.name}
                  </p>
                  <button
                    onClick={() => startEdit(level)}
                    className="shrink-0 h-4 w-4 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {level.requiredPoints.toLocaleString("pt-BR")} pts · #badge
                  {level.badgeNumber}
                </p>
              </div>
            )}

            {/* Upload */}
            <UploadButton
              assetKey={assetKey}
              currentUrl={customUrl}
              onUploaded={(k, url) => onAssetChange(k, url)}
              onDeleted={(k) => onAssetChange(k, null)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Apps tab ──────────────────────────────────────────────────────────────────
function AppsTab({
  apps,
  assetsMap,
  onAssetChange,
}: {
  apps: AppEntry[];
  assetsMap: Record<string, string>;
  onAssetChange: (key: string, url: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {apps.map((app) => {
        const assetKey = `app:${app.slug}`;
        const customUrl = assetsMap[assetKey];

        return (
          <div
            key={app.slug}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-2 hover:border-knob transition-all"
          >
            {/* Icon preview */}
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-panel flex items-center justify-center border border-border">
              {customUrl ? (
                <>
                  <Image
                    src={customUrl}
                    alt={app.label}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div
                    className="absolute top-0 right-0 w-3 h-3 rounded-full bg-success border border-card"
                    title="Imagem personalizada"
                  />
                </>
              ) : (
                <span className="text-3xl">{app.emoji}</span>
              )}
            </div>

            <div className="text-center">
              <p className="text-xs font-semibold text-foreground">{app.label}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{app.slug}</p>
            </div>

            <UploadButton
              assetKey={assetKey}
              currentUrl={customUrl}
              onUploaded={(k, url) => onAssetChange(k, url)}
              onDeleted={(k) => onAssetChange(k, null)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Integrations tab ──────────────────────────────────────────────────────────
function IntegrationsTab({
  integrations,
  assetsMap,
  onAssetChange,
}: {
  integrations: IntegrationEntry[];
  assetsMap: Record<string, string>;
  onAssetChange: (key: string, url: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = Array.from(
    new Set(integrations.map((i) => i.category)),
  ).sort();

  const filtered = integrations.filter((i) => {
    const matchSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.slug.includes(search.toLowerCase());
    const matchCat = category === "all" || i.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar integração..."
            className="w-full pl-8 pr-3 py-2 text-sm bg-panel border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-sm bg-panel border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((integration) => {
          const assetKey = `integration:${integration.slug}`;
          const customUrl = assetsMap[assetKey];
          const displayUrl =
            customUrl ??
            (integration.icon.startsWith("http") ? integration.icon : null);

          return (
            <div
              key={integration.slug}
              className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-2 hover:border-knob transition-all"
            >
              {/* Icon preview */}
              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white flex items-center justify-center shrink-0">
                {displayUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayUrl}
                    alt={integration.name}
                    className="w-10 h-10 object-contain"
                  />
                ) : (
                  <span className="text-2xl">
                    {integration.icon.startsWith("http")
                      ? "🔌"
                      : integration.icon}
                  </span>
                )}
                {customUrl && (
                  <div
                    className="absolute top-0 right-0 w-3 h-3 rounded-full bg-success border border-white"
                    title="Imagem personalizada"
                  />
                )}
              </div>

              <div className="text-center w-full">
                <p className="text-xs font-semibold text-foreground leading-tight truncate">
                  {integration.name}
                </p>
                <p className="text-[9px] text-muted-foreground truncate">
                  {integration.category}
                </p>
              </div>

              <UploadButton
                assetKey={assetKey}
                currentUrl={customUrl}
                onUploaded={(k, url) => onAssetChange(k, url)}
                onDeleted={(k) => onAssetChange(k, null)}
              />
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma integração encontrada.
        </div>
      )}
    </div>
  );
}

// ── Platform tab ──────────────────────────────────────────────────────────────
function PlatformTab({
  platformKeys,
  assetsMap,
  onAssetChange,
}: {
  platformKeys: PlatformKey[];
  assetsMap: Record<string, string>;
  onAssetChange: (key: string, url: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {platformKeys.map((pk) => {
        const customUrl = assetsMap[pk.key];
        return (
          <div
            key={pk.key}
            className="bg-card border border-border rounded-2xl p-4 space-y-3"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{pk.label}</p>
              <p className="text-xs text-muted-foreground">{pk.hint}</p>
            </div>

            {/* Preview */}
            <div className="w-full h-28 rounded-xl bg-panel border border-border flex items-center justify-center overflow-hidden">
              {customUrl ? (
                <Image
                  src={customUrl}
                  alt={pk.label}
                  width={160}
                  height={80}
                  className="object-contain max-h-24"
                  unoptimized
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImageIcon className="w-6 h-6" />
                  <p className="text-[10px]">Sem imagem</p>
                </div>
              )}
            </div>

            <UploadButton
              assetKey={pk.key}
              currentUrl={customUrl}
              label="Enviar imagem"
              size="md"
              onUploaded={(k, url) => onAssetChange(k, url)}
              onDeleted={(k) => onAssetChange(k, null)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Elementos tab ─────────────────────────────────────────────────────────────
const MASCOT_SLOTS = Array.from({ length: 8 }, (_, i) => ({
  key: `popup:mascot:${i + 1}`,
  label: `Elemento ${i + 1}`,
}));

function ElementosTab({
  assetsMap,
  onAssetChange,
}: {
  assetsMap: Record<string, string>;
  onAssetChange: (key: string, url: string | null) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-info/10 border border-info/20 rounded-xl px-4 py-3 text-sm text-foreground">
        Faça upload de imagens{" "}
        <span className="text-foreground font-semibold">1:1 (quadradas)</span> de
        elementos visuais. Eles poderão ser arrastados e posicionados livremente
        nos banners de popup em{" "}
        <strong className="text-foreground">Editar/Novo Template → Prévia</strong>
        .
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {MASCOT_SLOTS.map(({ key, label }) => {
          const url = assetsMap[key];
          return (
            <div
              key={key}
              className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-3 hover:border-knob transition-all"
            >
              <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-panel border border-border flex items-center justify-center">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={label}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="w-8 h-8" />
                    <p className="text-[10px]">Vazio</p>
                  </div>
                )}
                {url && (
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-success border border-card" />
                )}
              </div>
              <p className="text-xs font-medium text-foreground">{label}</p>
              <UploadButton
                assetKey={key}
                currentUrl={url}
                label="Enviar imagem"
                size="md"
                onUploaded={(k, u) => onAssetChange(k, u)}
                onDeleted={(k) => onAssetChange(k, null)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
type Tab =
  | "selos"
  | "apps"
  | "integrations"
  | "platform"
  | "elementos"
  | "popups";

export function AssetsManager({
  levels,
  apps,
  integrations,
  platformKeys,
  assetsMap: initialMap,
}: Props) {
  const [tab, setTab] = useState<Tab>("selos");
  const [assetsMap, setAssetsMap] =
    useState<Record<string, string>>(initialMap);

  const handleAssetChange = useCallback((key: string, url: string | null) => {
    setAssetsMap((prev) => {
      const next = { ...prev };
      if (url === null) delete next[key];
      else next[key] = url;
      return next;
    });
  }, []);

  const customCount = Object.keys(assetsMap).length;

  const TABS: {
    key: Tab;
    label: string;
    icon: React.ElementType;
    count?: number;
  }[] = [
    { key: "selos", label: "Selos", icon: Rocket, count: levels.length },
    { key: "apps", label: "Apps", icon: Puzzle, count: apps.length },
    {
      key: "integrations",
      label: "Integrações",
      icon: ImageIcon,
      count: integrations.length,
    },
    {
      key: "platform",
      label: "Plataforma",
      icon: Palette,
      count: platformKeys.length,
    },
    {
      key: "elementos",
      label: "Elementos",
      icon: ImageIcon,
      count: MASCOT_SLOTS.length,
    },
    { key: "popups", label: "Popups", icon: Sparkles },
  ];

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          <span className="text-foreground font-bold">{customCount}</span> ativos
          personalizados
          {" · "}
          <span className="text-foreground font-bold">
            {levels.length +
              apps.length +
              integrations.length +
              platformKeys.length}
          </span>{" "}
          total configurável
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Arquivos são enviados para S3 e o fallback é a imagem padrão do
          sistema
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-panel p-1">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex shrink-0 items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              tab === key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count !== undefined && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  tab === key
                    ? "bg-background/20 text-background"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "selos" && (
        <SelosTab
          levels={levels}
          assetsMap={assetsMap}
          onAssetChange={handleAssetChange}
        />
      )}
      {tab === "apps" && (
        <AppsTab
          apps={apps}
          assetsMap={assetsMap}
          onAssetChange={handleAssetChange}
        />
      )}
      {tab === "integrations" && (
        <IntegrationsTab
          integrations={integrations}
          assetsMap={assetsMap}
          onAssetChange={handleAssetChange}
        />
      )}
      {tab === "platform" && (
        <PlatformTab
          platformKeys={platformKeys}
          assetsMap={assetsMap}
          onAssetChange={handleAssetChange}
        />
      )}
      {tab === "elementos" && (
        <ElementosTab assetsMap={assetsMap} onAssetChange={handleAssetChange} />
      )}
      {tab === "popups" && <PopupsTab />}
    </div>
  );
}

// ── Popups tab ─────────────────────────────────────────────────────────────────
function PopupsTab() {
  const [templates, setTemplates] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/popup-templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="text-muted-foreground text-sm py-6 text-center">
        Carregando...
      </div>
    );
  return (
    <PopupTemplatesManager
      templates={
        templates as Parameters<typeof PopupTemplatesManager>[0]["templates"]
      }
    />
  );
}
