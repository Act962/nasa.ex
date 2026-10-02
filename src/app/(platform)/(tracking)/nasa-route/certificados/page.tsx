import { CertificatesList } from "@/features/nasa-route/components/student/certificates-list";
import { NasaRouteShell } from "@/features/nasa-route/components/shared/nasa-route-shell";

export default function NasaRouteCertificatesPage() {
  return (
    <NasaRouteShell>
      <CertificatesList />
    </NasaRouteShell>
  );
}
