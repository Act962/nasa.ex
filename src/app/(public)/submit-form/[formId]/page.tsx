"use client";

import { useQueryPublicForm } from "@/features/form/hooks/use-form";
import NotAvaliable from "@/features/form/components/public/not-avaliable";
import { FormBlockInstance } from "@/features/form/types";
import FormSubmitComponent from "@/features/form/components/public/form-submit-component";
import { useParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

const Page = () => {
  const params = useParams();
  const formId = params.formId as string;

  const { form, isLoading } = useQueryPublicForm({ formId });

  if (isLoading) {
    return <Spinner />;
  }

  if (!form) {
    return <NotAvaliable />;
  }

  const blocks = JSON.parse(form.jsonBlock) as FormBlockInstance[];
  return <FormSubmitComponent formId={formId} blocks={blocks} />;
};

export default Page;
