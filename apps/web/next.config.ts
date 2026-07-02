import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes internos do monorepo publicados como TS puro (sem build próprio).
  transpilePackages: ["@imobia/core", "@imobia/domain"],
};

export default nextConfig;
