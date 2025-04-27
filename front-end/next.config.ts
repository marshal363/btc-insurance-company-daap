import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_CONVEX_URL: process.env.CONVEX_URL || "https://hallowed-jellyfish-500.convex.cloud"
  }
};

export default nextConfig;
