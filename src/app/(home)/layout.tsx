import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import React from "react";
import { Navbar } from "./_components/navbar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Usuários já autenticados vão direto para o NASA Explorer
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/home");

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
