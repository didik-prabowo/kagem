import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every tool runs in the browser, so `next build` writes plain files to
  // out/ and the Docker image serves them with Caddy: no Node server at run
  // time. A feature that needs a server (route handler, server action,
  // next/image optimisation) fails the build instead of shipping broken.
  output: "export",
  allowedDevOrigins: ["*"],
};

export default nextConfig;
