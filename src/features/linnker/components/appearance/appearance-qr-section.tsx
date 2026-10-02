"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangleIcon, QrCode } from "lucide-react";
import { DEFAULT_QR_MESSAGE_TEMPLATE, extractPreviewPhone } from "./appearance-draft";
import type { AppearanceDraft, UpdateAppearanceDraft } from "./appearance-draft";

const PREVIEW_MESSAGE_LENGTH = 80;

interface AppearanceSectionProps {
  draft: AppearanceDraft;
  onChange: UpdateAppearanceDraft;
}

export function AppearanceQrSection({ draft, onChange }: AppearanceSectionProps) {
  const previewPhone = extractPreviewPhone(draft.socialLinks);

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-line bg-muted/40 p-3 text-xs leading-relaxed">
        <p className="mb-1 flex items-center gap-1.5 font-semibold">
          <QrCode className="size-3.5" />
          QR code de contato
        </p>
        <p className="text-muted-foreground">
          Mostra um botão de QR ao lado da sua foto na página pública. Ao escanear, abre o WhatsApp com a mensagem
          pronta. O contato fica registrado e pode disparar automações no seu Tracking.
        </p>
      </div>

      {!previewPhone && (
        <div className="flex items-start gap-2 rounded-[18px] border border-warning/30 bg-warning/15 p-3 text-xs leading-relaxed text-warning">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Adicione um link de WhatsApp em <strong>Social</strong> primeiro. O QR usa esse número como destino.
          </p>
        </div>
      )}

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[18px] border border-line bg-card p-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold">Mostrar QR na página pública</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Desligado, o botão de QR não aparece para visitantes.</p>
        </div>
        <Switch checked={draft.qrEnabled} onCheckedChange={(qrEnabled) => onChange({ qrEnabled })} className="shrink-0" />
      </label>

      <div>
        <Label className="text-xs font-semibold">Mensagem pronta</Label>
        <p className="mt-0.5 mb-1.5 text-[11px] text-muted-foreground">
          Texto que já aparece no WhatsApp de quem escaneou. Use{" "}
          <code className="rounded-full bg-muted px-1.5 font-mono">{"{org}"}</code> para colocar o nome da sua empresa.
        </p>
        <Textarea
          rows={3}
          value={draft.qrMessageTemplate}
          onChange={(event) => onChange({ qrMessageTemplate: event.target.value })}
          placeholder={DEFAULT_QR_MESSAGE_TEMPLATE}
          className="text-xs"
          maxLength={500}
        />
      </div>

      {previewPhone && (
        <div className="rounded-[18px] border border-line bg-card p-3">
          <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Prévia do link</p>
          <code className="font-mono text-[11px] break-all text-foreground">
            wa.me/{previewPhone}?text=
            {encodeURIComponent(draft.qrMessageTemplate.replace(/\{org\}/g, "Sua Empresa")).slice(0, PREVIEW_MESSAGE_LENGTH)}…
          </code>
        </div>
      )}
    </div>
  );
}
