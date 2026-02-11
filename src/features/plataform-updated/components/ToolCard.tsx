import { motion } from "framer-motion";
import { Plus, Check } from "lucide-react";
import { useState } from "react";
import type { Tool } from "@/features/plataform-updated/data/tools";
import { Button } from "@/components/ui/button";
import LoginDialog from "@/features/plataform-updated/components/LoginDialog";
import Link from "next/link";
import Image from "next/image";

interface ToolCardProps {
  tool: Tool;
  index?: number;
}

export default function ToolCard({ tool, index = 0 }: ToolCardProps) {
  const [added, setAdded] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const isLoggedIn = false;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      setShowLogin(true);
      return;
    }
    setAdded(!added);
  };

  return (
    <>
      <Link href={`/home/${tool.id}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.08 }}
          className="tool-card rounded-xl p-6 flex gap-5 items-start cursor-pointer"
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, hsl(${tool.color}), hsl(${tool.color} / 0.5))`,
            }}
          >
            <Image
              src={tool.icon}
              alt={tool.name}
              fill
              className="object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold tracking-wider text-foreground mb-1">
              {tool.name}
              <span className="text-xs font-sans font-normal text-muted-foreground ml-2 tracking-normal">
                by N.A.S.A
              </span>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {tool.description}
            </p>
            <Button
              onClick={handleAdd}
              variant={"default"}
              size="sm"
              className={`rounded-full gap-2`}
            >
              {added ? (
                <>
                  <Check className="w-4 h-4" />
                  Adicionado
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </Link>
      <LoginDialog open={showLogin} onOpenChange={setShowLogin} />
    </>
  );
}
