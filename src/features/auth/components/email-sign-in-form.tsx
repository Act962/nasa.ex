"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import posthog from "posthog-js";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import styles from "./auth-entry.module.css";

const signInSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha obrigatória"),
});

type SignInPayload = z.infer<typeof signInSchema>;

interface EmailSignInFormProps {
  callbackUrl: string | null;
  onBack: () => void;
}

export function EmailSignInForm({ callbackUrl, onBack }: EmailSignInFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInPayload>({ resolver: zodResolver(signInSchema) });
  const [isLoading, startLoading] = useTransition();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const redirectUrl = callbackUrl ?? "/home";

  const completeSignIn = (user?: { id: string; email: string }) => {
    if (user) posthog.identify(user.id, { email: user.email });
    posthog.capture("user_signed_in", { method: "email" });
    toast.success("✅ Login realizado com sucesso!");
    // Navegação completa: o Router Cache do Next guarda a versão deslogada de /home e causava loop sign-in → home → sign-in.
    window.location.assign(redirectUrl);
  };

  const onSignIn = (payload: SignInPayload) => {
    startLoading(async () => {
      const result = await authClient.signIn.email({
        email: payload.email,
        password: payload.password,
        callbackURL: redirectUrl,
      });

      if (!result.error) {
        completeSignIn(result.data?.user);
        return;
      }

      const errorMessage = result.error.message ?? "";
      // organizationClient pode acusar erro mesmo com o login feito, quando só a busca da org falha.
      const isOrganizationFalsePositive =
        errorMessage.includes("organization") ||
        errorMessage.includes("active") ||
        errorMessage === "" ||
        result.error.status === 404 ||
        result.error.status === 400;

      if (isOrganizationFalsePositive) {
        const session = await authClient.getSession();
        if (session.data) {
          completeSignIn(session.data.user);
          return;
        }
      }

      const isInvalidCredentials =
        errorMessage.toLowerCase().includes("password") ||
        errorMessage.toLowerCase().includes("credentials") ||
        result.error.status === 401;

      toast.error(
        isInvalidCredentials
          ? "E-mail ou senha incorretos."
          : errorMessage || "Erro ao entrar. Verifique suas credenciais.",
      );
    });
  };

  const PasswordToggleIcon = isPasswordVisible ? EyeOff : Eye;

  return (
    <form method="post" onSubmit={handleSubmit(onSignIn)} className={styles.emailForm} noValidate>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={14} /> Voltar
      </button>

      <div>
        <div className={styles.field}>
          <Mail className={styles.fieldIcon} />
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="E-mail"
            aria-label="E-mail"
            autoFocus
            disabled={isLoading}
            className={errors.email ? `${styles.input} ${styles.inputInvalid}` : styles.input}
            {...register("email")}
          />
        </div>
        {errors.email && <p className={styles.fieldError}>{errors.email.message}</p>}
      </div>

      <div>
        <div className={styles.field}>
          <Lock className={styles.fieldIcon} />
          <input
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Senha"
            aria-label="Senha"
            disabled={isLoading}
            className={errors.password ? `${styles.input} ${styles.inputInvalid}` : styles.input}
            {...register("password")}
          />
          <button
            type="button"
            className={styles.eyeToggle}
            onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
            aria-label={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
          >
            <PasswordToggleIcon size={18} />
          </button>
        </div>
        {errors.password && <p className={styles.fieldError}>{errors.password.message}</p>}
      </div>

      <a href="/reset-password" className={styles.forgot}>
        Esqueceu a senha?
      </a>

      <button type="submit" disabled={isLoading} className={`${styles.button} ${styles.submit}`}>
        {isLoading ? (
          <>
            <Loader2 className={styles.spinner} /> Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </button>
    </form>
  );
}
