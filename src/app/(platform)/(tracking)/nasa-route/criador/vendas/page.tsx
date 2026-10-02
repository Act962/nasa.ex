import { SalesTable } from "@/features/nasa-route/components/creator/sales-table";
import { NasaRouteShell } from "@/features/nasa-route/components/shared/nasa-route-shell";

export default function SalesPage() {
  return (
    <NasaRouteShell>
      <SalesTable />
    </NasaRouteShell>
  );
}
