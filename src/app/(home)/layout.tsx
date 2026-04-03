import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import React from "react";
import { Navbar } from "./_components/navbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Não redireciona usuários autenticados — eles podem visualizar os planos
  // e a landing page normalmente. O navbar detecta o estado de login
  // e exibe "Entrar no NASA" em vez dos botões de cadastro.

  return (
    <div className="relative bg-black min-h-screen overflow-x-hidden">
      <Navbar />
      <main className="relative z-10">{children}</main>
      {/* Fixed star background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ShootingStars />
        <StarsBackground />
      </div>
    </div>
  );
}
