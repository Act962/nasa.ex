"use client";

import { CheckCircle2, CircleHelp, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeBankPermissions } from "../../lib/bank-providers";

// Permissões da integração conferidas chamando a API do banco (spec 0133): diz antes de usar o
// que funciona e o que falta marcar no banco, para ninguém achar que "o sistema não funciona".

export interface BankPermissionsView {
  permissionsCheckedAt: Date | null;
  missingForPix: string[] | null;
  missingForBoleto: string[] | null;
  isBoletoSupported: boolean;
  moneyMovingScopes: string[];
}

interface PermissionRowProps {
  label: string;
  missing: string[] | null;
  okText: string;
}

function PermissionRow({ label, missing, okText }: PermissionRowProps) {
  if (missing === null) {
    return (
      <li className="flex items-start gap-2">
        <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>
          <span className="font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">Ainda não conferido.</span>
        </span>
      </li>
    );
  }
  const isOk = missing.length === 0;
  return (
    <li className="flex items-start gap-2">
      {isOk ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      )}
      <span>
        <span className="font-medium">{label}</span>
        <span className={`block text-xs ${isOk ? "text-muted-foreground" : "text-destructive"}`}>
          {isOk ? okText : `Falta marcar na integração do banco: ${describeBankPermissions(missing)}.`}
        </span>
      </span>
    </li>
  );
}

export function BankPermissionsCheck({
  permissions,
  isChecking,
  onCheck,
}: {
  permissions: BankPermissionsView;
  isChecking: boolean;
  onCheck: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Permissões no banco</p>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" disabled={isChecking} onClick={onCheck}>
          {isChecking && <Loader2 className="size-3.5 animate-spin" />}
          {permissions.permissionsCheckedAt ? "Conferir de novo" : "Conferir agora"}
        </Button>
      </div>
      <ul className="space-y-2.5 text-sm">
        <PermissionRow
          label="PIX das cobranças"
          missing={permissions.missingForPix}
          okText="Gera o PIX, confere o pagamento e recebe o aviso."
        />
        {permissions.isBoletoSupported && (
          <PermissionRow
            label="Boleto com PIX"
            missing={permissions.missingForBoleto}
            okText="Pode emitir boleto com PIX."
          />
        )}
      </ul>
      {permissions.moneyMovingScopes.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            <span className="font-semibold">A integração permite tirar dinheiro da conta</span> (
            {describeBankPermissions(permissions.moneyMovingScopes)}). O ÓRBITA nunca usa isso, mas, se as credenciais
            vazarem, alguém poderia. Remova essas permissões na integração do banco.
          </p>
        </div>
      )}
      {permissions.permissionsCheckedAt && (
        <p className="text-[11px] text-muted-foreground">
          Conferido em {new Date(permissions.permissionsCheckedAt).toLocaleString("pt-BR")} chamando o banco, sem criar nada.
        </p>
      )}
    </div>
  );
}
