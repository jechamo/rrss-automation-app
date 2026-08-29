import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDataDir } from "../runtime/e2e-profile";

/**
 * Secret Vault (Arquitectura §7).
 *
 * Mantiene el formato histórico AES-256-GCM y las rutas `data/.vaultkey` y
 * `data/vault.enc`. Los errores de integridad se propagan con mensajes neutros:
 * un Vault corrupto nunca se interpreta como uno vacío ni se sobrescribe.
 */

type VaultEntry = { iv: string; tag: string; data: string };
type VaultData = Record<string, VaultEntry>;

export type VaultReadiness = "empty" | "ready";

export class VaultIntegrityError extends Error {
  readonly code = "VAULT_INTEGRITY_ERROR";

  constructor() {
    super("El almacén cifrado local no es válido.");
    this.name = "VaultIntegrityError";
  }
}

export function createVault(dataDir = getDataDir()) {
  const keyFile = path.join(dataDir, ".vaultkey");
  const vaultFile = path.join(dataDir, "vault.enc");
  const lockFile = path.join(dataDir, ".vault.lock");

  function ensureDataDir(): void {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  }

  function readExistingMasterKey(): Buffer | null {
    if (!fs.existsSync(keyFile)) return null;
    const encoded = fs.readFileSync(keyFile, "utf8").trim();
    if (!/^[0-9a-f]{64}$/iu.test(encoded)) throw new VaultIntegrityError();
    return Buffer.from(encoded, "hex");
  }

  function loadMasterKey({ create }: { create: boolean }): Buffer | null {
    ensureDataDir();
    const existing = readExistingMasterKey();
    if (existing) return existing;
    if (fs.existsSync(vaultFile) || !create) {
      if (fs.existsSync(vaultFile)) throw new VaultIntegrityError();
      return null;
    }
    const key = crypto.randomBytes(32);
    writeAtomic(keyFile, key.toString("hex"));
    return key;
  }

  function readVault(): VaultData {
    ensureDataDir();
    if (!fs.existsSync(vaultFile)) {
      if (fs.existsSync(keyFile)) throw new VaultIntegrityError();
      return {};
    }
    if (!fs.existsSync(keyFile)) throw new VaultIntegrityError();
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(vaultFile, "utf8"));
      if (!isVaultData(parsed)) throw new VaultIntegrityError();
      return parsed;
    } catch (error) {
      if (error instanceof VaultIntegrityError) throw error;
      throw new VaultIntegrityError();
    }
  }

  function writeVault(vault: VaultData): void {
    ensureDataDir();
    writeAtomic(vaultFile, JSON.stringify(vault, null, 2));
  }

  function setSecret(provider: string, value: string): void {
    withWriteLock(() => {
      const vault = readVault();
      authenticateVault(vault);
      const key = loadMasterKey({ create: true });
      if (!key) throw new VaultIntegrityError();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      vault[provider] = {
        iv: iv.toString("hex"),
        tag: cipher.getAuthTag().toString("hex"),
        data: encrypted.toString("hex"),
      };
      writeVault(vault);
    });
  }

  function getSecret(provider: string): string | null {
    const vault = readVault();
    const entry = vault[provider];
    if (!entry) return null;
    const key = loadMasterKey({ create: false });
    if (!key) throw new VaultIntegrityError();
    return decryptEntry(entry, key);
  }

  function hasSecret(provider: string): boolean {
    return Object.hasOwn(readVault(), provider);
  }

  function deleteSecret(provider: string): void {
    withWriteLock(() => {
      const vault = readVault();
      authenticateVault(vault);
      if (!Object.hasOwn(vault, provider)) return;
      delete vault[provider];
      writeVault(vault);
    });
  }

  function maskSecret(provider: string): string | null {
    const value = getSecret(provider);
    if (!value) return null;
    if (value.length <= 8) return "•".repeat(value.length);
    return `${value.slice(0, 4)}${"•".repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
  }

  function inspectReadiness(): VaultReadiness {
    if (fs.existsSync(lockFile)) throw new VaultIntegrityError();
    const vault = readVault();
    const entries = Object.keys(vault);
    if (entries.length === 0) return "empty";
    authenticateVault(vault);
    return "ready";
  }

  function authenticateVault(vault: VaultData): void {
    const entries = Object.values(vault);
    if (entries.length === 0) return;
    const key = loadMasterKey({ create: false });
    if (!key) throw new VaultIntegrityError();
    for (const entry of entries) decryptEntry(entry, key);
  }

  function withWriteLock<T>(operation: () => T): T {
    ensureDataDir();
    let descriptor: number | undefined;
    try {
      descriptor = fs.openSync(lockFile, "wx", 0o600);
      return operation();
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "EEXIST") {
        throw new VaultIntegrityError();
      }
      throw error;
    } finally {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
        fs.rmSync(lockFile, { force: true });
      }
    }
  }

  return Object.freeze({
    setSecret,
    getSecret,
    hasSecret,
    deleteSecret,
    maskSecret,
    inspectReadiness,
  });
}

function decryptEntry(entry: VaultEntry, key: Buffer): string {
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(entry.iv, "hex"),
    );
    decipher.setAuthTag(Buffer.from(entry.tag, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(entry.data, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new VaultIntegrityError();
  }
}

function isVaultData(value: unknown): value is VaultData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const candidate = entry as Partial<VaultEntry>;
    return (
      typeof candidate.iv === "string" && /^[0-9a-f]{24}$/iu.test(candidate.iv) &&
      typeof candidate.tag === "string" && /^[0-9a-f]{32}$/iu.test(candidate.tag) &&
      typeof candidate.data === "string" && /^(?:[0-9a-f]{2})*$/iu.test(candidate.data) &&
      Object.keys(candidate).length === 3
    );
  });
}

function writeAtomic(filePath: string, content: string): void {
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // La excepción original es la que conserva el diagnóstico útil sin exponer contenido.
    }
    throw error;
  }
}

const defaultVault = createVault();

export const setSecret = defaultVault.setSecret;
export const getSecret = defaultVault.getSecret;
export const hasSecret = defaultVault.hasSecret;
export const deleteSecret = defaultVault.deleteSecret;
export const maskSecret = defaultVault.maskSecret;
export const inspectVaultReadiness = defaultVault.inspectReadiness;
