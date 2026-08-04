/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // tesseract.js ships WASM; keep it external on the server bundle
    serverComponentsExternalPackages: ["tesseract.js", "@prisma/client", "bcryptjs"],
    serverActions: {
      bodySizeLimit: "8mb", // cheque images may be a few MB
    },
    // منع الـ Router Cache من عرض بيانات مالية قديمة عند التنقّل بين الصفحات
    // (كان يسبّب ظهور رصيد قديم في الخزنة/المحفظة لحد الريلود). 0 = اجلب دائماً عند التنقّل.
    staleTimes: { dynamic: 0, static: 0 },
  },
};

export default nextConfig;
