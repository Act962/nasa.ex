"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBuilderStore } from "../../context/builder-form-provider";
import {
  useQueryStatus,
  useQueryTrackings,
} from "@/features/trackings/hooks/use-trackings";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Uploader } from "@/components/file-uploader/uploader";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FormSettings() {
  const { formData, updateSettings } = useBuilderStore();
  const { trackings } = useQueryTrackings();
  const { status } = useQueryStatus({
    trackingId: formData?.settings?.trackingId || "",
  });

  const settings = formData?.settings;
  if (!settings) return null;

  const trackingName = trackings?.find(
    (t) => t.id === settings.trackingId,
  )?.name;

  const statusName = status?.find((s) => s.id === settings.statusId)?.name;

  const handleUploadBackground = (key: string) => {
    if (!key) {
      updateSettings({ backgroundImage: null });
      return;
    }

    const fullUrl = `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;
    updateSettings({ backgroundImage: fullUrl });
  };

  // Helper to extract key from full URL if needed (for Uploader value)
  const extractKeyFromUrl = (url: string | null) => {
    if (!url) return "";
    const parts = url.split("/");
    return parts[parts.length - 1];
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Direcionamento ─────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Direcionamento
        </h3>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel>Tracking</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {trackingName || "Selecionar"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Trackings</DropdownMenuLabel>
                  {trackings?.map((tracking) => (
                    <DropdownMenuItem
                      onClick={() =>
                        updateSettings({ trackingId: tracking.id })
                      }
                      key={tracking.id}
                    >
                      {tracking.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>

          <Field>
            <FieldLabel>Status</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger disabled={!settings.trackingId} asChild>
                <Button variant="outline" className="w-full justify-start">
                  {statusName || "Selecionar"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  {status?.map((s) => (
                    <DropdownMenuItem
                      onClick={() => updateSettings({ statusId: s.id })}
                      key={s.id}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </Field>
        </div>
      </section>

      <Separator />

      {/* ─── Campos do Lead ─────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Campos do Lead
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Exigir identificação</span>
            <Switch
              checked={settings.needLogin}
              onCheckedChange={(checked) =>
                updateSettings({ needLogin: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Mostrar Nome</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Mostrar E-mail</span>
            <Switch
              checked={settings.showEmail}
              onCheckedChange={(checked) =>
                updateSettings({ showEmail: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Mostrar Telefone</span>
            <Switch
              checked={settings.showPhone}
              onCheckedChange={(checked) =>
                updateSettings({ showPhone: checked })
              }
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* ─── Aparência ──────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Aparência
        </h3>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel>Cor primária</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) =>
                  updateSettings({ primaryColor: e.target.value })
                }
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <Input
                value={settings.primaryColor}
                onChange={(e) =>
                  updateSettings({ primaryColor: e.target.value })
                }
                className="flex-1"
              />
            </div>
          </Field>
          <Field>
            <FieldLabel>
              Cor de fundo{" "}
              <FieldLabel>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="size-4 cursor-pointer text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        A cor de fundo influencia diretamente a cor das letras
                        para garantir legibilidade.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </FieldLabel>
            </FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(e) =>
                  updateSettings({ backgroundColor: e.target.value })
                }
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <Input
                value={settings.backgroundColor}
                onChange={(e) =>
                  updateSettings({ backgroundColor: e.target.value })
                }
                className="flex-1"
              />
            </div>
          </Field>
          <Field>
            <FieldLabel>Imagem de fundo</FieldLabel>
            <div className="flex items-center gap-2 w-full">
              <Uploader
                value={extractKeyFromUrl(settings.backgroundImage)}
                onConfirm={handleUploadBackground}
                fileTypeAccepted="image"
              />
            </div>
          </Field>
        </div>
      </section>

      <Separator />

      {/* ─── Mensagens ──────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Mensagens
        </h3>
        <Field>
          <FieldLabel>Mensagem de finalização</FieldLabel>
          <Textarea
            value={settings.finishMessage}
            onChange={(e) => updateSettings({ finishMessage: e.target.value })}
            placeholder="Obrigado por seu cadastro!"
            rows={3}
          />
        </Field>
      </section>

      <Separator />

      {/* ─── Integrações ────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Integrações
        </h3>
        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel>URL de redirecionamento</FieldLabel>
            <Input
              value={settings.redirectUrl || ""}
              onChange={(e) =>
                updateSettings({
                  redirectUrl: e.target.value || null,
                })
              }
              placeholder="https://seusite.com/obrigado"
            />
          </Field>
          <Field>
            <FieldLabel>ID do Facebook Pixel</FieldLabel>
            <Input
              value={settings.idPixel || ""}
              onChange={(e) =>
                updateSettings({
                  idPixel: e.target.value || null,
                })
              }
              placeholder="123456789"
            />
          </Field>
          <Field>
            <FieldLabel>ID do Google Tag Manager</FieldLabel>
            <Input
              value={settings.idTagManager || ""}
              onChange={(e) =>
                updateSettings({
                  idTagManager: e.target.value || null,
                })
              }
              placeholder="GTM-XXXXXXX"
            />
          </Field>
        </div>
      </section>
    </div>
  );
}
