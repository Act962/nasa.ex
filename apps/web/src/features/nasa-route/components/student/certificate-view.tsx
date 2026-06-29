"use client";

import { Award, GraduationCap } from "lucide-react";
import { imgSrc } from "@/features/public-calendar/utils/img-src";

interface Props {
  certificate: {
    code: string;
    studentName: string;
    courseTitle: string;
    orgName: string;
    durationMin: number | null;
    issuedAt: string | Date;
    course?: {
      coverUrl?: string | null;
      creatorOrg?: { logo?: string | null } | null;
    };
  };
  validateUrl?: string;
}

export function CertificateView({ certificate, validateUrl }: Props) {
  const date = new Date(certificate.issuedAt);
  const formattedDate = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const orgLogo = certificate.course?.creatorOrg?.logo;

  return (
    <div className="certificate-page bg-gradient-to-br from-slate-50 via-white to-violet-50 print:bg-white">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html,
          body {
            background: white !important;
          }
          .certificate-no-print {
            display: none !important;
          }
          .certificate-page {
            min-height: auto !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1100px] p-6 print:p-0">
        <div className="relative overflow-hidden rounded-3xl border-[6px] border-violet-700 bg-white p-10 shadow-2xl print:rounded-none print:border-[8px] print:p-12 print:shadow-none">
          <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 size-80 rounded-full bg-fuchsia-500/10 blur-3xl" />

          <div className="absolute inset-x-10 top-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-violet-700">
              <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white">
                <GraduationCap className="size-5" />
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.18em]">
                NASA Route
              </div>
            </div>
            {orgLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc(orgLogo)}
                alt={certificate.orgName}
                className="h-10 w-auto rounded object-contain"
              />
            ) : (
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {certificate.orgName}
              </div>
            )}
          </div>

          <div className="relative pt-16 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-700">
              <Award className="size-4" />
              Certificado de Conclusão
            </div>

            <p className="mt-7 text-sm uppercase tracking-[0.2em] text-slate-500">
              Conferido a
            </p>

            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-5xl">
              {certificate.studentName}
            </h1>

            <div className="mx-auto mt-5 h-[2px] w-32 bg-gradient-to-r from-transparent via-violet-700 to-transparent" />

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-700 md:text-lg">
              Por concluir com sucesso o curso{" "}
              <span className="font-semibold text-slate-900">
                "{certificate.courseTitle}"
              </span>
              , oferecido por{" "}
              <span className="font-semibold text-slate-900">
                {certificate.orgName}
              </span>
              {certificate.durationMin
                ? ` com carga horária de ${certificate.durationMin} minutos`
                : ""}
              .
            </p>
          </div>

          <div className="relative mt-12 grid grid-cols-1 items-end gap-6 md:grid-cols-3">
            <div className="text-center md:text-left">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Emitido em
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formattedDate}
              </p>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex size-14 items-center justify-center rounded-full border-4 border-amber-400 bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-md">
                <Award className="size-7" />
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">
                Selo de Conclusão
              </p>
            </div>

            <div className="text-center md:text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Código de validação
              </p>
              <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                {certificate.code}
              </p>
              {validateUrl && (
                <p className="mt-0.5 break-all text-[10px] text-slate-500">
                  {validateUrl}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
