"use client";

import Link from "next/link";
import { MessageCircleWarning } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useHasMetaCloudInstance } from "../hooks/use-has-meta-cloud-instance";

interface WhatsAppAnalyticsGuardProps {
  trackingId: string;
  children: React.ReactNode;
}

/**
 * Só renderiza o dashboard quando a tracking tem uma instância WhatsApp
 * Oficial (Meta Cloud) configurada — esses dados só existem via Graph API
 * da Meta. Cobre também o acesso direto pela URL sem essa instância.
 */
export function WhatsAppAnalyticsGuard({
  trackingId,
  children,
}: WhatsAppAnalyticsGuardProps) {
  const { hasMetaCloudInstance, isLoading } =
    useHasMetaCloudInstance(trackingId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!hasMetaCloudInstance) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <MessageCircleWarning className="size-8 text-muted-foreground" />
        <p className="max-w-sm text-sm text-muted-foreground">
          Esta funcionalidade requer uma instância WhatsApp Oficial (Meta
          Cloud) conectada nesta tracking.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/tracking/${trackingId}/settings?tab=instance`}>
            Ir para Integrações
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
