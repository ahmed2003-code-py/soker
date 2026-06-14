"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

/**
 * انتقال سلس بين الصفحات: ظهور + انزلاق خفيف عند تغيّر المسار.
 * يُغلّف محتوى المنطقة الرئيسية داخل التخطيط.
 */
export function انتقال_الصفحة({ children }: { children: React.ReactNode }) {
  const مسار = usePathname();
  const قلّل = useReducedMotion();

  if (قلّل) return <>{children}</>;

  return (
    <motion.div
      key={مسار}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
