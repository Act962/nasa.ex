"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { AppTemplateToggle } from "@/features/admin/components/app-template-toggle";

interface TemplateSettingsProps {
  trackingId: string;
}

export function TemplateSettings({ trackingId }: TemplateSettingsProps) {
  const { data: tracking } = useQuery(
    orpc.tracking.get.queryOptions({ input: { trackingId } })
  );

  if (!tracking) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Padrões NASA</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Marque este tracking como um padrão NASA para que ele possa ser duplicado em outras empresas com dados fictícios.
        </p>
      </div>

      <AppTemplateToggle
        appId={trackingId}
        appType="tracking"
        isTemplate={tracking.isTemplate ?? false}
      />
    </div>
  );
}
