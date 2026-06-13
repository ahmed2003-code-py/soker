"use client";
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const منبثقة = PopoverPrimitive.Root;
const مشغل_منبثقة = PopoverPrimitive.Trigger;
const مرساة_منبثقة = PopoverPrimitive.Anchor;

const محتوى_منبثقة = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-xl border border-border bg-white p-3 text-foreground shadow-card outline-none data-[state=open]:animate-fade-in",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
محتوى_منبثقة.displayName = PopoverPrimitive.Content.displayName;

export { منبثقة, مشغل_منبثقة, مرساة_منبثقة, محتوى_منبثقة };
