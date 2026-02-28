"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useIntegration } from "@/features/integration/use-intrgration";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export function MigrationData() {
  const mutation = useIntegration();
  const session = authClient.useSession();

  const handleImport = () => {
    if (!session.data?.user.email)
      return toast.error("Nenhum email encontrado");
    mutation.mutate(
      { email: session.data?.user.email },
      {
        onSuccess: () => {
          toast.success("Dados importados com sucesso");
          window.location.reload();
        },
        onError: () => {
          toast.error("Erro ao importar dados");
        },
      },
    );
  };
  return (
    <div>
      <Button onClick={handleImport} disabled={mutation.isPending}>
        {mutation.isPending ? (
          <>
            <Spinner />
            Importando dados...
          </>
        ) : (
          "Importar dados"
        )}
      </Button>
    </div>
  );
}
