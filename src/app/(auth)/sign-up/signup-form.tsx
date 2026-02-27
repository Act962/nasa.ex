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
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const signUpSchema = z
  .object({
    name: z.string().min(1, "Campo obrigatório"),
    email: z.email(),
    password: z.string().min(8, "Senha precisar ter no mínimo 8 caracteres"),
    confirmPassword: z
      .string()
      .min(8, "Confirmação de senha precisar ter no mínimo 8 caracteres"),
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
  const [isLoading, setIsLoading] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setConfirmPassword] = useState(false);
  const router = useRouter();

  const onSignUp = (data: SignUpData) => {
    setIsLoading(async () => {
      await authClient.signUp.email(
        {
          email: data.email,
          password: data.password,
          name: data.name,
          callbackURL: "/tracking",
        },
        {
          onSuccess: () => {
            toast.success("Conta criada com succeso");
            router.push("/tracking");
          },
          onError: (err) => {
            console.log(err);
            toast.error("Erro ao criar conta");
          },
        },
      );
    });
  };

  const onSignInWithGoogle = async () => {
    const data = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/tracking",
      scopes: ["https://www.googleapis.com/auth/drive.file"],
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
          <h1 className="text-2xl font-bold">Entrar no NASA</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Preencha o formulário abaixo para atualizar os dados da sua conta.
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
            disabled={isLoading}
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
            disabled={isLoading}
          />
          {errors.email && (
            <FieldError className="text-sm text-red-400">
              {errors.email.message}
            </FieldError>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              placeholder="••••••••"
              type={showPassword ? "text" : "password"}
              {...register("password")}
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent!"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="sr-only">
                {showPassword ? "Esconder senha" : "Mostrar senha"}
              </span>
            </Button>
          </div>
          {errors.password && (
            <FieldError>{errors.password.message} </FieldError>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Confirmar senha</FieldLabel>
          <div className="relative">
            <Input
              placeholder="••••••••"
              type={showConfirmPassword ? "text" : "password"}
              id="confirm-password"
              {...register("confirmPassword")}
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent!"
              onClick={() => setConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="sr-only">
                {showConfirmPassword ? "Esconder senha" : "Mostrar senha"}
              </span>
            </Button>
          </div>
          {errors.confirmPassword && (
            <FieldError>{errors.confirmPassword.message} </FieldError>
          )}
        </Field>
        <Field>
          <Button type="submit" className="cursor-pointer" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              "Atualizar"
            )}
          </Button>
        </Field>
        <FieldSeparator>ou</FieldSeparator>
        <Field>
          <Button
            variant="outline"
            type="button"
            className="cursor-pointer"
            onClick={onSignInWithGoogle}
          >
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
