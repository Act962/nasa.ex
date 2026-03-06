"use client";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { useCreateLeadFile, useLeadFiles } from "../../hooks/use-lead-file";
import { Button } from "@/components/ui/button";
import {
  DownloadIcon,
  FileIcon,
  SquareArrowOutUpRightIcon,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CreateFile } from "./create-file";
import { formatDate } from "date-fns";
import { handleDownload, handleOpen } from "@/utils/handle-files";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function LeadFiles({ leadId }: { leadId: string }) {
  const mutation = useCreateLeadFile(leadId);
  const [open, setOpen] = useState(false);

  const { files, isLoading } = useLeadFiles(leadId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  function handleCreateFile(name: string, fileUrl: string) {
    const mimeType = fileUrl.split(".").pop() || "application/pdf";

    console.log({ fileUrl, mimeType, name, leadId });
    mutation.mutate(
      { fileUrl, mimeType, name, leadId },
      {
        onSuccess: () => {
          setOpen(false);
        },
      },
    );
  }

  const disabled = mutation.isPending;

  return (
    <div className="flex flex-col w-full h-full min-h-0 space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">Arquivos</h2>
        <CreateFile
          onConfirm={handleCreateFile}
          disabled={disabled}
          open={open}
          onOpenChange={setOpen}
        >
          <Button>Novo arquivo</Button>
        </CreateFile>
      </div>
      <ScrollArea className="flex-1 w-full min-h-0 rounded-md">
        <div className="flex flex-col gap-4 pr-4">
          {files &&
            files?.map((file) => {
              const url = useConstructUrl(file.fileUrl);
              return (
                <Item key={file.id}>
                  <ItemContent>
                    <ItemTitle>{file.name}</ItemTitle>
                    <ItemDescription>
                      {formatDate(file.createdAt, "dd/MM/yyyy HH:mm:ss")}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="outline"
                      onClick={() => handleDownload(url, file.name)}
                    >
                      <DownloadIcon className="size-4" />
                    </Button>
                    <Button variant="outline" onClick={() => handleOpen(url)}>
                      <SquareArrowOutUpRightIcon className="size-4" />
                    </Button>
                  </ItemActions>
                </Item>
              );
            })}

          {!files?.length && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum arquivo encontrado</EmptyTitle>
                <EmptyDescription>
                  Você ainda não tem nenhum arquivo. Comece criando seu primeiro
                  arquivo.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row justify-center gap-2">
                <CreateFile
                  open={open}
                  onOpenChange={setOpen}
                  onConfirm={handleCreateFile}
                  disabled={disabled}
                >
                  <Button>Fazer upload</Button>
                </CreateFile>
              </EmptyContent>
            </Empty>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
