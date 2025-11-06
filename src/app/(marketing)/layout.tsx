import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import React from "react";
import { Navbar } from "./_components/navbar";
import { Footer } from "./_components/footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full relative">
      <Navbar />
      <main className="relative h-full flex items-center justify-center z-99999">
        {children}
      </main>
      <Footer />
      <ShootingStars />
      <StarsBackground />
    </div>
  );
}
