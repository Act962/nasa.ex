"use client";

interface Props {
  format: string;
  priceStars: number;
  // eBook
  ebookFileSize?: number | null;
  ebookMimeType?: string | null;
  ebookPageCount?: number | null;
  // Evento
  eventStartsAt?: Date | string | null;
  eventTimezone?: string | null;
  eventLocationNote?: string | null;
  // Comunidade
  communityType?: string | null;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mimeLabel(mime?: string | null): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "application/epub+zip") return "EPUB";
  return mime ? "Arquivo" : "-";
}

function communityLabel(type?: string | null): string {
  switch (type) {
    case "whatsapp":
      return "WhatsApp";
    case "telegram":
      return "Telegram";
    case "discord":
      return "Discord";
    default:
      return "grupo externo";
  }
}

/**
 * Bloco de detalhes específicos de cada formato — renderizado abaixo do
 * currículo na página pública. Não mostra nada pra formatos `course/training/mentoring`
 * (esses já têm a seção "Conteúdo do curso" acima).
 */
export function FormatDetailsSection({
  format,
  priceStars,
  ebookFileSize,
  ebookMimeType,
  ebookPageCount,
  eventStartsAt,
  eventTimezone,
  eventLocationNote,
  communityType,
}: Props) {
  if (format === "ebook") {
    return (
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="text-xl font-bold">📘 O que você recebe</h2>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Formato</dt>
            <dd className="font-semibold">{mimeLabel(ebookMimeType)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tamanho</dt>
            <dd className="font-semibold">{formatBytes(ebookFileSize)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Páginas</dt>
            <dd className="font-semibold">{ebookPageCount ?? "-"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Após a compra, baixe quantas vezes quiser. O arquivo fica vinculado à sua conta
          pra sempre.
        </p>
      </section>
    );
  }

  if (format === "event" && eventStartsAt) {
    return (
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="text-xl font-bold">📅 Quando acontece</h2>
        <p className="mt-3 text-sm">
          <strong>
            {new Date(eventStartsAt).toLocaleString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: eventTimezone ?? undefined,
            })}
          </strong>
        </p>
        {eventTimezone && (
          <p className="text-xs text-muted-foreground">Fuso: {eventTimezone}</p>
        )}
        {eventLocationNote && (
          <p className="mt-3 text-sm text-muted-foreground">{eventLocationNote}</p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          O link de transmissão é liberado 30 minutos antes do início.
        </p>
      </section>
    );
  }

  if (format === "community") {
    return (
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="text-xl font-bold">💬 Sobre a comunidade</h2>
        <p className="mt-3 text-sm">
          Após pagar, você recebe o link de convite pra entrar em uma comunidade no{" "}
          <strong>{communityLabel(communityType)}</strong>.
        </p>
      </section>
    );
  }

  if (format === "subscription") {
    return (
      <section className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-6 dark:border-indigo-800/40 dark:bg-indigo-900/20">
        <h2 className="text-xl font-bold">🔁 Assinatura mensal</h2>
        <p className="mt-3 text-sm">
          <strong>{priceStars.toLocaleString("pt-BR")} ★</strong> debitados
          automaticamente todo mês. Cancele a qualquer momento entrando em contato com o
          suporte.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Se faltar saldo, tentamos novamente diariamente. Após 7 falhas o acesso é
          encerrado.
        </p>
      </section>
    );
  }

  return null;
}
