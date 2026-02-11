"use client";
import { Instagram, Facebook, Linkedin, Youtube, Twitter } from "lucide-react";

const socialLinks = [
  { name: "Instagram", icon: Instagram, url: "#" },
  { name: "Facebook", icon: Facebook, url: "#" },
  { name: "LinkedIn", icon: Linkedin, url: "#" },
  { name: "YouTube", icon: Youtube, url: "#" },
  { name: "Twitter", icon: Twitter, url: "#" },
];

const Footer = () => {
  return (
    <footer className="w-full py-12 mt-12 border-t border-border/30 bg-background/50 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col items-center gap-6">
          <img
            src={"/nasa-logo.png"}
            alt="N.A.S.A"
            className="h-10 opacity-70"
          />

          <div className="flex gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.url}
                aria-label={social.name}
                className="p-3 rounded-full bg-secondary/50 hover:bg-foreground/20 transition-all"
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              Termos de uso
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Política de privacidade
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Contato
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Suporte
            </a>
          </div>

          <p className="text-xs text-muted-foreground/60 text-center">
            © {new Date().getFullYear()} N.A.S.A - Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
