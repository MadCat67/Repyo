import { cn } from "@/lib/utils";
import {
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }
>(({ className, label, error, id, ...props }, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[] }
>(({ className, label, options, id, ...props }, ref) => {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
});
Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }
>(({ className, label, id, ...props }, ref) => {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20",
          className
        )}
        {...props}
      />
    </div>
  );
});
Textarea.displayName = "Textarea";
