"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search } from "lucide-react";
import ParallaxBackground from "@/features/plataform-updated/components/ParallaxBackground";
import ToolCard from "@/features/plataform-updated/components/ToolCard";
import Footer from "@/features/plataform-updated/components/Footer";
import AstroButton from "@/features/plataform-updated/components/AstroButton";
import { tools, searchTools } from "@/features/plataform-updated/data/tools";
import Link from "next/link";
import Image from "next/image";

export function AllTools() {
  const [filter, setFilter] = useState("");
  const displayed = filter ? searchTools(filter) : tools;

  return (
    <div className="relative min-h-screen flex flex-col rocket-cursor">
      <ParallaxBackground />

      <div className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        {/* Header */}
        <div className=" items-center justify-between mb-10 relative grid grid-cols-3">
          <Link
            href="/home"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="flex items-center justify-center">
            <Image
              src={"/nasa-logo.png"}
              alt="N.A.S.A"
              width={200}
              height={200}
              className="h-20 object-contain"
            />
          </div>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl md:text-4xl font-bold text-center mb-2 tracking-wider"
        >
          Universo de Soluções
        </motion.h1>
        <p className="text-muted-foreground text-center mb-8 text-sm">
          Todas as ferramentas N.A.S.A em um só lugar
        </p>

        {/* Filter */}
        <div className="max-w-md mx-auto mb-10">
          <div className="rounded-full bg-secondary/60 backdrop-blur-xl border border-border flex items-center px-4 py-2.5 gap-3">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar ferramentas..."
              className="bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground text-sm"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {displayed.map((tool, i) => (
            <ToolCard key={tool.id} tool={tool} index={i} />
          ))}
        </div>

        {displayed.length === 0 && (
          <p className="text-center text-muted-foreground text-sm mt-8">
            Nenhuma ferramenta encontrada.
          </p>
        )}
      </div>

      <Footer />
      <AstroButton />
    </div>
  );
}

export default AllTools;
