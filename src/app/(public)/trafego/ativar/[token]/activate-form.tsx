"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Lock, Mail, Rocket, User } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { client as orpcClient } from "@/lib/orpc";

const schema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Mínimo 8 caracteres"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

interface ActivateFormProps {
  token: string;
  email: string;
  defaultName: string;
  isAuthenticated: boolean;
  sessionEmail: string | null;
}

/**
 * Fluxo:
 *  1. `authClient.signUp.email` cria User + sessão (pulado se já logado com o
 *     e-mail certo).
 *  2. `trafego.redeemPurchase` cria Organization, Member e o pedido.
 *  3. `setActive` deixa a org nova ativa na sessão.
 *  4. Redireciona para o painel da campanha.
 */
export function ActivateForm({
  token,
  email,
  defaultName,
  isAuthenticated,
  sessionEmail,
}: ActivateFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const isSameAccountLogged =
    isAuthenticated && sessionEmail?.toLowerCase() === email.toLowerCase();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: defaultName, password: "", confirmPassword: "" },
  });

  async function onSubmit(data: FormData) {
    setIsSubmitting(true);
    setStatusText(null);

    try {
      if (!isSameAccountLogged) {
        setStatusText("Criando sua conta…");
        const signUp = await authClient.signUp.email({
          email,
          password: data.password,
          name: data.name,
        });

        if (signUp.error) {
          // O plugin de organization pode reclamar de "sem org ativa" mesmo
          // após criar a conta — conferimos a sessão pra distinguir erro real.
          const session = await authClient.getSession();
          if (!session.data) {
            const message = (signUp.error.message ?? "").toLowerCase();
            toast.error(
              message.includes("email") ||
                message.includes("already") ||
                message.includes("exists")
                ? "Este e-mail já tem conta. Faça login e abra o link do e-mail novamente."
                : signUp.error.message || "Erro ao criar conta. Tente novamente.",
            );
            setIsSubmitting(false);
            setStatusText(null);
            return;
          }
        }
      }

      setStatusText("Preparando sua campanha…");
      const redeem = await orpcClient.trafego.redeemPurchase({ signupToken: token });

      try {
        await authClient.organization.setActive({
          organizationId: redeem.organizationId,
        });
      } catch (error) {
        // Não bloqueia: o usuário pode trocar de organização no header depois.
        console.error("[trafego/ativar] setActive falhou:", error);
      }

      toast.success("Conta ativada! Agora envie seus criativos 🚀");
      router.push(`/trafego/painel/${redeem.orderId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao ativar a campanha.",
      );
      setIsSubmitting(false);
      setStatusText(null);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-white/70">E-mail</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={email}
            readOnly
            disabled
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-9 py-2.5 text-sm text-white/80"
          />
        </div>
      </div>

      {!isSameAccountLogged && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/70">Seu nome</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
              <input
                {...register("name")}
                placeholder="Como podemos te chamar"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-9 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none"
              />
            </div>
            {errors.name && (
              <p className="text-xs text-rose-400">{errors.name.message}</p>
            )}
          </div>

          <PasswordField
            label="Crie uma senha"
            register={register("password")}
            error={errors.password?.message}
            show={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
          />

          <PasswordField
            label="Confirme a senha"
            register={register("confirmPassword")}
            error={errors.confirmPassword?.message}
            show={showConfirm}
            onToggle={() => setShowConfirm((value) => !value)}
          />
        </>
      )}

      {isSameAccountLogged && (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          Você já está logado com este e-mail. É só confirmar para liberar a campanha.
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {statusText ?? "Ativando…"}
          </>
        ) : (
          <>
            <Rocket className="size-4" />
            {isSameAccountLogged ? "Liberar minha campanha" : "Criar conta e continuar"}
          </>
        )}
      </button>
    </form>
  );
}

function PasswordField({
  label,
  register,
  error,
  show,
  onToggle,
}: {
  label: string;
  register: ReturnType<ReturnType<typeof useForm<FormData>>["register"]>;
  error?: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/70">{label}</label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <input
          {...register}
          type={show ? "text" : "password"}
          placeholder="••••••••"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-9 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
