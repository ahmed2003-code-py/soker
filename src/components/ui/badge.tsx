import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const أنماط_الشارة = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-muted text-muted-foreground",
        navy: "border-transparent bg-primary/10 text-primary",
        success: "border-transparent bg-success-soft text-success",
        danger: "border-transparent bg-danger-soft text-danger",
        warning: "border-transparent bg-warning-soft text-warning",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface خصائص_الشارة
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof أنماط_الشارة> {}

function الشارة({ className, variant, ...props }: خصائص_الشارة) {
  return <span className={cn(أنماط_الشارة({ variant }), className)} {...props} />;
}

export { الشارة, أنماط_الشارة };
