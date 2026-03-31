import { ReactNode } from "react";

interface SidebarFieldProps {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function SidebarField({ label, icon, children }: SidebarFieldProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </p>
      {children}
    </div>
  );
}
