"use client";

import { Receipt } from "lucide-react";
import { FiscalProfileForm } from "@/features/fiscal/components/fiscal-profile-form";

export function FiscalTab() {
  return (
    <div className="w-full space-y-6 pb-8">
      <header className="px-4 sm:px-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Receipt className="size-5 text-[#7C3AED] shrink-0" /> Configuração
          Fiscal
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre o perfil fiscal da empresa, certificado A1 e padrões de
          emissão de NFS-e.
        </p>
      </header>
      <FiscalProfileForm />
    </div>
  );
}
