import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes internos do monorepo publicados como TS puro (sem build próprio).
  transpilePackages: ["@mobia/core", "@mobia/domain"],
};

export default nextConfig;
