"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import type { LinnkerPage } from "../types";

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
      <div className="flex flex-col items-center gap-6 p-6 border rounded-xl bg-muted/20">
        <div className="p-4 bg-white rounded-xl shadow-sm flex items-center justify-center" style={{ minWidth: 240, minHeight: 240 }}>
          {error ? (
            <p className="text-xs text-destructive text-center px-4">{error}</p>
          ) : svg ? (
            <div
              style={{ width: 220, height: 220 }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="size-[220px] animate-pulse bg-muted rounded" />
          )}
        </div>

        <div className="text-center">
          <p className="font-semibold">{page.title}</p>
          <p className="text-sm text-muted-foreground break-all">{publicUrl}</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={copyUrl}>
            <Copy className="size-4 mr-2" /> Copiar link
          </Button>
          <Button onClick={download} disabled={!svg}>
            <Download className="size-4 mr-2" /> Baixar QR Code
          </Button>
        </div>
      </div>

      <div className="border rounded-xl p-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <QrCode className="size-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Captura automática de leads</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quando alguém escaneia este QR Code e abre sua página Linnker, os dados
              são capturados automaticamente. Se a pessoa preencher nome, e-mail ou
              telefone em qualquer formulário vinculado, um lead é criado no seu Tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
