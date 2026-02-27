"use client";

import { Button } from "@/components/ui/button";
import { useIntegration } from "@/features/integration/use-intrgration";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export function MigrationData() {
  const mutation = useIntegration();
  const session = authClient.useSession();

  const handleImport = () => {
    if (!session.data?.user.email)
      return toast.error("Nenhum email encontrado");
    mutation.mutate({ email: session.data?.user.email });
  };
  return (
    <div>
      <Button onClick={handleImport}>Importar dados</Button>
    </div>
  );
}
