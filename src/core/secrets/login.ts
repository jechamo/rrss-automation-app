import { setSecret, getSecret, hasSecret, deleteSecret } from "./vault";

/**
 * REQ-006 (DA-05): credenciales de login de la appweb objetivo, cifradas por
 * proyecto en el mismo Secret Vault (AES-256-GCM) bajo la clave `login:<projectId>`.
 * Nunca se exponen en claro por la API (solo se guarda/borra y se consulta si existe).
 */

export interface LoginCreds {
  user: string;
  pass: string;
}

const key = (projectId: string) => `login:${projectId}`;

export function setLogin(projectId: string, creds: LoginCreds): void {
  setSecret(key(projectId), JSON.stringify({ user: creds.user, pass: creds.pass }));
}

export function getLogin(projectId: string): LoginCreds | null {
  const raw = getSecret(key(projectId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LoginCreds>;
    if (typeof value.user === "string" && typeof value.pass === "string") {
      return { user: value.user, pass: value.pass };
    }
  } catch {
    // Una entrada descifrada pero no válida se trata como no configurada.
  }
  return null;
}

export function hasLogin(projectId: string): boolean {
  return hasSecret(key(projectId));
}

export function deleteLogin(projectId: string): void {
  deleteSecret(key(projectId));
}
