# ⚡ Azure Deployment Action Plan (5 Steps)

## What Changed
✅ Fixed startup timeout issue (prevents 504 gateway timeout)  
✅ Added timeout protection for database & Redis connections  
✅ Created deployment guide & env var template  

---

## 🎯 DO THIS NOW (In Order)

### STEP 1️⃣: Build & Test Locally
```bash
npm run build
npm run prisma:deploy
npm start
```
You should see:
```
✓ Database connected
✓ Redis cache connected  
Server is running on port 8080
GET /health → 200 OK
```

---

### STEP 2️⃣: Add Environment Variables to Azure Portal

**Navigate to:** Azure Portal → **Your App Service** → **Settings → Configuration**

Add these Application settings (copy-paste from `.env.azure.example`):

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `DATABASE_URL` | `postgresql://postgres.dgyblfwmomudxxrybpyg:...` |
| `DIRECT_URL` | `postgresql://postgres:...` |
| `REDIS_URL` | `rediss://default:gQAA...` |
| `JWT_ACCESS_SECRET` | `1f6727e25...` |
| `JWT_REFRESH_SECRET` | `b567ddd4e...` |
| `JWT_ACCESS_EXPIRES_IN` | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` ⚠️ **THIS WAS MISSING** |
| `FIREBASE_PROJECT_ID` | `vastra-7f311` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@...` |
| `FIREBASE_PRIVATE_KEY` | (full key from .env.azure.example) |
| `CLOUDINARY_CLOUD_NAME` | `vastraRoot` |
| `CLOUDINARY_API_KEY` | `249417979931414` |
| `CLOUDINARY_API_SECRET` | `L5cwt_ICyA...` |
| `MISTRAL_API_KEY` | `PA2mp5d0...` |
| `MISTRAL_BASE_URL` | `https://api.mistral.ai/v1` |
| `MISTRAL_MODEL` | `mistral-medium-latest` |
| `NVIDIA_GEMMA_API_KEY` | `Bearer nvapi-...` |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` |
| `NVIDIA_GEMMA_MODEL` | `google/gemma-3-27b-it` |
| `OPENWEATHER_API_KEY` | `1bf3b0b4...` |
| `OPENWEATHER_BASE_URL` | `https://api.openweathermap.org/data/2.5` |
| `SENTRY_DSN` | `https://9b11ec3e...` |
| `CORS_ORIGIN` | `https://your-app.azurewebsites.net` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX` | `120` |
| `LOG_LEVEL` | `info` |

**Save** and **Restart** the App Service.

---

### STEP 3️⃣: Configure App Service Settings

**Path:** Settings → **General Settings** (or Platform Settings on older Portal)

- [ ] **Always On**: Enable (prevents app from unloading, which causes 504)
- [ ] **Platform**: 64-bit
- [ ] **HTTP version**: 2.0
- [ ] **ARR Affinity**: On

---

### STEP 4️⃣: Deploy Latest Code

```bash
git push origin main
```

Azure DevOps will auto-deploy.

---

### STEP 5️⃣: Monitor Startup Logs

**Option A: Azure Portal**
- Go to: **Log Stream** (under Monitoring)
- Watch for: `✓ Database connected` and `Server is running on port 8080`

**Option B: Command Line**
```bash
az webapp log tail --name your-app-name --resource-group your-resource-group
```

**Expected Log Output:**
```
2026-04-26T10:30:00Z ✓ Database connected
2026-04-26T10:30:02Z ⚠ Redis cache unavailable (startup continues)
2026-04-26T10:30:02Z Server is running on port 8080
```

---

## ✅ Verify It Works

```bash
# Should return 200 OK
curl https://your-app.azurewebsites.net/health

# Response:
{
  "success": true,
  "message": "Vastra backend is healthy",
  "data": {
    "service": "vastra-backend",
    "environment": "production"
  },
  "timestamp": "2026-04-26T10:30:15.000Z"
}
```

---

## 🔧 If Still Getting 504

1. **Check logs** in Azure Portal → Log Stream
2. **Look for timeout errors** (30s for DB, 10s for Redis)
3. **Verify DATABASE_URL is accessible** from Azure's network
4. **Check if "Always On" is enabled** (prevents cold starts)
5. **Restart the App Service** explicitly

---

## 📋 Checklist Before Deployment

- [ ] All env vars from `.env.azure.example` added to Azure Portal
- [ ] `JWT_REFRESH_EXPIRES_IN` is set to `30d`
- [ ] "Always On" is enabled
- [ ] Code committed & pushed: `git push origin main`
- [ ] Latest commit includes startup timeout fixes
- [ ] CORS_ORIGIN matches your Azure domain
- [ ] Sentry DSN is correct

---

## 🚀 What the Fix Does

| Problem | Solution |
|---------|----------|
| `JWT_REFRESH_EXPIRES_IN: Required` | ✅ Added to env vars |
| 504 Gateway Timeout | ✅ Database connection now times out after 30s instead of hanging forever |
| Redis timeout hangs startup | ✅ Redis is non-blocking; cache optional, data critical |
| Slow network startup | ✅ Clear timeout messages in logs for debugging |

---

## 📞 Need Help?

If deployment still fails:
1. Share the **Log Stream** output (Azure Portal → Log Stream)
2. Check if error contains timeout messages → Increase DB_TIMEOUT_MS in startup.util.ts
3. Verify database credentials are correct in DATABASE_URL
