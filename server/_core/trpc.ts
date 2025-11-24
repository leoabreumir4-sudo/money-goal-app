import { initTRPC } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./context";
import superjson from "superjson";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceUserIsAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthenticated);

const enforceUserIsAdmin = t.middleware(({ ctx, next }) => {
    if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
});

export const adminProcedure = t.procedure.use(enforceUserIsAdmin);
