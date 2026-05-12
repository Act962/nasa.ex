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
      { hostname: "images.unsplash.com" },
      { hostname: "mmg.whatsapp.net" },
      { hostname: "uazapi.com" },
      { hostname: "nasa-ex.t3.storage.dev" },
      // Wildcard pra todos buckets Cloudflare R2 dev (`pub-<hash>.r2.dev`).
      // Cobre o bucket atual + qualquer bucket novo sem precisar reconfig
      // a cada vez que uma key roda no R2 e gera URL nova.
      { hostname: "*.r2.dev" },
      // Wildcard pra storage buckets do T3 (similar ao R2).
      { hostname: "*.t3.storage.dev" },
      { hostname: "lh3.googleusercontent.com" },
      { hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
