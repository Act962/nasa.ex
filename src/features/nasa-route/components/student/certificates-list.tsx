"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Award, Calendar, Eye, GraduationCap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import { NasaRoutePageTop, TopActionLink } from "../shared/nasa-route-page-top";
import { useNasaRouteStudentDock } from "../../hooks/use-nasa-route-dock";

export function CertificatesList() {
  useNasaRouteStudentDock({ activeSection: "certificates" });
  const { data, isLoading } = useQuery({
    ...orpc.nasaRoute.listMyCertificates.queryOptions(),
  });

  const certificates = data?.certificates ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-2 pb-[150px] md:py-8 lg:pb-10">
      <NasaRoutePageTop
        icon={<Award />}
        title="Meus certificados"
        mobileTitle="Certificados"
        subtitle="Todos os cursos que você concluiu na plataforma."
        mobileSubtitle="Cursos que você concluiu"
        actions={
          <TopActionLink href="/nasa-route" icon={<GraduationCap className="size-4" />} label="Ver catálogo" />
        }
        className="mb-5 md:mb-8"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {[1, 2, 3, 4].map((placeholderIndex) => (
            <Skeleton key={placeholderIndex} className="h-44 rounded-[20px]" />
          ))}
        </div>
      ) : certificates.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-line p-10 text-center md:p-16">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
            <Award className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-base font-semibold">
            Você ainda não possui certificados
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conclua um curso no ÓRBITA Route para receber seu primeiro certificado.
          </p>
          <Button asChild className="mt-6 h-11 rounded-full md:h-9">
            <Link href="/nasa-route">Explorar cursos</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {certificates.map((certificate) => (
            <Link
              key={certificate.id}
              href={`/nasa-route/certificados/${certificate.code}`}
              className="group flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-line bg-card transition-all hover:border-info hover:shadow-lg md:flex-row"
            >
              <div className="relative aspect-video w-full shrink-0 bg-info md:w-40">
                {certificate.course.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgSrc(certificate.course.coverUrl)}
                    alt={certificate.courseTitle}
                    className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/40">
                    <GraduationCap className="size-10" />
                  </div>
                )}
                <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                  <Award className="size-3" />
                  Concluído
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 md:p-4">
                <h3 className="line-clamp-2 text-sm leading-tight font-semibold md:text-base">
                  {certificate.courseTitle}
                </h3>
                <p className="truncate text-xs text-muted-foreground">{certificate.orgName}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3" />
                    {new Date(certificate.issuedAt).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-info max-md:hidden">
                    <Eye className="size-3" />
                    Ver certificado
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                  {certificate.code}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
