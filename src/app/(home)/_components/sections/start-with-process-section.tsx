import Link from "next/link";
import { ArrowRight, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Comece por um processo", seção antídoto à objeção de migração
 * (briefing § 3.9). Absorve o CTA antigo `/patterns` (PatternsFeatureSection
 * foi deletada) como botão secundário, mantendo o link pra Padrões NASA
 * vivo na página.
 *
 * Metáfora central: "todo foguete começa com um estágio", você não
 * monta a nave inteira no primeiro dia.
 */
export function StartWithProcessSection() {
  return (
    <section className="relative py-28 px-4 overflow-hidden border-t border-white/5">
      {/* Background glow laranja-ignição */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-orange-500/[0.05] blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-orange-500/12 border border-orange-500/25 rounded-full px-5 py-2">
            <Rocket className="size-3.5 text-orange-300" />
            <span className="text-orange-200 text-sm font-semibold tracking-wide">
              Comece por um estágio
            </span>
          </div>
        </div>

        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white text-center mb-6 leading-[1.05]">
          Todo foguete começa com um estágio.
          <br />
          <span className="text-nasa">
            Você não monta a nave inteira no primeiro dia.
          </span>
        </h2>

        <p className="text-white/55 text-lg sm:text-xl text-center max-w-3xl mx-auto leading-relaxed mb-10">
          Não precisa trocar tudo que você usa hoje de uma vez. Escolha o
          processo que mais te dá dor de cabeça. A gente monta ele inteiro no
          NASA, do começo ao fim, e você vê funcionar com um caso real antes de
          mexer em qualquer outra coisa.{" "}
          <span className="text-white/85 font-semibold">
            O resto da sua operação entra no seu tempo
          </span>,{" "}
          pelo caminho onde seus dados já estão passando.
        </p>

        {/* CTAs: primário leva pro sign-up assistido; secundário pro
            catálogo de Padrões NASA (CTA absorvido do antigo
            PatternsFeatureSection). */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            size="lg"
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-9 py-6 text-base rounded-xl card-hover shadow-[0_0_60px_rgba(249,115,22,0.35)]"
          >
            <Link href="/sign-up">
              Montar meu primeiro processo
              <Rocket className="size-4 ml-2" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-violet-500/30 bg-violet-500/5 text-white hover:bg-violet-500/15 font-semibold px-9 py-6 text-base rounded-xl card-hover"
          >
            <Link href="/patterns">
              <Sparkles className="size-4 mr-2 text-violet-300" />
              Ver Padrões NASA prontos
              <ArrowRight className="size-4 ml-2" />
            </Link>
          </Button>
        </div>

        {/* Microcopy reafirmando ausência de cartão */}
        <p className="mt-8 text-center text-sm text-white/30">
          Sem cartão de crédito. Sem prazo de migração. A gente acompanha a
          primeira semana com você.
        </p>
      </div>
    </section>
  );
}
