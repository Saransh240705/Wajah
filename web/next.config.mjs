import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Amplify SSR hosting
  output: 'standalone',
  // Required for monorepo: trace shared package files from repo root
  outputFileTracingRoot: path.join(__dirname, '../'),
  transpilePackages: ['@wajah/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
