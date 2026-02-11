"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, Rocket } from "lucide-react";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirect?: string;
}

const LoginDialog = ({ open, onOpenChange, redirect }: LoginDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader className="text-center items-center">
          <img src={"/nasa-logo.png"} alt="N.A.S.A" className="h-12 mb-4" />
          <DialogTitle className="font-display text-xl tracking-wider">
            Faça seu login agora mesmo
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Para adicionar ferramentas ao seu acesso, você precisa estar
            conectado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-6">
          <Button className="w-full gap-2 h-12 text-base">
            <LogIn className="w-5 h-5" />
            Entrar na minha conta
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2 h-12 text-base">
            <Rocket className="w-5 h-5" />
            Criar conta grátis
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Ao continuar, você concorda com nossos Termos de Uso e Política de
          Privacidade.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
