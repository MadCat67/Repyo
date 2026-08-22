/** Parse a US zip code to a 5-digit number, or null if invalid. */
export function parseZipCode(zip: string): number | null {
  const digits = zip.replace(/\D/g, "").slice(0, 5);
  if (digits.length !== 5) return null;
  const value = parseInt(digits, 10);
  return Number.isNaN(value) ? null : value;
}

/** Check if a zip falls within an admin's inclusive range (e.g. 85040–85050). */
export function zipInRange(
  zip: string,
  start: string | null | undefined,
  end: string | null | undefined
): boolean {
  const z = parseZipCode(zip);
  if (z == null) return false;

  const s = start ? parseZipCode(start) : null;
  const e = end ? parseZipCode(end) : null;

  if (s != null && e != null) return z >= s && z <= e;
  if (s != null) return z === s;
  if (e != null) return z === e;

  return false;
}

export function formatZipRange(start: string | null, end: string | null): string {
  if (start && end && start !== end) return `${start} – ${end}`;
  return start ?? end ?? "";
}
