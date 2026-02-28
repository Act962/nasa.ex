import { cn } from "@/lib/utils";
import { FileIcon, ImageIcon, Trash2, UploadIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import Link from "next/link";

export function RenderEmptyState({ isDragActive }: { isDragActive: boolean }) {
  return (
    <div className="text-center">
      <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-muted mb-4">
        <UploadIcon
          className={cn(
            " text-muted-foreground",
            isDragActive && "text-primary",
          )}
        />
      </div>
      <p className="text-sm font-semibold text-foreground">
        Arraste e solte arquivos ou{" "}
        <span className="text-primary font-bold cursor-pointer">
          clique para upload
        </span>
      </p>
    </div>
  );
}

export function RenderErrorState() {
  return (
    <div className="text-destructive text-center">
      <div className="flex items-center mx-auto justify-center size-12 rounded-full bg-destructive/30 mb-4">
        <ImageIcon className={cn(" text-destructive")} />
      </div>

      <p className="text-sm font-semibold">Falha no upload</p>
      <p className="text-xs mt-1 text-muted-foreground">Algo deu errado</p>
    </div>
  );
}

export function RenderUploadedState({
  previewUrl,
  isDeleting,
  handleDelete,
  fileType,
}: {
  previewUrl: string;
  isDeleting: boolean;
  handleDelete: () => void;
  fileType: "image" | "video" | "outros";
}) {
  return (
    <div className=" group">
      {/* {fileType === "video" ? (
        <video src={previewUrl} controls className="rounded-md size-full" />
      ) : (
        <Image
          src={previewUrl}
          alt="Uploaded file"
          fill
          className="object-contain p-2"
        />
      )} */}

      {fileType === "image" && (
        <Image
          src={previewUrl}
          alt="Uploaded file"
          fill
          className="object-contain p-2"
        />
      )}

      {fileType === "outros" && (
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <FileIcon className="size-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Arquivo enviado</p>
          <Link
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline"
          >
            Abrir arquivo
          </Link>
        </div>
      )}

      <Button
        variant="destructive"
        size="icon"
        className={cn(
          "absolute top-2 right-2 opacity-0 group-hover:opacity-100",
        )}
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? <Spinner /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  );
}

export function RenderUploadingState({
  progress,
  file,
}: {
  progress: number;
  file: File;
}) {
  return (
    <div className="text-center flex justify-center items-center flex-col">
      <p> {progress}% </p>
      <p className="mt-2 text-sm font-medium text-foreground">
        <Spinner />
      </p>
    </div>
  );
}
