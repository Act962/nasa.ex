"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormPdfDocument } from "./form-pdf-document";
import type { FormBlockInstance } from "@/features/form/types";
import type { PdfResponseValues } from "./pdf-field-helpers";
import { constructUrl } from "./pdf-field-helpers";

type FormPrintButtonProps = {
  blocks: FormBlockInstance[];
  formName: string;
  leadName?: string;
  responseValues?: PdfResponseValues;
};

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function tryFetchBase64(rawUrl: string): Promise<string> {
  if (!rawUrl) return "";
  // Se já é data URL, não precisa buscar
  if (rawUrl.startsWith("data:")) return rawUrl;

  const resolved = constructUrl(rawUrl);
  if (!resolved) return "";

  // Se constructUrl retornou caminho relativo, torna absoluto usando a origin atual
  const absoluteUrl =
    resolved.startsWith("http://") || resolved.startsWith("https://")
      ? resolved
      : `${window.location.origin}${resolved.startsWith("/") ? "" : "/"}${resolved}`;

  try {
    return await fetchImageAsBase64(absoluteUrl);
  } catch {
    return "";
  }
}

async function resolveImageBlocks(
  blocks: FormBlockInstance[],
): Promise<FormBlockInstance[]> {
  return Promise.all(
    blocks.map(async (block) => {
      if (block.blockType === "RowLayout" && block.childblocks?.length) {
        return { ...block, childblocks: await resolveImageBlocks(block.childblocks) };
      }

      if (block.blockType !== "ImageDisplay") return block;

      const rawUrl: string = (block.attributes?.url as string) ?? "";
      if (!rawUrl) return block;

      const base64 = await tryFetchBase64(rawUrl);
      return { ...block, attributes: { ...block.attributes, url: base64 } };
    }),
  );
}


export function FormPrintButton({
  blocks,
  formName,
  leadName,
  responseValues,
}: FormPrintButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handlePrint() {
    setIsGenerating(true);
    try {
      const resolvedBlocks = await resolveImageBlocks(blocks);

      const blob = await pdf(
        <FormPdfDocument
          blocks={resolvedBlocks}
          formName={formName}
          leadName={leadName}
          responseValues={responseValues}
        />,
      ).toBlob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      // Falha silenciosa — o usuário percebe que nada abriu
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      disabled={isGenerating}
      className="shrink-0"
      title="Gerar PDF do formulário para impressão"
      aria-label="Imprimir PDF do formulário"
    >
      {isGenerating ? (
        <Spinner className="size-4" />
      ) : (
        <Printer className="size-4" />
      )}
      <span className="hidden sm:inline">Imprimir PDF</span>
    </Button>
  );
}
