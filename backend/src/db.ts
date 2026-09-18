import "./env.ts";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ["error"],
});
