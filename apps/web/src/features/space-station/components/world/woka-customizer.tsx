"use client";

/**
 * WokaCustomizer — avatar selector matching WorkAdventure's Woka UI.
 * Uses Pipoya spritesheets (96×128px, 3 cols × 4 rows, 32×32 per frame).
 * Body tab = full-character selection. Other tabs = coming soon.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Shuffle, RotateCcw, Upload, X } from "lucide-react";
import type { AvatarConfig } from "../../types";
import { AVATAR_SCALE_DEFAULT, AVATAR_SCALE_MAX, AVATAR_SCALE_MIN } from "../../types";
import { useListAvatarTemplates } from "../../hooks/use-station";
import { buildCompositeSpritesheet } from "../../utils/composite-spritesheet";
import { buildFaceOnPipoyaSprite } from "../../utils/composite-face-pipoya";
import { portraitToPipoya } from "../../utils/portrait-to-pipoya";

/* ─── Asset catalogue ────────────────────────────────────────────────────── */
interface WokaTexture { id: string; url: string; label: string }
interface WokaGroup   { label: string; textures: WokaTexture[] }

function buildBodyGroups(): WokaGroup[] {
  const female: WokaTexture[] = [];
  const male:   WokaTexture[] = [];

  for (let i = 1; i <= 25; i++) {
    const id = String(i).padStart(2, "0");
    female.push({ id: `f${id}-1`, url: `/woka/pipoya/Female ${id}-1.png`, label: `F${id}` });
  }
  for (let i = 1; i <= 22; i++) {
    const id = String(i).padStart(2, "0");
    for (let v = 2; v <= 4; v++)
      female.push({ id: `f${id}-${v}`, url: `/woka/pipoya/Female ${id}-${v}.png`, label: `F${id}-${v}` });
  }
  for (let i = 1; i <= 25; i++) {
    const id = String(i).padStart(2, "0");
    male.push({ id: `m${id}-1`, url: `/woka/pipoya/Male ${id}-1.png`, label: `M${id}` });
  }
  for (let i = 1; i <= 17; i++) {
    const id = String(i).padStart(2, "0");
    for (let v = 2; v <= 4; v++)
      male.push({ id: `m${id}-${v}`, url: `/woka/pipoya/Male ${id}-${v}.png`, label: `M${id}-${v}` });
  }

  return [
    { label: "Feminino",  textures: female },
    { label: "Masculino", textures: male   },
  ];
}

const BODY_GROUPS = buildBodyGroups();
const ALL_TEXTURES = BODY_GROUPS.flatMap(g => g.textures);

/* ─── WorkAdventure customisation assets ─────────────────────────────────
 * Assets served from WorkAdventure's public CDN (96×128 RGBA, same format
 * as Pipoya so compositing works directly).
 * Verified ranges (2026-04):
 *   eyes        character_eyes1.png       1–34
 *   hairs       character_hairs0.png      0–73
 *   clothes     character_clothes0.png    0–69
 *   accessories character_accessories1.png 1–32
 *   hats        character_hats0.png       0–26
 * ------------------------------------------------------------------------- */
const WOKA_CDN = "https://play.workadventu.re/resources/customisation";

function buildRange(
  dir: string,
  prefix: string,
  from: number,
  to: number,
  idPrefix: string,
  labelPrefix: string,
): WokaTexture[] {
  const out: WokaTexture[] = [];
  for (let n = from; n <= to; n++) {
    out.push({
      id:    `${idPrefix}_${n}`,
      url:   `${WOKA_CDN}/${dir}/${prefix}${n}.png`,
      label: `${labelPrefix} ${n}`,
    });
  }
  return out;
}

function buildEyesGroups(): WokaGroup[] {
  return [{ label: "Olhos", textures: buildRange("character_eyes", "character_eyes", 1, 34, "eye", "Olho") }];
}

function buildHairGroups(): WokaGroup[] {
  return [{ label: "Cabelos", textures: buildRange("character_hairs", "character_hairs", 0, 73, "hair", "Cabelo") }];
}

function buildClothesGroups(): WokaGroup[] {
  return [{ label: "Roupas", textures: buildRange("character_clothes", "character_clothes", 0, 69, "clothes", "Roupa") }];
}

function buildHatGroups(): WokaGroup[] {
  return [{ label: "Chapéus", textures: buildRange("character_hats", "character_hats", 0, 26, "hat", "Chapéu") }];
}

