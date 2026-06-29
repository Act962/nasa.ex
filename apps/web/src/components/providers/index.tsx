"use client";

import { useState } from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { createQueryClient } from "@/lib/query/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./theme-provider";
import { Provider } from "jotai";
import { PostHogProvider } from "./posthog-provider";

export function Providers(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <PostHogProvider>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </PostHogProvider>
  );
}
