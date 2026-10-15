import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination:
          (process.env.API_BASE_URL || "http://127.0.0.1:8001") + "/:path*",
      },
    ];
  },
};
export default nextConfig;
