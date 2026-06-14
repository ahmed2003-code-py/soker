"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const التبويبات = TabsPrimitive.Root;

const قائمة_التبويبات = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex flex-wrap items-center gap-1 rounded-xl bg-muted p-1",
      className
    )}
    {...props}
  />
));
قائمة_التبويبات.displayName = TabsPrimitive.List.displayName;

const زر_تبويب = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-soft",
      className
    )}
    {...props}
  />
));
زر_تبويب.displayName = TabsPrimitive.Trigger.displayName;

const محتوى_تبويب = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 focus-visible:outline-none", className)}
    {...props}
  />
));
محتوى_تبويب.displayName = TabsPrimitive.Content.displayName;

export { التبويبات, قائمة_التبويبات, زر_تبويب, محتوى_تبويب };
