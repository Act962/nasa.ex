"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Slider } from "@/components/ui/slider";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useKanbanAppearance } from "@/features/trackings/hooks/use-kanban-appearance";
import {
  Image as ImageLucide,
  KanbanSquare,
  X,
  Square as SquareIcon,
  Columns2,
} from "lucide-react";

/**
 * Lista pequena de cores predefinidas + custom picker, igual ao padrão
 * da seção de aparência do card no dashboard. Primeira entrada (null)
 * = "sem cor" — botão X.
 */
const PRESET_COLORS: (string | null)[] = [
  null,
  "#0f172a", // slate-900
  "#1e293b", // slate-800
  "#1f2937", // gray-800
  "#7c3aed", // purple-600
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#ec4899", // pink-500
];

/**
 * Seção de Personalização → Aparência do Kanban. Permite configurar
 * cores de cards de lead, colunas de status, e o fundo do canvas do
 * tracking (com imagem + blur + opacidade mesclados com a cor base).
 */
export function KanbanAppearanceSection({
  trackingId,
}: {
  trackingId: string;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useKanbanAppearance(trackingId);

  const [cardBg, setCardBg] = useState<string | null>(null);
  const [cardBorder, setCardBorder] = useState<string | null>(null);
  const [cardOpacity, setCardOpacity] = useState<number>(100);
  const [colBg, setColBg] = useState<string | null>(null);
  const [colBorder, setColBorder] = useState<string | null>(null);
  const [colOpacity, setColOpacity] = useState<number>(100);
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgBlur, setBgBlur] = useState<number>(0);
  const [bgOpacity, setBgOpacity] = useState<number>(50);

  // Re-sync após fetch / mutation.
  useEffect(() => {
    if (!data) return;
    setCardBg(data.kanbanCardBackgroundColor);
    setCardBorder(data.kanbanCardBorderColor);
    setCardOpacity(data.kanbanCardBackgroundOpacity);
    setColBg(data.kanbanColumnBackgroundColor);
    setColBorder(data.kanbanColumnBorderColor);
    setColOpacity(data.kanbanColumnBackgroundOpacity);
    setBgColor(data.kanbanBackgroundColor);
    setBgImage(data.kanbanBackgroundImage);
    setBgBlur(data.kanbanBackgroundBlur);
    setBgOpacity(data.kanbanBackgroundOpacity);
  }, [data]);

  const bgPreviewUrl = useConstructUrl(bgImage || "");

  const mutate = useMutation(
    orpc.tracking.update.mutationOptions({
      onSuccess: () => {
        toast.success("Aparência do Kanban atualizada");
        queryClient.invalidateQueries({
          queryKey: orpc.tracking.getKanbanAppearance.queryKey({
            input: { trackingId },
          }),
        });
      },
      onError: (err) => toast.error(err?.message || "Falha ao salvar"),
    }),
  );

  function save() {
    mutate.mutate({
      trackingId,
      kanbanCardBackgroundColor: cardBg,
      kanbanCardBorderColor: cardBorder,
      kanbanCardBackgroundOpacity: cardOpacity,
      kanbanColumnBackgroundColor: colBg,
      kanbanColumnBorderColor: colBorder,
      kanbanColumnBackgroundOpacity: colOpacity,
      kanbanBackgroundColor: bgColor,
      kanbanBackgroundImage: bgImage,
      kanbanBackgroundBlur: bgBlur,
      kanbanBackgroundOpacity: bgOpacity,
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
          <KanbanSquare className="size-4" />
          <h3 className="text-lg font-medium">Aparência do Kanban</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure as cores dos cards de lead, das colunas de status e do
          fundo do tracking. Opcionalmente adicione uma imagem de fundo com
          desfoque e transparência mesclados com a cor.
        </p>
      </div>

      {/* ── Cards dos leads ──────────────────────────────────────── */}
      <div className="rounded-md border bg-background/40 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <SquareIcon className="size-4" />
          <h4 className="text-sm font-semibold">Cards do lead</h4>
        </div>
        <ColorRow
          label="Fundo do card"
          value={cardBg}
          onChange={setCardBg}
        />
        <ColorRow
          label="Contorno do card"
          value={cardBorder}
          onChange={setCardBorder}
        />
        {/* Slider de transparência — só faz sentido quando há cor de
            fundo definida. Sem cor, o card herda o fallback do tema
            (bg-muted) e o slider fica desabilitado. */}
        <OpacityRow
          label="Transparência do card"
          value={cardOpacity}
          onChange={setCardOpacity}
          disabled={!cardBg}
        />
      </div>

      {/* ── Colunas de status ──────────────────────────────────── */}
      <div className="rounded-md border bg-background/40 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Columns2 className="size-4" />
          <h4 className="text-sm font-semibold">Colunas de status</h4>
        </div>
        <ColorRow
          label="Fundo da coluna"
          value={colBg}
          onChange={setColBg}
        />
        <ColorRow
          label="Contorno da coluna"
          value={colBorder}
          onChange={setColBorder}
        />
        <OpacityRow
          label="Transparência da coluna"
          value={colOpacity}
          onChange={setColOpacity}
          disabled={!colBg}
        />
      </div>

      {/* ── Fundo do tracking (canvas) ─────────────────────────── */}
      <div className="rounded-md border bg-background/40 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <KanbanSquare className="size-4" />
          <h4 className="text-sm font-semibold">Fundo do tracking</h4>
        </div>
        <ColorRow
          label="Cor de fundo"
          value={bgColor}
          onChange={setBgColor}
        />

        {/* Imagem + sliders */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Imagem de fundo (mesclada com a cor)
          </label>
          {bgImage ? (
            <>
              <div
                className="relative h-40 rounded-md overflow-hidden border"
                style={{ backgroundColor: bgColor ?? "transparent" }}
              >
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
                  <label className="text-sm font-medium">
                    Transparência (mesclagem com a cor)
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
            <div className="border rounded-md p-3 bg-background">
              <Uploader
                fileTypeAccepted="image"
                onConfirm={(key) => setBgImage(key)}
              />
              <p className="text-[11px] text-muted-foreground mt-2 inline-flex items-center gap-1">
                <ImageLucide className="size-3" />
                A imagem aceita desfoque e transparência após o upload,
                mesclando com a cor de fundo escolhida.
              </p>
            </div>
          )}
        </div>
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

/**
 * Linha de slider de transparência (0-100%). Layout idêntico ao slider
 * "Transparência" da seção "Fundo do tracking". `disabled` é usado pra
 * desabilitar quando a cor de fundo correspondente é `null` (sem cor)
 * — opacidade não tem efeito sem uma cor base.
 */
function OpacityRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          className={`text-sm font-medium ${disabled ? "text-muted-foreground" : ""}`}
        >
          {label}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value}%
        </span>
      </div>
      <Slider
        min={0}
        max={100}
        step={5}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? 0)}
        disabled={disabled}
      />
      {disabled && (
        <p className="text-[11px] text-muted-foreground">
          Selecione uma cor de fundo para configurar a transparência.
        </p>
      )}
    </div>
  );
}

/**
 * Linha de seleção de cor — paleta predefinida + custom picker + botão
 * "sem cor". Reusada nas 5 cores configuráveis (card bg/border, column
 * bg/border, canvas bg).
 */
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_COLORS.map((c, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onChange(c)}
            className={`size-8 rounded-md border-2 flex items-center justify-center transition-all ${
              value === c ? "ring-2 ring-offset-2 ring-foreground/30" : ""
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
          value={value ?? "#7c3aed"}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 rounded-md cursor-pointer border"
          title="Escolher cor personalizada"
        />
      </div>
    </div>
  );
}
