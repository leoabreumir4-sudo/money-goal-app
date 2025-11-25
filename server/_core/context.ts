// server/_core/context.ts
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { inferAsyncReturnType } from "@trpc/server";
import { sdk } from "./sdk";
import type { User } from "../../drizzle/schema";

export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Authenticate user from JWT Bearer token in Authorization header
  let user: User | undefined;
  try {
    user = await sdk.authenticateRequest(req);
  } catch (error) {
    // User not authenticated - will be undefined for public procedures
    console.log('[Context] Authentication failed:', error instanceof Error ? error.message : String(error));
    user = undefined;
  }

  return {
    req,
    res,
    user,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
export type TrpcContext = Context;
