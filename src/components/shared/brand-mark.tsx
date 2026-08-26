import Image from "next/image";
import { cn } from "@/lib/utils";

const iconSizes = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-14 w-14",
};

const textSizes = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-4xl sm:text-5xl",
};

export function BrandMark({
  className,
  size = "md",
  showIcon = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showIcon?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-3 font-bold tracking-tight",
        textSizes[size],
        className
      )}
    >
      {showIcon && (
        <Image
          src="/icon.png"
          alt="GoRepYo"
          width={64}
          height={64}
          className={cn("shrink-0 rounded-xl object-contain", iconSizes[size])}
          priority
        />
      )}
      <span>
        <span className="text-rose-600">Go</span>
        <span className="text-slate-900">RepYo</span>
      </span>
    </span>
  );
}
