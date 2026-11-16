import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* NOAH is a fully dynamic, auth-gated app: cacheComponents is off so that
     per-user pages are always rendered at request time. */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
