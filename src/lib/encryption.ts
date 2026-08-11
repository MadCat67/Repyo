import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getKey(): Buffer {
  const keyEnv = process.env.PHI_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error("PHI_ENCRYPTION_KEY environment variable is required");
  }
  return Buffer.from(keyEnv, "base64");
}

export function encryptPHI(plaintext: string): string {
  const key = getKey();
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const derivedKey = scryptSync(key, salt, 32);
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, encrypted]).toString("base64");
}

export function decryptPHI(ciphertext: string): string {
  try {
    const key = getKey();
    const combined = Buffer.from(ciphertext, "base64");

    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.subarray(
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );

    const derivedKey = scryptSync(key, salt, 32);
    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "[encrypted]";
  }
}

export function encryptDate(date: Date): string {
  return encryptPHI(date.toISOString());
}

export function decryptDate(ciphertext: string): Date {
  const iso = decryptPHI(ciphertext);
  if (iso === "[encrypted]") return new Date(0);
  return new Date(iso);
}
