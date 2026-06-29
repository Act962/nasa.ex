"use client";
import { useBuilderStore } from "@/features/form/context/builder-form-provider";
import { Button } from "@/components/ui/button";
import { Copy, Tags } from "lucide-react";
import { toast } from "sonner";
import { CopyLinkWithUtm } from "@/components/ui/copy-link-with-utm";

export function FloatingShareButton(props: { isSidebarOpen: boolean }) {
  const { isSidebarOpen } = props;
  const { formData } = useBuilderStore();

  const shareableLink = `${process.env.NEXT_PUBLIC_APP_URL}/submit-form/${formData?.id}`;

  const copyLinkToClipboard = () => {
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
      className="fixed bottom-5 z-50 flex items-center gap-2
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
        className="rounded-full transition-all duration-300 hover:scale-105"
        aria-label="Copy Shareable Link"
      >
        <Copy className="size-5" />
        Compartilhar Link
      </Button>
      <CopyLinkWithUtm
        baseUrl={shareableLink}
        trigger={
          <Button
            variant="secondary"
            size="lg"
            className="rounded-full transition-all duration-300 hover:scale-105"
            aria-label="Copiar link com UTM"
          >
            <Tags className="size-5" />
            Com UTM
          </Button>
        }
      />
    </div>
  );
}
