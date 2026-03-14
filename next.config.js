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
      {
        // Allow pixel.js to be loaded from any domain
        source: '/pixel.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=86400' },
          { key: 'Content-Type', value: 'application/javascript' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
