import type { Metadata } from "next";
import { OrbitaStationClient } from "@/features/orbita-station/components/orbita-station-client";
import { requireAuth } from "@/lib/auth-utils";

export const metadata: Metadata = { title: "Órbita Station" };

export default async function OrbitaStationPage() {
  const session = await requireAuth();
  return <OrbitaStationClient userId={session.user.id} />;
}
