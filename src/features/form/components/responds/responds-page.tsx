"use client";

import { FormBlockInstance } from "@/features/form/types";
import { Button } from "@/components/ui/button";
import { LinkIcon, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import AllReponds from "./all-reponds";
import { useQueryFormResponses } from "../../hooks/use-form";
import Link from "next/link";

export function RespondsPage({ formId }: { formId: string }) {
  const { form } = useQueryFormResponses({ id: formId });

  if (!form) {
    return (
      <div className="w-full h-[50vh] flex items-center">
        Error Occured, Refresh
      </div>
    );
  }

  const blocks = JSON.parse(form?.jsonBlock) as FormBlockInstance[];
  const responses = form || [];

  return (
    <main>
      <div className="w-full">
        <div className="w-full mx-auto pt-1">
          <div className="w-full flex items-center justify-between py-5">
            <h1 className="text-2xl font-semibold tracking-tight">
              ({responses?.formSubmissions?.length}) Respostas
            </h1>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button asChild variant="outline">
                <Link href={`/formulario/novo/${formId}`}>
                  <Plus />
                  Preencher para um cliente
                </Link>
              </Button>
              <Button asChild className="bg-primary!">
                <Link
                  href={`${process.env.NEXT_PUBLIC_APP_URL}/submit-form/${formId}`}
                  target="_blank"
                >
                  <LinkIcon />
                  Visitar formulário
                </Link>
              </Button>
            </div>
          </div>
          <Separator />
          <AllReponds blocks={blocks} responses={responses.formSubmissions} />
        </div>
      </div>
    </main>
  );
}
