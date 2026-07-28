/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Single-origin: /lk/* и /api/v1/* проксирует nginx, не Next.js.
  // NEXT_PUBLIC_API_BASE='' — пути к API как в контракте сервера.
};
export default nextConfig;
