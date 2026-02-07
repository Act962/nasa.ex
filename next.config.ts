import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
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
    ],
  },
};

export default nextConfig;
