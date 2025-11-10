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
  FieldSeparator,
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

const formCreateOrg = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Nome muito longo"),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug deve conter apenas letras minúsculas, números e hífens"
    ),
  logo: z.string().optional(),
});

type FormCreateOrg = z.infer<typeof formCreateOrg>;

export function FormCreateOrg() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormCreateOrg>({
    resolver: zodResolver(formCreateOrg),
  });

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const isFirstRender = useRef(true);
  const router = useRouter();

  const name = watch("name");
  const logo = watch("logo");

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
      const slug = createSlug(name);
      setValue("slug", slug, { shouldValidate: true });
    }
  }, [name, isSlugManuallyEdited, setValue]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = createSlug(e.target.value);
    setValue("slug", slug, { shouldValidate: true });
    setIsSlugManuallyEdited(true);
  };

  const onSubmit = async (data: FormCreateOrg) => {
    // Verifica se o slug já existe
    const { data: checkData } = await authClient.organization.checkSlug({
      slug: data.slug,
    });

    console.log(checkData);

    if (!checkData?.status) {
      toast.error("Este slug já está em uso. Por favor, escolha outro.");
      return;
    }

    // Cria a organização
    const metadata = { name: data.name, createdAt: new Date().toISOString() };

    const { error } = await authClient.organization.create({
      name: data.name,
      slug: data.slug,
      logo: data.logo,
      metadata,
      keepCurrentActiveOrganization: true,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Organização criada com sucesso!");
    router.push("tracking");
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setValue("logo", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Criar organização</CardTitle>
        <CardDescription>
          Preencha o formulário abaixo para criar sua organização.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nome da empresa</FieldLabel>
                <Input
                  id="name"
                  placeholder="Acm Distribuidora"
                  {...register("name")}
                />
                {errors.name && <FieldError>{errors.name.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="slug">Slug</FieldLabel>
                <div className="flex items-center gap-x-4">
                  <Input
                    id="slug"
                    placeholder="acm-distribuidora"
                    {...register("slug")}
                    onChange={handleSlugChange}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (name) {
                        const slug = createSlug(name);
                        setValue("slug", slug);
                      }
                    }}
                  >
                    Gerar
                  </Button>
                </div>
                {errors.slug && <FieldError>{errors.slug.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="logo">Logo</FieldLabel>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
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
              <Button type="submit">Criar organização</Button>
            </Field>
          </FieldSet>
        </form>
      </CardContent>
      <CardFooter></CardFooter>
    </Card>
  );
}
