"use client";

import dynamic from "next/dynamic";

// Three.js só entra no bundle desta rota e nunca roda no servidor (spec 0117, RNF-1).
const OrbitaStationView = dynamic(() => import("./orbita-station-view").then((module) => module.OrbitaStationView), {
  ssr: false,
  loading: () => <div className="h-dvh w-full bg-black" />,
});

export function OrbitaStationClient({ userId }: { userId: string }) {
  return <OrbitaStationView userId={userId} />;
}
