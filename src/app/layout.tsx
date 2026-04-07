import "../lib/orpc.server"; // for pre-rendering

import type { Metadata } from "next";
import { Inter, Bungee } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

import { Providers } from "@/components/providers";

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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
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
      <body className={`${inter.variable} ${bungee.variable} antialiased`}>
        <Providers>
          <Toaster position="bottom-left" />
          {children}
        </Providers>
      </body>
    </html>
  );
}
