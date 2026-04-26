# Azure Environment Variables Checklist

Your backend requires **ALL** these environment variables to be set in Azure App Service.

---

## 🎯 How to Add Them in Azure

1. **Go to**: Azure Portal → Your App Service → Settings → **Configuration**
2. **Click**: **+ New application setting**
3. **Add each variable** from checklist below
4. **Click**: **Save** at top
5. **Restart** App Service (optional but recommended)

---

## ✅ REQUIRED Variables for Vastra Backend

### **1. Server Configuration**
| Variable | Value | Copy From |
|----------|-------|-----------|
| `NODE_ENV` | `production` | Type this |
| `PORT` | `8080` | Type this |
| `LOG_LEVEL` | `info` | Type this |

### **2. Database (CRITICAL)**
| Variable | Value | Copy From |
|----------|-------|-----------|
| `DATABASE_URL` | `postgresql://postgres.dgyblfwmomudxxrybpyg:Shayan%406565%23@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require` | Your `.env` file |
| `DIRECT_URL` | `postgresql://postgres:Shayan%406565%23@db.dgyblfwmomudxxrybpyg.supabase.co:5432/postgres?sslmode=require` | Your `.env` file |

### **3. Redis Cache (CRITICAL)**
| Variable | Value | Copy From |
|----------|-------|-----------|
| `REDIS_URL` | `rediss://default:gQAAAAAAAQV_...@rational-spider-66943.upstash.io:6379` | Your `.env` file |

### **4. JWT Tokens (CRITICAL)**
| Variable | Value | Copy From |
|----------|-------|-----------|
| `JWT_ACCESS_SECRET` | `1f6727e256d7e80956740fe104d81b1e70f48e49d4bd71c9903d8c456552b5c0` | Your `.env` file |
| `JWT_REFRESH_SECRET` | `b567ddd4efb908ce16c28ba2ca9476e5c12b5c4e49472bd6501efdd6104f4818` | Your `.env` file |
| `JWT_ACCESS_EXPIRES_IN` | `7d` | Your `.env` file |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Your `.env` file |

### **5. Firebase Admin SDK (CRITICAL)**
| Variable | Value | Copy From |
|----------|-------|-----------|
| `FIREBASE_PROJECT_ID` | `vastra-7f311` | Your `.env` file |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@vastra-7f311.iam.gserviceaccount.com` | Your `.env` file |
| `FIREBASE_PRIVATE_KEY` | (Full private key starting with `-----BEGIN PRIVATE KEY-----`) | Your `.env` file |

⚠️ **For `FIREBASE_PRIVATE_KEY`**: In Azure portal, paste the ENTIRE key as-is. Do NOT manually replace `\n` with newlines. Azure handles it.

### **6. Cloudinary (CRITICAL for image uploads)**
| Variable | Value | Copy From |
|----------|-------|-----------|
| `CLOUDINARY_CLOUD_NAME` | `vastraRoot` | Your `.env` file |
| `CLOUDINARY_API_KEY` | `249417979931414` | Your `.env` file |
| `CLOUDINARY_API_SECRET` | `L5cwt_ICyA_ycsAh_0PK0Q4NT3w` | Your `.env` file |

### **7. AI Providers (CRITICAL)**
| Variable | Value | Copy From |
|----------|-------|-----------|
| `MISTRAL_API_KEY` | `PA2mp5d083WU0dtznyjhcUHFt69jxcx8` | Your `.env` file |
| `MISTRAL_BASE_URL` | `https://api.mistral.ai/v1` | Type this (or from `.env`) |
| `MISTRAL_MODEL` | `mistral-medium-latest` | Type this (or from `.env`) |
| `NVIDIA_GEMMA_API_KEY` | `Bearer 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` | Your `.env` file |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | Type this (or from `.env`) |
| `NVIDIA_GEMMA_MODEL` | `google/gemma-3-27b-it` | Type this (or from `.env`) |

### **8. Weather API (For outfit suggestions)**
| Variable | Value | Copy From |
|----------|-------|-----------|
| `OPENWEATHER_API_KEY` | `1bf3b0b48ab8e566211c7ebe99da2189` | Your `.env` file |
| `OPENWEATHER_BASE_URL` | `https://api.openweathermap.org/data/2.5` | Type this (or from `.env`) |

### **9. Observability (Optional but recommended)**
| Variable | Value | Copy From |
|----------|-------|-----------|
| `SENTRY_DSN` | `https://9b11ec3e27dfc0676bc68cad3527beaa@o4511268089298944.ingest.us.sentry.io/4511268123049984` | Your `.env` file |

### **10. CORS Configuration (For Flutter & Web)**
| Variable | Value | Why |
|----------|-------|-----|
| `CORS_ORIGIN` | `https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net,http://localhost:3000,http://localhost:4000` | Allow backend itself, localhost, and mobile requests |

**Mobile apps (Flutter)** send no origin header → code now allows them automatically ✓

### **11. Rate Limiting (API protection)**
| Variable | Value | Copy From |
|----------|-------|-----------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Type this (15 minutes = 900000 ms) |
| `RATE_LIMIT_MAX` | `120` | Type this (max 120 requests per window) |

---

## 📋 Step-by-Step: Add to Azure

### **From Your Local Machine**

1. **Open your `.env` file** locally
2. **Copy each value** from the table above
3. **Go to Azure Portal**
4. **Click**: App Service → Settings → Configuration
5. **For each variable**:
   ```
   Name:  (from table)
   Value: (from your .env)
   ```
6. **Click Save** at top
7. **Restart** App Service (optional)

### **Quick Copy-Paste Format**

If you want to add multiple at once, use Azure CLI:

