"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { BookOpen, ChevronLeft, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { imgSrc } from "@/features/public-calendar/utils/img-src";

interface Props {
  course: {
    id: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    coverUrl: string | null;
    ebookFileName: string | null;
    ebookFileSize: number | null;
    ebookMimeType: string | null;
    ebookPageCount: number | null;
    creatorOrg?: { id: string; name: string; slug: string; logo: string | null } | null;
    creator?: { id: string; name: string; image: string | null } | null;
  };
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mimeLabel(mime: string | null): string {
  if (!mime) return "Arquivo";
  if (mime === "application/pdf") return "PDF";
  if (mime === "application/epub+zip") return "EPUB";
  return mime.split("/").pop()?.toUpperCase() ?? "Arquivo";
}

export function EbookViewer({ course }: Props) {
  const [downloadCount, setDownloadCount] = useState(0);

  const downloadMutation = useMutation({
    ...orpc.nasaRoute.getEbookDownloadUrl.mutationOptions(),
    onSuccess: (data) => {
      // Abre o link presigned numa nova aba — o navegador respeita
      // Content-Disposition: attachment, então baixa direto.
      window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      setDownloadCount((c) => c + 1);
      toast.success("Download iniciado", {
        description: `O link expira em 5 minutos.`,
      });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível gerar o link de download.");
    },
  });

  const isDownloading = downloadMutation.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Voltar */}
      <Link
        href="/nasa-route"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Voltar pra meus produtos
      </Link>

      {/* Card principal */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          {/* Capa */}
          <div className="relative aspect-[3/4] bg-muted md:aspect-auto md:min-h-[360px]">
            {course.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc(course.coverUrl)}
                alt={course.title}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <BookOpen className="size-20 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Detalhes + CTA */}
          <div className="flex flex-col gap-4 p-6">
            <div className="space-y-1">
              <Badge variant="secondary" className="text-xs">
                📘 eBook
              </Badge>
              <h1 className="text-2xl font-bold">{course.title}</h1>
              {course.subtitle && (
                <p className="text-muted-foreground">{course.subtitle}</p>
              )}
            </div>

            {course.creatorOrg && (
              <p className="text-xs text-muted-foreground">
                Por <span className="font-medium">{course.creatorOrg.name}</span>
                {course.creator?.name && ` · ${course.creator.name}`}
              </p>
            )}

            {/* Metadados */}
            <dl className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Formato</dt>
                <dd className="font-semibold">{mimeLabel(course.ebookMimeType)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tamanho</dt>
                <dd className="font-semibold">{formatBytes(course.ebookFileSize)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Páginas</dt>
                <dd className="font-semibold">{course.ebookPageCount ?? "-"}</dd>
              </div>
            </dl>

            {/* Botão grande */}
            <Button
              size="lg"
              className="mt-auto w-full"
              onClick={() => downloadMutation.mutate({ courseId: course.id })}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Gerando link...
                </>
              ) : (
                <>
                  <Download className="mr-2 size-5" />
                  Baixar eBook
                </>
              )}
            </Button>

            {downloadCount > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Você baixou {downloadCount}× nesta sessão. O arquivo fica disponível pra
                sempre — pode voltar quando quiser.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Descrição */}
      {course.description && (
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4" />
            Sobre o eBook
          </div>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-muted-foreground">
            {course.description}
          </div>
        </div>
      )}
    </div>
  );
}
