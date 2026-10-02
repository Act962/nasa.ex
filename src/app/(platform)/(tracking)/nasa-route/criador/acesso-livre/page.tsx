import { CreatorFreeAccessPage } from "@/features/nasa-route/components/creator/creator-free-access-page";
import { NasaRouteShell } from "@/features/nasa-route/components/shared/nasa-route-shell";

export default function FreeAccessPage() {
  return (
    <NasaRouteShell>
      <CreatorFreeAccessPage />
    </NasaRouteShell>
  );
}
