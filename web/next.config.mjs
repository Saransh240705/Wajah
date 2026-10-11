/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@wajah/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
