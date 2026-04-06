"use client";

import { AppTemplateToggle } from "@/features/admin/components/app-template-toggle";

interface TemplatesTabProps {
  workspace: any;
  workspaceId: string;
}

export function TemplatesTab({ workspace, workspaceId }: TemplatesTabProps) {

  return (
    <div className="w-full space-y-6">
      <div>
        <h3 className="text-lg font-medium">Padrões NASA</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Marque este workspace como um padrão NASA para que ele possa ser duplicado em outras empresas com dados fictícios.
        </p>
      </div>

      <AppTemplateToggle
        appId={workspaceId}
        appType="workspace"
        isTemplate={workspace.isTemplate ?? false}
      />
    </div>
  );
}
