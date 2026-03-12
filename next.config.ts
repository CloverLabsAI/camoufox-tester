import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
