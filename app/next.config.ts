import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  /* バンドル分析: ANALYZE=true npm run build で実行 */
};

export default withBundleAnalyzer(nextConfig);
