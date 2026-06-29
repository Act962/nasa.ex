"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MessageCircle,
  PaletteIcon,
  ImageIcon,
  RotateCcwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useUserChatPreferences,
  useUpdateUserChatPreferences,
} from "../hooks/use-user-chat-preferences";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { getContrastingTextColor } from "../lib/contrast";
import { Slider } from "@/components/ui/slider";

/**
 * Seção de Personalização → Aparência do Chat (USER-LEVEL).
 *
 * Renderiza inline dentro do tab "Personalização" do settings. Diferente
 * de `CardAppearanceSection` (que é org/tracking-level), aqui as
 * preferências são por USUÁRIO — cada atendente customiza o próprio chat
 * sem afetar os colegas.
 *
 * Campos:
 *  - Fundo do chat: default (padrão WhatsApp) / cor sólida / imagem URL
 *  - Cor de fundo das bolhas próprias (verde-WhatsApp por default)
 *  - Cor de fundo das bolhas recebidas (branco por default)
 *
 * Aplicado nos componentes `Body` (tracking-chat) e `InChatWindow` (in-chat)
 * via CSS vars injetadas no scope do container.
 */

const DEFAULT_OWN_COLOR = "#d9fdd3"; // verde-WhatsApp claro
const DEFAULT_THEIR_COLOR = "#ffffff"; // branco

