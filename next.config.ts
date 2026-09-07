import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@google/adk", "@google/genai", "parallel-web", "@remotion/bundler", "@remotion/renderer"],
};

export default nextConfig;
