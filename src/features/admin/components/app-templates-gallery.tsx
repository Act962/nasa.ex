"use client";

import { useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useAdminToast } from "@/features/admin/hooks/use-admin-toast";
import { useDeleteAppTemplate } from "@/features/admin/hooks/use-delete-app-template";
import { authClient } from "@/lib/auth-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AppType =
  | "tracking"
  | "workspace"
  | "forge-proposal"
  | "forge-contract"
  | "form";

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const toast = useAdminToast();
  const { data: session } = authClient.useSession();

  const isSystemAdmin = (session?.user as { isSystemAdmin?: boolean })?.isSystemAdmin;
  const canManage = !!isSystemAdmin;

  const { mutate: deleteTemplate, isPending: isDeleting } = useDeleteAppTemplate();

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
      } catch {
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
      onDuplicate?.(templateId);
      toast.success("Padrão duplicado com sucesso!");
    } catch {
      toast.error("Erro ao duplicar padrão");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteTemplate(
      { templateId: deleteId, appType },
      {
        onSuccess: () => {
          setTemplates((prev) => prev.filter((t) => t.id !== deleteId));
          setDeleteId(null);
          setConfirmName("");
        },
      },
    );
  };

  const templateToDelete = templates.find((t) => t.id === deleteId);
  const deleteConfirmNameMatch =
    templateToDelete &&
    (templateToDelete.name || templateToDelete.title || "").toLowerCase().trim() ===
      confirmName.toLowerCase().trim();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <OrbitaSpinner className="w-6 h-6 text-info " />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum padrão disponível para este tipo de app</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <div
          key={template.id}
          className="bg-card border border-border rounded-xl p-4 hover:border-line transition-colors"
        >
          <div className="mb-4">
            {template.color && (
              <div
                className="w-full h-12 rounded-lg mb-2 border border-line"
                style={{ backgroundColor: template.color }}
              />
            )}
            <h3 className="font-semibold text-foreground mb-1">
              {template.name || template.title || "Sem nome"}
            </h3>
            {template.description && (
              <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {new Date(template.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleDuplicate(template.id)}
              disabled={isDuplicating === template.id}
              className="flex-1 flex items-center justify-center gap-2 bg-info/20 hover:bg-info/30 text-info text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <Copy className="w-3 h-3" />
              {isDuplicating === template.id ? "Duplicando..." : "Duplicar"}
            </button>
            {canManage && (
              <button
                onClick={() => setDeleteId(template.id)}
                className="px-3 flex items-center justify-center bg-destructive/20 hover:bg-destructive/30 text-destructive text-xs font-semibold py-2 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      ))}

      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setConfirmName("");
          }
        }}
      >
        <DialogContent className="bg-popover border-line text-foreground">
          <DialogHeader>
            <DialogTitle>Deletar Padrão</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Esta ação removerá o item da galeria de padrões. O registro original
              continuará existindo, mas não será mais exibido como padrão para outros usuários.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm">
              Para confirmar, digite o nome do padrão:{" "}
              <span className="font-bold text-info">
                {templateToDelete?.name || templateToDelete?.title}
              </span>
            </p>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Digite o nome aqui..."
              className="bg-card border-border focus:ring-ring text-foreground"
            />
          </div>

          <DialogFooter className="mt-auto">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteId(null);
                setConfirmName("");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || !deleteConfirmNameMatch}
              className="bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-50"
            >
              {isDeleting ? "Deletando..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
