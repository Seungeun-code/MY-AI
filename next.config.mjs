/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 외부 글로벌 변수 ESLint 경고 방지
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;