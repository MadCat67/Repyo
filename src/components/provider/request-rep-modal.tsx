"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { fetchJson } from "@/lib/api-client";
import { cn, PROCEDURE_TYPES, REP_STATUS_LABELS } from "@/lib/utils";
import { MapPin, Sparkles, User, X } from "lucide-react";

interface Company {
  id: string;
  name: string;
  products: string[];
}

interface AvailableRep {
  id: string;
  name: string;
  phone: string | null;
  companyName: string;
  products: string[];
  status: string;
  distanceMiles: number | null;
  etaMinutes: number | null;
}

interface RequestRepModalProps {
  companies: Company[];
  defaultFacility?: {
    name?: string;
    address?: string;
    phone?: string;
    department?: string;
    physician?: string;
    lat?: number;
    lng?: number;
    state?: string;
    zip?: string;
  };
  preferredRepId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RequestRepModal({
  companies,
  defaultFacility,
  preferredRepId,
  onClose,
  onSuccess,
}: RequestRepModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(companies[0]?.id ?? "");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedRepId, setSelectedRepId] = useState<string | null>(
    preferredRepId ?? null
  );
  const [availableReps, setAvailableReps] = useState<AvailableRep[]>([]);
  const [loadingReps, setLoadingReps] = useState(false);

  const company = companies.find((c) => c.id === selectedCompany);

  const loadAvailableReps = useCallback(async () => {
    if (!selectedCompany) {
      setAvailableReps([]);
      return;
    }

    setLoadingReps(true);
    try {
      const params = new URLSearchParams({ companyId: selectedCompany });
      if (selectedProduct) params.set("product", selectedProduct);
      if (defaultFacility?.lat != null) params.set("facilityLat", String(defaultFacility.lat));
      if (defaultFacility?.lng != null) params.set("facilityLng", String(defaultFacility.lng));
      if (defaultFacility?.state) params.set("facilityState", defaultFacility.state);
      if (defaultFacility?.zip) params.set("facilityZip", defaultFacility.zip);

      const reps = await fetchJson<AvailableRep[]>(
        `/api/reps/available?${params.toString()}`
      );
      setAvailableReps(Array.isArray(reps) ? reps : []);

      setSelectedRepId((current) => {
        if (preferredRepId && reps.some((r) => r.id === preferredRepId)) {
          return preferredRepId;
        }
        if (current && reps.some((r) => r.id === current)) {
          return current;
        }
        return null;
      });
    } catch {
      setAvailableReps([]);
    } finally {
      setLoadingReps(false);
    }
  }, [
    selectedCompany,
    selectedProduct,
    defaultFacility?.lat,
    defaultFacility?.lng,
    defaultFacility?.state,
    defaultFacility?.zip,
    preferredRepId,
  ]);

