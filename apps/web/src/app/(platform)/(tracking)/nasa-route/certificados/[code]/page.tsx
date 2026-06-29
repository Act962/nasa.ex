import { CertificateDetailPage } from "@/features/nasa-route/components/student/certificate-page";

export default async function NasaRouteCertificateDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <CertificateDetailPage code={code} isAuthenticated />;
}
