"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadFromUrl, downloadPlannerImageAsPng, extractPlannerMediaKey } from "../../lib/post-media";

interface ImageViewerDialogProps {
  imageUrl: string | null;
  downloadTitle?: string;
  onClose: () => void;
}

export function ImageViewerDialog({ imageUrl, downloadTitle, onClose }: ImageViewerDialogProps) {
  const handleDownload = (viewedUrl: string) => {
    const mediaKey = extractPlannerMediaKey(viewedUrl);
    if (mediaKey) downloadPlannerImageAsPng(mediaKey, downloadTitle);
    else downloadFromUrl(viewedUrl, "post.png");
  };

  return (
    <Dialog open={!!imageUrl} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[95vh] sm:max-h-[80vh] p-2 bg-black border-black flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Visualizar imagem</DialogTitle>
        </DialogHeader>
        {imageUrl && (
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <img
              src={imageUrl}
              alt="Post"
              className="flex-1 min-h-0 w-full rounded-md object-contain max-h-[75vh]"
            />
            <div className="flex justify-center gap-2 pb-1">
              <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => handleDownload(imageUrl)}>
                <DownloadIcon className="size-4" />
                Baixar PNG (alta qualidade)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
