import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    domains: ["images.unsplash.com", "mmg.whatsapp.net", "uazapi.com"],
  },
};

export default nextConfig;
