"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { NasaPlannerPostType } from "@/generated/prisma/enums";
import { useImportPlannerCreation } from "../../hooks/use-planner-creations";
import { uploadBrandFile } from "../brand-kit/brand-file-upload";
import { POST_TYPE_META, POST_TYPES } from "./planner-v2-utils";
import type { PlannerClient } from "./planner-v2-types";

/** "Trouxe de outra IA?" (spec 0065, RF-7): sobe a imagem/vídeo como rascunho com a origem marcada. */

const ORIGIN_OPTIONS = ["ChatGPT", "Gemini", "Midjourney", "Canva", "Outra IA"];

export function ImportCreationDialog({ isOpen, clients, onClose }: { isOpen: boolean; clients: PlannerClient[]; onClose: () => void }) {
  const creatableClients = clients.filter((client) => client.permissions.canCreate);
  const [chosenOrganizationId, setOrganizationId] = useState("");
  // Clientes chegam depois da 1ª renderização: sem escolha, vale o primeiro.
  const organizationId = chosenOrganizationId || creatableClients[0]?.id || "";
  const [origin, setOrigin] = useState(ORIGIN_OPTIONS[0]);
  const [format, setFormat] = useState<NasaPlannerPostType>("STATIC");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importCreation = useImportPlannerCreation();

  const pickFile = async (file: File | undefined) => {
    if (!file || !organizationId) return;
    setIsUploading(true);
    try {
      const mediaKey = await uploadBrandFile(file);
      importCreation.mutate(
        { organizationId, format, originLabel: origin, mediaKey, isVideo: file.type.startsWith("video/"), title: file.name.replace(/\.[^.]+$/, "") },
        {
          onSuccess: () => {
            toast.success(`Criação do ${origin} em Rascunho no Kanban.`);
            onClose();
          },
          onError: (error) => toast.error(error.message),
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não deu para enviar o arquivo.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-[22px] sm:max-w-sm max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-t-[26px] max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100">
        <DialogHeader>
          <DialogTitle>Trouxe de outra IA?</DialogTitle>
          <DialogDescription>Envie a imagem ou o vídeo. Ele entra como rascunho, com a origem marcada, para revisar e aprovar.</DialogDescription>
        </DialogHeader>
        {creatableClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você não tem permissão para criar posts em nenhum cliente.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold">De onde veio</p>
              <div className="flex flex-wrap gap-1">
                {ORIGIN_OPTIONS.map((option) => (
                  <button key={option} type="button" onClick={() => setOrigin(option)} className={cn("rounded-full px-2.5 py-1 text-xs", origin === option ? "bg-foreground font-semibold text-background" : "bg-panel")}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold">Formato</p>
              <div className="flex flex-wrap gap-1">
                {POST_TYPES.map((type) => (
                  <button key={type} type="button" onClick={() => setFormat(type)} className={cn("rounded-full px-2.5 py-1 text-xs", format === type ? "bg-foreground font-semibold text-background" : "bg-panel")}>
                    {POST_TYPE_META[type].label}
                  </button>
                ))}
              </div>
            </div>
            {creatableClients.length > 1 && (
              <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="w-full rounded-full bg-panel px-3 py-1.5 text-sm">
                {creatableClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              disabled={isUploading || importCreation.isPending}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground py-2 text-sm font-semibold text-background disabled:opacity-40"
            >
              {isUploading || importCreation.isPending ? <OrbitaSpinner className="size-4" /> : <Upload className="size-4" />} Enviar imagem ou vídeo
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => void pickFile(event.target.files?.[0])} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
