"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { Logo } from "./logo";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import { PlanPurchaseModal } from "@/features/stars/components/plan-purchase-modal";
import { Menu, Sparkles } from "lucide-react";

const NAV_LINKS = [
  { href: "/#planos", label: "Planos" },
  { href: "/#o-que-e-nasa", label: "O que é NASA?" },
  { href: "/#como-funciona", label: "Como funciona" },
];

export function Navbar() {
  const { data: session, isPending } = authClient.useSession();
  const isLoggedIn = !!session?.user && !isPending;

  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: balanceData } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    enabled: isLoggedIn,
  });

  const planName = balanceData?.planName;
  const planSlug = balanceData?.planSlug;

  return (
    <header className="fixed top-0 w-full z-[99999] px-4 py-3 sm:px-5 flex items-center gap-2 backdrop-blur-md bg-black/60 border-b border-white/5">
      <div className="flex shrink-0 items-center">
        <Logo />
      </div>

      <nav className="hidden md:flex flex-1 items-center justify-center gap-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-white/50 hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-white/5 whitespace-nowrap transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex w-full items-center justify-between gap-x-2 md:ml-auto md:w-auto md:shrink-0 md:justify-end">
        {isPending && <Spinner />}

        {!session?.user && !isPending && (
          <>
            <Button
              variant="ghost"
              asChild
              className="hidden md:flex cursor-pointer text-white/70 hover:text-white hover:bg-white/5"
            >
              <Link href="/sign-in">Entrar</Link>
            </Button>
            <Button
              asChild
              className="flex cursor-pointer bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2 rounded-xl whitespace-nowrap"
            >
              <Link href="/sign-up">Começar gratuitamente</Link>
            </Button>
          </>
        )}

        {session?.user && !isPending && (
          <>
            {/* Plan name button, opens PlanPurchaseModal */}
            {planName && (
              <Button
                variant="ghost"
                onClick={() => setPurchaseOpen(true)}
                className="hidden md:flex cursor-pointer items-center gap-1.5 text-white/50 hover:text-white hover:bg-white/5 text-sm font-medium rounded-xl whitespace-nowrap"
              >
                <Sparkles className="size-3.5 text-violet-400" />
                {planName}
              </Button>
            )}

            <Button
              asChild
              className="cursor-pointer bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl whitespace-nowrap"
            >
              <Link href="/home">Entrar no NASA</Link>
            </Button>
          </>
        )}

        {/* Mobile menu */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir menu"
              className="md:hidden cursor-pointer text-white/70 hover:text-white hover:bg-white/5"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-3/4 max-w-xs border-white/10 bg-black/95 text-white backdrop-blur-md"
          >
            <SheetHeader>
              <SheetTitle className="text-white">Menu</SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col gap-1 px-4">
              {NAV_LINKS.map((link) => (
                <SheetClose asChild key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/70 hover:text-white text-base font-medium px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {link.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>

            <div className="mt-auto flex flex-col gap-2 p-4">
              {session?.user && planName && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMenuOpen(false);
                    setPurchaseOpen(true);
                  }}
                  className="cursor-pointer justify-start items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/5 font-medium rounded-xl"
                >
                  <Sparkles className="size-4 text-violet-400" />
                  {planName}
                </Button>
              )}

              {!session?.user && !isPending && (
                <SheetClose asChild>
                  <Button
                    asChild
                    className="cursor-pointer w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl"
                  >
                    <Link href="/sign-up">Começar gratuitamente</Link>
                  </Button>
                </SheetClose>
              )}

            </div>
          </SheetContent>
        </Sheet>
      </div>

      <PlanPurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        currentPlanSlug={planSlug}
      />
    </header>
  );
}
