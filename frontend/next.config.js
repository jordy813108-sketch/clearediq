/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'verifyx-receipts.s3.amazonaws.com',
      'verifyx-receipts.r2.cloudflarestorage.com',
    ],
  },
};

module.exports = nextConfig;