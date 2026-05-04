"use client";

import { Eye, EyeOff, Loader2, LogIn, Mail, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { useRouter } from "next/navigation";

const signInSchema = z.object({
  email:    z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha obrigatória"),
});

type SignInData = z.infer<typeof signInSchema>;

// ── Styled field wrapper ──────────────────────────────────────────────────────
function AuthField({
  label, icon: Icon, id, type, placeholder, error, disabled, register, rightElement,
}: {
  label: string;
  icon: React.ElementType;
  id: string;
  type: string;
  placeholder: string;
  error?: string;
  disabled?: boolean;
  register: any;
  rightElement?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={id} style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <Icon style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          width: 15, height: 15, color: "rgba(255,255,255,0.3)",
        }} />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          {...register}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: error ? "1.5px solid rgba(239,68,68,0.6)" : "1.5px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: "10px 12px 10px 36px",
            paddingRight: rightElement ? 40 : 12,
            color: "white",
            fontSize: 14,
            outline: "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
            boxSizing: "border-box",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(124,58,237,0.7)";
            e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(124,58,237,0.12)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)";
            e.currentTarget.style.boxShadow   = "none";
          }}
        />
        {rightElement && (
          <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }}>
            {rightElement}
          </div>
        )}
      </div>
      {error && <p style={{ color: "rgba(239,68,68,0.85)", fontSize: 12, marginTop: -2 }}>{error}</p>}
    </div>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  const Icon = show ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", color: "rgba(255,255,255,0.35)", display: "flex" }}
    >
      <Icon style={{ width: 15, height: 15 }} />
    </button>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
  });
  const [isLoading, setIsLoading] = useTransition();
  const [showPass, setShowPass]   = useState(false);
  const [callbackUrl]             = useQueryState("callbackUrl");
  const router                    = useRouter();

  const onSignIn = (data: SignInData) => {
    setIsLoading(async () => {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: callbackUrl ?? "/home",
      });

      if (result.error) {
        const errMsg = result.error.message ?? "";
        // organizationClient false-positive: login succeeded but org fetch failed
        const isOrgFalsePositive =
          errMsg.includes("organization") ||
          errMsg.includes("active") ||
          errMsg === "" ||
          result.error.status === 404 ||
          result.error.status === 400;

        if (isOrgFalsePositive) {
          const session = await authClient.getSession();
          if (session.data) {
            toast.success("✅ Login realizado com sucesso!");
            router.push(callbackUrl ?? "/home");
            return;
          }
        }

        if (errMsg.toLowerCase().includes("password") || errMsg.toLowerCase().includes("credentials") || result.error.status === 401) {
          toast.error("E-mail ou senha incorretos.");
        } else {
          toast.error(errMsg || "Erro ao entrar. Verifique suas credenciais.");
        }
        return;
      }

      toast.success("✅ Login realizado com sucesso!");
      router.push(callbackUrl ?? "/home");
    });
  };

  const onGoogle = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackUrl ?? "/home",
    });
  };

  return (
    <form method="post" onSubmit={handleSubmit(onSignIn)} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "white", letterSpacing: "-0.5px", marginBottom: 6 }}>
          Acessar plataforma
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
          Entre na sua conta e continue sua jornada
        </p>
      </div>

      {/* Google button */}
      <button
        type="button"
        onClick={onGoogle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          width: "100%", padding: "10px 16px", borderRadius: 10, cursor: "pointer",
          background: "rgba(255,255,255,0.07)",
          border: "1.5px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 500,
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.11)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Entrar com Google
      </button>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>ou com e-mail</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
      </div>

      {/* Fields */}
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

      <div>
        <AuthField
          label="Senha"
          icon={Lock}
          id="password"
          type={showPass ? "text" : "password"}
          placeholder="Sua senha"
          error={errors.password?.message}
          disabled={isLoading}
          register={register("password")}
          rightElement={<EyeToggle show={showPass} onToggle={() => setShowPass(!showPass)} />}
        />
        <div style={{ textAlign: "right", marginTop: 6 }}>
          <a href="/reset-password" style={{ color: "rgba(167,139,250,0.7)", fontSize: 12, textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            Esqueceu a senha?
          </a>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 12, cursor: isLoading ? "not-allowed" : "pointer",
          background: isLoading ? "rgba(124,58,237,0.5)" : "linear-gradient(135deg, #7c3aed, #a855f7)",
          border: "none", color: "white", fontSize: 14, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: isLoading ? "none" : "0 4px 20px rgba(124,58,237,0.4)",
          transition: "all 0.2s", marginTop: 4,
        }}
        onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(124,58,237,0.55)"; }}}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = isLoading ? "none" : "0 4px 20px rgba(124,58,237,0.4)"; }}
      >
        {isLoading ? (
          <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Entrando...</>
        ) : (
          <><LogIn style={{ width: 15, height: 15 }} /> Entrar</>
        )}
      </button>

      {/* Sign-up link */}
      <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
        Não tem uma conta?{" "}
        <a
          href={`/sign-up${callbackUrl ? `?callbackUrl=${callbackUrl}` : ""}`}
          style={{ color: "#a78bfa", fontWeight: 600, textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
        >
          Criar conta grátis
        </a>
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}
