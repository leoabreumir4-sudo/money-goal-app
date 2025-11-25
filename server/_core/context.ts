// server/_core/context.ts
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { inferAsyncReturnType } from "@trpc/server";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Se o middleware de sessão coloca req.session, usamos. Caso contrário, null.
  const session = (req as any).session ?? null;

  return {
    req,
    res,
    session,
    // expose prisma if you have it, por exemplo:
    // prisma: (globalThis as any).prisma ?? require('../db').prisma
  };
}
export type Context = inferAsyncReturnType<typeof createContext>;
