import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Файлы из samples/ читаются через fs (пример транскрипта и демо-материалы) —
  // явно добавляем их в бандл серверных функций (Vercel)
  outputFileTracingIncludes: {
    "/api/**/*": ["./samples/**/*"],
  },
  partialPrefetching: true,
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
