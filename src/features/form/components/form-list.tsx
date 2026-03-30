"use client";
import { SquarePenIcon } from "lucide-react";
import { useQueryListForms } from "../hooks/use-form";
import { FormItem } from "./form-item";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CreateForm } from "./create-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Form } from "@/generated/prisma/client";

export function FormList() {
  const { forms, isLoading } = useQueryListForms();
  return (
    <>
      {isLoading && (
        <div
          className="grid gap-4 grid-cols-2
        md:grid-cols-5
           lg:grid-cols-3
           xl:grid-cols-5"
        >
          <Skeleton className="w-full h-40" />
          <Skeleton className="w-full h-40" />
          <Skeleton className="w-full h-40" />
          <Skeleton className="w-full h-40" />
          <Skeleton className="w-full h-40" />
        </div>
      )}
      {forms && (
        <div
          className="grid gap-4 grid-cols-2
        md:grid-cols-5
           lg:grid-cols-3
           xl:grid-cols-5
           "
        >
          {forms?.map((form: any) => (
            <FormItem
              key={form.id}
              id={form.id}
              formId={form.id}
              name={form.name}
              published={form.published}
              createdAt={form.createdAt}
              responses={form.responses}
              views={form.views}
              backgroundColor={form.settings.backgroundColor}
            />
          ))}
        </div>
      )}
      {!isLoading && forms?.length === 0 && (
        <Empty className="w-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SquarePenIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum formulário criado</EmptyTitle>
            <EmptyDescription>
              Você ainda não criou nenhum formulário. Comece criando seu
              primeiro formulário.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center gap-2">
            <CreateForm />
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
