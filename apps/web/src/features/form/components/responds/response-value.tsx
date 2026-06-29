"use client";

import { useState } from "react";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { cn } from "@/lib/utils";

/**
 * Detecta se o valor armazenado numa resposta é uma imagem:
 *  - data URL (`data:image/...;base64,...`) — Signature, ImageUpload em fallback
 *  - URL/key com extensão de imagem (.png, .jpg, .jpeg, .gif, .webp, .avif, .svg)
 *  - URL absoluta apontando pra arquivo de imagem
 *
 * Importante: assinaturas salvas em base64 podem ser ENORMES (50KB+ de texto).
 * Sem essa detecção, o card explode de altura/largura mostrando o blob inteiro.
 */
function isImageValue(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("data:image/")) return true;
  // Considera só os primeiros 200 chars pra evitar regex em strings gigantes
  const probe = value.slice(0, 200).toLowerCase();
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(probe);
}

type ResponseValueProps = {
  value: unknown;
  /** Quando true (default), tenta renderizar como imagem se aplicável. */
  renderImages?: boolean;
  className?: string;
};

/**
 * Renderiza o valor de uma resposta de forma segura para o card:
 *  - Imagens (S3 key, URL absoluta, data URL) → thumbnail clicável (abre full
 *    size em nova aba ou modal). Tem `max-w-full` pra nunca estourar o card.
 *  - Textos longos / IDs base64 / UUIDs → quebra de palavra forçada com
 *    `break-all` + `line-clamp` + botão "ver mais" se passar do limite.
 *  - Vazio / null → "-"
 */
export function ResponseValue({
  value,
  renderImages = true,
  className,
}: ResponseValueProps) {
  // Normaliza pra string. Objetos ficam stringified (JSON), arrays viram lista.
  let displayValue: string;
  if (value == null || value === "") {
    displayValue = "-";
  } else if (Array.isArray(value)) {
    displayValue = value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
  } else if (typeof value === "object") {
    displayValue = JSON.stringify(value);
  } else {
    displayValue = String(value);
  }

  if (displayValue === "-") {
    return <span className={cn("text-sm text-muted-foreground", className)}>-</span>;
  }

  const isImage = renderImages && isImageValue(displayValue);

  if (isImage) {
    return <ResponseImage src={displayValue} className={className} />;
  }

  return <ResponseText value={displayValue} className={className} />;
}

function ResponseImage({ src, className }: { src: string; className?: string }) {
  // Resolve key S3/R2 → URL completa. Data URLs e URLs absolutas passam direto.
  const resolvedSrc = useConstructUrl(src);
  const [errored, setErrored] = useState(false);

  if (errored) {
    // Se o load falhar (URL quebrada, hostname não permitido), cai pra texto
    return <ResponseText value={src} className={className} />;
  }

  return (
    <div className={cn("w-full max-w-full", className)}>
      <a
        href={resolvedSrc}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full max-w-[200px]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedSrc}
          alt="Resposta"
          className="w-full h-auto max-h-[160px] object-contain rounded-md border border-foreground/10 bg-foreground/5"
          onError={() => setErrored(true)}
          loading="lazy"
        />
      </a>
    </div>
  );
}

function ResponseText({ value, className }: { value: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > 120;

  return (
    <div className={cn("min-w-0 w-full max-w-full", className)}>
      <p
        className={cn(
          // `break-all` é proposital aqui pq muitos valores são UUIDs, hashes
          // ou base64 sem espaços — sem ele, o texto estoura horizontalmente.
          "text-sm text-foreground break-all whitespace-pre-wrap",
          !expanded && isLong && "line-clamp-3",
        )}
      >
        {value}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-1 text-[11px] text-muted-foreground hover:text-foreground underline"
        >
          {expanded ? "ver menos" : "ver mais"}
        </button>
      )}
    </div>
  );
}

/**
 * Resolve o label de exibição pra um bloco do form. Cai em vários atributos
 * possíveis porque blocos diferentes usam keys diferentes (label, title,
 * question, text). Quando nada bate, devolve string vazia → caller decide
 * o fallback ("Campo desconhecido" etc.).
 */
export function resolveBlockLabel(attributes: Record<string, unknown> | undefined | null): string {
  if (!attributes) return "";
  const candidates = ["label", "title", "question", "text", "name", "placeholder"];
  for (const key of candidates) {
    const v = attributes[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}
