"use client";

import { BellIcon, PlayIcon, UploadIcon, Music2Icon, XIcon } from "lucide-react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";
import { useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { useSuspenseParticipants } from "@/features/trackings/hooks/use-trackings";
import {
  SYSTEM_SOUNDS,
  SystemSoundId,
  playSystemSound,
  playCustomSound,
  useSoundNotificationSettings,
} from "../hooks/use-sound-notification";

export function SoundNotification() {
  const params = useParams<{ trackingId: string }>();
  const trackingId = params.trackingId;

  const { data: session } = authClient.useSession();
  const { data: participantsData } = useSuspenseParticipants({ trackingId });

  const currentParticipant = participantsData.participants.find(
    (p) => p.userId === session?.user.id,
  );
  const canUpload =
    currentParticipant?.role === "OWNER" ||
    currentParticipant?.role === "ADMIN";

  const { settings, updateSettings, isLoaded } =
    useSoundNotificationSettings(trackingId);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isLoaded) return null;

  const handleSoundPreview = async (soundId: SystemSoundId) => {
    await playSystemSound(soundId);
  };

  const handleCustomPreview = async () => {
    if (settings.customSoundDataUrl) {
      await playCustomSound(settings.customSoundDataUrl);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/webm"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|webm)$/i)) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      updateSettings({
        customSoundDataUrl: dataUrl,
        customSoundName: file.name,
        selectedSound: "custom",
      });
    };
    reader.readAsDataURL(file);

    // Reset input value so same file can be re-selected
    e.target.value = "";
  };

  const handleRemoveCustom = () => {
    updateSettings({
      customSoundDataUrl: undefined,
      customSoundName: undefined,
      selectedSound: "ding",
    });
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <BellIcon className="size-4" />
          <h2 className="text-xl font-semibold">Notificação sonora</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Configure alertas sonoros para quando um novo lead chegar no tracking
        </p>
      </div>

      <FieldGroup>
        {/* Toggle enable/disable */}
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="sound-enabled">
              Ativar notificação sonora
            </FieldLabel>
            <FieldDescription>
              Reproduz um som sempre que um novo lead for criado neste tracking
            </FieldDescription>
          </FieldContent>
          <Switch
            id="sound-enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSettings({ enabled: checked })}
          />
        </Field>

        <FieldSeparator />

        {/* System sounds selector */}
        <Field>
          <FieldLabel>Sons do sistema</FieldLabel>
          <FieldDescription>
            Escolha um dos sons padrão disponíveis
          </FieldDescription>

          <RadioGroup
            value={settings.selectedSound}
            onValueChange={(value) =>
              updateSettings({ selectedSound: value as SystemSoundId | "custom" })
            }
            className="mt-3 grid gap-2"
            disabled={!settings.enabled}
          >
            {SYSTEM_SOUNDS.map((sound) => (
              <div
                key={sound.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem
                    value={sound.id}
                    id={`sound-${sound.id}`}
                    disabled={!settings.enabled}
                  />
                  <Label
                    htmlFor={`sound-${sound.id}`}
                    className="cursor-pointer font-normal text-sm"
                  >
                    {sound.label}
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={!settings.enabled}
                  onClick={() => handleSoundPreview(sound.id)}
                  title="Pré-visualizar som"
                >
                  <PlayIcon className="size-3.5" />
                </Button>
              </div>
            ))}

            {/* Custom sound option */}
            {settings.customSoundDataUrl && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <RadioGroupItem
                    value="custom"
                    id="sound-custom"
                    disabled={!settings.enabled}
                  />
                  <Label
                    htmlFor="sound-custom"
                    className="cursor-pointer font-normal text-sm flex items-center gap-2"
                  >
                    <Music2Icon className="size-3.5 text-muted-foreground" />
                    <span className="max-w-[180px] truncate">
                      {settings.customSoundName ?? "Som personalizado"}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Personalizado
                    </Badge>
                  </Label>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={!settings.enabled}
                    onClick={handleCustomPreview}
                    title="Pré-visualizar som"
                  >
                    <PlayIcon className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={handleRemoveCustom}
                    title="Remover som"
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </RadioGroup>
        </Field>

        {/* Custom upload — only OWNER or ADMIN */}
        {canUpload && (
          <>
            <FieldSeparator />
            <Field>
              <FieldLabel>Som personalizado</FieldLabel>
              <FieldDescription>
                Faça upload de um arquivo de áudio personalizado (MP3, WAV, OGG)
              </FieldDescription>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/webm,.mp3,.wav,.ogg,.m4a,.aac,.webm"
                className="hidden"
                onChange={handleFileChange}
              />

              <Button
                type="button"
                variant="outline"
                className="mt-2 gap-2 w-fit"
                disabled={!settings.enabled}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="size-4" />
                {settings.customSoundDataUrl
                  ? "Substituir arquivo"
                  : "Fazer upload de áudio"}
              </Button>
            </Field>
          </>
        )}
      </FieldGroup>
    </div>
  );
}
