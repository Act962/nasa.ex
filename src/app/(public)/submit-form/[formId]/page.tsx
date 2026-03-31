"use client";

import { useQueryPublicForm } from "@/features/form/hooks/use-form";
import { NotAvaliable } from "@/features/form/components/public/not-avaliable";
import { FormBlockInstance } from "@/features/form/types";
import { FormSubmitComponent } from "@/features/form/components/public/form-submit-component";
import { useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

export default function Page() {
  const params = useParams<{ formId: string }>();
  const formId = params.formId;

  const { form, isLoading } = useQueryPublicForm({ id: formId });

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
  return (
    <FormSubmitComponent id={formId} blocks={blocks} settings={form.settings} />
  );
}
