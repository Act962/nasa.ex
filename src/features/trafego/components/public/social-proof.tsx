"use client";

import { Quote, Star, TrendingUp, Users } from "lucide-react";

/**
 * ⚠️ DEPOIMENTOS SÃO PLACEHOLDER.
 *
 * Os três cards abaixo existem para dar a forma da seção. Substitua por
 * depoimentos REAIS antes de divulgar a página: depoimento inventado com
 * pessoa que não existe é publicidade enganosa (CDC art. 37) e contradiz os
 * Termos de Serviço que a própria página publica.
 *
 * Enquanto forem exemplos, a seção fica oculta — basta manter
 * `SHOW_TESTIMONIALS = false`. Troque o conteúdo e vire a chave.
 */
const SHOW_TESTIMONIALS = false;

interface Testimonial {
  name: string;
  role: string;
  quote: string;
  initials: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "[Nome do cliente]",
    role: "[Negócio, cidade]",
    quote:
      "[Depoimento real: o que mudou no negócio depois da campanha. Um resultado concreto vale mais que um elogio genérico.]",
    initials: "—",
  },
  {
    name: "[Nome do cliente]",
    role: "[Negócio, cidade]",
    quote: "[Depoimento real.]",
    initials: "—",
  },
  {
    name: "[Nome do cliente]",
    role: "[Negócio, cidade]",
    quote: "[Depoimento real.]",
    initials: "—",
  },
];

const STATS = [
  {
    icon: TrendingUp,
    value: "R$ 50 milhões",
    label: "investidos em tráfego pago",
  },
  {
    icon: Users,
    value: "5.350",
    label: "clientes atendidos",
  },
  {
    icon: Star,
    value: "12 marcas",
    label: "nacionais na carteira",
  },
];

export function SocialProofStats() {
  return (
    <section className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {STATS.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center"
        >
          <stat.icon className="mx-auto size-5 text-violet-300" />
          <p className="mt-2.5 text-xl font-bold text-white sm:text-2xl">
            {stat.value}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-white/50">{stat.label}</p>
        </div>
      ))}
    </section>
  );
}

export function Testimonials() {
  if (!SHOW_TESTIMONIALS) return null;

  return (
    <section className="mt-14" aria-labelledby="depoimentos-titulo">
      <h2
        id="depoimentos-titulo"
        className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/35"
      >
        O que dizem nossos clientes
      </h2>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial) => (
          <figure
            key={testimonial.name + testimonial.quote.slice(0, 12)}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <Quote className="size-4 shrink-0 text-violet-300/70" />
            <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-white/70">
              {testimonial.quote}
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-200">
                {testimonial.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-white">
                  {testimonial.name}
                </span>
                <span className="block truncate text-xs text-white/45">
                  {testimonial.role}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
