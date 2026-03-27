"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Error() {
  const router = useRouter();
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <h2 className="text-2xl font-bold">Algo deu errado!</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Por favor, tente novamente mais tarde.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <Button onClick={() => router.push("/")}>
          Ir para a página inicial
        </Button>
      </div>
    </div>
  );
}
