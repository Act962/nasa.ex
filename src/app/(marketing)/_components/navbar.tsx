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
    <header className="fixed top-0 w-full z-999999 p-4 ">
      <Logo />
      <div className="md:ml-auto md:justify-end justify-between w-full flex items-center gap-x-2">
        {isPending && <Spinner />}
        {!session?.user && !isPending && (
          <>
            <Button variant="ghost" asChild className="cursor-pointer">
              <Link href="/sign-in">Entrar</Link>
            </Button>
            <Button asChild className="cursor-pointer">
              <Link href="/sign-up">Começar gratuitamente</Link>
            </Button>
          </>
        )}
        {session?.user && !isPending && (
          <>
            <Button asChild className="cursor-pointer">
              <Link href="/sign-out">Entrar</Link>
            </Button>
          </>
        )}
        <ModeToggle />
      </div>
    </header>
  );
}
