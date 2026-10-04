"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkspaceError({ error }: { error: Error & { digest?: string } }) {
  const router = useRouter();

  useEffect(() => {
    // Sem este registro o erro some: a tela só volta para a lista. O digest acha a causa no log do servidor.
    console.error("[workspace] erro ao abrir o projeto", error.digest ?? error.message, error);
    router.replace("/workspaces");
  }, [error, router]);

  return null;
}
