"use client";

import { FolderLock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NBoxExplorer } from "@/features/nbox/components/nbox-explorer";
import {
  companyDocumentFileHref,
  useCompanyDocumentsFolder,
} from "@/features/accounting/hooks/use-accounting-documents";

export function DocumentsExplorerCard({ onUpload }: { onUpload: () => void }) {
  const { data: folder, isLoading } = useCompanyDocumentsFolder();

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (!folder?.canBrowse || !folder.rootFolderId) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderLock className="size-4 text-violet-500" /> Pasta no N-Box
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Os arquivos ficam em “Documentos da empresa”, uma pasta restrita do N-Box separada por assunto. Só quem
          administra o financeiro vê essa pasta, e ela nunca pode ser pública.
        </p>
      </CardHeader>
      <CardContent>
        <NBoxExplorer
          rootFolderId={folder.rootFolderId}
          readOnly
          resolveHref={(item) => companyDocumentFileHref(item.id)}
          onUploadClick={() => onUpload()}
        />
      </CardContent>
    </Card>
  );
}
