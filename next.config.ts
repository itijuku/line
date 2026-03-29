import type { NextConfig } from "next";

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, // 型エラーがあってもビルドを続行する
  },
};

export default nextConfig;
