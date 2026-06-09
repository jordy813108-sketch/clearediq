/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'verifyx-receipts.s3.amazonaws.com',
      'verifyx-receipts.r2.cloudflarestorage.com',
    ],
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/backend/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;