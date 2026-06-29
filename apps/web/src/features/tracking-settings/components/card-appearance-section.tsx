"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Slider } from "@/components/ui/slider";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import {
  Image as ImageLucide,
  Layout as LayoutIcon,
  X,
} from "lucide-react";

const PRESET_COLORS = [
  null,
  "#7c3aed",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#0ea5e9",
  "#64748b",
];

/**
 * Seção de Personalização → Aparência do card. Renderiza inline (sem
 * Dialog wrapper) dentro da tab "Personalização" do settings do tracking.
 *
 * Persiste via `tracking.update` que aceita `cardBorderColor`,
 * `cardBackgroundImage`, `cardBackgroundBlur`, `cardBackgroundOpacity` —
 * graviados via $executeRaw pra independer do Prisma client regenerado.
 */
export function CardAppearanceSection({
  trackingId,
}: {
  trackingId: string;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(
    orpc.tracking.getCardAppearance.queryOptions({
      input: { trackingId },
    }),
  );

  const [borderColor, setBorderColor] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgBlur, setBgBlur] = useState<number>(8);
  const [bgOpacity, setBgOpacity] = useState<number>(25);

  // Re-sincroniza quando os dados chegam (e depois disso, em refetches).
  useEffect(() => {
    if (!data) return;
    setBorderColor(data.cardBorderColor);
    setBgImage(data.cardBackgroundImage);
    setBgBlur(data.cardBackgroundBlur);
    setBgOpacity(data.cardBackgroundOpacity);
  }, [data]);

  const bgPreviewUrl = useConstructUrl(bgImage || "");

  const mutate = useMutation(
    orpc.tracking.update.mutationOptions({
      onSuccess: () => {
        toast.success("Aparência atualizada");
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.getCardAppearance.queryKey({
            input: { trackingId },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.listDashboard.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.list.queryKey(),
        });
      },
      onError: (err) => toast.error(err?.message || "Falha ao salvar"),
    }),
  );

  function save() {
    mutate.mutate({
      trackingId,
      cardBorderColor: borderColor,
      cardBackgroundImage: bgImage,
      cardBackgroundBlur: bgBlur,
      cardBackgroundOpacity: bgOpacity,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border bg-muted/20 p-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <LayoutIcon className="size-4" />
          <h3 className="text-lg font-medium">Aparência do card no Dashboard</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Defina cor da borda, imagem de fundo (com desfoque/transparência)
          e veja a pré-visualização aplicada no painel "Tracking".
        </p>
      </div>

      {/* ── Cor da borda ──────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Cor da borda</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setBorderColor(c)}
              className={`size-8 rounded-md border-2 flex items-center justify-center transition-all ${
                borderColor === c
                  ? "ring-2 ring-offset-2 ring-foreground/30"
                  : ""
              }`}
              style={{
                background: c ?? "transparent",
                borderColor: c ?? "rgba(0,0,0,0.2)",
              }}
              title={c ?? "Sem cor"}
            >
              {c === null && <X className="size-3.5 text-muted-foreground" />}
            </button>
          ))}
          <input
            type="color"
            value={borderColor ?? "#7c3aed"}
            onChange={(e) => setBorderColor(e.target.value)}
            className="size-8 rounded-md cursor-pointer border"
            title="Escolher cor personalizada"
          />
        </div>
      </div>

      {/* ── Imagem de fundo + sliders ─────────────────────────── */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Imagem de fundo (com desfoque)
        </label>
        {bgImage ? (
          <>
            <div className="relative h-40 rounded-md overflow-hidden border bg-background">
              <div className="absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bgPreviewUrl}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    filter: `blur(${bgBlur}px)`,
                    transform: "scale(1.1)",
                    opacity: bgOpacity / 100,
                  }}
                />
              </div>
              <div className="absolute inset-0 flex items-end p-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBgImage(null)}
                  type="button"
                >
                  <X className="size-3 mr-1" />
                  Remover
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">Desfoque</label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {bgBlur}px
                </span>
              </div>
              <Slider
                min={0}
                max={30}
                step={1}
                value={[bgBlur]}
                onValueChange={(v) => setBgBlur(v[0] ?? 0)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">Transparência</label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {bgOpacity}%
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[bgOpacity]}
                onValueChange={(v) => setBgOpacity(v[0] ?? 0)}
              />
            </div>
          </>
        ) : (
          <div className="border rounded-md p-3 bg-background">
            <Uploader
              fileTypeAccepted="image"
              onConfirm={(key) => setBgImage(key)}
            />
            <p className="text-[11px] text-muted-foreground mt-2 inline-flex items-center gap-1">
              <ImageLucide className="size-3" />
              A imagem aceita desfoque e transparência configuráveis após o upload.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={mutate.isPending}>
          {mutate.isPending && <Spinner className="size-4 mr-2" />}
          Salvar aparência
        </Button>
      </div>
    </div>
  );
}