export function ChatAppearanceSection() {
  const { data, isLoading } = useUserChatPreferences();
  const update = useUpdateUserChatPreferences();

  // Estado local pra controlar inputs (commit no botão Salvar)
  const [bgType, setBgType] = useState<"default" | "color" | "image">(
    "default",
  );
  const [bgValue, setBgValue] = useState<string>("");
  const [bgOpacity, setBgOpacity] = useState<number>(100);
  const [ownColor, setOwnColor] = useState<string>(DEFAULT_OWN_COLOR);
  const [theirColor, setTheirColor] = useState<string>(DEFAULT_THEIR_COLOR);

  // Cores de texto auto-calculadas (WCAG luminance) — atualizam em tempo
  // real conforme user mexe nos color pickers. Mesma lógica que a
  // `message-box.tsx` usa em runtime, garantindo que o preview reflita
  // exatamente o que ele vai ver no chat real.
  const ownTextColor =
    getContrastingTextColor(ownColor) ?? "#18181b";
  const theirTextColor =
    getContrastingTextColor(theirColor) ?? "#18181b";

  // URL pública da imagem de fundo (quando bgType=image e bgValue=R2 key)
  const bgPreviewUrl = useConstructUrl(bgValue);

  // Sincroniza estado local quando os dados chegam
  useEffect(() => {
    if (!data) return;
    setBgType(data.chatBackgroundType);
    setBgValue(data.chatBackgroundValue ?? "");
    setBgOpacity(data.chatBackgroundOpacity ?? 100);
    setOwnColor(data.ownMessageBgColor ?? DEFAULT_OWN_COLOR);
    setTheirColor(data.theirMessageBgColor ?? DEFAULT_THEIR_COLOR);
  }, [data]);

  const handleSave = () => {
    update.mutate({
      chatBackgroundType: bgType,
      chatBackgroundValue: bgType === "default" ? null : bgValue || null,
      chatBackgroundOpacity: bgOpacity,
      ownMessageBgColor:
        ownColor === DEFAULT_OWN_COLOR ? null : ownColor,
      theirMessageBgColor:
        theirColor === DEFAULT_THEIR_COLOR ? null : theirColor,
    });
  };

  const handleReset = () => {
    setBgType("default");
    setBgValue("");
    setBgOpacity(100);
    setOwnColor(DEFAULT_OWN_COLOR);
    setTheirColor(DEFAULT_THEIR_COLOR);
    update.mutate({
      chatBackgroundType: "default",
      chatBackgroundValue: null,
      chatBackgroundOpacity: 100,
      ownMessageBgColor: null,
      theirMessageBgColor: null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4" />
          <h3 className="text-lg font-medium">Aparência do Chat</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Personalize o fundo do chat e as cores das mensagens — só pra você
          (não afeta os colegas da empresa).
        </p>
      </div>

      {/* ── Fundo do chat ─────────────────────────────── */}
      <div className="space-y-3">
        <Label>Fundo do chat</Label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: "default", label: "Padrão", icon: PaletteIcon },
              { value: "color", label: "Cor sólida", icon: PaletteIcon },
              { value: "image", label: "Imagem", icon: ImageIcon },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = bgType === opt.value;
            return (
              <Card
                key={opt.value}
                onClick={() => setBgType(opt.value)}
                className={cn(
                  "cursor-pointer p-3 transition-all hover:border-primary",
                  active
                    ? "border-primary ring-2 ring-primary/20 bg-muted/20"
                    : "border-border/50",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "size-4",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
              </Card>
            );
          })}
        </div>

        {bgType === "color" && (
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={bgValue || "#dbe9f7"}
              onChange={(e) => setBgValue(e.target.value)}
              className="w-16 h-9 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={bgValue}
              onChange={(e) => setBgValue(e.target.value)}
              placeholder="#dbe9f7"
              className="flex-1 font-mono text-xs"
            />
          </div>
        )}

        {bgType === "image" && (
          <div className="border rounded-md p-3 bg-background space-y-3">
            <Uploader
              fileTypeAccepted="image"
              onConfirm={(key) => setBgValue(key)}
            />
            {bgValue && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bgPreviewUrl}
                  alt="Pré-visualização do fundo"
                  className="size-12 rounded object-cover border"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">
                    Imagem carregada
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBgValue("")}
                >
                  Remover
                </Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <ImageIcon className="size-3" />
              Arraste e solte uma imagem ou clique pra fazer upload.
            </p>

            {/* Slider de transparência — 0% = totalmente transparente
                (overlay do tema toma conta), 100% = imagem opaca. Default
                100. Aplicado em runtime no wrapper da page do tracking-chat. */}
            <div className="space-y-2 pt-1 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Transparência da imagem</Label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {bgOpacity}%
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[bgOpacity]}
                onValueChange={(v) => setBgOpacity(v[0] ?? 100)}
              />
              <p className="text-[10px] text-muted-foreground">
                Menos opaco mescla com o tema (claro/escuro) por trás.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Cores das mensagens ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Suas mensagens (fundo)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={ownColor}
              onChange={(e) => setOwnColor(e.target.value)}
              className="w-16 h-9 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={ownColor}
              onChange={(e) => setOwnColor(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
          </div>
          {/* Preview da bolha — usa cor de texto auto-contraste (mesma
              regra WCAG aplicada no chat real). User vê em tempo real
              como vai ficar a legibilidade. */}
          <div className="flex justify-end pt-1">
            <div
              className="text-xs rounded-lg px-3 py-2 shadow-sm max-w-[60%]"
              style={{ backgroundColor: ownColor, color: ownTextColor }}
            >
              Como suas mensagens aparecem
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mensagens recebidas (fundo)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={theirColor}
              onChange={(e) => setTheirColor(e.target.value)}
              className="w-16 h-9 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={theirColor}
              onChange={(e) => setTheirColor(e.target.value)}
              className="flex-1 font-mono text-xs"
            />
          </div>
          <div className="flex justify-start pt-1">
            <div
              className="text-xs rounded-lg px-3 py-2 shadow-sm max-w-[60%] border"
              style={{ backgroundColor: theirColor, color: theirTextColor }}
            >
              Como mensagens recebidas aparecem
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={update.isPending || isLoading}
          size="sm"
        >
          {update.isPending ? "Salvando..." : "Salvar personalização"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={update.isPending || isLoading}
        >
          <RotateCcwIcon className="size-3.5" />
          Voltar ao padrão
        </Button>
      </div>
    </div>
  );
}
