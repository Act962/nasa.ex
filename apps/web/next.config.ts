import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // React Compiler custa CPU+RAM a cada compile. Mantemos no build de produção
  // (ganho de perf real) e desligamos no dev pra aliviar o `next dev` numa
  // máquina com pouca RAM. Funcionalmente inócuo — o compiler só memoiza.
  reactCompiler: process.env.NODE_ENV === "production",
  // Libs server-only / nativas que NÃO precisam passar pelo bundler do Turbopack.
  // Tira peso enorme do grafo de módulos em dev (são carregadas via require no
  // runtime do server). Inclui SDKs de IA server-side, AWS, parsers e nativos.
  serverExternalPackages: [
    "sharp",
    "pdf-parse",
    "mammoth",
    "@langchain/community",
    "@langchain/openai",
    "@langchain/textsplitters",
    "@aws-sdk/client-s3",
    "@aws-sdk/lib-storage",
    "@aws-sdk/s3-request-presigner",
  ],
  experimental: {
    // Não cacheia respostas de `fetch` de Server Components entre refreshes de
    // HMR — em dev isso evita acúmulo de memória a cada hot-reload. Sem efeito
    // em produção. Default do Next é `true`.
    serverComponentsHmrCache: false,
    // Carrega só os sub-módulos usados (em vez do barrel inteiro) das libs com
    // muitos exports. Reduz o tamanho do grafo client que o Turbopack segura.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@tanstack/react-table",
      "@tanstack/react-query",
      "date-fns",
      "lodash",
    ],
  },
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
