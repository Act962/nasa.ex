"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Check,
  Star,
  Users,
  Building2,
  Shield,
  Zap,
} from "lucide-react";
import { tools } from "@/features/plataform-updated/data/tools";
import ParallaxBackground from "@/features/plataform-updated/components/ParallaxBackground";
import Header from "@/features/plataform-updated/components/Header";
import Footer from "@/features/plataform-updated/components/Footer";
import AstroButton from "@/features/plataform-updated/components/AstroButton";
import LoginDialog from "@/features/plataform-updated/components/LoginDialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

const features = [
  { icon: Zap, text: "Integração completa com outras ferramentas N.A.S.A" },
  { icon: Shield, text: "Suporte técnico prioritário 24/7" },
  { icon: Users, text: "Treinamento online incluso" },
  { icon: Building2, text: "Personalização para sua empresa" },
];

const testimonials = [
  {
    name: "João Mendes",
    company: "Digital Cube",
    avatar: "👨‍💼",
    rating: 5,
    text: "Ferramenta excepcional! Aumentamos nossa produtividade em 40% no primeiro mês.",
  },
  {
    name: "Maria Santos",
    company: "StartNow",
    avatar: "👩‍💻",
    rating: 5,
    text: "O suporte é incrível e a integração foi super fácil. Recomendo demais!",
  },
];

const partners = [
  { name: "TechCorp", logo: "🏢" },
  { name: "Inova", logo: "💡" },
  { name: "CloudMax", logo: "☁️" },
  { name: "DataPro", logo: "📊" },
];

interface ToolDetailProps {
  id: string;
}

export function ToolDetail({ id }: ToolDetailProps) {
  const tool = tools.find((t) => t.id === id);
  const [added, setAdded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Simulate not logged in - in real app, this would come from auth context
  const isLoggedIn = false;

  const handleAdd = () => {
    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    setAdded(!added);
  };

  if (!tool) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Ferramenta não encontrada</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col rocket-cursor">
      <ParallaxBackground />
      <Header />

      <main className="flex-1 px-4 py-20 pt-24">
        <div className="max-w-4xl mx-auto">
          {/* Back link */}
          <Link
            href="/home"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para início
          </Link>

          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="tool-card rounded-2xl p-8 md:p-12 mb-8"
          >
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center text-4xl md:text-5xl shrink-0"
                style={{
                  background: `linear-gradient(135deg, hsl(${tool.color}), hsl(${tool.color} / 0.5))`,
                }}
              >
                <Image src={tool.icon} alt={tool.name} width={50} height={50} />
              </div>

              <div className="flex-1">
                <h1 className="font-display text-3xl md:text-4xl font-bold tracking-wider text-foreground mb-2">
                  {tool.name}
                </h1>
                <p className="text-muted-foreground mb-1">by N.A.S.A</p>

                <div className="flex items-center gap-2 mb-4">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    (4.9) • 1.2k avaliações
                  </span>
                </div>

                <p className="text-foreground/90 leading-relaxed mb-6">
                  {tool.description}
                </p>

                <Button
                  onClick={handleAdd}
                  size="lg"
                  className={`rounded-full gap-2 text-base ${
                    added
                      ? "bg-primary/20 text-primary hover:bg-primary/30"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="w-5 h-5" />
                      Adicionado ao seu acesso
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Adicionar ao meu acesso
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Features */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            <h2 className="font-display text-xl font-bold tracking-wider text-foreground mb-6">
              O que está incluso
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="tool-card rounded-xl p-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-foreground" />
                  </div>
                  <p className="text-sm text-foreground">{feature.text}</p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Partners */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            <h2 className="font-display text-xl font-bold tracking-wider text-foreground mb-6">
              Empresas que usam {tool.name}
            </h2>
            <div className="flex flex-wrap gap-4">
              {partners.map((partner) => (
                <div
                  key={partner.name}
                  className="tool-card rounded-xl px-6 py-4 flex items-center gap-3"
                >
                  <span className="text-2xl">{partner.logo}</span>
                  <span className="text-sm font-medium text-foreground">
                    {partner.name}
                  </span>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Testimonials */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-12"
          >
            <h2 className="font-display text-xl font-bold tracking-wider text-foreground mb-6">
              O que dizem os usuários
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.name}
                  className="tool-card rounded-xl p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{testimonial.avatar}</span>
                    <div>
                      <p className="font-semibold text-foreground">
                        {testimonial.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.company}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: testimonial.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    "{testimonial.text}"
                  </p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="tool-card rounded-2xl p-8 text-center"
          >
            <h2 className="font-display text-2xl font-bold tracking-wider text-foreground mb-3">
              Pronto para decolar?
            </h2>
            <p className="text-muted-foreground mb-6">
              Adicione {tool.name} ao seu acesso e transforme seu negócio agora
              mesmo.
            </p>
            <Button
              onClick={handleAdd}
              size="lg"
              className="rounded-full gap-2 text-base animate-pulse-glow"
            >
              <Plus className="w-5 h-5" />
              Adicionar {tool.name}
            </Button>
          </motion.div>
        </div>
      </main>

      <Footer />
      <AstroButton />
      <LoginDialog open={showLogin} onOpenChange={setShowLogin} />
    </div>
  );
}
