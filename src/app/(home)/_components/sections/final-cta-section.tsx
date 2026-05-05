import Link from "next/link";
import { Clock, Globe, Rocket, Shield, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCTASection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="py-32 px-4">
      <div className="max-w-4xl mx-auto text-center relative">
        <div className="absolute inset-0 bg-[#7C3AED]/8 blur-3xl rounded-full scale-150 pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/12 border border-emerald-500/25 rounded-full px-5 py-2 mb-8">
            <Star className="size-3.5 text-emerald-400 fill-emerald-400" />
            <span className="text-emerald-300 text-sm font-medium">
              Grátis para começar • Sem cartão de crédito
            </span>
          </div>

          <h2 className="text-5xl sm:text-6xl md:text-7xl font-black text-white mb-6 leading-[0.9]">
            Pronto para decolar
            <br />
            <span className="text-nasa">com o NASA?</span>
          </h2>

          <p className="text-white/40 text-xl mb-12 max-w-xl mx-auto leading-relaxed">
            Junte-se a mais de 2.300 empresas que já transformaram seu processo
            comercial com o Método N.A.S.A.®
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
            <Button
              asChild
              size="lg"
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black px-12 py-7 text-lg rounded-2xl nasa-glow-sm card-hover"
            >
              <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
                Começar gratuitamente
                <Rocket className="size-5 ml-2" />
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {[
              { icon: Shield, label: "LGPD Compliant" },
              { icon: Globe, label: "Hospedagem no Brasil" },
              { icon: Clock, label: "Setup em 5 minutos" },
              { icon: Users, label: "Suporte dedicado" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-white/25 text-sm"
              >
                <Icon className="size-4" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