function buildAccessoryGroups(): WokaGroup[] {
  return [{ label: "Acessórios", textures: buildRange("character_accessories", "character_accessories", 1, 32, "acc", "Acessório") }];
}

const EYES_GROUPS     = buildEyesGroups();
const HAIR_GROUPS     = buildHairGroups();
const CLOTHES_GROUPS  = buildClothesGroups();
const HAT_GROUPS      = buildHatGroups();
const ACCESSORY_GROUPS = buildAccessoryGroups();

const GROUPS_BY_TAB: Record<Exclude<TabId, "body" | "custom" | "comunidade">, WokaGroup[]> = {
  eyes:      EYES_GROUPS,
  hair:      HAIR_GROUPS,
  clothes:   CLOTHES_GROUPS,
  hat:       HAT_GROUPS,
  accessory: ACCESSORY_GROUPS,
};

/* ─── Tabs ───────────────────────────────────────────────────────────────── */
export type WokaTabId = "body" | "eyes" | "hair" | "clothes" | "hat" | "accessory" | "custom" | "comunidade";
type TabId = WokaTabId;

export const WOKA_TABS: { id: WokaTabId; label: string; icon: string; available: boolean }[] = [
  { id: "body",       label: "Body",       icon: "🧍", available: true },
  { id: "eyes",       label: "Eyes",       icon: "👀", available: true },
  { id: "hair",       label: "Hair",       icon: "💇", available: true },
  { id: "clothes",    label: "Clothes",    icon: "👕", available: true },
  { id: "hat",        label: "Hat",        icon: "🎩", available: true },
  { id: "accessory",  label: "Accessory",  icon: "📎", available: true },
  { id: "custom",     label: "Meu Sprite", icon: "📤", available: true },
  { id: "comunidade", label: "Comunidade", icon: "🌍", available: true },
];

/* ─── Animated preview canvas ────────────────────────────────────────────── */
const FW = 32, FH = 32;
const DIR_ROWS = [0, 1, 3, 2]; // down, left, up, right

interface PreviewCanvasProps {
  url:       string | null;
  dirIdx:    number;
  eyes?:     string | null;
  hair?:     string | null;
  clothes?:  string | null;
  hat?:      string | null;
  accessory?: string | null;
}

function PreviewCanvas({ url, dirIdx, eyes, hair, clothes, hat, accessory }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLCanvasElement | null>(null);
  const rafRef    = useRef(0);
  const tickRef   = useRef(0);
  const frameRef  = useRef(0);
  const SIZE = 128;

  // Rebuild composite whenever any layer changes
  useEffect(() => {
    if (!url) { imgRef.current = null; return; }
    let cancelled = false;
    buildCompositeSpritesheet({ base: url, eyes, hair, clothes, hat, accessory })
      .then((canvas) => { if (!cancelled) imgRef.current = canvas; });
    return () => { cancelled = true; imgRef.current = null; };
  }, [url, eyes, hair, clothes, hat, accessory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const row = DIR_ROWS[dirIdx % 4];

    const loop = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      const composite = imgRef.current;
      if (composite) {
        tickRef.current++;
        if (tickRef.current % 10 === 0) frameRef.current = (frameRef.current + 1) % 3;
        // Auto-detect frame size of the composite (matches the base)
        const pipoya = composite.width <= 96;
        const fw = pipoya ? FW : 64;
        ctx.drawImage(composite, frameRef.current * fw, row * fw, fw, fw, 0, 0, SIZE, SIZE);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dirIdx]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE} height={SIZE}
      className="rounded-lg"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

/* ─── Thumbnail canvas ───────────────────────────────────────────────────── */
/**
 * Renders the idle-down frame (col=1, row=0) of a spritesheet. Works for both
 * Pipoya (96×128 → 32×32 frames) and LPC (64×64 → varies) formats by
 * auto-detecting the frame width from the image dimensions.
 */
function Thumbnail({ url, selected }: { url: string; selected: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SIZE = 60;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      // Detect format: Pipoya is 96×128 (32×32 frames), LPC is wider (64×64).
      // Take the idle/front frame (col=1 for Pipoya, col=0 for LPC walk-down row).
      const pipoya = img.naturalWidth <= 96;
      const fw = pipoya ? FW : 64;
      const col = pipoya ? 1 : 0;
      const row = pipoya ? 0 : (img.naturalHeight >= 64 ? 2 : 0);
      ctx.drawImage(img, col * fw, row * fw, fw, fw, 0, 0, SIZE, SIZE);
    };
    img.onerror = () => {
      // Graceful fallback — draw a subtle placeholder so missing assets
      // don't break the grid visually.
      ctx.fillStyle = "#2a3050";
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "#475569";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("?", SIZE / 2, SIZE / 2 + 3);
    };
    img.src = url;
  }, [url]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE} height={SIZE}
      className={`rounded-xl cursor-pointer transition-all ${
        selected
          ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#1a1f2e]"
          : "opacity-70 hover:opacity-100"
      }`}
      style={{ imageRendering: "pixelated", width: SIZE, height: SIZE }}
    />
  );
}