  useEffect(() => {
    loadAvailableReps();
  }, [loadAvailableReps]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const scheduledDate = form.get("scheduledDate") as string;
    const scheduledTime = form.get("scheduledTime") as string;

    const payload = {
      companyId: selectedCompany,
      facilityName: form.get("facilityName"),
      facilityAddr: form.get("facilityAddr"),
      facilityPhone: form.get("facilityPhone") || undefined,
      facilityZipCode: form.get("facilityZipCode"),
      facilityLat: defaultFacility?.lat,
      facilityLng: defaultFacility?.lng,
      department: form.get("department"),
      physicianName: form.get("physicianName"),
      patientName: form.get("patientName"),
      patientDOB: form.get("patientDOB"),
      procedureType: form.get("procedureType"),
      requestType: form.get("requestType"),
      product: selectedProduct || undefined,
      urgency: form.get("urgency"),
      scheduledAt: new Date(`${scheduledDate}T${scheduledTime}`).toISOString(),
      notes: form.get("notes") || undefined,
      preferredRepId: selectedRepId || undefined,
    };

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit request");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Request a Rep</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Facility
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Facility / Hospital"
                name="facilityName"
                defaultValue={defaultFacility?.name}
                required
              />
              <Input
                label="Phone"
                name="facilityPhone"
                type="tel"
                defaultValue={defaultFacility?.phone}
              />
            </div>
            <Input
              label="Address"
              name="facilityAddr"
              defaultValue={defaultFacility?.address}
              required
            />
            <Input
              label="Zip Code"
              name="facilityZipCode"
              defaultValue={defaultFacility?.zip}
              required
              placeholder="85044"
              pattern="\d{5}"
              maxLength={5}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Department"
                name="department"
                defaultValue={defaultFacility?.department}
                required
              />
              <Input
                label="Physician Name"
                name="physicianName"
                defaultValue={defaultFacility?.physician}
                required
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Patient Info (Encrypted)
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Patient Name" name="patientName" required />
              <Input label="Date of Birth" name="patientDOB" type="date" required />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Procedure Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Procedure Type"
                name="procedureType"
                required
                options={PROCEDURE_TYPES.map((p) => ({ value: p, label: p }))}
              />
              <Select
                label="Request Type"
                name="requestType"
                options={[
                  { value: "CASE", label: "Case" },
                  { value: "CHECK", label: "Check" },
                ]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Device Company"
                name="companyId"
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  setSelectedRepId(null);
                }}
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Select
                label="Product"
                name="product"
                value={selectedProduct}
                onChange={(e) => {
                  setSelectedProduct(e.target.value);
                  setSelectedRepId(null);
                }}
                options={[
                  { value: "", label: "Any product" },
                  ...(company?.products ?? []).map((p) => ({ value: p, label: p })),
                ]}
              />
            </div>
            <Select
              label="Urgency"
              name="urgency"
              options={[
                { value: "ASAP", label: "ASAP" },
                { value: "SAME_DAY", label: "Same Day" },
                { value: "SCHEDULED", label: "Scheduled" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Procedure Date"
                name="scheduledDate"
                type="date"
                required
              />
              <Input
                label="Procedure Time"
                name="scheduledTime"
                type="time"
                required
              />
            </div>
            <Textarea label="Additional Notes" name="notes" rows={3} />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Select Rep
              </h3>
              {!loadingReps && (
                <span className="text-xs text-slate-500">
                  {availableReps.length} available
                </span>
              )}
            </div>

            {loadingReps ? (
              <p className="text-sm text-slate-500">Loading available reps...</p>
            ) : availableReps.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                No reps are currently available for this company
                {selectedProduct ? ` and product` : ""}. Your request will be
                submitted for assignment when a rep becomes available.
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedRepId(null)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
                    selectedRepId === null
                      ? "border-rose-300 bg-rose-50 ring-1 ring-rose-200"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      selectedRepId === null
                        ? "border-rose-600 bg-rose-600"
                        : "border-slate-300"
                    )}
                  >
                    {selectedRepId === null && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-rose-500" />
                      <span className="font-medium text-slate-900">
                        Auto-assign nearest rep
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      We&apos;ll match the closest available credentialed rep
                    </p>
                  </div>
                </button>

                {availableReps.map((rep) => (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => setSelectedRepId(rep.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
                      selectedRepId === rep.id
                        ? "border-rose-300 bg-rose-50 ring-1 ring-rose-200"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selectedRepId === rep.id
                          ? "border-rose-600 bg-rose-600"
                          : "border-slate-300"
                      )}
                    >
                      {selectedRepId === rep.id && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-900">{rep.name}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          {REP_STATUS_LABELS[rep.status] ?? rep.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{rep.companyName}</p>
                      {rep.products.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {rep.products.join(" · ")}
                        </p>
                      )}
                      {rep.etaMinutes != null && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" />
                          ~{rep.etaMinutes} min away
                          {rep.distanceMiles != null &&
                            ` (${rep.distanceMiles.toFixed(1)} mi)`}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Submitting..."
                : selectedRepId
                  ? "Request Selected Rep"
                  : "Submit Request"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
