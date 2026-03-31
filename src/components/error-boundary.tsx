"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 space-y-4 border-2 border-dashed border-destructive/50 rounded-lg bg-destructive/5 m-4">
          <div className="flex items-center space-y-2 text-destructive">
             <AlertCircle className="size-8" />
             <h2 className="text-lg font-semibold ml-2">Algo deu errado ao renderizar o Kanban</h2>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Ocorreu um erro inesperado. Tente recarregar a página ou contate o suporte.
          </p>
          <Button 
            variant="outline" 
            onClick={() => this.setState({ hasError: false })}
          >
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
