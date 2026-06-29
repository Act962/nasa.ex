"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useIntegrationTotal,
  useIntegrationPartial,
} from "@/features/integration/use-intrgration";
import { authClient } from "@/lib/auth-client";
import { useOrgRole } from "@/hooks/use-org-role";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatabaseBackup, Database, Info } from "lucide-react";

export function MigrationData() {
  const mutation = useIntegrationTotal();
  const mutationPartial = useIntegrationPartial();
  const session = authClient.useSession();
  const { isSingle } = useOrgRole();
  const [hasImported, setHasImported] = useState(false);

  if (isSingle) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="flex items-center justify-center size-14 rounded-full bg-amber-100 dark:bg-amber-950/40">
          <Lock className="size-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Acesso Restrito</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas o Master, Adm ou Moderador podem acessar a importação de dados.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    // const imported = localStorage.getItem("nasa_data_imported");
    // if (imported === "true") {
    //   setHasImported(true);
    // }
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

  const handleImportPartial = () => {
    if (!session.data?.user.email)
      return toast.error("Nenhum email encontrado");
    mutationPartial.mutate(
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
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Info className="size-5" />
        <p className="text-sm">
          Escolha o tipo de migração de dados que deseja realizar para sua
          conta.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Imigração Total */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DatabaseBackup className="size-6 text-primary" />
              </div>
              <CardTitle>Imigração Total</CardTitle>
            </div>
            <CardDescription>
              Migre todos os dados históricos e registros completos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                • Todos os leads e contatos
              </li>
              <li className="flex items-start gap-2">
                • Histórico completo de conversas
              </li>
              <li className="flex items-start gap-2">
                • Tags, campos personalizados
              </li>
              <li className="flex items-start gap-2">
                • Todos os trackings da empresa atual
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={handleImport}
              disabled={mutation.isPending || hasImported}
            >
              {mutation.isPending ? (
                <>
                  <Spinner />
                  Importando...
                </>
              ) : hasImported ? (
                "Já importado"
              ) : (
                "Iniciar Migração Total"
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Imigração Parcial */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Database className="size-6 text-primary" />
              </div>
              <CardTitle>Imigração Parcial</CardTitle>
            </div>
            <CardDescription>
              Migre apenas os dados recentes e essenciais para operação.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                • Todos os trackings da empresa atual
              </li>
              <li className="flex items-start gap-2">
                • Todos os status dos trackings
              </li>
              <li className="flex items-start gap-2">
                • Todos os leads da empresa atual
              </li>
              <li className="flex items-start gap-2">
                • Menor tempo de processamento
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleImportPartial}
              disabled={mutationPartial.isPending || hasImported}
            >
              {mutationPartial.isPending ? (
                <>
                  <Spinner />
                  Importando...
                </>
              ) : hasImported ? (
                "Já importado"
              ) : (
                "Iniciar Migração Parcial"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
