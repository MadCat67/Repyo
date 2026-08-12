import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-4xl sm:text-5xl",
  };

  return (
    <span className={cn(sizes[size], "font-bold tracking-tight", className)}>
      <span className="text-rose-600">Go</span>
      <span className="text-slate-900">RepYo</span>
    </span>
  );
}
