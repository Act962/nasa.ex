"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useIntegration } from "@/features/integration/use-intrgration";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export function MigrationData() {
  const mutation = useIntegration();
  const session = authClient.useSession();
  const [hasImported, setHasImported] = useState(false);

  useEffect(() => {
    const imported = localStorage.getItem("nasa_data_imported");
    if (imported === "true") {
      setHasImported(true);
    }
  }, []);

  const handleImport = () => {
    if (!session.data?.user.email)
      return toast.error("Nenhum email encontrado");
    mutation.mutate(
      { email: session.data?.user.email },
      {
        onSuccess: () => {
          localStorage.setItem("nasa_data_imported", "true");
          setHasImported(true);
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
      <Button
        onClick={handleImport}
        disabled={mutation.isPending || hasImported}
      >
        {mutation.isPending ? (
          <>
            <Spinner />
            Importando dados...
          </>
        ) : hasImported ? (
          "Dados já importados"
        ) : (
          "Importar dados"
        )}
      </Button>
    </div>
  );
}
