import type { Metadata } from "next";
import Link from "next/link";
import { OrbitaStationClient } from "@/features/orbita-station/components/orbita-station-client";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { requireAuth } from "@/lib/auth-utils";

export const metadata: Metadata = { title: "Órbita Station" };

function AccessMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="grid h-dvh place-items-center bg-background p-6">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{detail}</p>
        <Link href="/home" className="text-sm font-medium underline underline-offset-4">
          Voltar para o início
        </Link>
      </div>
    </main>
  );
}

export default async function OrbitaStationPage() {
  const session = await requireAuth();
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    return <AccessMessage title="Escolha uma empresa" detail="A Órbita Station é da empresa: escolha uma empresa ativa para entrar." />;
  }
  // A estação começa liberada só para o Master; ele abre para a equipe na matriz de Permissões (spec 0119, D-4).
  const canView = await hasAppPermission(organizationId, session.user.id, "orbita-station", "canView");
  if (!canView) {
    return (
      <AccessMessage
        title="Você ainda não tem acesso à Órbita Station"
        detail="Peça ao Master da empresa para liberar em Configurações → Permissões → Órbita Station 3D."
      />
    );
  }
  return <OrbitaStationClient userId={session.user.id} />;
}
