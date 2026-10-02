"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useWorkspaces } from "../hooks/use-workspace";
import { forgetLastWorkspaceId, readLastWorkspaceId } from "../lib/last-workspace";

/** Redireciona para o último projeto aberto, se ele ainda existir e for do usuário; senão, para a lista. */
export function OpenLastWorkspace() {
  const router = useRouter();
  const { data, isSuccess, isError } = useWorkspaces();

  useEffect(() => {
    if (isError) {
      router.replace("/workspaces");
      return;
    }
    if (!isSuccess) return;
    const lastWorkspaceId = readLastWorkspaceId();
    const stillExists = Boolean(lastWorkspaceId && data.workspaces.some((workspace) => workspace.id === lastWorkspaceId));
    if (lastWorkspaceId && !stillExists) forgetLastWorkspaceId();
    router.replace(stillExists ? `/workspaces/${lastWorkspaceId}` : "/workspaces");
  }, [data, isError, isSuccess, router]);

  return (
    <div className="grid h-full w-full place-items-center">
      <OrbitaSpinner className="size-10" />
    </div>
  );
}
