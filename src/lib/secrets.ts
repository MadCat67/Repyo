import { encryptPHI, decryptPHI } from "./encryption";

export function encryptSecret(value: string): string {
  return encryptPHI(value);
}

export function decryptSecret(value: string): string {
  return decryptPHI(value);
}

export function getSalesforceConfig() {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const appUrl =
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl.replace(/\/$/, "")}/api/company/salesforce/callback`,
    mockMode: process.env.SALESFORCE_MOCK === "true" || !clientId,
  };
}
