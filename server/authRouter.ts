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

      // Create session token for the new user
      const token = await sdk.createSessionToken(newUser.openId, {
        name: newUser.name || "",
      });

      // Return the token for the client to store
      return {
        token,
        user: {
          id: newUser.id,
          openId: newUser.openId,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
      };
    }),

  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(`[Auth] Login attempt for email: ${input.email}`);
        
        const user = await db.getUserByEmail(input.email);
        console.log(`[Auth] User found: ${!!user}`);

        if (!user || !user.passwordHash) {
          console.log(`[Auth] Login failed: user not found or no password hash`);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        const isPasswordValid = await bcrypt.compare(
          input.password,
          user.passwordHash
        );
        console.log(`[Auth] Password valid: ${isPasswordValid}`);

        if (!isPasswordValid) {
          console.log(`[Auth] Login failed: invalid password`);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        // Create session token for the user
        const token = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
        });
        console.log(`[Auth] Token created successfully`);

        // Return the token for the client to store
        return {
          token,
          user: {
            id: user.id,
            openId: user.openId,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        };
      } catch (error) {
        console.error(`[Auth] Login error for ${input.email}:`, error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Login failed due to server error",
        });
      }
    }),
});
