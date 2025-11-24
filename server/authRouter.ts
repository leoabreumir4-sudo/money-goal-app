// /home/ubuntu/money-goal-app/server/authRouter.ts
import { publicProcedure, router, protectedProcedure } from "./_core/trpc"; // protectedProcedure adicionado
import { z } from "zod";
import * as db from "./db";
import { users } from "../drizzle/schema";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { sdk } from "./_core/sdk";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const authRouter = router({
  // NOVA PROCEDURE: auth.me
  me: protectedProcedure.query(({ ctx }) => {
    // Se a procedure protegida passar, ctx.user é garantido
    return ctx.user;
  }),

  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ ctx, input }) => {
      const existingUser = await db.getUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      
      // Use email as openId for local auth
      const openId = input.email; 

      const dbInstance = await db.getDb();
      if (!dbInstance) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }
      const [newUser] = await dbInstance.insert(users).values({
        openId,
        email: input.email,
        name: input.name,
        passwordHash,
      }).returning();

      if (!newUser) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      // Create session token
      const sessionToken = await sdk.createSessionToken(newUser.openId, { name: newUser.name || "" });
      // REMOVED: Setting cookie. Now returning token for client to store.

      return { success: true, token: sessionToken };
    }),

  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(input.email);

      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const isPasswordValid = await bcrypt.compare(
        input.password,
        user.passwordHash
      );

      if (!isPasswordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Create session token
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "" });
      // REMOVED: Setting cookie. Now returning token for client to store.

      return { success: true, token: sessionToken };
    }),
});
