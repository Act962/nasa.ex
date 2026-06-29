"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { ArrowLeft, Loader2, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CertificateView } from "./certificate-view";

interface Props {
  code: string;
  isAuthenticated?: boolean;
  publicView?: boolean;
}

export function CertificateDetailPage({
  code,
  isAuthenticated = false,
  publicView = false,
}: Props) {
  const { data, isLoading, isError } = useQuery({
    ...orpc.nasaRoute.publicGetCertificate.queryOptions({ input: { code } }),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Certificado não encontrado</h1>
        <p className="mt-2 text-muted-foreground">
          O código <span className="font-mono font-semibold">{code}</span> é inválido
          ou o certificado foi revogado.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={publicView ? "/" : "/nasa-route/certificados"}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const cert = data.certificate;
  const validateUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/c/certificado/${cert.code}`
      : "";

  function handlePrint() {
    window.print();
  }

  async function handleShare() {
    const shareUrl = `${window.location.origin}/c/certificado/${cert.code}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Certificado · ${cert.courseTitle}`,
          text: `Conclui o curso "${cert.courseTitle}" no NASA Route!`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copiado para a área de transferência");
      }
    } catch {
      // ignored — usuário cancelou compartilhamento
    }
  }

  return (
    <div>
      <div className="certificate-no-print sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-3">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href={publicView || !isAuthenticated ? "/" : "/nasa-route/certificados"}>
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
              <Share2 className="size-4" />
              Compartilhar
            </Button>
            <Button onClick={handlePrint} size="sm" className="gap-1.5">
              <Printer className="size-4" />
              Imprimir / PDF
            </Button>
          </div>
        </div>
      </div>

      <CertificateView
        certificate={{
          code: cert.code,
          studentName: cert.studentName,
          courseTitle: cert.courseTitle,
          orgName: cert.orgName,
          durationMin: cert.durationMin,
          issuedAt: cert.issuedAt,
          course: cert.course
            ? {
                coverUrl: cert.course.coverUrl,
                creatorOrg: cert.course.creatorOrg,
              }
            : undefined,
        }}
        validateUrl={validateUrl}
      />

      <div className="certificate-no-print mx-auto max-w-2xl px-4 pb-12 text-center">
        <p className="text-xs text-muted-foreground">
          Este certificado pode ser validado publicamente em{" "}
          <span className="font-mono font-semibold">/c/certificado/{cert.code}</span>
        </p>
      </div>
    </div>
  );
}
