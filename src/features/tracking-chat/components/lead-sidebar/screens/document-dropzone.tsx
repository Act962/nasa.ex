"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { CheckCircle2Icon, FileUpIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { uploadFileToStorage } from "@/lib/upload-to-storage";
import { useMutationFileMessage, useMutationImageMessage } from "@/features/tracking-chat/hooks/use-messages";

// Enviar documento ao lead direto da tela "Documentos": clica ou solta o
// arquivo, ele sobe para o storage e vai pela conversa, como o anexo do chat.

const MAX_FILE_BYTES = 25 * 1024 * 1024;

interface DocumentDropzoneProps {
  conversationId: string;
  lead: { id: string; name: string; phone: string | null };
}

export function DocumentDropzone({ conversationId, lead }: DocumentDropzoneProps) {
  const { data: session } = authClient.useSession();
  const [progress, setProgress] = useState<number | null>(null);
  const [sentFileName, setSentFileName] = useState<string | null>(null);
  const sendFile = useMutationFileMessage({ conversationId, lead });
  const sendImage = useMutationImageMessage({ conversationId, lead });

  const sendToLead = async (file: File) => {
    if (!lead.phone) {
      toast.error("Este lead não tem telefone: não há para onde enviar.");
      return;
    }
    setSentFileName(null);
    setProgress(0);
    try {
      const isImage = file.type.startsWith("image/");
      const mediaUrl = await uploadFileToStorage(file, { isImage, onProgress: setProgress });
      const body = `*${session?.user.name ?? ""}*`;
      const onSuccess = () => {
        setSentFileName(file.name);
        toast.success(`"${file.name}" enviado para ${lead.name}.`);
      };
      if (isImage) {
        sendImage.mutate({ body, mediaUrl, conversationId, leadPhone: lead.phone }, { onSuccess });
      } else {
        sendFile.mutate(
          {
            body,
            mediaUrl,
            fileName: file.name,
            mimetype: file.type || "application/octet-stream",
            conversationId,
            leadPhone: lead.phone,
          },
          { onSuccess },
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar o documento.");
    } finally {
      setProgress(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    maxSize: MAX_FILE_BYTES,
    disabled: progress !== null,
    onDropAccepted: ([file]) => void sendToLead(file),
    onDropRejected: () => toast.error("Arquivo inválido ou maior que 25 MB."),
  });

  const isUploading = progress !== null;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        isDragActive ? "border-sky-400 bg-sky-500/10" : "border-muted-foreground/25 hover:border-sky-400/60 hover:bg-muted/40",
        isUploading && "cursor-wait",
      )}
    >
      <input {...getInputProps()} />
      <div
        className={cn(
          "flex size-20 items-center justify-center rounded-full bg-sky-500/10 text-sky-400 transition-transform duration-300",
          isDragActive ? "scale-110" : !isUploading && "animate-bounce [animation-duration:2s]",
        )}
      >
        {isUploading ? (
          <Loader2Icon className="size-10 animate-spin" />
        ) : sentFileName ? (
          <CheckCircle2Icon className="size-10 text-emerald-400" />
        ) : (
          <FileUpIcon className="size-10" />
        )}
      </div>
      <p className="text-sm font-medium">
        {isUploading
          ? `Enviando… ${progress}%`
          : isDragActive
            ? "Solte para enviar"
            : "Clique aqui ou solte o documento para enviar para o lead"}
      </p>
      <p className="text-xs text-muted-foreground">
        {sentFileName ? `Último enviado: ${sentFileName}` : `Vai pela conversa com ${lead.name}. Até 25 MB.`}
      </p>
    </div>
  );
}
