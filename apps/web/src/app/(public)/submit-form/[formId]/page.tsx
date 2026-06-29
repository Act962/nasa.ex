"use client";

import { useQueryPublicForm } from "@/features/form/hooks/use-form";
import { NotAvaliable } from "@/features/form/components/public/not-avaliable";
import { FormBlockInstance } from "@/features/form/types";
import { FormSubmitComponent } from "@/features/form/components/public/form-submit/form-submit-component";
import { FormTrackingScripts } from "@/features/form/components/public/form-tracking-scripts";
import { useParams, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export default function Page() {
  const params = useParams<{ formId: string }>();
  const formId = params.formId;
  const searchParams = useSearchParams();
  const leadToken = searchParams.get("leadToken");

  const { form, isLoading } = useQueryPublicForm({ id: formId });

  const { data: prefillData } = useQuery({
    ...orpc.leads.getPrefillByToken.queryOptions({
      input: { token: leadToken ?? "" },
    }),
    enabled: !!leadToken,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (!form) {
    return <NotAvaliable />;
  }

  const blocks = JSON.parse(form.jsonBlock) as FormBlockInstance[];
  const initialLead = prefillData?.prefill ?? undefined;

  return (
    <>
      <FormTrackingScripts settings={form.settings} />
      <FormSubmitComponent
        id={formId}
        blocks={blocks}
        settings={form.settings}
        initialLead={initialLead}
      />
    </>
  );
}
