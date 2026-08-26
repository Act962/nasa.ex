"use client";

import { Loader2, ShieldCheck, ShieldX, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useMyPaymentAccess,
  useClaimOwnerPaymentAccess,
} from "../../hooks/use-payment";

/**
 * Gate do módulo NASA Payment (spec 0007).
 *
 * Acesso é determinado exclusivamente pela whitelist (`PaymentAccess`): quem
 * está autorizado entra direto, quem não está vê a tela de restrição. O owner
 * da empresa é autoprovisionado no servidor, então nunca cai na restrição —
 * exceto contas de staff da plataforma, que por RF-13 não são autoprovisionadas
 * e recebem aqui o botão de auto-liberação (RF-14).
 *
 * Não há senha própria do módulo, código por WhatsApp nem estado no navegador.
 * A reconfirmação de identidade foi adiada de propósito para a fase de
 * biometria — ver decisão D-5 da spec.
 */
export function PaymentGate({ children }: { children: React.ReactNode }) {
  const my = useMyPaymentAccess();
  const claimAccess = useClaimOwnerPaymentAccess();

  async function handleClaim() {
    try {
      await claimAccess.mutateAsync({});
      await my.refetch();
      toast.success("Acesso financeiro liberado");
    } catch {
      toast.error("Não foi possível liberar seu acesso");
    }
  }

  if (my.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Falha de carga não pode virar "acesso restrito" — a mensagem mandaria a
  // pessoa procurar o financeiro por um problema que é de rede/servidor.
  if (my.isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full gap-6 px-4 text-center">
        <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <TriangleAlert className="size-8 text-amber-500" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h1 className="text-xl font-bold">Não foi possível verificar seu acesso</h1>
          <p className="text-sm text-muted-foreground">
            Houve uma falha ao consultar suas permissões do módulo financeiro.
            Isso não é um bloqueio de acesso — tente novamente.
          </p>
        </div>
        <Button onClick={() => my.refetch()} className="h-11">
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (my.data?.authorized) return <>{children}</>;

  // Owner da empresa barrado na autoprovisão (conta de staff, RF-13): em vez
  // de mandá-lo procurar o responsável — que é ele mesmo — oferece o clique.
  if (my.data?.canClaimAsOrgOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full gap-6 px-4 text-center">
        <div className="size-16 rounded-2xl bg-[#1E90FF]/10 border border-[#1E90FF]/20 flex items-center justify-center">
          <ShieldCheck className="size-8 text-[#1E90FF]" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h1 className="text-xl font-bold">Liberar seu acesso financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Você é responsável por esta empresa, então pode liberar o próprio
            acesso ao NASA Payment. Vale só para esta organização e fica
            registrado no histórico de acessos.
          </p>
        </div>
        <Button
          onClick={handleClaim}
          disabled={claimAccess.isPending}
          className="h-11 bg-[#1E90FF] hover:bg-[#1E90FF]/90 text-white"
        >
          {claimAccess.isPending ? (
            <><Loader2 className="size-4 animate-spin mr-2" />Liberando...</>
          ) : (
            <><ShieldCheck className="size-4 mr-2" />Liberar meu acesso</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full gap-6 px-4 text-center">
      <div className="size-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <ShieldX className="size-8 text-red-500" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h1 className="text-xl font-bold">Acesso financeiro restrito</h1>
        <p className="text-sm text-muted-foreground">
          Apenas pessoas autorizadas em{" "}
          <strong>Permissões → Acesso Financeiro</strong> podem entrar no módulo
          NASA Payment. Procure o responsável pelo financeiro da sua organização
          para solicitar acesso.
        </p>
      </div>
    </div>
  );
}
