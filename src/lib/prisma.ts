import { PrismaClient } from "@prisma/client";
import { resolveRuntimeProfile } from "@/core/runtime/e2e-profile";

// En el perfil E2E valida el containment antes de que Prisma abra SQLite.
resolveRuntimeProfile();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
