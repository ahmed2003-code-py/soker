import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { مزود_الإشعارات } from "@/components/ui/toast";
import { مزود_اللغة_والمظهر } from "@/components/providers/i18n-provider";
import { لغة_الطلب, مظهر_الطلب } from "@/lib/i18n/server";
import { اتجاه } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
  const لغة = لغة_الطلب();
  const مظهر = مظهر_الطلب();

  return (
    <html
      lang={لغة}
      dir={اتجاه(لغة)}
      className={cn(cairo.variable, مظهر === "dark" && "dark")}
    >
      <body className="font-sans">
        <مزود_اللغة_والمظهر اللغة_الابتدائية={لغة} المظهر_الابتدائي={مظهر}>
          <مزود_الإشعارات>{children}</مزود_الإشعارات>
        </مزود_اللغة_والمظهر>
      </body>
    </html>
  );
}
