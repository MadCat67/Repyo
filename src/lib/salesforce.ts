import { db } from "./db";
import { decryptSecret, encryptSecret, getSalesforceConfig } from "./secrets";

const API_VERSION = "v59.0";

export interface SalesforceDeviceRecord {
  id: string;
  deviceName: string;
  serialNumber: string;
  manufacturer?: string;
  product?: string;
}

export interface DeviceLookupInput {
  patientName: string;
  patientDOB: string;
  manufacturer: string;
}

export interface DeviceLookupResult {
  companyId: string;
  companyName: string;
  status: "FOUND" | "NOT_FOUND" | "SKIPPED" | "ERROR";
  device?: SalesforceDeviceRecord;
  salesforceRecordId?: string;
  message?: string;
}

type CompanyWithSalesforceTokens = {
  id: string;
  salesforceInstanceUrl: string | null;
  salesforceAccessTokenEnc: string | null;
  salesforceRefreshTokenEnc: string | null;
  salesforceTokenExpiresAt: Date | null;
};

type CompanyWithSalesforceDevices = CompanyWithSalesforceTokens & {
  salesforceDeviceObject: string | null;
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function findCompanyByManufacturer(
  manufacturer: string
): Promise<{ id: string; name: string } | null> {
  const needle = normalize(manufacturer);
  if (!needle) return null;

  const companies = await db.company.findMany({
    where: { active: true },
    select: { id: true, name: true, manufacturerAliases: true },
  });

  const match = companies.find((company) => {
    const names = [company.name, ...company.manufacturerAliases];
    return names.some((name) => {
      const hay = normalize(name);
      return hay.includes(needle) || needle.includes(hay);
    });
  });

  return match ? { id: match.id, name: match.name } : null;
}

async function refreshAccessToken(company: CompanyWithSalesforceTokens): Promise<string | null> {
  const { clientId, clientSecret } = getSalesforceConfig();
  if (!clientId || !clientSecret || !company.salesforceRefreshTokenEnc) {
    return null;
  }

  const refreshToken = decryptSecret(company.salesforceRefreshTokenEnc);
  const res = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    instance_url?: string;
  };

  await db.company.update({
    where: { id: company.id },
    data: {
      salesforceAccessTokenEnc: encryptSecret(data.access_token),
      salesforceInstanceUrl: data.instance_url ?? company.salesforceInstanceUrl,
      salesforceTokenExpiresAt: new Date(Date.now() + 55 * 60 * 1000),
    },
  });

  return data.access_token;
}

async function getValidAccessToken(
  company: CompanyWithSalesforceTokens
): Promise<{ token: string; instanceUrl: string } | null> {
  if (!company.salesforceInstanceUrl || !company.salesforceAccessTokenEnc) {
    return null;
  }

  const expires = company.salesforceTokenExpiresAt?.getTime() ?? 0;
  let token = decryptSecret(company.salesforceAccessTokenEnc);

  if (Date.now() > expires - 60_000) {
    const refreshed = await refreshAccessToken(company);
    if (!refreshed) return null;
    token = refreshed;
  }

  return { token, instanceUrl: company.salesforceInstanceUrl };
}

