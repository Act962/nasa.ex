import Link from "next/link";
import { Clock, Globe, Play, Rocket, Shield, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Fechamento, briefing § 3.12.
 * Metáfora de órbita aplicada à promessa concreta: "em órbita até
 * sexta-feira". O `[sexta-feira]` é placeholder do briefing, Wey
 * personaliza pelo dia da semana ou substitui por "em 7 dias".
 */
export function FinalCTASection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="py-32 px-4">
      <div className="max-w-4xl mx-auto text-center relative">
        <div className="absolute inset-0 bg-[#7C3AED]/8 blur-3xl rounded-full scale-150 pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/12 border border-emerald-500/25 rounded-full px-5 py-2 mb-8">
            <Star className="size-3.5 text-emerald-400 fill-emerald-400" />
            <span className="text-emerald-300 text-sm font-medium">
              Sem cartão • Sem trocar tudo às cegas
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-6 leading-[1.05]">
            O processo que mais te dói pode estar
            <br />
            <span className="text-nasa">
              em órbita até{" "}
              {/* [TODO]: Wey personaliza o dia da semana ou substitui
                  por "em 7 dias" se preferir prazo fixo. */}
              <span title="TODO: personalizar dia">[sexta-feira]</span>.
            </span>
          </h2>

          <p className="text-white/55 text-lg sm:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
            Sem cartão, sem trocar tudo às cegas.{" "}
            <span className="text-white/85 font-semibold">
              A gente monta o lançamento com você
            </span>,{" "}
            você só assiste decolar.
          </p>

          {/* 2 CTAs, primário comece, secundário demo ao vivo */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
            <Button
              asChild
              size="lg"
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-black px-12 py-7 text-lg rounded-2xl nasa-glow-sm card-hover"
            >
              <Link href={isLoggedIn ? "/tracking" : "/sign-up"}>
                Começar meu primeiro processo
                <Rocket className="size-5 ml-2" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/3 text-white hover:bg-white/8 font-semibold px-10 py-7 text-base rounded-2xl card-hover"
            >
              <Link href={isLoggedIn ? "/tracking" : "/sign-in"}>
                <Play className="size-4 mr-2 text-[#a78bfa] fill-[#a78bfa]" />
                Ver uma demonstração ao vivo
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {[
              { icon: Shield, label: "LGPD Compliant" },
              { icon: Globe, label: "Hospedagem no Brasil" },
              { icon: Clock, label: "Setup em 5 minutos" },
              { icon: Users, label: "Acompanhamento da 1ª semana" },
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
