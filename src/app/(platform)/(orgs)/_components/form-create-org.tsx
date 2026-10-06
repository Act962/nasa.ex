"use client";

import { clearAppSignupCookie, readAppSignupCookie, resolveAppLink } from "@/features/apps/lib/app-signup-link";
import { useSetHomeApp } from "@/hooks/use-sidebar-prefs";
import { OrbitaSpinner } from "@/components/orbita-spinner";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { clearSignupCompanyType, readSignupCompanyType } from "@/features/company/lib/signup-company-type";
import { useConsumePartnerReferral } from "@/features/partner/hooks/use-partner-referral";
import { CompanyLogoDropzone } from "@/features/settings/components/company-logo-dropzone";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { checkOrgSlug } from "../_actions/check-org-slug";
import { updateOrgOnboarding } from "../_actions/update-org-onboarding";
import { type OrgSlugStatus, useOrgSlugAvailability } from "../_hooks/use-org-slug-availability";
import { ORG_SLUG_MAX_LENGTH, ORG_SLUG_PATTERN, createSlug } from "../_lib/org-slug";

const MAX_VISIBLE_SUGGESTIONS = 3;
const SLUG_TAKEN_MESSAGE = "Já existe uma empresa com este identificador.";

const createOrgSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Nome muito longo"),
  slug: z
    .string()
    .min(1, "Identificador é obrigatório")
    .max(ORG_SLUG_MAX_LENGTH, `Use até ${ORG_SLUG_MAX_LENGTH} caracteres`)
    .regex(ORG_SLUG_PATTERN, "Use apenas letras minúsculas, números e hífens"),
  logo: z.string().optional(),
  companyNiche: z.string().optional(),
  companyCep: z
    .string()
    .regex(/^(\d{5}-\d{3})?$/, "CEP incompleto")
    .optional(),
});

type CreateOrgData = z.infer<typeof createOrgSchema>;

function OptionalHint() {
  return <span className="font-normal text-muted-foreground">(opcional)</span>;
}

interface SlugFeedbackProps {
  status: OrgSlugStatus;
  errorMessage?: string;
  replacedTakenSlug: string | null;
  suggestions: string[];
  onPickSuggestion: (suggestedSlug: string) => void;
}