function escapeSoql(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function querySalesforceDevices(
  company: CompanyWithSalesforceDevices,
  input: DeviceLookupInput
): Promise<SalesforceDeviceRecord[]> {
  const auth = await getValidAccessToken(company);
  if (!auth) return [];

  const objectName = company.salesforceDeviceObject ?? "Implant_Device__c";
  const dob = input.patientDOB.slice(0, 10);
  const soql = [
    "SELECT Id, Name, Serial_Number__c, Device_Name__c, Product_Name__c, Manufacturer__c",
    `FROM ${objectName}`,
    `WHERE Patient_Name__c = '${escapeSoql(input.patientName.trim())}'`,
    `AND Patient_DOB__c = ${dob}`,
    `LIMIT 5`,
  ].join(" ");

  const url = `${auth.instanceUrl}/services/data/${API_VERSION}/query?q=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce query failed: ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    records?: Array<Record<string, string | null>>;
  };

  return (payload.records ?? []).map((record) => ({
    id: String(record.Id),
    deviceName: String(record.Device_Name__c ?? record.Name ?? "Unknown device"),
    serialNumber: String(record.Serial_Number__c ?? ""),
    manufacturer: record.Manufacturer__c ? String(record.Manufacturer__c) : undefined,
    product: record.Product_Name__c ? String(record.Product_Name__c) : undefined,
  }));
}

function mockDeviceLookup(
  company: { id: string; name: string },
  input: DeviceLookupInput
): DeviceLookupResult {
  return {
    companyId: company.id,
    companyName: company.name,
    status: "FOUND",
    salesforceRecordId: "mock-device-001",
    device: {
      id: "mock-device-001",
      deviceName: `${company.name} ${input.manufacturer} ICD`,
      serialNumber: "SN-DEMO-78421",
      manufacturer: input.manufacturer,
      product: "ICD",
    },
    message: "Demo CRM lookup (connect Salesforce for live data)",
  };
}

export async function lookupPatientDevice(
  input: DeviceLookupInput
): Promise<DeviceLookupResult> {
  const companyMatch = await findCompanyByManufacturer(input.manufacturer);
  if (!companyMatch) {
    return {
      companyId: "",
      companyName: "",
      status: "NOT_FOUND",
      message: `No device company matched manufacturer "${input.manufacturer}"`,
    };
  }

  const company = await db.company.findUnique({
    where: { id: companyMatch.id },
    select: {
      id: true,
      name: true,
      salesforceInstanceUrl: true,
      salesforceAccessTokenEnc: true,
      salesforceRefreshTokenEnc: true,
      salesforceTokenExpiresAt: true,
      salesforceDeviceObject: true,
    },
  });

  if (!company) {
    return {
      companyId: "",
      companyName: "",
      status: "ERROR",
      message: "Matched company not found",
    };
  }

  const { mockMode } = getSalesforceConfig();
  const connected = Boolean(
    company.salesforceAccessTokenEnc && company.salesforceInstanceUrl
  );

  if (mockMode || !connected) {
    return mockDeviceLookup(company, input);
  }

  try {
    const devices = await querySalesforceDevices(company, input);
    if (!devices.length) {
      return {
        companyId: company.id,
        companyName: company.name,
        status: "NOT_FOUND",
        message: "No implanted device found in Salesforce for this patient",
      };
    }

    const device = devices[0];
    return {
      companyId: company.id,
      companyName: company.name,
      status: "FOUND",
      device,
      salesforceRecordId: device.id,
    };
  } catch (error) {
    return {
      companyId: company.id,
      companyName: company.name,
      status: "ERROR",
      message: error instanceof Error ? error.message : "Salesforce lookup failed",
    };
  }
}

export async function createSalesforceCase(params: {
  companyId: string;
  subject: string;
  description: string;
  requestId: string;
}): Promise<string | null> {
  const company = await db.company.findUnique({
    where: { id: params.companyId },
    select: {
      id: true,
      salesforceInstanceUrl: true,
      salesforceAccessTokenEnc: true,
      salesforceRefreshTokenEnc: true,
      salesforceTokenExpiresAt: true,
      salesforceCaseObject: true,
    },
  });

  if (!company?.salesforceAccessTokenEnc || !company.salesforceInstanceUrl) {
    return null;
  }

  const auth = await getValidAccessToken(company);
  if (!auth) return null;

  const objectName = company.salesforceCaseObject ?? "Case";
  const url = `${auth.instanceUrl}/services/data/${API_VERSION}/sobjects/${objectName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Subject: params.subject,
      Description: params.description,
      Origin: "GoRepYo",
      GoRepYo_Request_Id__c: params.requestId,
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

export function getSalesforceAuthorizeUrl(state: string): string | null {
  const { clientId, redirectUri } = getSalesforceConfig();
  if (!clientId) return null;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "api refresh_token offline_access",
    state,
  });

  return `https://login.salesforce.com/services/oauth2/authorize?${params.toString()}`;
}

export async function exchangeSalesforceCode(
  code: string
): Promise<{ instanceUrl: string; accessToken: string; refreshToken: string } | null> {
  const { clientId, clientSecret, redirectUri } = getSalesforceConfig();
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    instance_url: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    instanceUrl: data.instance_url,
  };
}
