"use client";

import { useEffect, useState } from "react";
import { Copy, Loader } from "lucide-react";
import { useAdminToast } from "@/features/admin/hooks/use-admin-toast";

type AppType = "tracking" | "workspace" | "forge-proposal" | "forge-contract" | "form";

interface AppTemplatesGalleryProps {
  appType: AppType;
  organizationId: string;
  onDuplicate?: (templateId: string) => void;
}

interface Template {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: string;
}

export function AppTemplatesGallery({
  appType,
  organizationId,
  onDuplicate,
}: AppTemplatesGalleryProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const toast = useAdminToast();

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch(`/api/admin/app-templates?appType=${appType}`);
        if (!response.ok) throw new Error("Erro ao buscar padrões");

        const data = await response.json();
        const typeData =
          data[
            appType === "forge-proposal"
              ? "forgeProposal"
              : appType === "forge-contract"
                ? "forgeContract"
                : appType
          ] ?? [];

        setTemplates(typeData);
      } catch (error) {
        toast.error("Erro ao buscar padrões");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, [appType, toast]);

  const handleDuplicate = async (templateId: string) => {
    setIsDuplicating(templateId);
    try {
      // TODO: Implement duplication logic for each app type
      onDuplicate?.(templateId);
      toast.success("Padrão duplicado com sucesso!");
    } catch (error) {
      toast.error("Erro ao duplicar padrão");
    } finally {
      setIsDuplicating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Nenhum padrão disponível para este tipo de app</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <div
          key={template.id}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
        >
          <div className="mb-4">
            {template.color && (
              <div
                className="w-full h-12 rounded-lg mb-2 border border-zinc-700"
                style={{ backgroundColor: template.color }}
              />
            )}
            <h3 className="font-semibold text-white mb-1">
              {template.name || template.title || "Sem nome"}
            </h3>
            {template.description && (
              <p className="text-xs text-zinc-400 mb-2">{template.description}</p>
            )}
            <p className="text-xs text-zinc-500">
              {new Date(template.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>

          <button
            onClick={() => handleDuplicate(template.id)}
            disabled={isDuplicating === template.id}
            className="w-full flex items-center justify-center gap-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Copy className="w-3 h-3" />
            {isDuplicating === template.id ? "Duplicando..." : "Duplicar"}
          </button>
        </div>
      ))}
    </div>
  );
}
