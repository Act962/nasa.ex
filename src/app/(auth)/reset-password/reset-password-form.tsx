"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
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
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

const requestSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

const resetSchema = z
  .object({
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Mínimo 8 caracteres"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

type RequestData = z.infer<typeof requestSchema>;
type ResetData = z.infer<typeof resetSchema>;

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  const Icon = show ? EyeOff : Eye;

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px 6px",
        color: "var(--muted-foreground)",
        display: "flex",
      }}
    >
      <Icon style={{ width: 15, height: 15 }} />
    </button>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");
  const isResetMode = Boolean(token);

  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const requestForm = useForm<RequestData>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const handleRequestReset = (data: RequestData) => {
    startTransition(async () => {
      const redirectTo =
        typeof window !== "undefined"
          ? new URL("/reset-password", window.location.origin).href
          : "/reset-password";

      const result = await authClient.requestPasswordReset({
        email: data.email.trim(),
        redirectTo,
      });

      if (result.error) {
        toast.error(
          result.error.message ||
            "Não foi possível enviar o e-mail de recuperação.",
        );
        return;
      }

      setSent(true);
      toast.success(
        "Se o e-mail existir, você receberá um link de recuperação.",
      );
    });
  };

  const handleResetPassword = (data: ResetData) => {
    if (!token) {
      toast.error("Token de redefinição ausente.");
      return;
    }

    startTransition(async () => {
      const result = await authClient.resetPassword({
        token,
        newPassword: data.newPassword,
      });

      if (result.error) {
        toast.error(
          result.error.message || "Não foi possível redefinir a senha.",
        );
        return;
      }

      toast.success("Senha atualizada com sucesso. Faça login novamente.");
      router.push("/sign-in");
    });
  };

  return (
    <Card className="dark border-line bg-card/60 text-foreground shadow-2xl backdrop-blur-2xl">
      <CardHeader className="space-y-3 pb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" />
          Recuperação de acesso
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {isResetMode ? "Crie uma nova senha" : "Recuperar senha"}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {isResetMode
              ? "Digite sua nova senha para concluir a redefinição."
              : "Informe seu e-mail e enviaremos um link seguro para redefinir o acesso."}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {error === "INVALID_TOKEN" ? (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>
              Este link de redefinição expirou ou é inválido. Peça um novo
              e-mail para continuar.
            </p>
          </div>
        ) : null}

        {!isResetMode ? (
          <form
            onSubmit={requestForm.handleSubmit(handleRequestReset)}
            className="flex flex-col gap-5"
          >
            <FieldGroup>
              <Field data-invalid={!!requestForm.formState.errors.email}>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <FieldContent>
                  <FieldDescription>
                    Vamos enviar um link de recuperação para esse endereço.
                  </FieldDescription>
                  <Input
                    id="email"
                    type="email"
                    placeholder="voce@empresa.com"
                    aria-invalid={!!requestForm.formState.errors.email}
                    disabled={isPending}
                    {...requestForm.register("email")}
                    className="border-line bg-foreground/5 text-foreground placeholder:text-muted-foreground"
                  />
                  <FieldError errors={[requestForm.formState.errors.email]} />
                </FieldContent>
              </Field>
            </FieldGroup>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Enviando...
                </>
              ) : (
                "Enviar link de recuperação"
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Lembrou a senha?{" "}
              <Button
                type="button"
                variant="link"
                onClick={() => router.push("/sign-in")}
                className="h-auto px-0 text-info"
              >
                Voltar para o login
              </Button>
            </p>

            {sent ? (
              <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
                Se o e-mail existir, você receberá um link de redefinição em
                instantes.
              </div>
            ) : null}
          </form>
        ) : (
          <form
            onSubmit={resetForm.handleSubmit(handleResetPassword)}
            className="flex flex-col gap-5"
          >
            <FieldGroup>
              <Field data-invalid={!!resetForm.formState.errors.newPassword}>
                <FieldLabel htmlFor="newPassword">Nova senha</FieldLabel>
                <FieldContent>
                  <FieldDescription>
                    Use pelo menos 8 caracteres para manter a conta protegida.
                  </FieldDescription>
                  <div className="relative">
                    <Lock
                      style={{
                        position: "absolute",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 15,
                        height: 15,
                        color: "var(--muted-foreground)",
                      }}
                    />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Digite a nova senha"
                      aria-invalid={!!resetForm.formState.errors.newPassword}
                      disabled={isPending}
                      {...resetForm.register("newPassword")}
                      className="border-line bg-foreground/5 pl-9 pr-11 text-foreground placeholder:text-muted-foreground"
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: 4,
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <EyeToggle
                        show={showNewPassword}
                        onToggle={() => setShowNewPassword((value) => !value)}
                      />
                    </div>
                  </div>
                  <FieldError
                    errors={[resetForm.formState.errors.newPassword]}
                  />
                </FieldContent>
              </Field>

              <Field
                data-invalid={!!resetForm.formState.errors.confirmPassword}
              >
                <FieldLabel htmlFor="confirmPassword">
                  Confirmar senha
                </FieldLabel>
                <FieldContent>
                  <div className="relative">
                    <Lock
                      style={{
                        position: "absolute",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 15,
                        height: 15,
                        color: "var(--muted-foreground)",
                      }}
                    />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repita a nova senha"
                      aria-invalid={!!resetForm.formState.errors.confirmPassword}
                      disabled={isPending}
                      {...resetForm.register("confirmPassword")}
                      className="border-line bg-foreground/5 pl-9 pr-11 text-foreground placeholder:text-muted-foreground"
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: 4,
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <EyeToggle
                        show={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword((value) => !value)}
                      />
                    </div>
                  </div>
                  <FieldError
                    errors={[resetForm.formState.errors.confirmPassword]}
                  />
                </FieldContent>
              </Field>
            </FieldGroup>

            <div className="flex items-center justify-end gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Salvando...
                  </>
                ) : (
                  "Salvar nova senha"
                )}
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/sign-in")}
              className="w-full justify-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <ArrowLeft data-icon="inline-start" />
              Voltar para o login
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
