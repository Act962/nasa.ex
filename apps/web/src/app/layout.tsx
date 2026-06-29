import "../lib/orpc.server"; // for pre-rendering

import type { Metadata, Viewport } from "next";
import { Inter, Bungee } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

import { Providers } from "@/components/providers";
import { DevInspectorMount } from "@/components/dev-inspector";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bungee = Bungee({
  variable: "--font-bungee",
  subsets: ["latin"],
  weight: "400",
});

// 1918 x 850

/**
 * Viewport global — `maximumScale: 1` + `userScalable: false` matam
 * o auto-zoom irritante do iOS Safari ao focar inputs com font-size
 * abaixo de 16px. Defesa em profundidade junto com a regra CSS em
 * `globals.css` que força `font-size: 16px` em inputs no mobile.
 *
 * Trade-off conhecido: também desabilita pinch-zoom (a11y). Pedido
 * explícito do user pra remover o auto-zoom.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: "Órbita Hub",
  description: "Suas ideias e Seus Planos. Bem-vindo ao Órbita Hub",
  icons: {
    icon: [
      {
        url: "/favicon.png",
        href: "/favicon.png",
      },
    ],
  },
  openGraph: {
    type: "website",
    title: "Órbita Hub",
    description: "Suas ideias e Seus Planos. Bem-vindo ao Órbita Hub",
    locale: "pt_BR",
    images: [
      {
        url: "/background.png",
        width: 1918,
        height: 850,
        alt: "Órbita Hub",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${bungee.variable} antialiased`}>
        <Providers>
          <Toaster position="bottom-left" />
          {children}
          {/* Dev Inspector: hover 3s revela componente + texto + classes
              + cadeia de owners. Gated por NODE_ENV — em prod vira
              () => null literal e o tree-shaker remove. */}
          {/*<DevInspectorMount />*/}
        </Providers>
      </body>
    </html>
  );
}
