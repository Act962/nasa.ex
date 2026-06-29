import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100svh",
        background:
          "linear-gradient(135deg, #050010 0%, #0d0025 40%, #0a0118 70%, #030012 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Nebula blobs */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "5%",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            right: "5%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: 800,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(59,7,100,0.15) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      {/* Star field */}
      <style>{`
        @keyframes twinkle {
          0%,100% { opacity: 0.2; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.4); }
        }
        .auth-star { position: absolute; border-radius: 50%; background: white; animation: twinkle var(--d,3s) ease-in-out infinite; animation-delay: var(--delay,0s); }
      `}</style>

      {[
        { top: "8%", left: "12%", w: 2, h: 2, d: "2.5s", delay: "0s" },
        { top: "15%", left: "25%", w: 1.5, h: 1.5, d: "3.8s", delay: "0.5s" },
        { top: "5%", left: "55%", w: 2.5, h: 2.5, d: "2s", delay: "1s" },
        { top: "22%", left: "70%", w: 1, h: 1, d: "4.5s", delay: "0.3s" },
        { top: "35%", left: "88%", w: 2, h: 2, d: "3s", delay: "1.8s" },
        { top: "60%", left: "92%", w: 1.5, h: 1.5, d: "2.8s", delay: "0.7s" },
        { top: "75%", left: "78%", w: 1, h: 1, d: "3.5s", delay: "2.1s" },
        { top: "88%", left: "45%", w: 2, h: 2, d: "2.2s", delay: "1.3s" },
        { top: "92%", left: "18%", w: 1.5, h: 1.5, d: "4s", delay: "0.4s" },
        { top: "70%", left: "8%", w: 1, h: 1, d: "3.2s", delay: "1.6s" },
        { top: "45%", left: "3%", w: 2, h: 2, d: "2.7s", delay: "0.9s" },
        { top: "18%", left: "42%", w: 1, h: 1, d: "3.6s", delay: "2.4s" },
        { top: "50%", left: "60%", w: 1.5, h: 1.5, d: "2.4s", delay: "1.1s" },
        { top: "30%", left: "48%", w: 1, h: 1, d: "4.2s", delay: "0.2s" },
        { top: "80%", left: "32%", w: 2, h: 2, d: "3.1s", delay: "1.9s" },
      ].map((s, i) => (
        <div
          key={i}
          className="auth-star"
          style={
            {
              top: s.top,
              left: s.left,
              width: s.w,
              height: s.h,
              ["--d" as string]: s.d,
              ["--delay" as string]: s.delay,
            } as React.CSSProperties
          }
        />
      ))}

      <div style={{ position: "relative", zIndex: 1 }}>
        <div className="flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              {/* <div className="mb-4">
                <Logo />
              </div> */}
              <CardTitle className="text-6xl font-bold text-primary">
                404
              </CardTitle>
              <CardDescription className="text-lg">
                Página não encontrada
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="mb-6 text-muted-foreground">
                A página que você está procurando não existe ou foi movida.
              </p>
              <Button asChild>
                <Link href="/">Voltar ao Início</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
