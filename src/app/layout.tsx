import "../lib/orpc.server"; // for pre-rendering

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// 1918 x 850

export const metadata: Metadata = {
  title: "Nasa.ex",
  description: "Suas ideias e Seus Planos. Bem-vindo ao N.A.S.A",
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
    title: "Nasa.ex",
    description: "Suas ideias e Seus Planos. Bem-vindo ao N.A.S.A",
    locale: "pt_BR",
    images: [
      {
        url: "/background.png",
        width: 1918,
        height: 850,
        alt: "Nasa.ex",
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
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <Toaster position="bottom-right" />
          {children}
        </Providers>
      </body>
    </html>
  );
}
