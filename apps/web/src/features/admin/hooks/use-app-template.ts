"use client";

import { useState } from "react";
import { toast } from "sonner";

type AppType = "tracking" | "workspace" | "forge-proposal" | "forge-contract" | "form";

export function useAppTemplate() {
  const [isLoading, setIsLoading] = useState(false);

  const toggleTemplate = async (
    appType: AppType,
    appId: string,
    marked: boolean
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/app-template/${appType}/${appId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateMarkedByModerator: marked }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao marcar padrão");
      }

      const appTypeLabel = {
        tracking: "Tracking",
        workspace: "Workspace",
        "forge-proposal": "Proposta",
        "forge-contract": "Contrato",
        form: "Formulário",
      }[appType];

      toast.success(
        marked
          ? `${appTypeLabel} marcado como padrão NASA`
          : `${appTypeLabel} removido dos padrões`
      );

      return await response.json();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao marcar padrão");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { toggleTemplate, isLoading };
}
