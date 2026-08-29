import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.RRSS_NEXT_DIST_DIR?.trim() || ".next",
  serverExternalPackages: ["playwright", "@prisma/client", "prisma"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".js"],
    };
    return config;
  },
};

export default nextConfig;
