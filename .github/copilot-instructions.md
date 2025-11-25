# MoneyGoal Desktop - AI Agent Instructions

## Project Overview
Full-stack financial goal tracking application with project management (AQWorlds), AI chat, spending analytics. Monorepo structure with Express/tRPC backend, React/Vite frontend, PostgreSQL via Drizzle ORM.

## Architecture

### Monorepo Layout
- `client/` - React app with Vite, uses path aliases `@/*` and `@shared/*`
- `server/` - Express + tRPC API, feature routers in flat structure
- `server/_core/` - Framework code (trpc setup, auth, LLM, SDK utilities)
- `drizzle/` - Database schema and migrations (single source of truth)
- `shared/` - Type exports and constants shared between client/server

### Key Design Patterns

**tRPC Architecture:**
- Base procedures: `publicProcedure`, `protectedProcedure`, `adminProcedure` from `server/_core/trpc.ts`
- Context typing: `TrpcContext` includes optional `user` property populated during context creation
- Authentication: JWT tokens in `Authorization: Bearer <token>` header (NOT cookies)
- Context creation automatically calls `sdk.authenticateRequest(req)` to populate `ctx.user`
- Protected procedures check `ctx.user` presence, throw `UNAUTHORIZED` if missing
- SuperJSON transformer on both client and server for Date/BigInt serialization

**Authentication Flow (Critical):**
1. Client sends credentials to `auth.register` or `auth.login`
2. Server returns JWT token via `sdk.createSessionToken(user.openId)`
3. Client stores token in `localStorage.setItem('sessionToken', token)`
4. All requests include `Authorization: Bearer <token>` header
5. `createContext()` automatically calls `sdk.authenticateRequest(req)` to populate `ctx.user`
6. Protected procedures check `ctx.user` presence, throw `UNAUTHORIZED` if missing
7. Public procedures have `ctx.user` as `undefined` when not authenticated

**Database Conventions:**
- Money stored as **cents (integers)** - always multiply by 100 before storing, divide by 100 for display
- Schema in `drizzle/schema.ts` defines all tables, enums, relations
- DB functions in `server/db.ts` - use `getDb()` for connection, handles nullability
- User identification: `openId` (string) as unique identifier, NOT `id`

**Client State Management:**
- React Query + tRPC hooks: `trpc.goals.getActive.useQuery()`
- Global error handling in `client/src/main.tsx` intercepts `UNAUTHED_ERR_MSG` and redirects to `/auth`
- Protected routes wrapped in `<ProtectedRoute>` component using `auth.me` query

## Development Workflows

### Running the App
```bash
# Development (runs migrations automatically)
pnpm dev           # from root: starts server with hot reload

# Client separate terminal
cd client && pnpm dev

# Production
MIGRATE=1 pnpm start  # runs migrations then starts server
```

### Database Migrations
```bash
# Generate migration after schema changes
pnpm drizzle-kit generate

# Apply locally (dev auto-runs migrations)
pnpm migrate

# Production: Set MIGRATE=1 env var for one deploy, then remove
```

### Testing
```bash
# Server tests only (Vitest)
pnpm test          # runs server/**/*.test.ts

# Test files use createAuthContext() helper to mock authenticated users
# Example pattern in server/features.test.ts
```

## Code Conventions

### Adding New Features
1. **Define types** in `drizzle/schema.ts` (table + relations)
2. **Generate migration**: `pnpm drizzle-kit generate`
3. **Add DB functions** in `server/db.ts` using existing patterns
4. **Create router** in `server/` (e.g., `server/goalRouter.ts`)
5. **Register router** in `server/routers.ts` under `appRouter`
6. **Client hooks**: Import `trpc` from `@/lib/trpc`, use `.useQuery()` / `.useMutation()`

### File Organization
- UI components: `client/src/components/ui/` (shadcn/ui components)
- Pages: `client/src/pages/` (Dashboard, AQWorlds, Chat, etc.)
- Feature routers: `server/` flat (not nested folders)
- Core utilities: `server/_core/` for framework-level code only

### Import Patterns
```typescript
// Client
import { trpc } from "@/lib/trpc";
import type { Goal, Transaction } from "@shared/types";

// Server
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { goals } from "../drizzle/schema";
```

### TypeScript Paths
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- Server has no path aliases (relative imports)

## Critical Gotchas

1. **Context Authentication**: `createContext()` automatically attempts to authenticate via `sdk.authenticateRequest(req)`. If successful, `ctx.user` is populated; otherwise it's `undefined`. Protected procedures verify `ctx.user` exists.

2. **Money Amounts**: Always store as cents. Frontend display: `amount / 100`. Backend storage: `amount * 100`.

3. **No Sessions**: This app uses JWT bearer tokens exclusively. No express-session or cookies for auth.

4. **CORS**: Server allows `credentials: true` but client uses `credentials: "omit"`. Auth is via Authorization header only.

5. **Drizzle Schema**: Enum changes require new migration. Modify in `drizzle/schema.ts` then generate.

6. **Wouter Routing**: Uses `wouter` (not react-router), has custom patch in `patches/wouter@3.7.1.patch`.

7. **OpenAI Integration**: `invokeLLM()` in `server/_core/llm.ts` - streaming supported via `streamdown` package.

## Common Tasks

**Add tRPC Procedure:**
```typescript
// server/goalRouter.ts
export const goalRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string(), targetAmount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.createGoal({
        userId: ctx.user.id, // ctx.user guaranteed by protectedProcedure
        ...input
      });
      return { success: true };
    }),
});
```

**Client Usage:**
```typescript
const createGoal = trpc.goals.create.useMutation({
  onSuccess: () => {
    queryClient.invalidateQueries(['goals']);
  }
});
createGoal.mutate({ name: "Save $1000", targetAmount: 100000 });
```

**Add DB Table:**
1. Edit `drizzle/schema.ts`
2. Run `pnpm drizzle-kit generate`
3. Add CRUD functions to `server/db.ts`
4. Export types from `shared/types.ts` if needed

## Project-Specific Features

- **AQWorlds Page**: Project tracking with event calendar, monthly payment status
- **Spending Page**: Category analytics with pie charts (recharts), recurring expenses
- **Analytics Page**: Income/expense trends, savings projections
- **Chat Page**: OpenAI integration with conversation history persistence
- **Dark Theme**: Purple/pink accent colors, scrollbars hidden globally in CSS

## Testing Patterns
```typescript
// Create authenticated context for tests
function createAuthContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      email: `user${userId}@example.com`,
      role: "user",
      // ...other required fields
    },
    req: {} as any,
    res: {} as any,
  };
}
```
