import Image from "next/image";
import { cn } from "@/lib/utils";

const iconSizes = {
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
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
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-4xl sm:text-5xl",
  };

  const px = iconSizes[size];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-bold tracking-tight",
        sizes[size],
        className
      )}
    >
      {showIcon && (
        <Image
          src="/icon.png"
          alt="GoRepYo"
          width={px}
          height={px}
          className="shrink-0 rounded-lg"
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
