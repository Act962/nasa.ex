import { CertificateDetailPage } from "@/features/nasa-route/components/student/certificate-page";
import { NasaRouteShell } from "@/features/nasa-route/components/shared/nasa-route-shell";
import { StudentDockRegistrar } from "@/features/nasa-route/components/shared/student-dock-registrar";

export default async function NasaRouteCertificateDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <NasaRouteShell>
      <StudentDockRegistrar activeSection="certificates" />
      <CertificateDetailPage code={code} isAuthenticated />
    </NasaRouteShell>
  );
}
