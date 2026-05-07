import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Space Station | NASA Agents",
  description: "Espaço virtual de networking e colaboração",
};

export default function SpaceStationLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-950 p-0 m-0">
      {children}
    </main>
  );
}
