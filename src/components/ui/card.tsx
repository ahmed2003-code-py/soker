import * as React from "react";
import { cn } from "@/lib/utils";

const البطاقة = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("card-soft", className)}
    {...props}
  />
));
البطاقة.displayName = "البطاقة";

const رأس_البطاقة = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />
));
رأس_البطاقة.displayName = "رأس_البطاقة";

const عنوان_البطاقة = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
عنوان_البطاقة.displayName = "عنوان_البطاقة";

const محتوى_البطاقة = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
محتوى_البطاقة.displayName = "محتوى_البطاقة";

export { البطاقة, رأس_البطاقة, عنوان_البطاقة, محتوى_البطاقة };
