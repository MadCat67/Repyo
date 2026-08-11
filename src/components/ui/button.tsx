"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500":
              variant === "primary",
            "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400":
              variant === "secondary",
            "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500":
              variant === "danger",
            "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400":
              variant === "outline",
            "bg-transparent text-slate-700 hover:bg-slate-100":
              variant === "ghost",
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
