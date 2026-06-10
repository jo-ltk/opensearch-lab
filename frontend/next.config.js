/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" produces a self-contained server.js so the Docker image
  // doesn't need the full node_modules folder at runtime.
  output: 'standalone',
};

module.exports = nextConfig;
