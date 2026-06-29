export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  Bot,
  KeyRound,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ResetPasswordForm } from "./reset-password-form";

const HIGHLIGHTS = [
  { icon: Mail, label: "Link seguro", desc: "Enviado ao e-mail cadastrado" },
  { icon: ShieldCheck, label: "Token temporário", desc: "Expira em pouco tempo" },
  { icon: KeyRound, label: "Nova senha", desc: "Troque o acesso em minutos" },
  { icon: Sparkles, label: "Fluxo simples", desc: "Sem etapas desnecessárias" },
  { icon: Bot, label: "Suporte 24/7", desc: "Equipe pronta para ajudar" },
  { icon: Shield, label: "Proteção", desc: "Seu acesso continua seguro" },
];

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100svh", display: "flex" }}>
      <div
        style={{
          display: "none",
          width: "50%",
          height: "100svh",
          position: "sticky",
          top: 0,
          flexDirection: "column",
          overflow: "hidden",
        }}
        className="lg:flex"
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage:
              "radial-gradient(rgba(124,58,237,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            padding: "28px 36px",
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                borderRadius: 9,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 16px rgba(124,58,237,0.45)",
              }}
            >
              <Image src="/icon-astro.svg" alt="NASA" width={20} height={20} unoptimized />
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: "white", letterSpacing: "-0.4px" }}>
              NASA<span style={{ color: "#a78bfa" }}>.ex</span>
            </span>
          </Link>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 36px",
            gap: 20,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 130,
              height: 130,
              flexShrink: 0,
              animation: "astroResetFloat 3.2s ease-in-out infinite",
              filter: "drop-shadow(0 0 28px rgba(124,58,237,0.55))",
            }}
          >
            <Image src="/icon-astro.svg" alt="ASTRO" width={130} height={130} unoptimized />
          </div>

          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: "white",
                lineHeight: 1.2,
                letterSpacing: "-0.6px",
                margin: 0,
              }}
            >
              Recuperar acesso é{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #a78bfa, #7c3aed, #c084fc)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                rápido e seguro
              </span>
            </h1>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 13,
                lineHeight: 1.5,
                marginTop: 8,
                marginBottom: 0,
              }}
            >
              Envie o link para seu e-mail e redefina a senha em poucos cliques.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              width: "100%",
            }}
          >
            {HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    flexShrink: 0,
                    background: "rgba(124,58,237,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon style={{ width: 13, height: 13, color: "#a78bfa" }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: "white", fontSize: 12, fontWeight: 700, lineHeight: 1, margin: 0 }}>{label}</p>
                  <p
                    style={{
                      color: "rgba(255,255,255,0.38)",
                      fontSize: 10,
                      marginTop: 2,
                      lineHeight: 1.3,
                      margin: "2px 0 0",
                    }}
                  >
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: "20px 36px 28px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-around",
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          {[
            { value: "1 clique", label: "para recuperar" },
            { value: "60 min", label: "expiração padrão" },
            { value: "100%", label: "email protegido" },
          ].map(({ value, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <p style={{ color: "white", fontSize: 18, fontWeight: 800, margin: 0, lineHeight: 1 }}>{value}</p>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 3 }}>{label}</p>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes astroResetFloat {
            0%,100% { transform: translateY(0) rotate(2deg); }
            50% { transform: translateY(-12px) rotate(-2deg); }
          }
        `}</style>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          minHeight: "100svh",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            marginBottom: 28,
          }}
          className="lg:hidden"
        >
          <div
            style={{
              width: 30,
              height: 30,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image src="/icon-astro.svg" alt="NASA" width={18} height={18} unoptimized />
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "white" }}>
            NASA<span style={{ color: "#a78bfa" }}>.ex</span>
          </span>
        </Link>

        <div style={{ width: "100%", maxWidth: 460 }}>
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 11, marginTop: 16, textAlign: "center" }}>
          Segurança em primeiro lugar. O link expira automaticamente.
        </p>
      </div>
    </div>
  );
}
