import type { Metadata } from "next";
import { TourOverlay } from "@/features/tour/overlay";

export const metadata: Metadata = {
  title: "trafeGO — tráfego pago sem agência",
  description:
    "Contrate tráfego pago no Meta ou disparo no WhatsApp Oficial em minutos. Você escolhe o plano, envia os criativos e nossa equipe coloca no ar.",
};

export default function TrafegoPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="w-full min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {children}
      {/* O guia do Astro começa no painel da plataforma e continua aqui (spec 0050). */}
      <TourOverlay />
    </main>
  );
}
