"use client";

import { useState } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { createQueryClient } from "@/lib/query/client";
// import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";
import { Provider } from "jotai";
import { TRPCReactProvider } from "@/trpc/client";

export function Providers(props: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <NuqsAdapter>
          <Provider>{props.children}</Provider>
        </NuqsAdapter>
      </ThemeProvider>
    </TRPCReactProvider>
  );
}
