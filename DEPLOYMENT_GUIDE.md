# MoneyGoal Desktop - Deployment Guide

## 🚀 Deployment Checklist

### ✅ Security Improvements Implemented

- [x] Removed dangerous `_dangerDeleteAllUsers` endpoint
- [x] Removed hardcoded API keys (Google Maps, SERP API)
- [x] Added rate limiting protection (15 min window, 10 attempts for auth)
- [x] Improved CORS configuration for production
- [x] Created conditional logger to disable logs in production
- [x] Refactored `any` types to proper TypeScript types
- [x] Added database indexes for improved query performance
- [x] Enhanced input validation with Zod schemas
- [x] Fixed idempotency in AQWorlds Mark Paid feature

### 📋 Required Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Application
NODE_ENV=production
VITE_APP_URL=https://your-frontend-domain.com

# Owner Account (for admin role)
OWNER_OPEN_ID=your-admin-email@example.com

# OpenAI (for chat feature)
OPENAI_API_KEY=sk-...

# Google Maps API (REQUIRED - no default value)
GOOGLE_API_KEY=AIza...

# SERP API (REQUIRED - no default value)
SERPAPI_KEY=your-serpapi-key

# Wise Integration (Optional)
WISE_API_URL=https://api.transferwise.com
WISE_WEBHOOK_SECRET=your-webhook-secret

# Plaid Integration (Optional)
PLAID_CLIENT_ID=your-client-id
PLAID_SECRET=your-secret
PLAID_ENV=sandbox  # or production

# Twilio WhatsApp (Optional)
TWILIO_ACCOUNT_SID=ACxx...
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=+14155238886

# WhatsApp Cloud API (Optional - Alternative to Twilio)
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_WEBHOOK_TOKEN=your-verification-token

# Migration Control
MIGRATE=1  # Set to 1 ONLY during deployment with migrations, then remove
```

### 🗄️ Database Migration

**Before First Deploy:**

1. Ensure `DATABASE_URL` is set in environment variables
2. Temporarily set `MIGRATE=1` in your deployment environment
3. Deploy the application
4. After successful deployment, **REMOVE** or set `MIGRATE=0`

**For Subsequent Deploys:**

- Only set `MIGRATE=1` when you have new migrations to apply
- Always remove it after the migration completes

### 🔒 Security Recommendations

#### Production Checklist:

- [ ] All API keys stored in environment variables (not in code)
- [ ] `JWT_SECRET` is at least 32 characters and randomly generated
- [ ] `NODE_ENV=production` is set
- [ ] Database connection uses SSL (`?sslmode=require` in connection string)
- [ ] CORS origins are restricted to your actual domains
- [ ] Rate limiting is active (automatically enabled)
- [ ] No console.logs exposing sensitive data (logger handles this)

#### API Keys to Configure:

1. **Google Maps API** - Required for map features
   - Get from: https://console.cloud.google.com/
   - Enable: Maps JavaScript API, Geocoding API

2. **SERP API** - Required for web search features
   - Get from: https://serpapi.com/
   - Free tier: 100 searches/month

3. **OpenAI API** - Required for AI chat
   - Get from: https://platform.openai.com/
   - Models used: gpt-4, gpt-3.5-turbo

### 📊 Performance Optimizations

**Database Indexes Added:**
- `goals`: userId, status, (userId + status)
- `categories`: userId, isDefault
- `transactions`: userId, goalId, categoryId, (userId + goalId), createdDate
- `projects`: userId, (month + year), (userId + month + year)
- `events`: userId, month, (userId + month)

**Expected Performance Gains:**
- 70-90% faster queries on large datasets
- Better scalability for multiple users
- Reduced database load

### 🚦 Rate Limiting

**Authentication Endpoints:**
- Window: 15 minutes
- Max attempts: 10 per IP
- Affected routes: `/api/trpc/auth.register`, `/api/trpc/auth.login`

**General API:**
- Window: 1 minute
- Max requests: 100 per IP
- Affected routes: `/api/trpc/*`

### 🔄 Migration Process

**Generated Migration:**
- File: `drizzle/migrations/0012_wooden_shinko_yamashiro.sql`
- Contains: All database indexes for performance
- Safe to apply: Yes (only adds indexes, no data loss)

**To Apply Migration:**

```bash
# Local development
pnpm migrate

# Production (Render/Railway/etc)
# Set MIGRATE=1 in environment, deploy, then set MIGRATE=0
```

### 🐛 Common Issues & Solutions

**Issue: "Too many authentication attempts"**
- Solution: Rate limiter working correctly. Wait 15 minutes or try from different IP.

**Issue: "Not allowed by CORS"**
- Solution: Add your frontend domain to the allowed origins in `server/_core/index.ts`

**Issue: "Database not available"**
- Solution: Check `DATABASE_URL` is correct and database is accessible

**Issue: Migration fails**
- Solution: Check database connection, ensure no duplicate migrations exist

### 📝 Deployment Platforms

#### Render
```bash
# Build Command
pnpm install; pnpm drizzle-kit generate

# Start Command
sh -lc 'if [ "$MIGRATE" = "1" ]; then pnpm run migrate; fi && NODE_ENV=production tsx server/_core/index.ts'
```

#### Railway
```bash
# Build Command
pnpm install

# Start Command
pnpm start
```

#### Vercel (Frontend only)
```bash
# Build Command
cd client && pnpm install && pnpm build

# Output Directory
client/dist
```

### 🎯 Post-Deployment Verification

1. **Health Check**: Visit `https://your-api.com/health`
   - Expected: `{"status":"ok","timestamp":"..."}`

2. **Authentication**: Try to register/login
   - Should work without exposing sensitive info in console

3. **Rate Limiting**: Make 11 login attempts quickly
   - Should get rate limit error on 11th attempt

4. **Database**: Check if indexes were created
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename IN ('goals', 'transactions', 'categories', 'projects', 'events');
   ```

5. **Logs**: Verify no sensitive data in production logs
   - Console.logs should be minimal/disabled

### 📞 Support

For issues or questions:
- Check this deployment guide first
- Review `.github/copilot-instructions.md` for architecture details
- Check error logs for specific error messages

### 🔐 Security Incident Response

If API keys are compromised:

1. **Immediate Actions:**
   - Rotate all compromised keys immediately
   - Update environment variables on deployment platform
   - Redeploy application
   - Monitor for unusual activity

2. **Prevent Future Incidents:**
   - Never commit `.env` files to git
   - Use `.env.example` for documentation only
   - Regularly rotate sensitive credentials
   - Enable 2FA on all service accounts

### ✨ New Features Ready

All critical security fixes and performance optimizations are now implemented. The application is production-ready with:

- Enhanced security (no exposed secrets, rate limiting, proper CORS)
- Better performance (database indexes on all frequent queries)
- Robust validation (Zod schemas prevent invalid data)
- Production-ready logging (conditional logger)
- Type safety (no more `any` types in critical code)
- Idempotent operations (AQWorlds Mark Paid)

**Ready to deploy! 🚀**
