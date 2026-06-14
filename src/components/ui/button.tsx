import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const أنماط_الزر = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[transform,background-color,box-shadow,color] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        blue: "bg-primary-blue text-white hover:bg-primary-blue/90",
        success: "bg-success text-white hover:bg-success/90",
        danger: "bg-danger text-white hover:bg-danger/90",
        outline:
          "border border-border bg-card hover:bg-appgray text-foreground",
        ghost: "hover:bg-appgray text-foreground",
        link: "text-primary-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface خصائص_الزر
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof أنماط_الزر> {
  asChild?: boolean;
}

const الزر = React.forwardRef<HTMLButtonElement, خصائص_الزر>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(أنماط_الزر({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
الزر.displayName = "الزر";

export { الزر, أنماط_الزر };
