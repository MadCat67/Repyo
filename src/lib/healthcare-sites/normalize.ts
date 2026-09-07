export type HealthcareSiteInput = {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  siteType?: "HOSPITAL" | "CLINIC" | "SURGERY_CENTER" | "OTHER";
};

export function normalizeSiteSlug(
  name: string,
  city: string,
  state: string
): string {
  return [name, city, state]
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    )
    .filter(Boolean)
    .join("-");
}

export function normalizeZip(zip: string): string {
  return zip.trim().slice(0, 5);
}

export function formatSiteLabel(site: {
  name: string;
  city: string;
  state: string;
  zipCode: string;
}): string {
  return `${site.name} · ${site.city}, ${site.state} ${site.zipCode}`;
}
