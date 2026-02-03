import { Button } from "@/components/ui/button";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { FileIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface FileMessageBoxProps {
  mediaUrl: string;
  mimetype: string;
}

export function FileMessageBox({ mediaUrl, mimetype }: FileMessageBoxProps) {
  const formatUrl = useConstructUrl(mediaUrl);
  const [fileSize, setFileSize] = useState<string>("Carregando...");
  const fileName = useMemo(() => {
    const parts = mediaUrl.split("-");
    return parts.length > 5 ? parts.slice(5).join("-") : mediaUrl;
  }, [mediaUrl]);

  useEffect(() => {
    const getFileInfo = async () => {
      try {
        const response = await fetch(formatUrl, { method: "HEAD" });
        const size = response.headers.get("content-length");
        if (size) {
          const bytes = parseInt(size, 10);
          if (bytes < 1024) setFileSize(`${bytes} B`);
          else if (bytes < 1024 * 1024)
            setFileSize(`${(bytes / 1024).toFixed(1)} KB`);
          else setFileSize(`${(bytes / (1024 * 1024)).toFixed(1)} MB`);
        } else {
          // Se não conseguir ler via HEAD (CORS), tenta via GET com range 0-0
          const getResponse = await fetch(formatUrl, {
            headers: { Range: "bytes=0-0" },
          });
          const contentRange = getResponse.headers.get("content-range");
          const totalSize = contentRange?.split("/")[1];

          if (totalSize) {
            const bytes = parseInt(totalSize, 10);
            if (bytes < 1024) setFileSize(`${bytes} B`);
            else if (bytes < 1024 * 1024)
              setFileSize(`${(bytes / 1024).toFixed(1)} KB`);
            else setFileSize(`${(bytes / (1024 * 1024)).toFixed(1)} MB`);
          } else {
            setFileSize("Tamanho indisponível");
          }
        }
      } catch (error) {
        console.error(error);
        setFileSize("Arquivo indisponível");
      }
    };

    getFileInfo();
  }, [formatUrl]);

  const handleOpen = () => {
    window.open(formatUrl, "_blank");
  };

  const handleDownload = async () => {
    const response = await fetch(formatUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-5 bg-background/50">
        <div className="p-2 bg-secondary/10 rounded-lg">
          <FileIcon className="w-4 h-4 text-foreground" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <div className="text-sm font-medium truncate" title={fileName}>
            {fileName}
          </div>
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">
            {mimetype.split("/")[1]} • {fileSize}
          </span>
        </div>
      </div>
      <div className="flex items-center border-t divide-x ">
        <Button
          variant="ghost"
          className="flex-1 text-xs h-8 rounded-none hover:bg-primary/5"
          onClick={handleOpen}
        >
          Visualizar
        </Button>
        <Button
          variant="ghost"
          className="flex-1 text-xs h-8 rounded-none hover:bg-primary/5"
          onClick={handleDownload}
        >
          Download
        </Button>
      </div>
    </div>
  );
}
