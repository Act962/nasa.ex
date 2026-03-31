"use client";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export function FloatingShareButton(props: { isSidebarOpen: boolean }) {
  const { isSidebarOpen } = props;
  const { formData } = useBuilderStore();

  const copyLinkToClipboard = () => {
    const shareableLink = `${process.env.NEXT_PUBLIC_APP_URL}/submit-form/${formData?.id}`;
    navigator.clipboard
      .writeText(shareableLink)
      .then(() => {
        toast("Link copiado!");
      })
      .catch(() => {
        toast("Falha ao copiar o link. Tente novamente.");
      });
  };

  if (!formData?.published) return;

  return (
    <div
      className="fixed bottom-5 z-50 
      transition-transform 
      duration-500 ease-in-out"
      style={{
        left: isSidebarOpen ? "calc(41% + 150px)" : "41%",
        transform: "translateX(-50%)",
      }}
    >
      <Button
        onClick={copyLinkToClipboard}
        variant="secondary"
        size="lg"
        className="rounded-full 
         transition-all duration-300 
         hover:scale-105"
        aria-label="Copy Shareable Link"
      >
        <Copy className="size-5" />
        Share Link
      </Button>
    </div>
  );
}
