"use client";

import { useState } from "react";
import { CalendarClock, FileStack, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompanyDocuments } from "@/features/accounting/hooks/use-accounting-documents";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { RegularityDashboard } from "./regularity-dashboard";
import { MissingItemsList } from "./missing-items-list";
import { ExpiryTimeline } from "./expiry-timeline";
import { ScopeCards } from "./scope-cards";
import { DocumentsTable } from "./documents-table";
import { DocumentsExplorerCard } from "./documents-explorer-card";
import { DocumentUploadDialog, type DocumentDialogRequest } from "./document-upload-dialog";
import { VaultPanel } from "./vault-panel";
import { CUSTOM_DOCUMENT_TYPE, toDateInputValue } from "./document-display";
import type { CompanyDocumentRowView } from "./document-row-types";

interface CompanyDocumentsSectionProps {
  onNavigate?: (section: string) => void;
}

/** Subaba "N-Box · Documentos da empresa" (spec 0051, item 9). */
export function CompanyDocumentsSection({ onNavigate }: CompanyDocumentsSectionProps) {
  const { data, isLoading, isError } = useCompanyDocuments();
  const [dialogRequest, setDialogRequest] = useState<DocumentDialogRequest | null>(null);

  const documents = (data?.documents ?? []) as CompanyDocumentRowView[];
  const canManage = data?.canManage ?? false;
  const canEdit = data?.canEdit ?? false;

  function ensureCanEdit(): boolean {
    if (!canEdit) {
      toast.info("Sua função no financeiro só permite consultar. Peça a um administrador para enviar documentos.");
    }
    return canEdit;
  }

  function openUpload(typeCode?: string, period?: string) {
    if (!ensureCanEdit()) return;
    setDialogRequest({ mode: "upload", initialValues: { typeCode: typeCode ?? "", period: period ?? "" } });
  }

  function openReview(document: CompanyDocumentRowView) {
    if (!ensureCanEdit()) return;
    setDialogRequest({
      mode: "review",
      documentId: document.id,
      hasExtraction: document.hasExtraction,
      initialValues: {
        typeCode: document.typeCode,
        label: document.typeCode === CUSTOM_DOCUMENT_TYPE ? document.typeLabel : "",
        period: document.period ?? "",
        issuedAt: toDateInputValue(document.issuedAt),
        expiresAt: toDateInputValue(document.expiresAt),
        number: document.number ?? "",
      },
    });
  }

  const documentsTab = (
    <div className="space-y-4">
      <RegularityDashboard />
      <ScopeCards />
      <MissingItemsList requirementOverrides={data?.requirementOverrides ?? []} onUpload={openUpload} />
      <ExpiryTimeline documents={documents} />
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : isError ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Não foi possível carregar os documentos. Recarregue a página.
        </p>
      ) : (
        <DocumentsTable documents={documents} canManage={canManage} onUpload={() => openUpload()} onReview={openReview} />
      )}
      <DocumentsExplorerCard onUpload={() => openUpload()} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileStack className="size-5 text-info" /> Documentos da empresa
          </h2>
          <p className="text-sm text-muted-foreground">
            Certidões <FiscalTermHint termId="cnd" />, alvarás, contrato social e guias num lugar só. Mostramos o que
            está vencendo, o que falta e quanto cada documento pesa na regularidade da empresa.
          </p>
        </div>
        {onNavigate && (
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => onNavigate("calendar")}>
            <CalendarClock className="size-3.5" /> Calendário fiscal
          </Button>
        )}
      </div>

      {canManage ? (
        <Tabs defaultValue="documents">
          <TabsList>
            <TabsTrigger value="documents">
              <FileStack className="size-3.5" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="vault">
              <KeyRound className="size-3.5" /> Cofre
            </TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="mt-4">
            {documentsTab}
          </TabsContent>
          <TabsContent value="vault" className="mt-4">
            <VaultPanel />
          </TabsContent>
        </Tabs>
      ) : (
        documentsTab
      )}

      <DocumentUploadDialog request={dialogRequest} onClose={() => setDialogRequest(null)} />
    </div>
  );
}