```bash
az webapp config appsettings set \
  --resource-group <your-resource-group> \
  --name vastra-backend-fyefd2emhra7a8gg \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL="postgresql://..." \
    DIRECT_URL="postgresql://..." \
    REDIS_URL="rediss://..." \
    JWT_ACCESS_SECRET="1f6727e256..." \
    JWT_REFRESH_SECRET="b567ddd4e..." \
    JWT_ACCESS_EXPIRES_IN="7d" \
    JWT_REFRESH_EXPIRES_IN="30d" \
    FIREBASE_PROJECT_ID="vastra-7f311" \
    FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@..." \
    "FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n..." \
    CLOUDINARY_CLOUD_NAME="vastraRoot" \
    CLOUDINARY_API_KEY="249417979931414" \
    CLOUDINARY_API_SECRET="L5cwt_ICyA_..." \
    MISTRAL_API_KEY="PA2mp5d083..." \
    MISTRAL_BASE_URL="https://api.mistral.ai/v1" \
    MISTRAL_MODEL="mistral-medium-latest" \
    NVIDIA_GEMMA_API_KEY="Bearer nvapi-..." \
    NVIDIA_BASE_URL="https://integrate.api.nvidia.com/v1" \
    NVIDIA_GEMMA_MODEL="google/gemma-3-27b-it" \
    OPENWEATHER_API_KEY="1bf3b0b48..." \
    OPENWEATHER_BASE_URL="https://api.openweathermap.org/data/2.5" \
    SENTRY_DSN="https://9b11ec3e..." \
    CORS_ORIGIN="https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net,http://localhost:3000,http://localhost:4000" \
    RATE_LIMIT_WINDOW_MS="900000" \
    RATE_LIMIT_MAX="120" \
    LOG_LEVEL="info"
```

---

## ✅ Verification Checklist

After adding all variables:

- [ ] **Test health endpoint**:
  ```bash
  curl https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/health
  ```
  Should return: `{"success": true, "message": "Vastra backend is healthy", ...}`

- [ ] **Check logs** in Azure Portal → Log Stream
  - Should see: `✓ Database connected`
  - Should see: `Server is running on port 8080`
  - Should NOT see: `Invalid environment variables`

- [ ] **Test Flutter app** can login and get profile
  - Should work without 401 errors

- [ ] **Test image upload** to verify Cloudinary key works
  - Should upload successfully

- [ ] **Check no "Invalid environment variables" errors** in startup logs

---

## 🚨 Common Issues

### **Issue: "Invalid environment variables. JWT_REFRESH_EXPIRES_IN: Required"**
**Fix**: You missed adding `JWT_REFRESH_EXPIRES_IN` to Azure App Settings. Add it with value `30d`.

### **Issue: "Database connection failed"**
**Fix**: Check `DATABASE_URL` and `DIRECT_URL` are correct. Test connection manually:
```bash
psql postgresql://user:pass@host:port/dbname
```

### **Issue: "Redis connection failed"**
**Fix**: Redis is optional (cache is optional). Backend continues without it. But if you want it:
- Verify `REDIS_URL` is correct
- Check Upstash Redis is still active

### **Issue: "Firebase: Invalid service account"**
**Fix**: Verify `FIREBASE_PRIVATE_KEY` was pasted completely. It should start with `-----BEGIN PRIVATE KEY-----` and end with `-----END PRIVATE KEY-----\n`.

### **Issue: Flutter app gets CORS error**
**Fix**: The code now allows mobile requests (no origin check for mobile). But if still getting CORS error, add to `CORS_ORIGIN`:
```
https://yourdomain.com,http://localhost:3000,*
```

---

## 🔍 How to Find These Values

### **From Your Local `.env` File**
```bash
# In your backend directory
cat .env | grep DATABASE_URL
cat .env | grep JWT_ACCESS_SECRET
# etc...
```

### **From Azure Portal** (if already partially set)
- App Service → Configuration → Application settings
- Copy existing values

### **From Supabase** (for DATABASE_URL)
- https://supabase.com → Your project → Project Settings → Database
- Copy connection string

### **From Upstash** (for REDIS_URL)
- https://console.upstash.com/ → Your Redis instance
- Copy connection string

### **From Firebase** (for Firebase vars)
- Firebase Console → Project Settings
- Copy Project ID, Client Email, Private Key

### **From Cloudinary** (for Cloudinary vars)
- https://cloudinary.com → Dashboard
- Copy Cloud Name, API Key, API Secret

---

## 📊 Summary Table

**Total Variables to Add**: 27

| Category | Count | Critical? |
|----------|-------|-----------|
| Server | 3 | ✅ YES |
| Database | 2 | ✅ CRITICAL |
| Redis | 1 | ⚠️ Optional |
| JWT | 4 | ✅ CRITICAL |
| Firebase | 3 | ✅ CRITICAL |
| Cloudinary | 3 | ✅ YES |
| AI Providers | 6 | ✅ YES |
| Weather | 2 | ✅ YES |
| Observability | 1 | ⚠️ Optional |
| CORS | 1 | ✅ YES |
| Rate Limit | 2 | ✅ YES |

---

## 🚀 After You Add All Variables

1. **Restart App Service** (optional but recommended)
2. **Check logs** in Azure Portal
3. **Test health endpoint** to verify backend is up
4. **Test Flutter app login** to verify integration

**If everything works, you're done!** ✅

---

## 📞 Questions?

Refer to:
- [`AZURE_DEPLOYMENT_CHECKLIST.md`](AZURE_DEPLOYMENT_CHECKLIST.md) for deployment overview
- [`API_KEY_SECURITY_GUIDE.md`](API_KEY_SECURITY_GUIDE.md) for security best practices
- [`FLUTTER_ENV_SIMPLE_SETUP.md`](FLUTTER_ENV_SIMPLE_SETUP.md) for frontend setup

All 27 environment variables are **required** for production.
