"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, ExternalLink } from "lucide-react";
import Link from "next/link";
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
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center">
          <User className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">Nenhum scan ainda</p>
          <p className="text-sm text-muted-foreground">
            Os scans do QR Code aparecerão aqui
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{scans.length} scan{scans.length !== 1 ? "s" : ""} registrado{scans.length !== 1 ? "s" : ""}</p>
      </div>

      {scans.map((scan) => (
        <div key={scan.id} className="border rounded-lg p-3 flex items-start gap-3">
          <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{scan.name ?? "Anônimo"}</span>
              {scan.lead && (
                <Badge variant="secondary" className="text-xs">Lead criado</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {scan.email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-3" /> {scan.email}
                </span>
              )}
              {scan.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3" /> {scan.phone}
                </span>
              )}
              <span>{new Date(scan.createdAt).toLocaleDateString("pt-BR", { dateStyle: "short" })}</span>
            </div>
          </div>
          {scan.lead && (
            <Link
              href={`/tracking`}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-4" />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
