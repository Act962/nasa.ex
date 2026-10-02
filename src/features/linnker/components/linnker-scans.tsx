"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { EyeIcon, Mail, Phone, ExternalLink, User, UserCheckIcon } from "lucide-react";
import Link from "next/link";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { LinnkerKpiGrid } from "./linnker-kpi-grid";
import type { LinnkerScan } from "../types";

interface Props {
  pageId: string;
}

export function LinnkerScans({ pageId }: Props) {
  const { data, isLoading } = useQuery(
    orpc.linnker.getScans.queryOptions({ input: { id: pageId } }),
  );

  const scans = (data?.scans ?? []) as unknown as LinnkerScan[];

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <OrbitaSpinner className="size-7" />
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-line px-6 py-14 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-muted">
          <EyeIcon className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">Nenhuma visita ainda</p>
          <p className="text-sm text-muted-foreground">
            Publique a página e compartilhe o link ou o QR Code: cada visita aparece aqui.
          </p>
        </div>
      </div>
    );
  }

  const leadCount = scans.filter((scan) => scan.lead).length;

  return (
    <div className="space-y-3">
      <LinnkerKpiGrid
        className="md:grid-cols-2"
        kpis={[
          { label: "Visitas", value: scans.length, icon: <EyeIcon /> },
          { label: "Viraram lead", value: leadCount, icon: <UserCheckIcon /> },
        ]}
      />

      <ul className="m-0 list-none space-y-2 p-0">
        {scans.map((scan) => (
          <li key={scan.id} className="flex items-start gap-3 rounded-[18px] border border-line bg-card p-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">
              <User className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{scan.name ?? "Visitante anônimo"}</span>
                {scan.lead && (
                  <span className="rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                    Lead criado
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {scan.email && (
                  <span className="flex min-w-0 items-center gap-1">
                    <Mail className="size-3 shrink-0" /> <span className="truncate">{scan.email}</span>
                  </span>
                )}
                {scan.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3 shrink-0" /> {scan.phone}
                  </span>
                )}
                <span>{new Date(scan.createdAt).toLocaleDateString("pt-BR", { dateStyle: "short" })}</span>
              </div>
            </div>
            {scan.lead && (
              <Link
                href="/tracking"
                className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Abrir no Tracking"
              >
                <ExternalLink className="size-4" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
