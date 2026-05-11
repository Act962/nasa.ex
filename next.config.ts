import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {},
  async headers() {
    // Libera câmera, microfone e captura de tela pra origem própria.
    // Sem isso, alguns hosts/proxies (Vercel/Cloudflare) e browsers em
    // contextos derivados bloqueiam silenciosamente getUserMedia /
    // getDisplayMedia em produção.
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), autoplay=(self), fullscreen=(self)",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/@:nick/world",
        destination: "/station/:nick/world",
      },
      {
        source: "/@:nick",
        destination: "/station/:nick",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        hostname: "images.unsplash.com",
      },
      {
        hostname: "mmg.whatsapp.net",
      },
      {
        hostname: "uazapi.com",
      },
      {
        hostname: "nasa-ex.t3.storage.dev",
      },
      {
        hostname: "pub-f9e718fa60aa4e1092c20a791898d931.r2.dev",
      },
      {
        hostname: "lh3.googleusercontent.com",
      },
      {
        hostname: "api.dicebear.com",
      },
    ],
  },
};

export default nextConfig;
