"use client";

import { FormBlockInstance } from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Calculator, ClipboardList, Home, LinkIcon, Plus, Send } from "lucide-react";
import AllReponds from "./all-reponds";
import { useQueryFormResponses } from "../../hooks/use-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { FORM_RECORDS_SECTION_ID, FormRecordsSection } from "@/features/form-records/components/form-records-section";
import { FormWorkspaceHome } from "@/features/form-records/components/form-workspace-home";
import { SendClientLinkSheet } from "@/features/form-records/components/send-client-link-sheet";
import { useFormWorkspace } from "@/features/form-records/hooks/use-form-records";

const PAGE_TOP_ID = "form-responses-top";

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function RespondsPage({ formId }: { formId: string }) {
  const router = useRouter();
  const { form, isLoading, isError, refetch } = useQueryFormResponses({ id: formId });

  const { data: workspace } = useFormWorkspace(formId);
  const [isSendLinkOpen, setIsSendLinkOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const showDashboard = () => {
    setIsDashboardOpen(true);
    scrollToSection(FORM_RECORDS_SECTION_ID);
  };
  // Formulário comum, sem fichas, segue com a tela de respostas de sempre.
  const hasWorkspace = Boolean(workspace && (workspace.followUpForm || workspace.completedCount > 0));
  const newRecordHref = `/formulario/novo/${workspace?.openingForm.id ?? formId}`;
  const closingHref = `/form/responses/${workspace?.closingFormId ?? formId}/fechamento`;

  // Menu de baixo do celular com as ações desta tela (playbook dos Apps, §3).
  useRegisterOrbitDock({
    leftItems: [
      { label: "Início", icon: <Home />, onSelect: () => scrollToSection(PAGE_TOP_ID) },
      { label: "Fichas", icon: <ClipboardList />, onSelect: () => scrollToSection(FORM_RECORDS_SECTION_ID) },
    ],
    centerAction: hasWorkspace ? { label: "Nova", icon: <Plus />, onSelect: () => router.push(newRecordHref) } : undefined,
    rightItems: [
      { label: "Fechamento", icon: <Calculator />, onSelect: () => router.push(closingHref) },
      hasWorkspace
        ? { label: "Links", icon: <Send />, onSelect: () => setIsSendLinkOpen(true) }
        : { label: "Preencher", icon: <Plus />, onSelect: () => router.push(newRecordHref) },
    ],
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <OrbitaSpinner />
      </div>
    );
  }

  if (isError || !form) {
    return (
      <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar as respostas deste formulário.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const blocks = JSON.parse(form?.jsonBlock) as FormBlockInstance[];
  const responses = form || [];

  return (
    <main id={PAGE_TOP_ID} className="min-w-0 scroll-mt-16 pb-28 md:pb-8">
      <div className="w-full min-w-0">
        <div className="mx-auto w-full min-w-0 pt-1">
          <div className="flex w-full flex-wrap items-center justify-between gap-3 py-5">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {hasWorkspace && workspace ? workspace.openingForm.name : form.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {hasWorkspace && workspace?.followUpForm
                  ? `Depois de cada ficha: ${workspace.followUpForm.name}`
                  : `${responses?.formSubmissions?.length} ${responses?.formSubmissions?.length === 1 ? "resposta" : "respostas"}`}
              </p>
            </div>

            {hasWorkspace ? (
              <div className="flex items-center gap-2 max-md:hidden">
                <Button asChild variant="outline" className="rounded-full">
                  <Link href={closingHref}>
                    <Calculator />
                    Fechamento do mês
                  </Link>
                </Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setIsSendLinkOpen(true)}>
                  <Send />
                  Enviar link ao cliente
                </Button>
                <Button asChild className="h-11 rounded-full px-5">
                  <Link href={newRecordHref}>
                    <Plus />
                    {workspace?.openingForm.name}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex w-full items-center gap-2 md:w-auto md:justify-end">
                <Button asChild variant="outline" className="max-md:h-11 max-md:flex-1">
                  <Link href={newRecordHref}>
                    <Plus />
                    Preencher para um cliente
                  </Link>
                </Button>
                <Button asChild className="shrink-0 max-md:size-11 max-md:rounded-full max-md:p-0">
                  <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/submit-form/${formId}`} target="_blank" aria-label="Visitar formulário">
                    <LinkIcon />
                    <span className="max-md:sr-only">Visitar formulário</span>
                  </Link>
                </Button>
              </div>
            )}
          </div>
          {hasWorkspace && workspace && (
            <div className="w-full min-w-0">
              <FormWorkspaceHome workspace={workspace} onSendLink={() => setIsSendLinkOpen(true)} onShowDashboard={showDashboard} />
              <SendClientLinkSheet isOpen={isSendLinkOpen} onOpenChange={setIsSendLinkOpen} clients={workspace.clients} periodKeys={workspace.periodKeys} />
            </div>
          )}
          <FormRecordsSection
            formId={formId}
            title={hasWorkspace ? "Todas as fichas" : "Fichas"}
            dashboard={hasWorkspace ? { isOpen: isDashboardOpen, onToggle: () => setIsDashboardOpen((isOpen) => !isOpen) } : undefined}
          />
          <AllReponds blocks={blocks} responses={responses.formSubmissions} />
        </div>
      </div>
    </main>
  );
}
