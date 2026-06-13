import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { مزود_الإشعارات } from "@/components/ui/toast";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "سُكر — نظام إدارة الأعمال",
  description: "نظام ERP لإدارة الفواتير والخزنة والعملاء والموردين والشيكات",
};

export default function التخطيط_الجذري({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html dir="rtl" lang="ar" className={cairo.variable}>
      <body className="font-sans">
        <مزود_الإشعارات>{children}</مزود_الإشعارات>
      </body>
    </html>
  );
}
