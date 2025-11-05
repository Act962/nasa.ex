import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import React from "react";
import { Header } from "./_components/header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full relative bg-[#09090b]">
      <Header />
      <main className="relative h-full flex items-center justify-center z-99999">
        {children}
      </main>
      <ShootingStars />
      <StarsBackground />
    </div>
  );
}
