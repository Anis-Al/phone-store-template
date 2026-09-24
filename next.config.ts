import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Admin photo uploads go through a Server Action (5 MB max, checked again in lib/media.ts).
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
