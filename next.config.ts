import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    domains: [
      "images.unsplash.com",
      "mmg.whatsapp.net",
      "uazapi.com",
      "nasa-ex.t3.storage.dev",
      "pub-f9e718fa60aa4e1092c20a791898d931.r2.dev",
    ],
  },
};

export default nextConfig;
