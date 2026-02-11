"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Rocket } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const solutionItems = [
  { name: "ASTRO", icon: "/ASTRO-ICON.png", href: "/home/astro" },
  { name: "NASACHAT", icon: "/NASACHAT-ICON.png", href: "/home/nasachat" },
  { name: "NERP", icon: "/NERP-ICON.png", href: "/home/nerp" },
  { name: "LINNKER", icon: "/LINNKER-ICON.png", href: "/home/linnker" },
  { name: "ORBIT", icon: "/ORBIT-ICON.png", href: "/home/orbit" },
  { name: "TRACKING", icon: "/TRACKING-ICON.png", href: "/home/tracking" },
];

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3">
        {/* Menu Sanduíche */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger>
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 rounded-full bg-secondary/60 backdrop-blur-lg border border-border hover:bg-secondary transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Soluções N.A.S.A</SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-2">
                {solutionItems.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                        <Image
                          src={item.icon}
                          alt={item.name}
                          width={20}
                          height={20}
                          className="w-5 h-5 text-primary"
                        />
                      </div>
                      <span className="font-medium text-foreground">
                        {item.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <SheetFooter>
              <Button className="w-full">
                <Link
                  href="/home/tools"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2"
                >
                  <Rocket className="w-4 h-4" />
                  Ver todas as soluções
                </Link>
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
};

export default Header;
