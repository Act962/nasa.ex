"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import type { LinnkerPage } from "../types";
import { OrbitaSpinner } from "@/components/orbita-spinner";

interface Props {
  page: LinnkerPage;
}

export function LinnkerQRCode({ page }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/l/${page.slug}`
      : `/l/${page.slug}`;

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);

    import("qrcode")
      .then((mod) => {
        const QRCode = mod.default ?? mod;
        return (QRCode as any).toString(publicUrl, {
          type: "svg",
          width: 220,
          margin: 2,
          color: { dark: page.coverColor, light: "#ffffff" },
        });
      })
      .then((result: string) => {
        if (!cancelled) setSvg(result);
      })
      .catch((err: unknown) => {
        console.error("QR Code error:", err);
        if (!cancelled) setError(String(err));
      });

    return () => { cancelled = true; };
  }, [publicUrl, page.coverColor]);

  const download = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `linnker-${page.slug}.svg`;
    a.click();
    toast.success("QR Code baixado!");
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-5 rounded-[22px] border border-line bg-muted/20 p-4 sm:gap-6 sm:p-6">
        {/* Fundo branco de propósito: o QR precisa de contraste para ser lido pela câmera. */}
        <div className="flex size-[252px] items-center justify-center rounded-[20px] bg-white p-4 shadow-sm">
          {error ? (
            <p className="text-xs text-destructive text-center px-4">{error}</p>
          ) : svg ? (
            <div
              style={{ width: 220, height: 220 }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <OrbitaSpinner className="size-8" />
          )}
        </div>

        <div className="min-w-0 text-center">
          <p className="font-semibold">{page.title}</p>
          <p className="text-sm text-muted-foreground break-all">{publicUrl}</p>
        </div>

        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" className="h-11 rounded-full sm:h-9" onClick={copyUrl}>
            <Copy className="size-4" /> Copiar link
          </Button>
          <Button className="h-12 rounded-full sm:h-9" onClick={download} disabled={!svg}>
            <Download className="size-4" /> Baixar QR Code
          </Button>
        </div>
      </div>

      <div className="rounded-[20px] border border-line bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-info/15">
            <QrCode className="size-4 text-info" />
          </div>
          <div>
            <p className="font-medium text-sm">Captura automática de leads</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quem escaneia este QR Code abre sua página e a visita fica registrada. Se a
              pessoa preencher nome, e-mail ou telefone num formulário ligado à página, o
              lead entra direto no seu Tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
