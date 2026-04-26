# Azure Deployment Troubleshooting Guide

## Issue: JWT_REFRESH_EXPIRES_IN Missing + 504 Gateway Timeout

### Root Causes
1. **Missing Environment Variables**: Azure App Settings don't match local .env
2. **Startup Timeout**: Azure health check times out (5 min default) before server ready
3. **Port Binding**: May not be listening on correct port Azure expects

---

## Solution Steps

### Step 1: Add ALL Required Env Vars to Azure App Settings

**Navigate to:** Azure Portal → Your App Service → Settings → Environment variables (or Configuration)

Add these exact keys (copy from your .env):

```
NODE_ENV                = production
PORT                    = 8080
DATABASE_URL            = postgresql://postgres.dgyblfwmomudxxrybpyg:Shayan%406565%23@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require
DIRECT_URL              = postgresql://postgres:Shayan%406565%23@db.dgyblfwmomudxxrybpyg.supabase.co:5432/postgres?sslmode=require
REDIS_URL               = rediss://default:gQAAAAAAAQV_AAIgcDE1NWQzYWIyMzRkMDg0ODk1OGQzMzZkMjJiMjE1Zjk2MA@rational-spider-66943.upstash.io:6379
JWT_ACCESS_SECRET       = 1f6727e256d7e80956740fe104d81b1e70f48e49d4bd71c9903d8c456552b5c0
JWT_REFRESH_SECRET      = b567ddd4efb908ce16c28ba2ca9476e5c12b5c4e49472bd6501efdd6104f4818
JWT_ACCESS_EXPIRES_IN   = 7d
JWT_REFRESH_EXPIRES_IN  = 30d
FIREBASE_PROJECT_ID     = vastra-7f311
FIREBASE_CLIENT_EMAIL   = firebase-adminsdk-fbsvc@vastra-7f311.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY    = -----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCiKBCR2hD4ZcZT\nvbnjrZ9CZz3gHQpKvwoERuJZydI6DaxpGFn7PL9vpdFnTZWij5sXjGetTFY3UYPZ\nCaXkS3r6GIu464nMaerNLcSTV+VTsehyHtbTPP1Y4eXAkoGss7JhtMLo1EA9FluY\n542LxrbGmt+TLVMLx60xd66JHM0z1CnFSZXomFDf6kYEDVNBN1zmk8e7hB6Pikk4\ne3tRYEmwj3ZewVfovQ8lC/+R8TSQOKvFosxU/pFQ8AlsPpjtyqtI6Nodb6+NxV+h\nr7m29damMgVpMKr7EBn+i7UniTkaBs1K85WEZ6THvsnnXbxxzIsFA3LsTAdC3laZ\nYLnKiYx7AgMBAAECggEALqQsg+8/01rezWZ0ifb+KIjupMBlnfNOK8XBxIbHB7i4\nHzCIbTnfbHs6/KY1xKDewMq7ZX7gC6BQNsTOKRjG4hneUo25QIk0ptijwqfVCBpT\nnEOfkfnoe0Dap2Xck7LKO81VBMhMQ+Xi6dusfIhnOUABz+EJEonYGLLuinS011OZ\niy4XcdcAFVKW47GcUCQ7gz645/YC7IG5O3l7YLPRa3b0y5GMTmt2jzHzDhMIBFhe\nViEjegdiTrLfnNtxHrnz8I/A3wKcSqjRRMJUuc7IuJQyKZ7fOwpg59HC1n1lTdjw\nFezuk3HRSrLo0IwjVloTjxYv4DzZxc6PPASnBP1zzQKBgQDN0y0abR9GtdVBuKUa\nDNFtGgkC4nhaMFsCH7muBdUWkYYeRPFbVq9M7J8eIV3i/jLIdLAQ2jplJW77X0nJ\nV+KksfOzdS3w8Tzbmv0mGEQh3t8LiQptOoec21g0XSR/zZa4LlVYNkll5HXTcQf1\nG//jMcf1h8bmcYVTkT+hpCy6XwKBgQDJr7GbzFNHsYS79fOZt9m1b9oHm3dTl4q7\njc/FgszhXM8s1vUjS75d+vPvivYWs096ezKUbufUmfq3/o9nwNVdI2XueJGpdn/d\nq5dVk0eS52AVth38fDU9pw8nEvpwQlZgGvs+7EPXFbF4u/MXJewi7/Ou5suLDKZA\nKB6ptEQbZQKBgCrbQ9Ly0cZZajQrDEWmUZ0UBLhTC5hL5UdF79WqZTozxudal57b\nJ9kuk9skO3ZeU5ilo1t+9RXGe5tfte90mz6LxyCgz5YRxQg892UNPHKJA4xVVpRz\n0XT5vx34Hvd1iWKEU0Tw2MucjGQgbvW8hMV7whT/1ox5KrfB0KwJkT6lAoGAKR7r\nRWqpaCqnd3M0EZlMiBOgDoECGUcCgC7vt8NtZl132BqTrHia/apW5fYdKo+wmrZX\nn6/lEJG8bps2Pd8xIWZAOBjZCgYhF98OYeI/a5JFIugYwQvKByHykvLpoM3Fsp6N\nr0yYoFfJ8WXQsF2JAa6OrpBb26PemaIUbmFUqYkCgYAOZgmDxJkqQMduRculqK/Q\n+cle9mksHpTaFM6XIro7MPSt+LQNo2ktAQPo2XMApiOoWEewISBLCBujkMuiSgld\nHfmQ4I/GF6CWxR6tQlkCYuaMI4ZIKSJuWV2kTovsspx0pH0F6R3PzE7hyAMTDQGd\nq3IoTxqLYqc4aCzq78lH6Q==\n-----END PRIVATE KEY-----\n
CLOUDINARY_CLOUD_NAME   = vastraRoot
CLOUDINARY_API_KEY      = 249417979931414
CLOUDINARY_API_SECRET   = L5cwt_ICyA_ycsAh_0PK0Q4NT3w
MISTRAL_API_KEY         = PA2mp5d083WU0dtznyjhcUHFt69jxcx8
MISTRAL_BASE_URL        = https://api.mistral.ai/v1
MISTRAL_MODEL           = mistral-medium-latest
NVIDIA_GEMMA_API_KEY    = Bearer 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
NVIDIA_BASE_URL         = https://integrate.api.nvidia.com/v1
NVIDIA_GEMMA_MODEL      = google/gemma-3-27b-it
OPENWEATHER_API_KEY     = your-openweather-api-key
OPENWEATHER_BASE_URL    = https://api.openweathermap.org/data/2.5
SENTRY_DSN              = https://9b11ec3e27dfc0676bc68cad3527beaa@o4511268089298944.ingest.us.sentry.io/4511268123049984
CORS_ORIGIN             = https://yourdomain.com
RATE_LIMIT_WINDOW_MS    = 900000
RATE_LIMIT_MAX          = 120
LOG_LEVEL               = info
```

