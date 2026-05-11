"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { updateOrgOnboarding } from "../_actions/update-org-onboarding";

const step1Schema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Nome muito longo"),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug deve conter apenas letras minúsculas, números e hífens",
    ),
  logo: z.string().optional(),
});

const step2Schema = z.object({
  companyNiche: z.string().optional(),
  companyCep: z
    .string()
    .optional()
    .regex(/^\d{5}-\d{3}$/, "CEP inválido (formato: 00000-000)"),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

export function FormCreateOrg() {
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const isFirstRender = useRef(true);

  const name = form1.watch("name");
  const logo = form1.watch("logo");

  function createSlug(text: string): string {
    if (!text) return "";
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isSlugManuallyEdited && name) {
      form1.setValue("slug", createSlug(name), { shouldValidate: true });
    }
  }, [name, isSlugManuallyEdited, form1]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form1.setValue("slug", createSlug(e.target.value), {
      shouldValidate: true,
    });
    setIsSlugManuallyEdited(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => form1.setValue("logo", reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted =
      raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
    form2.setValue("companyCep", formatted, { shouldValidate: true });
  };

  const onStep1Next = async (data: Step1Data) => {
    const { data: checkData } = await authClient.organization.checkSlug({
      slug: data.slug,
    });
    if (!checkData?.status) {
      form1.setError("slug", {
        message: "Este slug já está em uso. Por favor, escolha outro.",
      });
      return;
    }
    setStep1Data(data);
    setStep(2);
  };

  const onStep2Submit = async (data: Step2Data) => {
    if (!step1Data) return;
    setIsSubmitting(true);

    try {
      const metadata = {
        name: step1Data.name,
        createdAt: new Date().toISOString(),
      };

      const { data: org, error } = await authClient.organization.create({
        name: step1Data.name,
        slug: step1Data.slug,
        logo: step1Data.logo,
        metadata,
      });

      if (error || !org) {
        toast.error(error?.message ?? "Erro ao criar organização");
        return;
      }

      await updateOrgOnboarding(org.id, {
        companyNiche: data.companyNiche,
        companyCep: data.companyCep,
      });

      toast.success("Organização criada com sucesso!");
      router.push("/home");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Criar organização</CardTitle>
        <CardDescription>
          {step === 1
            ? "Preencha os dados básicos da sua empresa."
            : "Informe a localização e o nicho da empresa."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Indicador de etapas */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`size-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                  step === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : step > s
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 2 && <div className="h-px w-8 bg-muted-foreground/20" />}
            </div>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            Etapa {step} de 2
          </span>
        </div>

        {/* Etapa 1 */}
        {step === 1 && (
          <form onSubmit={form1.handleSubmit(onStep1Next)}>
            <FieldSet>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Nome da empresa</FieldLabel>
                  <Input
                    id="name"
                    placeholder="Acm Distribuidora"
                    {...form1.register("name")}
                    disabled={isSubmitting}
                  />
                  {form1.formState.errors.name && (
                    <FieldError>
                      {form1.formState.errors.name.message}
                    </FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="slug">Slug</FieldLabel>
                  <div className="flex items-center gap-x-4">
                    <Input
                      id="slug"
                      placeholder="acm-distribuidora"
                      {...form1.register("slug")}
                      onChange={handleSlugChange}
                      disabled={isSubmitting}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (name) form1.setValue("slug", createSlug(name));
                      }}
                    >
                      Gerar
                    </Button>
                  </div>
                  {form1.formState.errors.slug && (
                    <FieldError>
                      {form1.formState.errors.slug.message}
                    </FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="logo">Logo</FieldLabel>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    disabled={isSubmitting}
                  />
                  {logo && (
                    <div className="mt-2">
                      <Image
                        src={logo}
                        alt="Logo da organização"
                        className="w-16 h-16 object-cover rounded-md"
                        width={64}
                        height={64}
                      />
                    </div>
                  )}
                </Field>
              </FieldGroup>

              <Field className="w-fit self-end">
                <Button type="submit" disabled={isSubmitting}>
                  Próximo
                </Button>
              </Field>
            </FieldSet>
          </form>
        )}

        {/* Etapa 2 */}
        {step === 2 && (
          <form onSubmit={form2.handleSubmit(onStep2Submit)}>
            <FieldSet>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="companyNiche">
                    Nicho da empresa
                  </FieldLabel>
                  <Input
                    id="companyNiche"
                    placeholder="Ex: Agência de Marketing, E-commerce, Saúde…"
                    {...form2.register("companyNiche")}
                    disabled={isSubmitting}
                  />
                  {form2.formState.errors.companyNiche && (
                    <FieldError>
                      {form2.formState.errors.companyNiche.message}
                    </FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="companyCep">CEP</FieldLabel>
                  <Input
                    id="companyCep"
                    placeholder="00000-000"
                    value={form2.watch("companyCep") ?? ""}
                    onChange={handleCepChange}
                    disabled={isSubmitting}
                    maxLength={9}
                  />
                  {form2.formState.errors.companyCep && (
                    <FieldError>
                      {form2.formState.errors.companyCep.message}
                    </FieldError>
                  )}
                </Field>
              </FieldGroup>

              <div className="flex items-center gap-3 w-fit self-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  Voltar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Criando…" : "Criar organização"}
                </Button>
              </div>
            </FieldSet>
          </form>
        )}
      </CardContent>
      <CardFooter />
    </Card>
  );
}
