"use client";

import { ModeToggle } from "@/components/mode-toggle";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

export default function Page() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <div className="px-4">
      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">Nome</h2>
          <span className="text-xs text-muted-foreground">
            Mude o nome exibido na interface
          </span>
        </div>
        <Input
          placeholder="Digite seu nome"
          value={session?.user?.name}
          className="w-64"
          disabled
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">E-mail</h2>
          <span className="text-xs text-muted-foreground">
            Mude o e-mail exibido na interface
          </span>
        </div>
        <Input
          placeholder="Digite seu e-mail"
          value={session?.user?.email}
          className="w-64"
          disabled
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between py-6">
        <div>
          <h2 className="font-medium">Tema</h2>
          <span className="text-xs text-muted-foreground">
            Mude o tema para o modo escuro
          </span>
        </div>
        <ModeToggle />
      </div>
    </div>
  );
}
