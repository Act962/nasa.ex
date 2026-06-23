"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormPdfDocument } from "./form-pdf-document";
import type { FormBlockInstance } from "@/features/form/types";
import type { PdfResponseValues } from "./pdf-field-helpers";

type FormPrintButtonProps = {
  blocks: FormBlockInstance[];
  formName: string;
  leadName?: string;
  responseValues?: PdfResponseValues;
};

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
      const blob = await pdf(
        <FormPdfDocument
          blocks={blocks}
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
