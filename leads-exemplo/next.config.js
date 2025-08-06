/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_CALCOM_URL: process.env.NEXT_PUBLIC_CALCOM_URL,
  },
};

module.exports = nextConfig;