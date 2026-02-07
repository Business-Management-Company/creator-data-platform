/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable edge runtime for smart link redirects
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Headers for fingerprinting accuracy
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
