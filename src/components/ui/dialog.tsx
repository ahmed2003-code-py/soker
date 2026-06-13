"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const الحوار = DialogPrimitive.Root;
const زر_الحوar = DialogPrimitive.Trigger;
const بوابة_الحوار = DialogPrimitive.Portal;
const إغلاق_الحوار = DialogPrimitive.Close;

const غطاء_الحوار = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-fade-in",
      className
    )}
    {...props}
  />
));
غطاء_الحوار.displayName = DialogPrimitive.Overlay.displayName;

const محتوى_الحوار = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <بوابة_الحوار>
    <غطاء_الحوار />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed start-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-white p-6 shadow-card data-[state=open]:animate-fade-in",
        "max-h-[90vh] overflow-y-auto rtl:translate-x-1/2",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute end-4 top-4 rounded-md opacity-70 transition hover:opacity-100 focus:outline-none">
        <X className="size-5" />
        <span className="sr-only">إغلاق</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </بوابة_الحوار>
));
محتوى_الحوار.displayName = DialogPrimitive.Content.displayName;

const رأس_الحوار = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 text-right", className)} {...props} />
);

const تذييل_الحوار = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-row-reverse gap-2 pt-2", className)}
    {...props}
  />
);

const عنوان_الحوار = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
عنوان_الحوار.displayName = DialogPrimitive.Title.displayName;

const وصف_الحوار = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
وصف_الحوار.displayName = DialogPrimitive.Description.displayName;

export {
  الحوار,
  زر_الحوar as زر_الحوار,
  محتوى_الحوار,
  رأس_الحوار,
  تذييل_الحوار,
  عنوان_الحوار,
  وصف_الحوار,
  إغلاق_الحوار,
};
