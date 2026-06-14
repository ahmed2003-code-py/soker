"use client";
import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

const قائمة_منسدلة = DropdownPrimitive.Root;
const مشغل_منسدلة = DropdownPrimitive.Trigger;

const محتوى_منسدلة = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[10rem] overflow-hidden rounded-xl border border-border bg-card p-1 text-foreground shadow-card data-[state=open]:animate-fade-in",
        className
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
محتوى_منسدلة.displayName = DropdownPrimitive.Content.displayName;

const عنصر_منسدلة = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & {
    خطر?: boolean;
  }
>(({ className, خطر, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none focus:bg-appgray data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      خطر && "text-danger focus:bg-danger-soft",
      className
    )}
    {...props}
  />
));
عنصر_منسدلة.displayName = DropdownPrimitive.Item.displayName;

const فاصل_منسدلة = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Separator
    ref={ref}
    className={cn("my-1 h-px bg-border", className)}
    {...props}
  />
));
فاصل_منسدلة.displayName = DropdownPrimitive.Separator.displayName;

const عنوان_منسدلة = DropdownPrimitive.Label;

export {
  قائمة_منسدلة,
  مشغل_منسدلة,
  محتوى_منسدلة,
  عنصر_منسدلة,
  فاصل_منسدلة,
  عنوان_منسدلة,
};
