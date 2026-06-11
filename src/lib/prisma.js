import { PrismaClient } from "@prisma/client";

// In development, Next.js reloads your code on every change. Without this guard
// we'd open a brand-new database connection on every reload and eventually run
// out. So we cache a single client on the global object and reuse it.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
