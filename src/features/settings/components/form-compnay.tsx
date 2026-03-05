"use client";

import { Button } from "@/components/ui/button";
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldDescription,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface UploadLogo {
  file: File | null;
  uploading: boolean;
  error: boolean;
  objectUrl?: string;
}

const formCompanySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Nome muito longo"),
  logo: z.string().optional(),
});

type FormCompanySchema = z.infer<typeof formCompanySchema>;

interface Company {
  id: string;
  name: string;
  logo?: string;
}

interface Props {
  company: Company;
}

export function FormCompany({ company }: Props) {
  const router = useRouter();
  const form = useForm<FormCompanySchema>({
    resolver: zodResolver(formCompanySchema),
    values: {
      name: company.name,
      logo: company.logo,
    },
  });

  const [uploadLogo, setUploadLogo] = useState<UploadLogo>({
    file: null,
    uploading: false,
    error: false,
    objectUrl: company.logo,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];

      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("logo", reader.result as string);
        setUploadLogo({
          file,
          uploading: false,
          error: false,
          objectUrl: reader.result as string,
        });
      };

      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    multiple: false,
    maxSize: 1024 * 1024 * 2,
  });

  function renderContent() {
    if (uploadLogo.objectUrl) {
      return (
        <div className="group relative size-full">
          <img
            src={uploadLogo.objectUrl}
            alt="Uploaded file"
            className="size-full object-cover"
          />
        </div>
      );
    }

    return <RenderLogoEmptyState isDragActive={isDragActive} />;
  }

  const onSubmit = async (data: FormCompanySchema) => {
    const { error } = await authClient.organization.update({
      data: {
        name: data.name,
        logo: data.logo,
      },
      organizationId: company.id,
    });

    if (error) {
      toast.error("Erro ao atualizar empresa");
    }

    toast.success("Empresa atualizada com sucesso");
    router.refresh();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field>
          <FieldLabel>Logo</FieldLabel>
          <div {...getRootProps()} className="relative">
            <div
              className={cn(
                "group/avatar relative size-24 cursor-pointer overflow-hidden rounded-full border border-dashed transition-colors",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/20",
              )}
            >
              <input {...getInputProps()} />
              {renderContent()}
            </div>
          </div>
        </Field>

        <Field>
          <FieldLabel>Nome da Empresa</FieldLabel>
          <Input placeholder="Ex.: Company LTDA." {...form.register("name")} />
          <FieldDescription>Insira o nome da sua empresa</FieldDescription>
        </Field>

        <FieldSeparator />
        <Field orientation="horizontal">
          <Button type="submit">Salvar</Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

export function RenderLogoEmptyState({
  isDragActive,
}: {
  isDragActive: boolean;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <UploadIcon className="size-6 text-muted-foreground" />
    </div>
  );
}
