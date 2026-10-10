"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useBotVoiceSample } from "@/features/astro-bot/hooks/use-astro-bot";
import {
  BOT_VOICES,
  DEFAULT_BOT_VOICE,
  type VoiceReplyMode,
} from "@/features/astro-bot/lib/voice/voices";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// Resposta em áudio do Astro no WhatsApp (spec 0083).

export interface VoiceReplySettings {
  mode: VoiceReplyMode;
  voiceName: string;
  alsoText: boolean;
}

export const DEFAULT_VOICE_REPLY_SETTINGS: VoiceReplySettings = {
  mode: "off",
  voiceName: DEFAULT_BOT_VOICE,
  alsoText: true,
};

const MODE_OPTIONS: Array<{ mode: VoiceReplyMode; label: string }> = [
  { mode: "off", label: "Nunca" },
  { mode: "match", label: "Quando eu mandar áudio" },
  { mode: "always", label: "Sempre" },
];

export function BotVoiceReplySettings({
  settings,
  onChange,
}: {
  settings: VoiceReplySettings;
  onChange: (settings: VoiceReplySettings) => void;
}) {
  const voiceSample = useBotVoiceSample();
  const [samplingVoiceName, setSamplingVoiceName] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSample = (voiceName: string) => {
    setSamplingVoiceName(voiceName);
    voiceSample.mutate(
      { voiceName },
      {
        onSuccess: ({ audioDataUrl }) => {
          audioRef.current?.pause();
          audioRef.current = new Audio(audioDataUrl);
          void audioRef.current.play();
        },
        onError: (error) => toast.error(error.message || "Não consegui tocar a amostra"),
        onSettled: () => setSamplingVoiceName(null),
      },
    );
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">Responder em áudio (cobra Stars)</p>
        <p className="text-xs text-muted-foreground">
          O Astro responde com nota de voz. Perguntas com botões, confirmações,
          PIX e links continuam em texto. 1 Star por minuto de áudio.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {MODE_OPTIONS.map((option) => (
          <Button
            key={option.mode}
            type="button"
            size="sm"
            variant={settings.mode === option.mode ? "default" : "outline"}
            className="rounded-full"
            onClick={() => onChange({ ...settings, mode: option.mode })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {settings.mode !== "off" && (
        <>
          <div className="space-y-2">
            {BOT_VOICES.map((voice) => {
              const isSelected = settings.voiceName === voice.name;
              return (
                <div
                  key={voice.name}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border px-3 py-2",
                    isSelected && "border-primary",
                  )}
                >
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-3 text-left"
                    aria-pressed={isSelected}
                    onClick={() => onChange({ ...settings, voiceName: voice.name })}
                  >
                    <span
                      className={cn(
                        "size-4 shrink-0 rounded-full border-2",
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/50",
                      )}
                    />
                    <span>
                      <span className="block text-sm">{voice.label}</span>
                      <span className="block text-xs text-muted-foreground">{voice.description}</span>
                    </span>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-8 shrink-0 rounded-full"
                    aria-label={`Ouvir a voz ${voice.label}`}
                    disabled={voiceSample.isPending}
                    onClick={() => playSample(voice.name)}
                  >
                    {samplingVoiceName === voice.name ? (
                      <OrbitaSpinner className="size-3.5" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Enviar também o texto</p>
              <p className="text-xs text-muted-foreground">
                Depois do áudio chega a mesma resposta escrita, para consultar e pesquisar.
              </p>
            </div>
            <Switch
              checked={settings.alsoText}
              onCheckedChange={(alsoText) => onChange({ ...settings, alsoText })}
            />
          </div>
        </>
      )}
    </div>
  );
}
