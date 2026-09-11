"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export function DomainTagInput({
  label,
  domains,
  onChange,
  placeholder = "Add domain, e.g. medtronic.com",
  helperText,
}: {
  label: string;
  domains: string[];
  onChange: (domains: string[]) => void;
  placeholder?: string;
  helperText?: string;
}) {
  const [draft, setDraft] = useState("");

  function addDomain() {
    const normalized = normalizeDomain(draft);
    if (!normalized) return;
    if (domains.includes(normalized)) {
      setDraft("");
      return;
    }
    onChange([...domains, normalized]);
    setDraft("");
  }

  function removeDomain(domain: string) {
    onChange(domains.filter((d) => d !== domain));
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>

      {domains.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
            >
              {domain}
              <button
                type="button"
                onClick={() => removeDomain(domain)}
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label={`Remove ${domain}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDomain();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="secondary" onClick={addDomain}>
          Add
        </Button>
      </div>

      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}
