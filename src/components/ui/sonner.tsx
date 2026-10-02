"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <OrbitaSpinner className="size-4 " />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--line)",
          "--border-radius": "20px",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "!shadow-lg !gap-3" } }}
      // No celular, os avisos sobem acima do dock em órbita.
      mobileOffset={{ bottom: "calc(160px + env(safe-area-inset-bottom))" }}
      {...props}
    />
  )
}

export { Toaster }
