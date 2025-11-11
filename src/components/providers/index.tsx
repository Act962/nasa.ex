"use client";

import { useState } from "react";
import { createQueryClient } from "@/lib/query/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ModalProvider } from "./modal-provider";
import { ThemeProvider } from "./theme-provider";

export function Providers(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ModalProvider />
        {props.children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
