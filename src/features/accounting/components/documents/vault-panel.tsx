"use client";

import { useState } from "react";
import { Fingerprint, KeyRound, Loader2, Lock, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isWebauthnSupported,
  useCompanyCredentials,
  useRegisterPaymentPasskey,
} from "@/features/accounting/hooks/use-accounting-credentials";
import { CertificatePanel } from "./certificate-panel";
import { CredentialFormDialog } from "./credential-form-dialog";
import { CredentialRow, type CredentialRowView } from "./credential-row";

function PasskeySetupNotice() {
  const registerPasskey = useRegisterPaymentPasskey();
  const isSupported = isWebauthnSupported();

  function register() {
    registerPasskey.mutate(undefined, {
      onSuccess: () => toast.success("Biometria cadastrada. Já pode revelar senhas."),
      onError: (error) =>
        toast.error(error.name === "NotAllowedError" ? "Cadastro cancelado." : error.message || "Não foi possível cadastrar."),
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 sm:flex-row sm:items-center">
      <Fingerprint className="size-6 shrink-0 text-amber-500" />
      <p className="flex-1 text-sm text-muted-foreground">
        Para ver uma senha guardada, confirme que é você com Face ID, Touch ID, Windows Hello ou a senha do aparelho.
        {!isSupported && " Este navegador não oferece essa confirmação — use outro aparelho."}
      </p>
      {isSupported && (
        <Button size="sm" variant="outline" disabled={registerPasskey.isPending} onClick={register}>
          {registerPasskey.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Cadastrar biometria
        </Button>
      )}
    </div>
  );
}

export function VaultPanel() {
  const { data, isLoading, error } = useCompanyCredentials();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<CredentialRowView | null>(null);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Lock className="size-5 shrink-0" />
          O cofre é só para quem administra o financeiro. Peça acesso ao dono da empresa.
        </CardContent>
      </Card>
    );
  }

  const credentials = data?.credentials ?? [];
  const hasPasskey = data?.hasPasskey ?? false;

  function openNewCredential() {
    setEditingCredential(null);
    setIsFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-violet-500" />
        <p className="text-muted-foreground">
          Senhas e certificados ficam cifrados (AES-256) e nunca aparecem na tela sem a sua biometria. Cada vez que
          alguém revela uma senha, fica registrado quem viu e quando. Só administradores do financeiro entram aqui.
        </p>
      </div>

      {!hasPasskey && <PasskeySetupNotice />}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-violet-500" /> Senhas de portais
          </CardTitle>
          <Button size="sm" className="bg-violet-600 text-white hover:bg-violet-700" onClick={openNewCredential}>
            <Plus className="size-3.5" /> Nova credencial
          </Button>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-8 text-center">
              <p className="text-sm font-medium">Nenhuma senha guardada</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Guarde os acessos do e-CAC, Simples Nacional, SEFAZ e prefeitura num lugar só, em vez de planilha ou
                bloco de notas.
              </p>
              <Button size="sm" variant="outline" onClick={openNewCredential}>
                <Plus className="size-3.5" /> Guardar a primeira
              </Button>
            </div>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {credentials.map((credential) => (
                <CredentialRow
                  key={credential.id}
                  credential={credential}
                  hasPasskey={hasPasskey}
                  onEdit={(selectedCredential) => {
                    setEditingCredential(selectedCredential);
                    setIsFormOpen(true);
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CertificatePanel />

      <CredentialFormDialog isOpen={isFormOpen} credential={editingCredential} onClose={() => setIsFormOpen(false)} />
    </div>
  );
}
