"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

const signUpSchema = z
  .object({
    name: z.string().min(1, "Campo obrigatório"),
    email: z.email(),
    password: z.string().min(6, "Senha precisar ter no mínimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

type SignUpData = z.infer<typeof signUpSchema>;

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
  });
  const [loading, setLoading] = useTransition();

  const onSignUp = (data: SignUpData) => {
    setLoading(async () => {
      const { data: response } = await authClient.signUp.email(
        {
          email: data.email,
          password: data.password,
          name: data.name,
          callbackURL: "/",
        },
        {
          onSuccess: (ctx) => {
            toast.success("Conta criada com succeso");
          },
          onError: (err) => {
            toast.error("Erro ao criar conta");
          },
        }
      );
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSignUp)}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Crie sua conta</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Preencha o formulário abaixo para criar sua conta.
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="name">Nome</FieldLabel>
          <Input
            id="name"
            type="text"
            autoFocus
            placeholder="John Doe"
            {...register("name")}
          />
          {errors.name && (
            <FieldError className="text-sm text-red-400">
              {errors.name.message}
            </FieldError>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            {...register("email")}
          />
          {errors.email && (
            <FieldError className="text-sm text-red-400">
              {errors.email.message}
            </FieldError>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input id="password" type="password" {...register("password")} />
          {errors.password && (
            <FieldError>{errors.password.message} </FieldError>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Confirmar senha</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <FieldError>{errors.confirmPassword.message} </FieldError>
          )}
        </Field>
        <Field>
          <Button type="submit" className="cursor-pointer">
            Criar conta
          </Button>
        </Field>
        <FieldSeparator>ou</FieldSeparator>
        <Field>
          <Button variant="outline" type="button" className="cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="200"
              height="200"
              viewBox="0 0 424 432"
            >
              <path
                fill="currentColor"
                d="M214 186v-1h201q3 12 3 36q0 93-56.5 150.5T213 429q-88 0-150.5-62T0 216T62 65T213 3q87 0 144 57l-57 56q-33-33-86-33q-54 0-92.5 39.5t-38.5 95t38.5 94.5t92.5 39q31 0 55-9.5t37.5-24.5t20.5-29.5t10-27.5H214v-74z"
              />
            </svg>
            Entrar com Google
          </Button>
          <FieldDescription className="px-6 text-center">
            Já possui uma conta? <a href="/sign-in">Entrar</a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
