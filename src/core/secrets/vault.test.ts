// @vitest-environment node

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";

import { createVault, VaultIntegrityError } from "./vault";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryVault() {
  const directory = mkdtempSync(path.join(tmpdir(), "rrss-vault-"));
  directories.push(directory);
  return { directory, vault: createVault(directory) };
}

describe("Secret Vault", () => {
  it("conserva el formato y descifra valores entre instancias", () => {
    const { directory, vault } = temporaryVault();
    vault.setSecret("provider", "valor-local");

    const stored = JSON.parse(readFileSync(path.join(directory, "vault.enc"), "utf8"));
    expect(Object.keys(stored.provider).sort()).toEqual(["data", "iv", "tag"]);
    expect(readFileSync(path.join(directory, ".vaultkey"), "utf8")).toMatch(/^[0-9a-f]{64}$/u);
    expect(createVault(directory).getSecret("provider")).toBe("valor-local");
    expect(createVault(directory).inspectReadiness()).toBe("ready");
  });

  it("falla cerrado si el Vault existe sin su clave", () => {
    const { directory, vault } = temporaryVault();
    vault.setSecret("provider", "valor-local");
    rmSync(path.join(directory, ".vaultkey"));

    expect(() => createVault(directory).getSecret("provider")).toThrow(VaultIntegrityError);
  });

  it("falla cerrado si la clave existe sin el Vault", () => {
    const { directory, vault } = temporaryVault();
    vault.setSecret("provider", "valor-local");
    rmSync(path.join(directory, "vault.enc"));

    expect(() => createVault(directory).inspectReadiness()).toThrow(VaultIntegrityError);
    expect(() => createVault(directory).setSecret("otro", "valor"))
      .toThrow(VaultIntegrityError);
  });

  it("no sobrescribe un Vault corrupto", () => {
    const { directory, vault } = temporaryVault();
    vault.setSecret("provider", "valor-local");
    const vaultPath = path.join(directory, "vault.enc");
    writeFileSync(vaultPath, "{corrupto");

    expect(() => createVault(directory).setSecret("otro", "valor"))
      .toThrow(VaultIntegrityError);
    expect(readFileSync(vaultPath, "utf8")).toBe("{corrupto");
  });

  it("autentica todo el Vault antes de mutarlo", () => {
    const { directory, vault } = temporaryVault();
    vault.setSecret("provider", "valor-local");
    const vaultPath = path.join(directory, "vault.enc");
    const stored = JSON.parse(readFileSync(vaultPath, "utf8"));
    stored.provider.tag = "00".repeat(16);
    const tampered = JSON.stringify(stored, null, 2);
    writeFileSync(vaultPath, tampered);

    expect(() => vault.setSecret("otro", "segundo")).toThrow(VaultIntegrityError);
    expect(readFileSync(vaultPath, "utf8")).toBe(tampered);
  });

  it("rechaza una escritura concurrente en vez de perder datos", () => {
    const { directory, vault } = temporaryVault();
    writeFileSync(path.join(directory, ".vault.lock"), "ocupado");

    expect(() => vault.setSecret("provider", "valor-local"))
      .toThrow(VaultIntegrityError);
    expect(() => readFileSync(path.join(directory, "vault.enc"), "utf8")).toThrow();
  });

  it("bloquea readiness si queda un lock huérfano", () => {
    const { directory, vault } = temporaryVault();
    vault.setSecret("provider", "valor-local");
    writeFileSync(path.join(directory, ".vault.lock"), "huérfano");

    expect(() => vault.inspectReadiness()).toThrow(VaultIntegrityError);
  });

  it("elimina secretos sin alterar los restantes", () => {
    const { vault } = temporaryVault();
    vault.setSecret("provider", "valor-local");
    vault.setSecret("otro", "segundo");
    vault.deleteSecret("provider");

    expect(vault.getSecret("provider")).toBeNull();
    expect(vault.getSecret("otro")).toBe("segundo");
    expect(vault.inspectReadiness()).toBe("ready");
  });
});
