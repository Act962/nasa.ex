"use client";

import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function Heading() {
  const { data: session, isPending } = authClient.useSession();
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">
        Suas ideias e Seus Planos. Bem-vindo ao{" "}
        <span className="underline">N.A.S.A</span>
      </h1>
      <h3 className="text-base sm:text-xl md:text-2xl font-medium">
        Descubra um universo de opções para <br /> gestão de trabalho em equipe
      </h3>
      {isPending && (
        <div className="w-full flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}
      {session?.user && !isPending && (
        <Button asChild>
          <Link href="/tracking">
            Entrar no Nasa
            <ArrowRight className="size-4 " />
          </Link>
        </Button>
      )}

      {!session?.user && !isPending && (
        <Button asChild className="cursor-pointer">
          <Link href="/sign-up">Começar gratuitamente</Link>
        </Button>
      )}
    </div>
  );
}
