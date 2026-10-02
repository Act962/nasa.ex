import { Suspense } from "react";
import { NasaRouteHome } from "@/features/nasa-route/components/student/nasa-route-home";
import { NasaRouteShell } from "@/features/nasa-route/components/shared/nasa-route-shell";

export default function NasaRoutePage() {
  return (
    <NasaRouteShell>
      <Suspense>
        <NasaRouteHome />
      </Suspense>
    </NasaRouteShell>
  );
}
