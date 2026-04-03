"use client";

import { useState } from "react";
import { useAdminToast } from "./use-admin-toast";

type AppType = "tracking" | "workspace" | "forge-proposal" | "forge-contract";

export function useAppTemplate() {
  const toast = useAdminToast();
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

      if (!response.ok) throw new Error("Erro ao marcar padrão");

      const appTypeLabel = {
        tracking: "Tracking",
        workspace: "Workspace",
        "forge-proposal": "Proposta",
        "forge-contract": "Contrato",
      }[appType];

      toast.success(
        marked
          ? `${appTypeLabel} marcado como padrão NASA`
          : `${appTypeLabel} removido dos padrões`
      );

      return await response.json();
    } catch (error) {
      toast.error("Erro ao marcar padrão");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { toggleTemplate, isLoading };
}
