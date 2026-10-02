import { notFound } from "next/navigation";
import { ALL_MODULES, type AppModule } from "@/features/insights/types";
import { AppInsightsEntry } from "@/features/insights/components/app-insights-entry";

/**
 * Relatório de um App (`/insights/<app>`): o Insights abre com só esse App marcado no seletor.
 * O segmento se chama `organizationId` porque o Next exige o mesmo nome de parâmetro que a rota
 * pública `/insights/[organizationId]/[insight-slug]`; aqui o valor é o slug do App.
 */
export default async function Page({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId: appSlug } = await params;
  if (!ALL_MODULES.includes(appSlug as AppModule)) notFound();
  return (
    <div className="h-full w-full">
      <AppInsightsEntry appModule={appSlug as AppModule} />
    </div>
  );
}
