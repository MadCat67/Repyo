export function extractEmailDomain(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return "";
  return normalized.slice(at + 1);
}

export function emailMatchesApprovedDomain(
  email: string,
  approvedDomains: string[]
): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;

  const normalizedApproved = approvedDomains.map((d) =>
    d.trim().toLowerCase().replace(/^@/, "")
  );

  return normalizedApproved.includes(domain);
}
