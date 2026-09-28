"use client";

import { Info } from "lucide-react";

/**
 * A expectativa mais cara de corrigir depois: o cliente acha que o primeiro
 * envio vai para a base inteira. A Meta libera por degraus, e isso não depende
 * de nós — melhor deixar claro antes do pagamento.
 */
export function WhatsappWarmupNote() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.09] bg-white/[0.03] p-4">
      <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
      <div className="space-y-1.5 text-xs leading-relaxed text-white/55">
        <p className="font-semibold text-white/85">
          Importante sobre os primeiros envios
        </p>
        <p>
          A API Oficial não permite começar enviando para toda a sua base
          imediatamente. O número precisa primeiro construir reconhecimento e
          interação com seus contatos.
        </p>
        <p>
          Os limites são ampliados gradualmente conforme a qualidade e o histórico
          da conta — começa em cerca de{" "}
          <strong className="text-white/80">250 conversas por dia</strong> e sobe
          para 1.000, 10.000 e 100.000. A equipe monta esse calendário em ondas
          com você antes de ativar.
        </p>
      </div>
    </div>
  );
}
