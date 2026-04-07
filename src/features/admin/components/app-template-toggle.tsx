"use client";

import { useState } from "react";
import { useAppTemplate } from "@/features/admin/hooks/use-app-template";

type AppType = "tracking" | "workspace" | "forge-proposal" | "forge-contract" | "form";

interface AppTemplateToggleProps {
  appId: string;
  appType: AppType;
  isTemplate: boolean;
  onToggle?: (marked: boolean) => void;
}

export function AppTemplateToggle({
  appId,
  appType,
  isTemplate,
  onToggle,
}: AppTemplateToggleProps) {
  const { toggleTemplate, isLoading } = useAppTemplate();
  const [isMarked, setIsMarked] = useState(isTemplate);

  const handleToggle = async () => {
    const newValue = !isMarked;
    try {
      await toggleTemplate(appType, appId, newValue);
      setIsMarked(newValue);
      onToggle?.(newValue);
    } catch (error) {
      // Error already handled by toast in hook
    }
  };

  return (
    <div className="flex items-center gap-3 p-4 border border-zinc-800 rounded-lg bg-zinc-900">
      <div className="flex-1">
        <p className="text-sm font-medium text-white">Marcar como Padrão NASA</p>
        <p className="text-xs text-zinc-400 mt-1">
          Este {appType} será disponível como modelo pré-configurado para outras
          empresas
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
          isMarked ? "bg-violet-600" : "bg-zinc-700"
        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
            isMarked ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
