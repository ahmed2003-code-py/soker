/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // tesseract.js ships WASM; keep it external on the server bundle
    serverComponentsExternalPackages: ["tesseract.js", "@prisma/client", "bcryptjs"],
    serverActions: {
      bodySizeLimit: "8mb", // cheque images may be a few MB
    },
  },
};

export default nextConfig;
