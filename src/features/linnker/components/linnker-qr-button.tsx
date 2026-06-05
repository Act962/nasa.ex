"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Share2, Download, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Botão flutuante de QR Code — fica ao lado do avatar no perfil
 * público do Linnker. Click abre um modal grande com o QR
 * apontando pra rota `/l/<slug>/wa` (que redireciona pra
 * wa.me/<phone> registrando o scan).
 *
 * Layout do modal segue o mock anexo (estilo WhatsApp Business):
 *   - Header com botão "voltar" + título "QR code" + botão
 *     "Escanear" (placeholder pro futuro — quando o user vê QR de
 *     outra pessoa pode escanear pra adicionar).
 *   - Avatar circular no topo
 *   - Nome + sub-URL `wa.me/<phone>`
 *   - QR code grande centralizado (com logo WhatsApp no centro)
 *   - Texto explicativo "Seus clientes podem escanear esse código"
 *   - Botão "Compartilhar código" no rodapé (Web Share API com
 *     fallback de copiar link)
 *   - Botão secundário "Baixar meu contato (.vcf)" — atalho pro
 *     dono testar o vCard direto.
 */
export function LinnkerQrButton({
  slug,
  title,
  avatarUrl,
  phoneDigits,
  socialIconColor,
}: {
  slug: string;
  title: string;
  avatarUrl?: string | null;
  phoneDigits: string;
  socialIconColor?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // URL do QR aponta pra rota nossa que registra scan e redireciona
  // pro WhatsApp. Em produção o host real é injetado via
  // NEXT_PUBLIC_APP_URL; em dev vai cair em window.location.origin.
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const qrUrl = `${origin}/l/${slug}/wa?utm_source=qr&utm_medium=event`;

  // Direto pro endpoint .vcf (test do dono no popup).
  const vcardUrl = `${origin}/api/linnker/${slug}/vcard`;
  // Página intersticial pra terceiros — funciona em qualquer browser.
  const contatoUrl = `${origin}/l/${slug}/contato`;

  const handleShare = async () => {
    // Web Share API quando disponível (mobile). Compartilha o link
    // do QR redirect, não a página do Linnker — porque a intenção
    // é capturar leads via WhatsApp.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `QR de contato — ${title}`,
          text: `Escaneia pra falar comigo: ${title}`,
          url: qrUrl,
        });
        return;
      } catch {
        /* user cancelou */
      }
    }
    // Fallback: copia URL pro clipboard.
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignora */
    }
  };

  const iconColor = socialIconColor ?? "#0f172a";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Mostrar QR de contato"
        aria-label="Mostrar QR de contato"
        className="size-10 rounded-full flex items-center justify-center bg-white border-2 border-white shadow-md hover:bg-zinc-50 transition-colors shrink-0"
        style={{ color: iconColor }}
      >
        <QrCode className="size-5" strokeWidth={2.5} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden bg-zinc-50 text-zinc-900 [&>button]:hidden">
          {/* Header estilo WhatsApp Business — usa o X do shadcn
              não exposto (escondido via [&>button]:hidden) e mostra
              nosso próprio botão "voltar" estilo iOS. */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="size-9 rounded-full bg-white hover:bg-zinc-100 flex items-center justify-center shadow-sm border"
            >
              <X className="size-4" />
            </button>
            <h2 className="text-base font-semibold">QR code</h2>
            {/* Placeholder pro botão "Escanear" — sem ação ainda */}
            <div className="size-9" />
          </div>

          {/* Card branco com avatar + dados */}
          <div className="px-6 pt-8 pb-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border">
              {/* Avatar circular acima do card */}
              <div className="flex justify-center -mt-14 mb-3">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={title}
                    className="size-20 rounded-full object-cover border-4 border-white shadow"
                  />
                ) : (
                  <div className="size-20 rounded-full bg-zinc-200 border-4 border-white shadow flex items-center justify-center text-2xl font-bold text-zinc-500">
                    {title.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <p className="text-center text-lg font-bold leading-tight">
                {title}
              </p>
              <p className="text-center text-xs text-zinc-500 mt-0.5 font-mono">
                wa.me/{phoneDigits}
              </p>

              {/* QR code centralizado */}
              <div className="flex justify-center my-5">
                <div className="bg-white p-2 rounded-lg">
                  <QRCodeSVG
                    value={qrUrl}
                    size={220}
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    // imageSettings poderia adicionar logo
                    // WhatsApp no centro do QR — fica pra
                    // próxima iteração.
                  />
                </div>
              </div>

              <p className="text-center text-xs text-zinc-600 leading-relaxed px-4">
                Seus clientes podem escanear esse código para
                iniciar uma conversa com você no WhatsApp.
              </p>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="px-6 pb-6 flex flex-col gap-2">
            <Button
              onClick={handleShare}
              className="w-full bg-zinc-900 text-white hover:bg-zinc-800 h-12 rounded-xl font-semibold gap-2"
            >
              <Share2 className="size-4" />
              {copied ? "Link copiado!" : "Compartilhar código"}
            </Button>
            <a
              href={vcardUrl}
              download
              className="w-full h-11 rounded-xl border bg-white hover:bg-zinc-50 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <Download className="size-4" />
              Baixar meu contato (.vcf)
            </a>
            {/* Link shareable da página intersticial — útil pra mandar
                "salve meu contato" via WhatsApp, email, etc. */}
            <a
              href={contatoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-center text-[11px] text-zinc-500 hover:text-zinc-700 underline"
            >
              Ou compartilhe esse link: {origin.replace(/^https?:\/\//, "")}/l/{slug}/contato
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
