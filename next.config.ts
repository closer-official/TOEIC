import type { NextConfig } from "next";

const isIosBuild = process.env.BUILD_IOS === "1";

const nextConfig: NextConfig = {
  ...(isIosBuild ? { output: "export" as const } : {}),
};

export default nextConfig;
