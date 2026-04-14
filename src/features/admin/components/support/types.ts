export const statusMap: Record<string, { label: string; colorClass: string }> =
  {
    PENDING: {
      label: "Pendente",
      colorClass: "bg-secondary text-secondary-foreground border-transparent",
    },
    IN_PROGRESS: {
      label: "Analisando",
      colorClass: "bg-primary text-primary-foreground border-transparent",
    },
    RESOLVED: {
      label: "Implementado",
      colorClass: "bg-accent text-accent-foreground border-border",
    },
    REJECTED: {
      label: "Rejeitado",
      colorClass: "bg-destructive text-destructive-foreground border-transparent",
    },
  };
