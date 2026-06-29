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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { useOrgRole } from "@/hooks/use-org-role";
import { useGetCompanyCode } from "@/features/workspace/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Building2Icon, CopyIcon, FileBadge, Lock, Mail, Phone, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useSpacePointCtx } from "@/features/space-point/components/space-point-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc, client as orpcClient } from "@/lib/orpc";
import { COMPANY_TYPES, COMPANY_TYPE_SLUGS } from "@/features/company/constants";

interface UploadLogo {
  file: File | null;
  uploading: boolean;
  error: boolean;
  objectUrl?: string;
}

const cnpjRegex = /^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})$/;

const formCompanySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Nome muito longo"),
  logo: z.string().optional(),
  companyType: z
    .string()
    .nullable()
    .refine((v) => v === null || v === "" || COMPANY_TYPE_SLUGS.includes(v), {
      message: "Tipo de empresa inválido",
    })
    .optional(),
  companySegment: z.string().max(120).nullable().optional(),
  cnpj: z
    .string()
    .optional()
    .refine((v) => !v || cnpjRegex.test(v), {
      message: "CNPJ inválido (use 00.000.000/0001-00 ou 14 dígitos)",
    }),
  contactEmail: z
    .string()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "E-mail inválido",
    }),
  contactPhone: z.string().optional(),
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
  const { isSingle } = useOrgRole();
  const { data: codeData, isLoading: isLoadingCode } = useGetCompanyCode();
  const { earn } = useSpacePointCtx();
  const queryClient = useQueryClient();
  const { data: profileData } = useQuery({
    ...orpc.orgs.getCompanyProfile.queryOptions(),
    staleTime: 60_000,
  });
  const form = useForm<FormCompanySchema>({
    resolver: zodResolver(formCompanySchema),
    values: {
      name: company.name,
      logo: company.logo,
      companyType: profileData?.org?.companyType ?? "",
      companySegment: profileData?.org?.companySegment ?? "",
      cnpj: profileData?.org?.cnpj ?? "",
      contactEmail: profileData?.org?.contactEmail ?? "",
      contactPhone: profileData?.org?.contactPhone ?? "",
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
      return;
    }

    try {
      await orpcClient.orgs.updateCompanyProfile({
        companyType: data.companyType ?? "",
        companySegment: data.companySegment ?? null,
        cnpj: data.cnpj || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.orgs.getCompanyProfile.key(),
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.spaceHelp.getSetupProgress.key(),
      });
    } catch (err) {
      console.error("[settings/company] companyProfile update failed:", err);
      toast.error("Falha ao salvar dados institucionais");
      return;
    }

    toast.success("Empresa atualizada com sucesso");
    router.refresh();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {isSingle && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
          <Lock className="size-4 shrink-0" />
          <span>Apenas o Master ou Adm podem editar os dados da empresa.</span>
        </div>
      )}
      <FieldGroup>
        <Field>
          <FieldLabel>Logo</FieldLabel>
          <div {...(!isSingle ? getRootProps() : {})} className="relative">
            <div
              className={cn(
                "group/avatar relative size-24 overflow-hidden rounded-full border border-dashed transition-colors",
                isSingle ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                !isSingle && isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/20",
              )}
            >
              {!isSingle && <input {...getInputProps()} />}
              {renderContent()}
            </div>
          </div>
        </Field>

        <Field>
          <FieldLabel>Nome da Empresa</FieldLabel>
          <Input
            placeholder="Ex.: Company LTDA."
            {...form.register("name")}
            disabled={isSingle}
            readOnly={isSingle}
          />
          <FieldDescription>Insira o nome da sua empresa</FieldDescription>
        </Field>

        <Field>
          <FieldLabel className="flex items-center gap-1.5">
            <Briefcase className="size-3.5 text-violet-500" />
            Tipo da empresa
          </FieldLabel>
          <Controller
            control={form.control}
            name="companyType"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
                disabled={isSingle}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o segmento da sua empresa" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>
                      <div className="flex flex-col">
                        <span className="font-medium">{t.label}</span>
                        {t.description && (
                          <span className="text-xs text-muted-foreground">
                            {t.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldDescription>
            Define o tipo de empresa para personalizar a hierarquia e relatórios.
          </FieldDescription>
          {form.formState.errors.companyType && (
            <p className="text-xs text-destructive">
              {form.formState.errors.companyType.message}
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel>Sub-nicho / segmento (opcional)</FieldLabel>
          <Input
            placeholder="Ex.: foco em e-commerce de moda"
            {...form.register("companySegment")}
            disabled={isSingle}
            readOnly={isSingle}
          />
          <FieldDescription>
            Texto livre para detalhar o segmento da sua empresa.
          </FieldDescription>
        </Field>

        <FieldSeparator />

        <Field>
          <FieldLabel className="flex items-center gap-1.5">
            <FileBadge className="size-3.5 text-violet-500" />
            CNPJ
          </FieldLabel>
          <Input
            placeholder="00.000.000/0001-00"
            {...form.register("cnpj")}
            disabled={isSingle}
            readOnly={isSingle}
          />
          <FieldDescription>
            Usado em contratos e propostas via variável {"{{empresa_cnpj}}"}.
          </FieldDescription>
          {form.formState.errors.cnpj && (
            <p className="text-xs text-destructive">
              {form.formState.errors.cnpj.message}
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel className="flex items-center gap-1.5">
            <Mail className="size-3.5 text-violet-500" />
            E-mail institucional
          </FieldLabel>
          <Input
            type="email"
            placeholder="contato@suaempresa.com.br"
            {...form.register("contactEmail")}
            disabled={isSingle}
            readOnly={isSingle}
          />
          <FieldDescription>
            Usado em contratos e propostas via variável {"{{empresa_email}}"}.
          </FieldDescription>
          {form.formState.errors.contactEmail && (
            <p className="text-xs text-destructive">
              {form.formState.errors.contactEmail.message}
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel className="flex items-center gap-1.5">
            <Phone className="size-3.5 text-violet-500" />
            Telefone / WhatsApp de contato
          </FieldLabel>
          <Input
            placeholder="(11) 90000-0000"
            {...form.register("contactPhone")}
            disabled={isSingle}
            readOnly={isSingle}
          />
          <FieldDescription>
            Usado em contratos e propostas via variável {"{{empresa_contato}}"}.
          </FieldDescription>
        </Field>

        <FieldSeparator />

        {/* Company code for cross-company card sharing */}
        <Field>
          <FieldLabel className="flex items-center gap-1.5">
            <Building2Icon className="size-3.5 text-violet-500" />
            Código da empresa
          </FieldLabel>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-200 dark:border-violet-800 min-h-[52px]">
            {isLoadingCode ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-xs text-muted-foreground animate-pulse">
                  Gerando código...
                </span>
              </div>
            ) : (
              <>
                <code className="font-mono font-bold text-xl tracking-[0.35em] text-violet-600 dark:text-violet-400 flex-1 text-center select-all">
                  {codeData?.companyCode ?? "—"}
                </code>
                {codeData?.companyCode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                    onClick={() => {
                      navigator.clipboard.writeText(codeData.companyCode!);
                      toast.success("Código copiado!");
                    }}
                  >
                    <CopyIcon className="size-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
          <FieldDescription>
            Compartilhe este código com outras empresas para que possam enviar
            cards para a sua organização.
          </FieldDescription>
        </Field>

        <FieldSeparator />
        {!isSingle && (
          <Field orientation="horizontal">
            <Button type="submit">Salvar</Button>
          </Field>
        )}
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
