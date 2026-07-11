import { PrismaClient } from "@prisma/client";

// Keep one client (and therefore one connection pool) for the whole process.
// Creating a client in every route/socket module multiplies PostgreSQL
// connections and is especially expensive on small hosted instances.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__storyCirclePrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__storyCirclePrisma = prisma;
}

export default prisma;
