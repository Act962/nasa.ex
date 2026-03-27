import { Button } from "@/components/ui/button";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="rounded-2xl bg-destructive/10 p-6">
          <AlertTriangleIcon className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Relatório não encontrado</h1>
          <p className="text-muted-foreground text-sm">
            Este link de compartilhamento pode ter expirado ou não existe.
            Verifique o endereço e tente novamente.
          </p>
        </div>
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCwIcon className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
