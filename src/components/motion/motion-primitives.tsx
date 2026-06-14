"use client";
import * as React from "react";
import {
  motion,
  useReducedMotion,
  useInView,
  animate,
  type Variants,
} from "framer-motion";
import { cn } from "@/lib/utils";

/* منحنى حركة موحّد (easeOutQuint) لإحساس عصري سلس */
const انسيابي = [0.22, 1, 0.36, 1] as const;

/* ───────────────── ظهور عنصر مفرد ───────────────── */
export function ظهور({
  children,
  className,
  تأخير = 0,
  مسافة = 16,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  تأخير?: number;
  مسافة?: number;
  as?: "div" | "section" | "li";
}) {
  const قلّل = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={قلّل ? false : { opacity: 0, y: مسافة }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: انسيابي, delay: تأخير }}
    >
      {children}
    </Comp>
  );
}

/* ───────────────── حاوية ظهور متدرّج ───────────────── */
const حاوية_متغيرات: Variants = {
  مخفي: {},
  ظاهر: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const عنصر_متغيرات: Variants = {
  مخفي: { opacity: 0, y: 18 },
  ظاهر: { opacity: 1, y: 0, transition: { duration: 0.5, ease: انسيابي } },
};

export function قائمة_متدرجة({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const قلّل = useReducedMotion();
  if (قلّل) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={حاوية_متغيرات}
      initial="مخفي"
      animate="ظاهر"
    >
      {children}
    </motion.div>
  );
}

export function عنصر_متدرج({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const قلّل = useReducedMotion();
  if (قلّل) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={عنصر_متغيرات}>
      {children}
    </motion.div>
  );
}

/* ───────────────── رقم متحرك (count-up) ───────────────── */
export function رقم_متحرك({
  القيمة,
  كسور = 0,
  className,
}: {
  القيمة: number;
  كسور?: number;
  className?: string;
}) {
  const قلّل = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [نص, تعيين_نص] = React.useState(() =>
    (قلّل ? القيمة : 0).toLocaleString("en-US", {
      minimumFractionDigits: كسور,
      maximumFractionDigits: كسور,
    })
  );

  React.useEffect(() => {
    if (قلّل || !inView) return;
    const controls = animate(0, القيمة, {
      duration: 1.1,
      ease: انسيابي,
      onUpdate: (v) =>
        تعيين_نص(
          v.toLocaleString("en-US", {
            minimumFractionDigits: كسور,
            maximumFractionDigits: كسور,
          })
        ),
    });
    return () => controls.stop();
  }, [القيمة, كسور, inView, قلّل]);

  return (
    <span ref={ref} className={cn("ltr-nums tabular-nums", className)}>
      {نص}
    </span>
  );
}

/* ───────────────── بطاقة تتحرك عند المرور ───────────────── */
export function بطاقة_متحركة({
  children,
  className,
  تأخير = 0,
}: {
  children: React.ReactNode;
  className?: string;
  تأخير?: number;
}) {
  const قلّل = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={قلّل ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: انسيابي, delay: تأخير }}
      whileHover={قلّل ? undefined : { y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
    >
      {children}
    </motion.div>
  );
}
