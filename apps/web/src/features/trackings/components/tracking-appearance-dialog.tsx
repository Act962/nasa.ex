"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Slider } from "@/components/ui/slider";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { Image as ImageLucide, X } from "lucide-react";

const PRESET_COLORS = [
  null,
  "#7c3aed", // roxo (igual ao exemplo)
  "#3b82f6", // azul
  "#10b981", // verde
  "#f59e0b", // âmbar
  "#ef4444", // vermelho
  "#ec4899", // rosa
  "#0ea5e9", // ciano
  "#64748b", // cinza
];

interface TrackingAppearanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingId: string;
  trackingName: string;
  initialBorderColor: string | null;
  initialBackgroundImage: string | null;
  initialBackgroundBlur?: number;
  initialBackgroundOpacity?: number;
}

export function TrackingAppearanceDialog({
  open,
  onOpenChange,
  trackingId,
  trackingName,
  initialBorderColor,
  initialBackgroundImage,
  initialBackgroundBlur = 8,
  initialBackgroundOpacity = 25,
}: TrackingAppearanceDialogProps) {
  const queryClient = useQueryClient();
  const [borderColor, setBorderColor] = useState<string | null>(
    initialBorderColor,
  );
  const [bgImage, setBgImage] = useState<string | null>(initialBackgroundImage);
  const [bgBlur, setBgBlur] = useState<number>(initialBackgroundBlur);
  const [bgOpacity, setBgOpacity] = useState<number>(initialBackgroundOpacity);

  // Re-sincroniza quando o dialog reabre com valores diferentes (caso o
  // usuário edite outro card sem refresh).
  useEffect(() => {
    if (open) {
      setBorderColor(initialBorderColor);
      setBgImage(initialBackgroundImage);
      setBgBlur(initialBackgroundBlur);
      setBgOpacity(initialBackgroundOpacity);
    }
  }, [
    open,
    initialBorderColor,
    initialBackgroundImage,
    initialBackgroundBlur,
    initialBackgroundOpacity,
  ]);

  const bgPreviewUrl = useConstructUrl(bgImage || "");

  const mutate = useMutation(
    orpc.tracking.update.mutationOptions({
      onSuccess: () => {
        toast.success("Aparência atualizada");
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.listDashboard.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.list.queryKey(),
        });
        onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aparência do card</DialogTitle>
          <DialogDescription>
            Personalize a borda e o fundo do card de "{trackingName}" no
            dashboard de Tracking.
          </DialogDescription>
        </DialogHeader>

        {/* ── Borda colorida ────────────────────────────────────── */}
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
            {/* Color picker custom (qualquer hex) */}
            <input
              type="color"
              value={borderColor ?? "#7c3aed"}
              onChange={(e) => setBorderColor(e.target.value)}
              className="size-8 rounded-md cursor-pointer border"
              title="Escolher cor personalizada"
            />
          </div>
        </div>

        {/* ── Imagem de fundo (com blur) ────────────────────────── */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Imagem de fundo (com desfoque)
          </label>
          {bgImage ? (
            <>
              {/* Preview da imagem com blur/opacity APLICADOS — assim o
                  usuário vê em tempo real o efeito antes de salvar. */}
              <div className="relative h-32 rounded-md overflow-hidden border bg-background">
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

              {/* Slider de desfoque */}
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

              {/* Slider de opacidade */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium">
                    Transparência
                  </label>
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
            <div className="border rounded-md p-3 bg-muted/30">
              <Uploader
                fileTypeAccepted="image"
                onConfirm={(key) => setBgImage(key)}
              />
              <p className="text-[11px] text-muted-foreground mt-2 inline-flex items-center gap-1">
                <ImageLucide className="size-3" />
                A imagem aceita desfoque e transparência configuráveis.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutate.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={save} disabled={mutate.isPending}>
            {mutate.isPending && <Spinner className="size-4 mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
