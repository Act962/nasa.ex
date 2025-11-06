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
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const signInShchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
});

type SignInSchema = z.infer<typeof signInShchema>;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signInShchema),
  });
  const [isLoading, setIsLoading] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const onSignIn = (data: SignInSchema) => {
    setIsLoading(async () => {
      await authClient.signIn.email(
        {
          email: data.email,
          password: data.password,
          callbackURL: "/tracking",
        },
        {
          onSuccess: () => {
            toast.success("Logado com sucesso!");
          },
          onError: (cxt) => {
            console.log("Erro ao logar", cxt);
            toast.error("Erro ao tentar entrar!");
          },
        }
      );
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSignIn)}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Faça login na sua conta</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Insira seu e-mail abaixo para acessar sua conta
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            autoFocus
            placeholder="johndoe@example.com"
            {...register("email")}
            disabled={isLoading}
          />
          {errors.email && (
            <FieldError>{errors.email.message || "E-mail inválido"}</FieldError>
          )}
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Senha</FieldLabel>
          </div>
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
            <FieldError>
              {errors.password.message || "Senha inválida"}
            </FieldError>
          )}

          <a
            href="#"
            className="ml-auto text-sm underline-offset-4 hover:underline"
          >
            Esqueceu sua senha?
          </a>
        </Field>
        <Field>
          <Button type="submit" className="cursor-pointer">
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
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
          <FieldDescription className="text-center">
            Não têm uma conta?{" "}
            <a href="sign-up" className="underline underline-offset-4">
              Cadastrar-se
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
