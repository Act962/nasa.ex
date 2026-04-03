"use client";
import { authClient } from "@/lib/auth-client";
import { Logo } from "./logo";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";

export function Navbar() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <header className="fixed top-0 w-full z-[99999] px-5 py-3 flex items-center justify-between backdrop-blur-md bg-black/60 border-b border-white/5">
      <Logo />
      <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
        <Link href="/#planos"
          className="text-white/50 hover:text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
          Planos
        </Link>
        <Link href="/#funcionalidades"
          className="text-white/50 hover:text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
          Funcionalidades
        </Link>
        <Link href="/#integrações"
          className="text-white/50 hover:text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
          Integrações
        </Link>
      </nav>
      <div className="md:ml-auto md:justify-end justify-between w-full flex items-center gap-x-2">
        {isPending && <Spinner />}
        {!session?.user && !isPending && (
          <>
            <Button variant="ghost" asChild className="cursor-pointer text-white/70 hover:text-white hover:bg-white/5">
              <Link href="/sign-in">Entrar</Link>
            </Button>
            <Button asChild className="hidden md:flex cursor-pointer bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2 rounded-xl">
              <Link href="/sign-up">Começar gratuitamente</Link>
            </Button>
          </>
        )}
        {session?.user && !isPending && (
          <>
            <Button variant="ghost" asChild className="hidden md:flex cursor-pointer text-white/50 hover:text-white hover:bg-white/5">
              <Link href="/#planos">Planos</Link>
            </Button>
            <Button asChild className="cursor-pointer bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl">
              <Link href="/tracking">Entrar no NASA</Link>
            </Button>
          </>
        )}
        <ModeToggle />
      </div>
    </header>
  );
}
