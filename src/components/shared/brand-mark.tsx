import Image from "next/image";
import { cn } from "@/lib/utils";

const boxSizes = {
  sm: "h-8 w-8 p-1.5",
  md: "h-10 w-10 p-2",
  lg: "h-12 w-12 p-2.5",
  xl: "h-14 w-14 p-3",
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
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-xl bg-rose-600",
            boxSizes[size]
          )}
        >
          <Image
            src="/icon.png"
            alt="GoRepYo"
            width={64}
            height={64}
            className="h-full w-full object-contain"
            priority
          />
        </span>
      )}
      <span>
        <span className="text-rose-600">Go</span>
        <span className="text-slate-900">RepYo</span>
      </span>
    </span>
  );
}
