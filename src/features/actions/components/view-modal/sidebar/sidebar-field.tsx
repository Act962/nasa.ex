interface SidebarFieldProps {
  label: string;
  children: React.ReactNode;
}

export function SidebarField({ label, children }: SidebarFieldProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