function SlugFeedback({
  status,
  errorMessage,
  replacedTakenSlug,
  suggestions,
  onPickSuggestion,
}: SlugFeedbackProps) {
  if (status === "taken") {
    return (
      <div className="flex flex-col gap-2">
        <FieldError>{SLUG_TAKEN_MESSAGE}</FieldError>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>Disponíveis:</span>
            {suggestions.slice(0, MAX_VISIBLE_SUGGESTIONS).map((suggestedSlug) => (
              <button
                key={suggestedSlug}
                type="button"
                onClick={() => onPickSuggestion(suggestedSlug)}
                className="cursor-pointer rounded-full border border-line bg-foreground/5 px-2.5 py-1 font-mono text-foreground transition-colors hover:border-ring hover:bg-foreground/10"
              >
                {suggestedSlug}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (errorMessage) return <FieldError>{errorMessage}</FieldError>;

  if (status === "available" && replacedTakenSlug) {
    return (
      <FieldDescription>
        <span className="font-mono">{replacedTakenSlug}</span> já estava em uso,
        então escolhemos este para você.
      </FieldDescription>
    );
  }

  if (status === "available") {
    return <FieldDescription>Identificador disponível.</FieldDescription>;
  }
  if (status === "checking") {
    return <FieldDescription>Verificando disponibilidade…</FieldDescription>;
  }

  return (
    <FieldDescription>
      Preenchido a partir do nome. Aparece nos links públicos da empresa.
    </FieldDescription>
  );
}

export function FormCreateOrg() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const setHomeApp = useSetHomeApp();
  const consumePartnerReferral = useConsumePartnerReferral();

  const form = useForm<CreateOrgData>({ resolver: zodResolver(createOrgSchema) });
  const { errors } = form.formState;

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [replacedTakenSlug, setReplacedTakenSlug] = useState<string | null>(null);
  const [isGeneratingSlug, setIsGeneratingSlug] = useState(false);
  const generatedSlugsRef = useRef<string[]>([]);
  const isFirstRender = useRef(true);

  const name = form.watch("name");
  const slug = form.watch("slug") ?? "";
  const logo = form.watch("logo");

  const { status: slugStatus, suggestions: slugSuggestions } =
    useOrgSlugAvailability(slug);
  const isSlugTaken = slugStatus === "taken";

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isSlugManuallyEdited) {
      setReplacedTakenSlug(null);
      form.setValue("slug", createSlug(name ?? ""), {
        shouldValidate: Boolean(name),
      });
    }
  }, [name, isSlugManuallyEdited, form]);

  // Identificador derivado do nome que já existe é trocado sozinho pela primeira variação livre.
  useEffect(() => {
    if (!isSlugTaken || isSlugManuallyEdited) return;
    const firstAvailableSlug = slugSuggestions[0];
    if (!firstAvailableSlug) return;
    setReplacedTakenSlug(slug);
    form.setValue("slug", firstAvailableSlug, { shouldValidate: true });
  }, [isSlugTaken, isSlugManuallyEdited, slugSuggestions, slug, form]);

  const applySlug = (nextSlug: string) => {
    setReplacedTakenSlug(null);
    setIsSlugManuallyEdited(true);
    form.setValue("slug", nextSlug, { shouldValidate: true });
  };

  const handleSlugChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const typedSlug = createSlug(event.target.value);
    setReplacedTakenSlug(null);
    form.setValue("slug", typedSlug, { shouldValidate: true });
    // Campo esvaziado volta a acompanhar o nome da empresa.
    setIsSlugManuallyEdited(typedSlug !== "");
  };

  const handleGenerateSlug = async () => {
    const baseSlug = createSlug(name ?? "") || slug;
    if (!baseSlug) {
      form.setFocus("name");
      return;
    }
    setIsGeneratingSlug(true);
    try {
      const { isAvailable, suggestions } = await checkOrgSlug(baseSlug);
      const availableSlugs = (
        isAvailable ? [baseSlug, ...suggestions] : suggestions
      ).filter((availableSlug) => availableSlug !== slug);
      const unseenSlug = availableSlugs.find(
        (availableSlug) => !generatedSlugsRef.current.includes(availableSlug),
      );
      const generatedSlug = unseenSlug ?? availableSlugs[0];
      if (!generatedSlug) return;
      generatedSlugsRef.current = unseenSlug
        ? [...generatedSlugsRef.current, unseenSlug]
        : [generatedSlug];
      applySlug(generatedSlug);
    } catch {
      toast.error("Não foi possível gerar um identificador agora.");
    } finally {
      setIsGeneratingSlug(false);
    }
  };

  const handleCepChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
    const formattedCep =
      digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    form.setValue("companyCep", formattedCep, { shouldValidate: true });
  };

  // Cadastro vindo do link de um app (/app/<chave>): o app vira principal e abre direto (spec 0042).
  const consumeAppSignupLink = async (): Promise<string> => {
    const appKey = readAppSignupCookie();
    clearAppSignupCookie();
    const appLink = appKey ? resolveAppLink(appKey) : null;
    if (!appLink) return "/home";
    await setHomeApp.mutateAsync({ appKey: appLink.homeKey }).catch(() => undefined);
    return appLink.url;
  };

  const onSubmit = async (formData: CreateOrgData) => {
    setIsSubmitting(true);

    try {
      const slugCheck = await checkOrgSlug(formData.slug);
      if (!slugCheck.isAvailable) {
        form.setError("slug", { message: SLUG_TAKEN_MESSAGE }, { shouldFocus: true });
        return;
      }

      const { data: org, error } = await authClient.organization.create({
        name: formData.name,
        slug: formData.slug,
        logo: formData.logo,
        metadata: { name: formData.name, createdAt: new Date().toISOString() },
      });

      if (error || !org) {
        toast.error(error?.message ?? "Erro ao criar empresa");
        return;
      }

      // Indicação é best-effort: pode ser atribuída manualmente depois.
      await consumePartnerReferral
        .mutateAsync({ organizationId: org.id })
        .catch((referralError) => {
          console.error("[create-org] Falha ao consumir indicação:", referralError);
        });

      // A empresa já existe: falha nos dados opcionais não pode prender o usuário nesta tela.
      const hasSavedCompanyDetails = await updateOrgOnboarding(org.id, {
        companyNiche: formData.companyNiche,
        companyCep: formData.companyCep,
        companyType: readSignupCompanyType() ?? undefined,
      })
        .then(() => true)
        .catch(() => false);
      clearSignupCompanyType();

      if (hasSavedCompanyDetails) {
        toast.success("Empresa criada com sucesso!");
      } else {
        toast.warning(
          "Empresa criada, mas não foi possível salvar os dados complementares. Preencha depois em Configurações.",
        );
      }
      router.push(await consumeAppSignupLink());
    } catch {
      toast.error("Erro ao criar empresa. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>Crie sua empresa</CardTitle>
        <CardDescription>
          Só o nome é obrigatório. O restante você pode preencher depois.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel>
                  Logo <OptionalHint />
                </FieldLabel>
                <div className="flex items-center gap-4">
                  <CompanyLogoDropzone
                    logoUrl={logo}
                    onLogoChange={(logoDataUrl) => form.setValue("logo", logoDataUrl)}
                    disabled={isSubmitting}
                    className="size-20"
                  />
                  <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground">
                    <span>Clique ou arraste uma imagem de até 2 MB.</span>
                    {logo && (
                      <button
                        type="button"
                        className="cursor-pointer text-xs text-foreground underline-offset-4 hover:underline"
                        onClick={() => form.setValue("logo", undefined)}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="name">Nome da empresa</FieldLabel>
                <Input
                  id="name"
                  placeholder="Acm Distribuidora"
                  autoFocus
                  {...form.register("name")}
                  disabled={isSubmitting}
                />
                {errors.name && <FieldError>{errors.name.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="slug">Identificador (slug)</FieldLabel>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="slug"
                      placeholder="acm-distribuidora"
                      aria-invalid={isSlugTaken || Boolean(errors.slug)}
                      className="pr-10"
                      maxLength={ORG_SLUG_MAX_LENGTH}
                      {...form.register("slug")}
                      onChange={handleSlugChange}
                      disabled={isSubmitting}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2">
                      {slugStatus === "checking" && <OrbitaSpinner className="size-4" />}
                      {slugStatus === "available" && (
                        <CheckIcon className="size-4 text-success" />
                      )}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateSlug}
                    disabled={isSubmitting || isGeneratingSlug}
                  >
                    <SparklesIcon />
                    Gerar
                  </Button>
                </div>
                <SlugFeedback
                  status={slugStatus}
                  errorMessage={errors.slug?.message}
                  replacedTakenSlug={replacedTakenSlug}
                  suggestions={slugSuggestions}
                  onPickSuggestion={applySlug}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                <Field>
                  <FieldLabel htmlFor="companyNiche">
                    Nicho <OptionalHint />
                  </FieldLabel>
                  <Input
                    id="companyNiche"
                    placeholder="Ex: Agência de Marketing, E-commerce…"
                    maxLength={120}
                    {...form.register("companyNiche")}
                    disabled={isSubmitting}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="companyCep">
                    CEP <OptionalHint />
                  </FieldLabel>
                  <Input
                    id="companyCep"
                    placeholder="00000-000"
                    inputMode="numeric"
                    value={form.watch("companyCep") ?? ""}
                    onChange={handleCepChange}
                    disabled={isSubmitting}
                    maxLength={9}
                  />
                  {errors.companyCep && (
                    <FieldError>{errors.companyCep.message}</FieldError>
                  )}
                </Field>
              </div>
            </FieldGroup>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isSlugTaken}
            >
              {isSubmitting ? "Criando…" : "Criar empresa"}
            </Button>
          </FieldSet>
        </form>
      </CardContent>
      <CardFooter />
    </Card>
  );
}
