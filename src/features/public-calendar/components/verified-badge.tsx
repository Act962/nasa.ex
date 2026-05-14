import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Badge "Verificado" pequenino, exibido ao lado do nome da organização
 * quando `Organization.isVerified=true`. Indica que aquela marca
 * passou pelo processo manual de verificação do NASA.
 *
 * Reports submetidos por usuários daquela org pesam 5x mais que reports
 * de orgs não-verificadas (anti-abuso favorecendo marcas legítimas).
 */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={cn("size-4 shrink-0 text-blue-500", className)}
      aria-label="Organização verificada"
    />
  );
}
