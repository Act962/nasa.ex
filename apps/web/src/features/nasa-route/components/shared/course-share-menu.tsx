"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Mail,
  Share2,
  Link as LinkIcon,
  Send,
  Twitter,
  Facebook,
  Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WhatsappIcon } from "@/components/whatsapp";

/**
 * Menu de compartilhamento de curso (e opcionalmente de aula gratuita).
 *
 * Opções:
 *  - Copiar link
 *  - WhatsApp (wa.me)
 *  - Telegram (t.me/share/url)
 *  - X / Twitter
 *  - Facebook
 *  - LinkedIn
 *  - Email (mailto)
 *  - Web Share API (`navigator.share`) quando disponível (mobile)
 *
 * Recebe `url` (absoluta ou path relativo — converte automaticamente)
 * e `text` (assunto/mensagem que vai junto no share).
 *
 * Reusável em:
 *  - Página pública do curso (`/c/<company>/<slug>`)
 *  - Editor do criador (`/nasa-route/criador/curso/<id>`)
 *  - Listagem da empresa, etc.
 */
interface Props {
  /** URL relativa (vai pra `${origin}${url}`) OU absoluta. */
  url: string;
  /** Texto que acompanha o share (título do curso, ou frase chamada). */
  text: string;
  /** Tipo de gatilho — "button" mostra botão completo, "icon" só ícone. */
  variant?: "button" | "icon" | "default";
  size?: "sm" | "default" | "lg";
  label?: string;
}

export function CourseShareMenu({
  url,
  text,
  variant = "button",
  size = "sm",
  label = "Compartilhar",
}: Props) {
  const [copied, setCopied] = useState(false);

  const absoluteUrl = useAbsoluteUrl(url);
  const encodedUrl = encodeURIComponent(absoluteUrl);
  const encodedText = encodeURIComponent(text);
  const encodedSubject = encodeURIComponent(text);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não consegui copiar — copie manualmente da barra.");
    }
  }

  async function handleNativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({ title: text, text, url: absoluteUrl });
    } catch {
      // Cancelado pelo usuário ou falha silenciosa — não mostra erro.
    }
  }

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            title="Compartilhar"
            aria-label="Compartilhar"
          >
            <Share2 className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size={size} className="gap-1.5">
            <Share2 className="size-4" />
            {label}
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">
          Compartilhar
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleCopy}>
          {copied ? (
            <Check className="size-4 text-emerald-500" />
          ) : (
            <Copy className="size-4" />
          )}
          Copiar link
        </DropdownMenuItem>

        {canNativeShare && (
          <DropdownMenuItem onClick={handleNativeShare}>
            <LinkIcon className="size-4" />
            Compartilhar via dispositivo
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a
            href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsappIcon className="size-4" />
            WhatsApp
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a
            href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Send className="size-4" />
            Telegram
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Twitter className="size-4" />X / Twitter
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Facebook className="size-4" />
            Facebook
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Linkedin className="size-4" />
            LinkedIn
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a
            href={`mailto:?subject=${encodedSubject}&body=${encodedText}%20${encodedUrl}`}
          >
            <Mail className="size-4" />
            Email
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Converte path relativo pra URL absoluta usando `window.location.origin`.
 * Em SSR/build retorna o input cru (não precisa absolute em listagem
 * server-rendered que não usa share — share só dispara client-side).
 */
function useAbsoluteUrl(url: string): string {
  if (typeof window === "undefined") return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
}
