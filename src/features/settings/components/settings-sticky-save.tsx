import { cn } from "@/lib/utils";

/** Celular: barra de salvar presa embaixo, acima do menu recolhido. Computador: alinhada à direita. */
export function SettingsStickySave({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "z-20 flex justify-end pt-2",
        "max-sm:sticky max-sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] max-sm:-mx-1 max-sm:rounded-full max-sm:bg-background/90 max-sm:p-1 max-sm:backdrop-blur-md",
        "max-sm:[&>button]:h-12 max-sm:[&>button]:w-full max-sm:[&>button]:rounded-full",
        className,
      )}
    >
      {children}
    </div>
  );
}
