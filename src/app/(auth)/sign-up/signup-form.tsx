"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeOff,
  Rocket,
  User,
  Mail,
  Lock,
  Building2,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import {
  COMPANY_TYPES,
  COMPANY_TYPE_SLUGS,
} from "@/features/company/constants";
import { saveSignupCompanyType } from "@/features/company/lib/signup-company-type";
import posthog from "posthog-js";

const signUpSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Mínimo 8 caracteres"),
    companyType: z.string().refine((v) => COMPANY_TYPE_SLUGS.includes(v), {
      message: "Selecione o tipo de empresa",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

type SignUpData = z.infer<typeof signUpSchema>;

const FIELD_INPUT_CLASS =
  "h-11 w-full rounded-full border border-line bg-foreground/5 pl-10 text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/40 disabled:opacity-60 aria-invalid:border-destructive";

function AuthField({
  label,
  icon: Icon,
  id,
  type,
  placeholder,
  error,
  disabled,
  register,
  rightElement,
}: {
  label: string;
  icon: React.ElementType;
  id: string;
  type: string;
  placeholder: string;
  error?: string;
  disabled?: boolean;
  register: UseFormRegisterReturn;
  rightElement?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-foreground/80">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-[15px] -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          {...register}
          className={cn(FIELD_INPUT_CLASS, rightElement ? "pr-10" : "pr-4")}
        />
        {rightElement && (
          <div className="absolute top-1/2 right-1 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && <p className="-mt-0.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function EyeToggle({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) {
  const Icon = show ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex cursor-pointer rounded-full px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="size-[15px]" />
    </button>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export function SignupForm() {
  const [callbackUrl] = useQueryState("callbackUrl");
  const [emailParam] = useQueryState("email");
  const postSignUpUrl = callbackUrl ?? "/create-organization";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: emailParam || "" },
  });

  const [isLoading, setIsLoading] = useTransition();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (emailParam) setValue("email", emailParam);
  }, [emailParam, setValue]);

  const onSignUp = (data: SignUpData) => {
    setIsLoading(async () => {
      const result = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.name.trim(),
        callbackURL: postSignUpUrl,
      });

      // better-auth's organizationClient plugin fires an internal request after
      // sign-up to set the active org. For a brand-new user (no org yet) that
      // sub-request returns an error, populating `result.error` even though the
      // account was created successfully. We detect this by checking the session.
      if (result.error) {
        const errMsg = result.error.message ?? "";
        const isOrgFalsePositive =
          errMsg.includes("organization") ||
          errMsg.includes("active") ||
          errMsg === "" ||
          result.error.status === 404 ||
          result.error.status === 400;

        if (isOrgFalsePositive) {
          // Account was created – verify by checking whether we now have a session
          const session = await authClient.getSession();
          if (session.data) {
            saveSignupCompanyType(data.companyType);
            posthog.identify(session.data.user.id, {
              email: data.email,
              name: data.name.trim(),
              company_type: data.companyType,
            });
            posthog.capture("user_signed_up", {
              method: "email",
              company_type: data.companyType,
            });
            toast.success("🚀 Conta criada! Bem-vindo ao ÓRBITA.ex!");
            // Hard navigation — bypassa o Router Cache do Next (RSC),
            // que mantém versão "deslogada" e causa loop sign-up → sign-in.
            window.location.assign(postSignUpUrl);
            return;
          }
        }

        // Real sign-up failure
        if (
          errMsg.toLowerCase().includes("email") ||
          errMsg.toLowerCase().includes("already")
        ) {
          toast.error("E-mail já cadastrado. Tente fazer login.");
        } else {
          toast.error(errMsg || "Erro ao criar conta. Tente novamente.");
        }
        return;
      }

      saveSignupCompanyType(data.companyType);
      if (result.data?.user) {
        posthog.identify(result.data.user.id, {
          email: data.email,
          name: data.name.trim(),
          company_type: data.companyType,
        });
      }
      posthog.capture("user_signed_up", {
        method: "email",
        company_type: data.companyType,
      });
      toast.success("🚀 Conta criada! Bem-vindo ao ÓRBITA.ex!");
      // Hard navigation — invalida Router Cache do Next que estaria
      // com versão "deslogada" da home, causando loop pós cadastro.
      window.location.assign(postSignUpUrl);
    });
  };

  const onGoogle = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackUrl ?? "/home",
      newUserCallbackURL: postSignUpUrl,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSignUp)} className="flex flex-col gap-[18px]">
      <div className="mb-1 text-center">
        <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-foreground">
          Crie sua conta
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Junte-se a centenas de times que vendem mais com ÓRBITA
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onGoogle}
        className="h-11 w-full gap-2.5 bg-foreground/5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continuar com Google
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted-foreground">ou preencha</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <AuthField
        label="Nome completo"
        icon={User}
        id="name"
        type="text"
        placeholder="João Silva"
        error={errors.name?.message}
        disabled={isLoading}
        register={register("name")}
      />
      <AuthField
        label="E-mail"
        icon={Mail}
        id="email"
        type="email"
        placeholder="joao@empresa.com"
        error={errors.email?.message}
        disabled={isLoading}
        register={register("email")}
      />
      <AuthField
        label="Senha"
        icon={Lock}
        id="password"
        type={showPass ? "text" : "password"}
        placeholder="Mínimo 8 caracteres"
        error={errors.password?.message}
        disabled={isLoading}
        register={register("password")}
        rightElement={
          <EyeToggle show={showPass} onToggle={() => setShowPass(!showPass)} />
        }
      />
      <AuthField
        label="Confirmar senha"
        icon={Lock}
        id="confirm-password"
        type={showConfirm ? "text" : "password"}
        placeholder="Repita a senha"
        error={errors.confirmPassword?.message}
        disabled={isLoading}
        register={register("confirmPassword")}
        rightElement={
          <EyeToggle
            show={showConfirm}
            onToggle={() => setShowConfirm(!showConfirm)}
          />
        }
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="companyType" className="text-[13px] font-medium text-foreground/80">
          Tipo da sua empresa
        </label>
        <div className="relative">
          <Building2 className="pointer-events-none absolute top-1/2 left-3.5 size-[15px] -translate-y-1/2 text-muted-foreground" />
          <select
            id="companyType"
            disabled={isLoading}
            defaultValue=""
            aria-invalid={Boolean(errors.companyType)}
            {...register("companyType")}
            className={cn(FIELD_INPUT_CLASS, "cursor-pointer appearance-none pr-4")}
          >
            <option value="" disabled className="bg-popover">
              Selecione…
            </option>
            {COMPANY_TYPES.map((companyType) => (
              <option key={companyType.slug} value={companyType.slug} className="bg-popover">
                {companyType.label}
              </option>
            ))}
          </select>
        </div>
        {errors.companyType && (
          <p className="-mt-0.5 text-xs text-destructive">{errors.companyType.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isLoading} className="mt-1 h-11 w-full font-bold">
        {isLoading ? (
          <>
            <OrbitaSpinner className="size-[15px] " /> Criando conta...
          </>
        ) : (
          <>
            <Rocket className="size-[15px]" /> Criar minha conta
          </>
        )}
      </Button>

      <p className="text-center text-[13px] text-muted-foreground">
        Já tem uma conta?{" "}
        <a
          href={`/sign-in${callbackUrl ? `?callbackUrl=${callbackUrl}` : ""}`}
          className="font-semibold text-info no-underline hover:underline"
        >
          Entrar
        </a>
      </p>
    </form>
  );
}
