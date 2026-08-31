import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=()",
  },
];

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      { source: "/imperio/logistica/:path*", headers: securityHeaders },
      { source: "/api/imperio/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
