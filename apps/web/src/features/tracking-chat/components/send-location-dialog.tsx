"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPinIcon, SendIcon } from "lucide-react";

interface SendLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  latitude: number | null;
  longitude: number | null;
  onConfirm: () => void;
  isSending?: boolean;
}

export function SendLocationDialog({
  open,
  onOpenChange,
  latitude,
  longitude,
  onConfirm,
  isSending,
}: SendLocationDialogProps) {
  const hasCoords =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const delta = 0.004;
  const embedUrl = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${
        longitude! - delta
      },${latitude! - delta},${longitude! + delta},${
        latitude! + delta
      }&layer=mapnik&marker=${latitude},${longitude}`
    : null;

  const mapsUrl = hasCoords
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : "#";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinIcon className="size-4 text-red-500" />
            Enviar localização
          </DialogTitle>
          <DialogDescription>
            Confira sua localização atual antes de enviar para o lead.
          </DialogDescription>
        </DialogHeader>

        {hasCoords ? (
          <div className="overflow-hidden rounded-md border">
            {embedUrl && (
              <div className="relative w-full h-60 overflow-hidden">
                <iframe
                  src={embedUrl}
                  className="absolute inset-x-0 top-0 w-full border-0"
                  style={{ height: "calc(100% + 56px)" }}
                  loading="lazy"
                  title="Pré-visualização do mapa"
                />
              </div>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 p-3 bg-accent/40 hover:bg-accent/60 transition-colors"
            >
              <MapPinIcon className="size-4 mt-0.5 shrink-0 text-red-500" />
              <div className="flex flex-col text-xs">
                <span className="font-medium">Abrir no Google Maps</span>
                <span className="text-muted-foreground font-mono">
                  {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
                </span>
              </div>
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Obtendo localização...
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!hasCoords || isSending}
          >
            <SendIcon className="size-4 mr-1" />
            {isSending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
