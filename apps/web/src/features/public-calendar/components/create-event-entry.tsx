"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function CreateEventEntry() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) return null;

  const handleClick = () => {
    if (session?.user) {
      router.push("/calendario/criar-evento");
      return;
    }
    // Usuário não cadastrado: vai pro sign-up; após criar conta volta pra
    // /calendario/criar-evento, que provisiona org + workspace + abre modal.
    router.push("/sign-up?callbackUrl=/calendario/criar-evento");
  };

  return (
    <Button onClick={handleClick} size="lg" className="gap-2">
      <Plus className="h-4 w-4" />
      Criar Evento
    </Button>
  );
}
