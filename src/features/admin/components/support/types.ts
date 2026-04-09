export const statusMap: Record<string, { label: string; colorClass: string }> =
  {
    PENDING: {
      label: "Pendente",
      colorClass: "bg-muted text-muted-foreground border-transparent",
    },
    IN_PROGRESS: {
      label: "Analisando",
      colorClass: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    },
    RESOLVED: {
      label: "Implementado",
      colorClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    },
    REJECTED: {
      label: "Rejeitado",
      colorClass: "bg-destructive/10 text-destructive border-destructive/20",
    },
  };
