"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { client as orpcClient } from "@/lib/orpc";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, Rocket, User } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";

const schema = z
  .object({
    name: z.string().min(2, "Informe seu nome"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Mínimo 8 caracteres"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

interface Props {
  token: string;
  email: string;
  courseTitle: string;
  companySlug: string;
  courseSlug: string;
  isAuthenticated: boolean;
  sessionEmail: string | null;
}

/**
 * Form de resgate. Fluxo:
 *  1. Se ainda não logado: `authClient.signUp.email` (cria User + sessão).
 *     Se já logado com o mesmo e-mail: pula direto pro passo 2.
 *  2. `orpcClient.nasaRoute.redeemCoursePurchase({ signupToken })` — cria
 *     Org + Member + topup + matrícula + payout, marca pending REDEEMED.
 *  3. `authClient.organization.setActive` pra ativar a org recém-criada
 *     na sessão.
 *  4. Redireciona pro player do curso.
 */
export function RedeemForm({
  token,
  email,
  courseTitle,
  companySlug,
  courseSlug,
  isAuthenticated,
  sessionEmail,
}: Props) {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const sameAccountAlreadyLogged =
    isAuthenticated && sessionEmail?.toLowerCase() === email.toLowerCase();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    setStatusText(null);
    try {
      // ── 1. signUp (se ainda não logado com a conta certa) ───────────────
      if (!sameAccountAlreadyLogged) {
        setStatusText("Criando sua conta…");
        const signUpResult = await authClient.signUp.email({
          email,
          password: data.password,
          name: data.name.trim(),
        });

        if (signUpResult.error) {
          const errMsg = signUpResult.error.message ?? "";
          // better-auth pode retornar erro do plugin de organization (sem org
          // ativa) mesmo após criar a conta — verificamos a sessão pra
          // distinguir.
          const session = await authClient.getSession();
          if (!session.data) {
            const lower = errMsg.toLowerCase();
            if (lower.includes("email") || lower.includes("already") || lower.includes("exists")) {
              toast.error(
                "Este e-mail já tem conta. Faça login e clique novamente no link do e-mail.",
              );
            } else {
              toast.error(errMsg || "Erro ao criar conta. Tente novamente.");
            }
            setIsLoading(false);
            return;
          }
        }
      }

      // ── 2. Resgate (cria Org + Member + topup + matrícula) ──────────────
      setStatusText("Liberando acesso ao curso…");
      const redeemResult = await orpcClient.nasaRoute.redeemCoursePurchase({
        signupToken: token,
      });

      // ── 3. Set active org na sessão ────────────────────────────────────
      try {
        await authClient.organization.setActive({
          organizationId: redeemResult.organizationId,
        });
      } catch (err) {
        // Não bloqueia — usuário pode trocar org no header depois
        console.error("[redeem] setActive failed:", err);
      }

      // ── 4. Redireciona pro player ──────────────────────────────────────
      toast.success(`Bem-vindo(a) ao curso "${courseTitle}"! 🚀`);
      router.push(`/nasa-route/curso/${redeemResult.courseId}`);
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao resgatar a compra.";
      toast.error(msg);
      setIsLoading(false);
      setStatusText(null);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
      {/* E-mail trancado */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground/80">E-mail</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={email}
            readOnly
            disabled
            className="w-full rounded-full border border-line bg-muted px-9 py-2.5 text-sm text-muted-foreground"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Vinculado ao pagamento. Não é editável.
        </p>
      </div>

      {/* Nome */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground/80">
          Nome completo
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            {...register("name")}
            disabled={isLoading || sameAccountAlreadyLogged}
            placeholder="João Silva"
            className="w-full rounded-full border border-line bg-card px-9 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
        {errors.name && (
          <p className="text-[11px] text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Senha */}
      {!sameAccountAlreadyLogged && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/80">Senha</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                {...register("password")}
                type={showPass ? "text" : "password"}
                disabled={isLoading}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-full border border-line bg-card px-9 py-2.5 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showPass ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/80">
              Confirmar senha
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                {...register("confirmPassword")}
                type={showConfirm ? "text" : "password"}
                disabled={isLoading}
                placeholder="Repita a senha"
                className="w-full rounded-full border border-line bg-card px-9 py-2.5 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-[11px] text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <OrbitaSpinner className="size-4 " />
            {statusText ?? "Processando…"}
          </>
        ) : (
          <>
            <Rocket className="size-4" />
            {sameAccountAlreadyLogged
              ? "Acessar curso agora"
              : "Criar conta e acessar"}
          </>
        )}
      </button>

      {/* Link explícito pra companhia (debug) */}
      <p className="text-center text-[11px] text-muted-foreground">
        Você caiu direto no player de{" "}
        <strong className="text-muted-foreground">/{companySlug}/{courseSlug}</strong>{" "}
        após o cadastro.
      </p>
    </form>
  );
}
