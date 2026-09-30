"use client";

import { useRef, useState } from "react";
import { AlertTriangle, BadgeCheck, FileKey2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useCompanyCertificates,
  useDeleteCompanyCertificate,
  useUploadCompanyCertificate,
} from "@/features/accounting/hooks/use-accounting-credentials";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { formatDocumentDate } from "./document-display";

const MAX_CERTIFICATE_BYTES = 50 * 1024;
const DAY_MS = 86_400_000;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function formatCnpjOrCpf(digits: string | null): string {
  if (!digits) return "";
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

export function CertificatePanel() {
  const { data, isLoading } = useCompanyCertificates();
  const uploadCertificate = useUploadCompanyCertificate();
  const deleteCertificate = useDeleteCompanyCertificate();
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function upload() {
    if (!certificateFile) return;
    if (certificateFile.size > MAX_CERTIFICATE_BYTES) {
      toast.error("Arquivo maior que 50 KB — não parece um certificado A1 (.pfx).");
      return;
    }
    const pfxBase64 = await readFileAsBase64(certificateFile);
    uploadCertificate.mutate(
      { pfxBase64, password },
      {
        onSuccess: (certificate) => {
          toast.success(`Certificado guardado. Válido até ${formatDocumentDate(certificate.validTo)}.`);
          setCertificateFile(null);
          setPassword("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        onError: (error) => toast.error(error.message || "Não foi possível abrir o certificado."),
      },
    );
  }

  function remove(certificateId: string) {
    if (!window.confirm("Remover este certificado do cofre? O documento dele também sai do score.")) return;
    deleteCertificate.mutate(
      { certificateId },
      {
        onSuccess: () => toast.success("Certificado removido."),
        onError: (error) => toast.error(error.message || "Não foi possível remover."),
      },
    );
  }

  const certificates = data?.certificates ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileKey2 className="size-4 text-violet-500" /> Certificado digital A1 <FiscalTermHint termId="certificado-digital" />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Guarde aqui o arquivo .pfx e a senha. Nós lemos o titular e a validade e avisamos antes de vencer.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : certificates.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Nenhum certificado guardado. Sem ele não dá para emitir nota nem entrar no e-CAC pelo sistema.
          </p>
        ) : (
          <ul className="space-y-2">
            {certificates.map((certificate) => {
              const daysToExpire = Math.floor((new Date(certificate.validTo).getTime() - Date.now()) / DAY_MS);
              const isExpired = daysToExpire < 0;
              const isExpiringSoon = !isExpired && daysToExpire <= 30;
              return (
                <li key={certificate.id} className="flex items-start gap-3 rounded-xl border p-3">
                  {isExpired || isExpiringSoon ? (
                    <AlertTriangle className={cn("mt-0.5 size-5 shrink-0", isExpired ? "text-red-500" : "text-amber-500")} />
                  ) : (
                    <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{certificate.subjectName ?? "Certificado A1"}</p>
                    {certificate.document && (
                      <p className="text-xs text-muted-foreground">{formatCnpjOrCpf(certificate.document)}</p>
                    )}
                    <p
                      className={cn(
                        "text-xs",
                        isExpired && "text-red-600 dark:text-red-400",
                        isExpiringSoon && "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {isExpired
                        ? `Venceu em ${formatDocumentDate(certificate.validTo)} — renove com a sua certificadora.`
                        : `Válido até ${formatDocumentDate(certificate.validTo)} (${daysToExpire} dias)`}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label="Remover certificado"
                    disabled={deleteCertificate.isPending}
                    onClick={() => remove(certificate.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="certificate-file">Arquivo .pfx ou .p12</Label>
            <Input
              ref={fileInputRef}
              id="certificate-file"
              type="file"
              accept=".pfx,.p12,application/x-pkcs12"
              onChange={(event) => setCertificateFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="certificate-password">Senha do certificado</Label>
            <Input
              id="certificate-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button
            className="bg-violet-600 text-white hover:bg-violet-700"
            disabled={!certificateFile || !password || uploadCertificate.isPending}
            onClick={upload}
          >
            {uploadCertificate.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