/* ─── Portrait → Pipoya auto-converter ──────────────────────────────────── */
async function convertToPipoya(
  file: File,
): Promise<{ ok: true; blob: Blob; objectUrl: string } | { ok: false; error: string }> {
  try {
    const blob      = await portraitToPipoya(file);
    const objectUrl = URL.createObjectURL(blob);
    return { ok: true, blob, objectUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha na conversão." };
  }
}

/* ─── CustomUploadTab ────────────────────────────────────────────────────── */
type CustomUploadState = "idle" | "validating" | "previewing" | "uploading" | "done" | "error";

interface CustomUploadTabProps {
  state:         CustomUploadState;
  error:         string | null;
  previewUrl:    string | null;
  faceApplied:   boolean;
  dirIdx:        number;
  overlays:      Record<Exclude<TabId, "body" | "custom" | "comunidade">, string | null>;
  onFileSelect:  (f: File) => void;
  onFaceSelect:  (f: File) => void;
  onRemoveFace:  () => void;
  onUpload:      () => void;
  onReset:       () => void;
}

function CustomUploadTab({
  state, error, previewUrl, faceApplied, dirIdx, overlays,
  onFileSelect, onFaceSelect, onRemoveFace, onUpload, onReset,
}: CustomUploadTabProps) {
  const spriteInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef   = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  const showDropZone  = state === "idle" || state === "error";
  const showPreview   = state === "previewing" || state === "uploading" || state === "done";

  return (
    <div className="flex flex-col gap-3 p-1">
      {/* Instruções */}
      <div className="text-[10px] text-slate-400 leading-relaxed bg-white/4 rounded-xl px-3 py-2.5">
        <p className="font-semibold text-slate-300 mb-1">Sprite personalizado</p>
        <p>Envie <span className="text-indigo-300">qualquer foto ou imagem</span> — ela será convertida automaticamente para o formato Pipoya com animações de caminhada.</p>
      </div>

      {/* Drop zone */}
      {showDropZone && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => spriteInputRef.current?.click()}
          className="border-2 border-dashed border-white/15 hover:border-indigo-400/60 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-all"
        >
          <Upload className="h-5 w-5 text-slate-400" />
          <p className="text-[11px] text-slate-400 text-center leading-snug">
            Arraste uma imagem aqui<br />ou clique para selecionar
          </p>
          <input
            ref={spriteInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onFileSelect(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* Convertendo */}
      {state === "validating" && (
        <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs">
          <span className="animate-spin inline-block">⟳</span> Convertendo para Pipoya...
        </div>
      )}

      {/* Erro */}
      {state === "error" && error && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3 text-[11px] text-red-300 leading-snug">
          {error}
        </div>
      )}

      {/* Preview + confirmação */}
      {showPreview && previewUrl && (
        <div className="flex flex-col items-center gap-3">
          <PreviewCanvas
            url={previewUrl}
            dirIdx={dirIdx}
            eyes={overlays.eyes}
            hair={overlays.hair}
            clothes={overlays.clothes}
            hat={overlays.hat}
            accessory={overlays.accessory}
          />

          {state === "previewing" && (
            <>
              <p className="text-[10px] text-green-400 text-center">Sprite gerado com animações de caminhada!</p>
              <div className="flex gap-2 w-full">
                <button onClick={onReset} className="flex-1 py-2 rounded-xl bg-white/6 hover:bg-white/10 text-[11px] font-medium text-slate-300 border border-white/8 transition-all">
                  Cancelar
                </button>
                <button onClick={onUpload} className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold text-white transition-all">
                  Fazer Upload
                </button>
              </div>
            </>
          )}

          {state === "uploading" && (
            <p className="text-[10px] text-indigo-300 animate-pulse text-center">Enviando...</p>
          )}

          {state === "done" && (
            <>
              <p className="text-[10px] text-green-400 text-center">
                Sprite ativo. Clique em &ldquo;Trocar arquivo&rdquo; pra substituir.
              </p>
              <button onClick={onReset} className="w-full py-2 rounded-xl bg-white/6 hover:bg-white/10 text-[11px] text-slate-300 border border-white/8 transition-all">
                Trocar arquivo
              </button>
            </>
          )}
        </div>
      )}

      {/* Seção foto de rosto — disponível após sprite carregado */}
      {(state === "previewing" || state === "done") && (
        <div className="border-t border-white/8 pt-3 flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-slate-300">📸 Foto de Rosto <span className="text-slate-500 font-normal">(opcional)</span></p>
          <p className="text-[10px] text-slate-500 leading-snug">A foto será aplicada na região da cabeça de cada frame.</p>

          {!faceApplied ? (
            <div
              onClick={() => faceInputRef.current?.click()}
              className="border border-dashed border-white/15 hover:border-indigo-400/60 rounded-xl p-3 flex items-center gap-2 cursor-pointer transition-all"
            >
              <span className="text-base">🖼️</span>
              <span className="text-[11px] text-slate-400">Selecionar foto de rosto</span>
              <input
                ref={faceInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) onFaceSelect(file);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-green-900/20 border border-green-500/20 rounded-xl px-3 py-2">
              <span className="text-[11px] text-green-300 flex-1">Rosto aplicado ✓</span>
              <button onClick={onRemoveFace} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Props ──────────────────────────────────────────────────────────────── */
interface Props {
  avatarConfig?: AvatarConfig;
  onChange: (partial: Partial<AvatarConfig>) => void;
  onClose: () => void;
  /** Quando definido, usa esta tab em vez do estado interno e esconde a
   *  barra de tabs (o pai controla a navegação). */
  externalTab?: WokaTabId;
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export function WokaCustomizer({ avatarConfig, onChange, onClose, externalTab }: Props) {
  const currentUrl = avatarConfig?.lpcSpritesheetUrl;
  // Accept any saved URL (Pipoya, /uploads/, or external) as the initial preview
  const initialUrl =
    currentUrl && !currentUrl.startsWith("pixel_")
      ? currentUrl
      : ALL_TEXTURES[0].url;

  const [selectedUrl, setSelectedUrl] = useState(initialUrl);
  const [internalTab, setInternalTab] = useState<TabId>("body");
  const tab = externalTab ?? internalTab;
  const setTab = (id: TabId) => {
    if (externalTab === undefined) setInternalTab(id);
  };
  const [dirIdx, setDirIdx] = useState(0);

  const [overlays, setOverlays] = useState<Record<Exclude<TabId, "body" | "custom" | "comunidade">, string | null>>({
    eyes:      avatarConfig?.wokaEyesUrl      ?? null,
    hair:      avatarConfig?.wokaHairUrl      ?? null,
    clothes:   avatarConfig?.wokaClothesUrl   ?? null,
    hat:       avatarConfig?.wokaHatUrl       ?? null,
    accessory: avatarConfig?.wokaAccessoryUrl ?? null,
  });

  // ── Tamanho do avatar (multiplicador 0.5–2.5) ────────────────────────────
  const initialScale = (() => {
    const v = avatarConfig?.avatarScale;
    if (typeof v !== "number" || !Number.isFinite(v)) return AVATAR_SCALE_DEFAULT;
    return Math.max(AVATAR_SCALE_MIN, Math.min(AVATAR_SCALE_MAX, v));
  })();
  const [avatarScale, setAvatarScale] = useState<number>(initialScale);
  const finishedRef = useRef(false);

  // Dispatch live preview event sempre que o slider muda — Phaser reescala em tempo real
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("space-station:avatar-scale", {
      detail: { scale: avatarScale },
    }));
  }, [avatarScale]);

  // Ao desmontar sem clicar em "Terminar", restaura a escala original.
  // Se o usuário concluiu (finishedRef=true), a nova escala já foi aplicada via onChange.
  useEffect(() => {
    return () => {
      if (finishedRef.current) return;
      window.dispatchEvent(new CustomEvent("space-station:avatar-scale", {
        detail: { scale: initialScale },
      }));
    };
    // initialScale só lido no momento do cleanup — sem dep array com side-effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Custom upload state ───────────────────────────────────────────────────
  const existingCustomUrl = currentUrl?.startsWith("/uploads/") ? currentUrl : null;
  const [customState, setCustomState] = useState<CustomUploadState>(existingCustomUrl ? "done" : "idle");
  const [customError, setCustomError] = useState<string | null>(null);
  const [customPreviewUrl, setCustomPreviewUrl] = useState<string | null>(existingCustomUrl ?? null);
  const [faceApplied, setFaceApplied] = useState(false);
  const customObjectUrlRef   = useRef<string | null>(null); // blob URL do sprite antes do upload
  const faceObjectUrlRef     = useRef<string | null>(null); // blob URL da foto de rosto
  const compositeWithFaceRef = useRef<string | null>(null); // sprite + rosto (para upload)
  const customFileRef        = useRef<File | null>(null);
  const convertedBlobRef     = useRef<Blob | null>(null);   // Pipoya blob gerado pelo conversor

  // Cleanup object URLs no unmount
  useEffect(() => {
    return () => {
      if (customObjectUrlRef.current)   URL.revokeObjectURL(customObjectUrlRef.current);
      if (faceObjectUrlRef.current)     URL.revokeObjectURL(faceObjectUrlRef.current);
      if (compositeWithFaceRef.current) URL.revokeObjectURL(compositeWithFaceRef.current);
      convertedBlobRef.current = null;
    };
  }, []);

  const handleCustomFileSelect = useCallback(async (file: File) => {
    if (customObjectUrlRef.current)   { URL.revokeObjectURL(customObjectUrlRef.current);   customObjectUrlRef.current   = null; }
    if (faceObjectUrlRef.current)     { URL.revokeObjectURL(faceObjectUrlRef.current);     faceObjectUrlRef.current     = null; }
    if (compositeWithFaceRef.current) { URL.revokeObjectURL(compositeWithFaceRef.current); compositeWithFaceRef.current = null; }
    customFileRef.current    = null;
    convertedBlobRef.current = null;
    setFaceApplied(false);
    setCustomState("validating");
    setCustomError(null);
    setCustomPreviewUrl(null);

    const result = await convertToPipoya(file);
    if (!result.ok) {
      setCustomState("error");
      setCustomError(result.error);
      return;
    }

    customObjectUrlRef.current = result.objectUrl;
    convertedBlobRef.current   = result.blob;
    customFileRef.current      = file;
    setCustomPreviewUrl(result.objectUrl);
    setSelectedUrl(result.objectUrl);
    setCustomState("previewing");
  }, []);

  const handleFaceSelect = useCallback(async (file: File) => {
    const baseUrl = customObjectUrlRef.current ?? customPreviewUrl;
    if (!baseUrl) return;

    const faceUrl = URL.createObjectURL(file);
    if (faceObjectUrlRef.current) URL.revokeObjectURL(faceObjectUrlRef.current);
    if (compositeWithFaceRef.current) URL.revokeObjectURL(compositeWithFaceRef.current);
    faceObjectUrlRef.current = faceUrl;

    try {
      const compositeUrl = await buildFaceOnPipoyaSprite(baseUrl, faceUrl);
      compositeWithFaceRef.current = compositeUrl;
      setSelectedUrl(compositeUrl);
      setCustomPreviewUrl(compositeUrl);
      setFaceApplied(true);
    } catch {
      URL.revokeObjectURL(faceUrl);
      faceObjectUrlRef.current = null;
    }
  }, [customPreviewUrl]);

  const handleRemoveFace = useCallback(() => {
    if (faceObjectUrlRef.current)     { URL.revokeObjectURL(faceObjectUrlRef.current);     faceObjectUrlRef.current     = null; }
    if (compositeWithFaceRef.current) { URL.revokeObjectURL(compositeWithFaceRef.current); compositeWithFaceRef.current = null; }
    setFaceApplied(false);
    const base = customObjectUrlRef.current;
    if (base) { setSelectedUrl(base); setCustomPreviewUrl(base); }
  }, []);

  const handleCustomUpload = useCallback(async () => {
    setCustomState("uploading");
    try {
      // Upload the composite-with-face blob if face was applied, else the converted Pipoya blob
      let fileToUpload: Blob;
      if (compositeWithFaceRef.current) {
        const resp = await fetch(compositeWithFaceRef.current);
        fileToUpload = await resp.blob();
      } else if (convertedBlobRef.current) {
        fileToUpload = convertedBlobRef.current;
      } else {
        throw new Error("Nenhum arquivo para enviar.");
      }

      const formData = new FormData();
      formData.append("file", fileToUpload, "custom-sprite.png");

      const res = await fetch("/api/upload-local", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const { url } = await res.json() as { url: string };

      // Revogar blobs locais
      if (customObjectUrlRef.current)   { URL.revokeObjectURL(customObjectUrlRef.current);   customObjectUrlRef.current   = null; }
      if (faceObjectUrlRef.current)     { URL.revokeObjectURL(faceObjectUrlRef.current);     faceObjectUrlRef.current     = null; }
      if (compositeWithFaceRef.current) { URL.revokeObjectURL(compositeWithFaceRef.current); compositeWithFaceRef.current = null; }
      customFileRef.current    = null;
      convertedBlobRef.current = null;

      setCustomPreviewUrl(url);
      setSelectedUrl(url);
      setCustomState("done");

      // Auto-Terminar: o user fez upload do sprite custom — intenção explícita.
      // Aplica no preview do mundo + marca avatarDirty pro Salvar do painel
      // gravar tudo. NÃO fecha o painel (keepOpen=true) — onClose seria
      // requestClose, que dispararia o modal "Salvar alterações?" confuso.
      // User continua vendo o sprite ativo no preview e clica Salvar no rodapé.
      handleFinish(url, true);
    } catch (err) {
      setCustomState("error");
      setCustomError(err instanceof Error ? err.message : "Falha no upload.");
      setSelectedUrl(initialUrl);
    }
    // handleFinish é redefinido a cada render mas usá-lo aqui sem dep não causa
    // bug — handleCustomUpload só roda em resposta a click, depois do render
    // que declarou a versão atual de handleFinish.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  const handleCustomReset = useCallback(() => {
    if (customObjectUrlRef.current)   { URL.revokeObjectURL(customObjectUrlRef.current);   customObjectUrlRef.current   = null; }
    if (faceObjectUrlRef.current)     { URL.revokeObjectURL(faceObjectUrlRef.current);     faceObjectUrlRef.current     = null; }
    if (compositeWithFaceRef.current) { URL.revokeObjectURL(compositeWithFaceRef.current); compositeWithFaceRef.current = null; }
    customFileRef.current    = null;
    convertedBlobRef.current = null;
    setCustomPreviewUrl(null);
    setCustomState("idle");
    setCustomError(null);
    setFaceApplied(false);
    setSelectedUrl(initialUrl);
  }, [initialUrl]);

  function selectOverlay(category: Exclude<TabId, "body" | "custom" | "comunidade">, url: string) {
    setOverlays(o => ({ ...o, [category]: o[category] === url ? null : url }));
  }

  const handleRandomize = useCallback(() => {
    const t = ALL_TEXTURES[Math.floor(Math.random() * ALL_TEXTURES.length)];
    setSelectedUrl(t.url);
  }, []);

  // Aplica a config atual no preview (onChange marca avatarDirty no parent).
  // `urlOverride` permite chamar logo após um setSelectedUrl sem ler valor stale.
  // `keepOpen=true` é usado pelo auto-Terminar pós-upload pra NÃO fechar o
  // painel ("onClose" é wired a `requestClose` do WorldSettingsPanel, que
  // fecha o painel inteiro e abre o modal "Salvar?"). Pra upload custom o
  // user só quer ver o sprite aplicado e continuar mexendo.
  const handleFinish = (urlOverride?: string, keepOpen = false) => {
    const finalUrl = urlOverride ?? selectedUrl;
    // Se a URL é um blob: local (sprite gerado mas não enviado ao servidor),
    // o usuário precisa clicar em "Fazer Upload" antes de finalizar.
    if (finalUrl.startsWith("blob:")) {
      alert("Clique em 'Fazer Upload' antes de finalizar para salvar o sprite personalizado.");
      return;
    }
    finishedRef.current = true;
    onChange({
      lpcSpritesheetUrl: finalUrl,
      lpcCharacterName:  undefined,
      wokaEyesUrl:       overlays.eyes,
      wokaHairUrl:       overlays.hair,
      wokaClothesUrl:    overlays.clothes,
      wokaHatUrl:        overlays.hat,
      wokaAccessoryUrl:  overlays.accessory,
      avatarScale:       avatarScale,
    });
    if (!keepOpen) onClose();
  };

  const handleReset = () => {
    finishedRef.current = true;
    // Restaura também a escala visual no Phaser imediatamente
    window.dispatchEvent(new CustomEvent("space-station:avatar-scale", {
      detail: { scale: AVATAR_SCALE_DEFAULT },
    }));
    onChange({
      lpcSpritesheetUrl: undefined,
      lpcCharacterName:  undefined,
      wokaEyesUrl:       null,
      wokaHairUrl:       null,
      wokaClothesUrl:    null,
      wokaHatUrl:        null,
      wokaAccessoryUrl:  null,
      avatarScale:       AVATAR_SCALE_DEFAULT,
    });
    onClose();
  };

  return (
    <div className="flex flex-col h-full bg-[#151929] text-white select-none overflow-hidden">

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left: preview (fixed 148px) ── */}
        <div className="w-[148px] flex-shrink-0 flex flex-col items-center gap-3 pt-4 px-3 pb-3 border-r border-white/8">
          <div
            className="w-28 h-28 rounded-2xl flex items-center justify-center relative overflow-hidden flex-shrink-0"
            style={{ background: "radial-gradient(circle at 50% 40%, #2a3050 0%, #0e1020 100%)" }}
          >
            <PreviewCanvas
              url={selectedUrl}
              dirIdx={dirIdx}
              eyes={overlays.eyes}
              hair={overlays.hair}
              clothes={overlays.clothes}
              hat={overlays.hat}
              accessory={overlays.accessory}
            />
            <button
              onClick={() => setDirIdx(d => (d + 1) % 4)}
              className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
              title="Girar"
            >
              <RotateCcw className="h-3 w-3 text-slate-300" />
            </button>
          </div>

          <button
            onClick={handleRandomize}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 transition-all text-xs font-medium"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Randomizar
          </button>
        </div>

        {/* ── Right: tabs + grid (fills remaining ~236px) ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Tab bar — scrollable horizontally. Escondida quando o pai
              controla a tab (externalTab) — ele renderiza as tabs no header. */}
          {externalTab === undefined && (
            <div className="flex border-b border-white/8 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}>
              {WOKA_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => t.available && setTab(t.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 pt-2.5 pb-2 text-[10px] font-medium transition-all relative ${
                    tab === t.id
                      ? "text-white border-b-2 border-indigo-400 bg-white/5"
                      : t.available
                        ? "text-slate-400 hover:text-slate-200"
                        : "text-slate-600 cursor-not-allowed"
                  }`}
                  title={!t.available ? "Em breve" : t.label}
                >
                  <span className="text-base leading-none">{t.icon}</span>
                  <span>{t.label}</span>
                  {!t.available && (
                    <span className="absolute top-1 right-0.5 text-[7px] bg-slate-700 text-slate-500 px-0.5 rounded leading-tight">soon</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Character grid */}
          <div
            className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#2a3050 transparent" }}
          >
            {tab === "body" && BODY_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-slate-400 mb-2 tracking-wide uppercase">{group.label}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {group.textures.map(tex => (
                    <div key={tex.id} onClick={() => setSelectedUrl(tex.url)}>
                      <Thumbnail url={tex.url} selected={selectedUrl === tex.url} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {tab === "custom" && (
              <CustomUploadTab
                state={customState}
                error={customError}
                previewUrl={customPreviewUrl}
                faceApplied={faceApplied}
                dirIdx={dirIdx}
                overlays={overlays}
                onFileSelect={handleCustomFileSelect}
                onFaceSelect={handleFaceSelect}
                onRemoveFace={handleRemoveFace}
                onUpload={handleCustomUpload}
                onReset={handleCustomReset}
              />
            )}

            {tab === "comunidade" && (
              <AvatarCommunityTab onChange={onChange} />
            )}

            {tab !== "body" && tab !== "custom" && tab !== "comunidade" && (
              <>
                {/* "None" / clear option */}
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 mb-2 tracking-wide uppercase">Nenhum</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setOverlays(o => ({ ...o, [tab]: null }))}
                      className={`w-[60px] h-[60px] rounded-xl border border-dashed transition-all flex items-center justify-center text-[11px] font-medium ${
                        overlays[tab as Exclude<TabId, "body" | "custom" | "comunidade">] === null
                          ? "border-indigo-400 bg-indigo-500/10 text-indigo-300 ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#1a1f2e]"
                          : "border-white/15 text-slate-500 hover:border-white/30 hover:text-slate-300"
                      }`}
                      title="Remover este item"
                    >
                      —
                    </button>
                  </div>
                </div>

                {GROUPS_BY_TAB[tab as Exclude<TabId, "body" | "custom" | "comunidade">].map(group => (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold text-slate-400 mb-2 tracking-wide uppercase">{group.label}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {group.textures.map(tex => (
                        <div key={tex.id} onClick={() => selectOverlay(tab as Exclude<TabId, "body" | "custom" | "comunidade">, tex.url)}>
                          <Thumbnail url={tex.url} selected={overlays[tab as Exclude<TabId, "body" | "custom" | "comunidade">] === tex.url} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tamanho do personagem (slider) ── */}
      <div className="px-4 py-3 border-t border-white/8 bg-[#0f1320] flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-medium text-slate-300 uppercase tracking-wide">
            Tamanho no mapa
          </label>
          <span className="text-xs font-mono text-indigo-300 tabular-nums">
            {avatarScale.toFixed(2)}×
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 select-none">A</span>
          <input
            type="range"
            min={AVATAR_SCALE_MIN}
            max={AVATAR_SCALE_MAX}
            step={0.05}
            value={avatarScale}
            onChange={(e) => setAvatarScale(parseFloat(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer accent-indigo-500"
          />
          <span className="text-base text-slate-400 select-none leading-none">A</span>
          <button
            onClick={() => setAvatarScale(AVATAR_SCALE_DEFAULT)}
            disabled={avatarScale === AVATAR_SCALE_DEFAULT}
            className="text-[10px] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-white/5 transition-colors"
            title="Voltar ao tamanho padrão (1.00×)"
          >
            Reset
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5 leading-snug">
          Ajusta o tamanho visual do seu avatar no mapa. A área de colisão escala junto.
        </p>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex gap-2 px-3 py-3 border-t border-white/8 bg-[#0f1320] flex-shrink-0">
        <button
          onClick={handleReset}
          className="flex-1 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 text-xs font-medium text-slate-300 transition-all border border-white/8 leading-tight"
        >
          Voltar ao personagem padrão
        </button>
        <button
          onClick={() => handleFinish()}
          className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-900/40"
        >
          Terminar
        </button>
      </div>
    </div>
  );
}

/* ─── Avatar Community Tab ───────────────────────────────────────────────── */

function AvatarCommunityTab({ onChange }: { onChange: (partial: Partial<AvatarConfig>) => void }) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListAvatarTemplates({ search: search || undefined });
  const templates = (data?.templates ?? []) as {
    id: string; name: string; spriteUrl: string;
    previewUrl?: string | null; usedCount: number;
    overlays?: Record<string, string | null> | null;
    author: { name: string | null };
  }[];

  function applyTemplate(t: typeof templates[number]) {
    const patch: Partial<AvatarConfig> = {
      lpcSpritesheetUrl: t.spriteUrl,
    };
    if (t.overlays) {
      if ("eyes" in t.overlays)      patch.wokaEyesUrl      = t.overlays.eyes      ?? undefined;
      if ("hair" in t.overlays)      patch.wokaHairUrl      = t.overlays.hair      ?? undefined;
      if ("clothes" in t.overlays)   patch.wokaClothesUrl   = t.overlays.clothes   ?? undefined;
      if ("hat" in t.overlays)       patch.wokaHatUrl       = t.overlays.hat       ?? undefined;
      if ("accessory" in t.overlays) patch.wokaAccessoryUrl = t.overlays.accessory ?? undefined;
    }
    onChange(patch);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Avatares criados pela comunidade NASA</p>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar avatares..."
        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
      />
      {isLoading && <p className="text-xs text-slate-500 text-center py-4">Carregando...</p>}
      {!isLoading && templates.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">Nenhum avatar público encontrado.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => applyTemplate(t)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl border border-white/10 hover:border-indigo-500 hover:bg-indigo-950/50 transition-colors"
          >
            {t.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.previewUrl} alt={t.name} className="w-12 h-12 object-cover rounded-lg" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-indigo-900/30 flex items-center justify-center text-xl">🧍</div>
            )}
            <span className="text-[10px] text-slate-300 text-center leading-tight truncate w-full">{t.name}</span>
            <span className="text-[9px] text-slate-500">{t.author.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
