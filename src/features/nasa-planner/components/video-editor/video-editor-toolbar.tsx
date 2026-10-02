"use client";

import {
  MergeIcon,
  ScissorsIcon,
  SparklesIcon,
  DownloadIcon,
  SaveIcon,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Button } from "@/components/ui/button";

interface Props {
  canMerge: boolean;
  canRemoveSilence: boolean;
  canSave: boolean;
  processing: boolean;
  onMerge: () => void;
  onRemoveSilence: () => void;
  onGenerateAI: () => void;
  onSave: () => void;
}

export function VideoEditorToolbar({
  canMerge, canRemoveSilence, canSave, processing,
  onMerge, onRemoveSilence, onGenerateAI, onSave,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 h-8"
        disabled={!canMerge || processing}
        onClick={onMerge}
      >
        {processing ? <OrbitaSpinner className="size-3.5 " /> : <MergeIcon className="size-3.5" />}
        Mesclar Clipes
        <span className="text-[10px] text-muted-foreground ml-0.5">1★</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 h-8"
        disabled={!canRemoveSilence || processing}
        onClick={onRemoveSilence}
      >
        <ScissorsIcon className="size-3.5" />
        Remover Silêncio
        <span className="text-[10px] text-muted-foreground ml-0.5">1★</span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 h-8 text-info border-info/30 hover:border-info"
        onClick={onGenerateAI}
        disabled={processing}
      >
        <SparklesIcon className="size-3.5" />
        Gerar com IA
        <span className="text-[10px] text-muted-foreground ml-0.5">3★</span>
      </Button>

      <div className="flex-1" />

      <Button
        size="sm"
        className="gap-1.5 h-8"
        disabled={!canSave || processing}
        onClick={onSave}
      >
        {processing ? <OrbitaSpinner className="size-3.5 " /> : <SaveIcon className="size-3.5" />}
        Salvar Vídeo
      </Button>
    </div>
  );
}
