"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket } from "lucide-react";

import ParallaxBackground from "@/features/plataform-updated/components/ParallaxBackground";
import SearchInput from "@/features/plataform-updated/components/SearchInput";
import ToolCard from "@/features/plataform-updated/components/ToolCard";
import Header from "@/features/plataform-updated/components/Header";
import NewsSection from "@/features/plataform-updated/components/NewsSection";
import PartnersSection from "@/features/plataform-updated/components/PartnersSection";
import TestimonialsSection from "@/features/plataform-updated/components/TestimonialsSection";
import Footer from "@/features/plataform-updated/components/Footer";
import AstroButton from "@/features/plataform-updated/components/AstroButton";
import { searchTools } from "@/features/plataform-updated/data/tools";
import Image from "next/image";

export function Home() {
  const [query, setQuery] = useState("");
  const results = searchTools(query);

  return (
    <div className="relative min-h-screen flex flex-col rocket-cursor">
      <ParallaxBackground />
      <Header />

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 pt-24">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <Image
            src={"/nasa-logo.png"}
            alt="N.A.S.A"
            width={200}
            height={200}
            className="h-16 md:h-20 object-contain animate-float"
          />
        </motion.div>

        {/* Search */}
        <SearchInput value={query} onChange={setQuery} />

        {/* Hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-muted-foreground text-sm mt-4 text-center"
        >
          Digite o nome ou função de uma ferramenta para explorar o universo
          N.A.S.A
        </motion.p>

        {/* Results or News Section */}
        <div className="w-full max-w-2xl mt-8 space-y-4">
          <AnimatePresence mode="popLayout">
            {query.length > 0 ? (
              <>
                {results.map((tool, i) => (
                  <ToolCard key={tool.id} tool={tool} index={i} />
                ))}
                {results.length === 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-muted-foreground text-sm"
                  >
                    Nenhuma ferramenta encontrada. Tente outra palavra-chave.
                  </motion.p>
                )}
              </>
            ) : (
              <NewsSection />
            )}
          </AnimatePresence>
        </div>

        {/* Link to all tools */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12"
        >
          <Link
            href="/home/tools"
            className="inline-flex items-center gap-2 text-sm text-foreground font-display tracking-wide"
          >
            <Rocket className="w-4 h-4" />
            Ver todas as soluções
          </Link>
        </motion.div>

        {/* Partners */}
        <PartnersSection />

        {/* Testimonials */}
        <TestimonialsSection />
      </main>

      <Footer />
      <AstroButton />
    </div>
  );
}
