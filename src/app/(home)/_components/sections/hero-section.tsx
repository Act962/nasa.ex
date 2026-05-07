import Link from "next/link";
import { ChevronRight, Play, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardMock } from "../mocks/dashboard-mock";

export function HeroSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-28 pb-16 overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[700px] h-[700px] rounded-full bg-[#7C3AED]/12 blur-[140px] nasa-glow pointer-events-none" />
      <div
        className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-[#a855f7]/8 blur-[100px] nasa-glow pointer-events-none"
        style={{ animationDelay: "2s" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-6xl mx-auto w-full">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2.5 bg-[#7C3AED]/12 border border-[#7C3AED]/30 rounded-full px-5 py-2 nasa-badge nasa-fade-up">
          <Rocket className="size-3.5 text-[#a78bfa]" />
          <span className="text-[#c4b5fd] text-sm font-medium">
            Powered pelo Método N.A.S.A.® exclusivo
          </span>
          <ChevronRight className="size-3.5 text-[#7C3AED]" />
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6 leading-[0.88] nasa-fade-up-d1">
          <span className="text-white">O maior ecossistema</span>
          <br />
          <span className="text-nasa">de ferramentas de IA</span>
          <br />
          <span className="text-white">para gestão comercial do universo</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl md:text-2xl text-white/45 max-w-3xl mb-3 leading-relaxed nasa-fade-up-d2">
          Com o NASA, você paga em créditos (STARs), apenas o que for utilizar.{" "}
          <span className="text-white/75 font-semibold">
            Mais de 15 ferramentas pelo preço de 1.
          </span>
        </p>
        <p className="text-base text-white/30 mb-10 nasa-fade-up-d2">
          Do primeiro contato ao contrato assinado. Tudo em uma única
          plataforma.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 nasa-fade-up-d3">
          <Button
            asChild
            size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold px-9 py-6 text-base rounded-xl nasa-glow-sm card-hover"
          >
            <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
              Começar gratuitamente
              <Rocket className="size-4 ml-2" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/15 bg-white/3 text-white hover:bg-white/8 font-semibold px-9 py-6 text-base rounded-xl card-hover"
          >
            <Link href="/sign-in">
              <Play className="size-4 mr-2 text-[#a78bfa] fill-[#a78bfa]" />
              Ver demonstração
            </Link>
          </Button>
        </div>

        {/* Social proof */}
        <div className="flex items-center gap-4 text-sm text-white/30 mb-14 nasa-fade-up-d3">
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 nasa-ping" />
            </div>
            <span>2.300+ empresas ativas</span>
          </div>
          <span className="text-white/10">•</span>
          <span>Sem cartão de crédito</span>
          <span className="text-white/10">•</span>
          <span>Setup em 5 minutos</span>
        </div>

        {/* Hero mock */}
        <div className="w-full max-w-4xl nasa-float">
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}