⚠️ **IMPORTANT FOR MULTILINE VALUES:**
- For `FIREBASE_PRIVATE_KEY` in Azure portal: Keep the actual newlines as-is (Azure will handle them)
- Do NOT manually escape `\n` to literal `\\n`

---

### Step 2: Fix Port Binding (504 timeout)

The app needs to start FAST. Check startup bottleneck:

**A. Disable Prisma migrations on every start** (already good in your `start` script, but verify):

```json
"start": "npx prisma generate && node dist/app.js"
```

This is correct. But ensure you've run `prisma migrate deploy` BEFORE deploying:

```bash
npx prisma migrate deploy
```

**B. Optimize database connection pool** in `src/config/database.ts`:

Verify connection string uses **pgbouncer** (already present):
```
DATABASE_URL=postgresql://...pooler.supabase.com:6543...
```
✅ Good, you have pgbouncer.

**C. Add startup health check endpoint** - Your `/health` already exists, so Azure should hit it.

---

### Step 3: Verify Deployment Configuration

**Azure App Service Configuration checklist:**

- [ ] **Startup Command** (if not auto-detected):
  ```
  npm run start
  ```

- [ ] **Runtime Stack**: Node 20+ LTS
  
- [ ] **Always On**: Enabled (prevents app from unloading)

- [ ] **Application Insights**: Enable (better logging for timeout issues)

---

### Step 4: Build & Deploy Steps

Run locally first to confirm build works:
```bash
npm install
npm run build
npm run prisma:deploy
npm start
```

Then deploy:
```bash
git add .
git commit -m "Add all Azure env vars"
git push origin main
```

---

### Step 5: Debugging if Still Failing

**View Azure logs in real-time:**
```bash
az webapp log tail --name <your-app-name> --resource-group <your-rg>
```

**Or in Portal:**
- App Service → Log stream
- Look for: `Server is running on port 8080`
- If not present → startup failed

---

## Quick Checklist

| Issue | Fix |
|-------|-----|
| ❌ JWT_REFRESH_EXPIRES_IN missing | ✅ Add to Azure App Settings |
| ❌ 504 Gateway Timeout | ✅ Enable "Always On" + check app startup logs |
| ❌ Connection pool exhausted | ✅ pgbouncer already enabled (good) |
| ❌ Prisma client mismatch | ✅ `npx prisma generate` runs on build |
| ❌ CORS errors | ✅ Update CORS_ORIGIN to your Azure domain |

---

## If Still Getting 504

504 means Azure gave up waiting. This happens when:

1. **App didn't start in 5 minutes** → Check logs for database connection timeout
2. **Port not listening** → Verify `PORT` env var is set (should be 8080)
3. **Process crashed** → Check Application Insights / Log Stream for errors

**Quick test:**
```bash
curl https://your-app.azurewebsites.net/health
```

Should return:
```json
{
  "success": true,
  "message": "Vastra backend is healthy",
  "data": {
    "service": "vastra-backend",
    "environment": "production"
  },
  "timestamp": "2026-04-26T10:30:00Z"
}
```

If 504 still shows → App never started → Check startup logs.
