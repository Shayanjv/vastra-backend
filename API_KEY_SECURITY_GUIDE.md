# API Key Security Guide — Frontend vs Backend

Your backend is secure, but exposing API keys on the frontend can destroy that security. Here's the production-grade breakdown.

---

## 🚨 The Risk: Public vs Private Keys

### **NEVER expose in Frontend** ❌

These MUST stay in backend only (backend `.env`):

| Key | Why | Risk |
|-----|-----|------|
| `MISTRAL_API_KEY` | AI provider key | Anyone can use your quota, run bill to $1000s |
| `GEMINI_API_KEY` | AI provider key | Rate limit abuse, cost explosion |
| `FIREBASE_PRIVATE_KEY` | Admin SDK secret | Complete database access |
| `CLOUDINARY_API_SECRET` | Image upload secret | Attackers delete/modify all images |
| `JWT_REFRESH_SECRET` | Token signing key | Forge any JWT token, impersonate anyone |
| `OPENWEATHER_API_SECRET` | (if exists) | Less critical but still private |
| `SENTRY_DSN` (in some cases) | Error reporting key | Can be tricky; see below |

### **Safe for Frontend** ✅

These can be exposed (technically public):

| Key | Why | Safe Because |
|-----|-----|---|
| `FIREBASE_PROJECT_ID` | Config only, no secrets | No authentication value |
| `CLOUDINARY_CLOUD_NAME` | Config only | No secrets, just account name |
| `BACKEND_URL` | Your own server | You control it |
| Browser/Mobile API keys | Limited-scope APIs | Rate limited per key |

---

## ⚠️ Your Current Setup Issues

### **Problem 1: OPENWEATHER_API_KEY on Frontend**
```dart
// ❌ UNSAFE: Frontend .env has key exposed
OPENWEATHER_API_KEY=your-openweather-api-key
```

**Risk**: Anyone can use your API key, burn quota, spike bill.

**Fix**: Remove from frontend, call backend instead:
```dart
// ✅ SAFE: Frontend calls backend
GET /api/v1/weather?lat=...&lon=...
// Backend calls OpenWeather internally
```

---

### **Problem 2: AI Keys on Frontend (if you intended to)**
```dart
// ❌ NEVER: AI keys exposed
GEMINI_API_KEY=...
MISTRAL_API_KEY=...
```

**Risk**: Attackers burn your API quota, cost can be $1000s/day.

**Fix**: All AI calls go through backend:
```dart
// ✅ SAFE: Frontend requests, backend processes
POST /api/v1/outfits  (with occasion, weather, preferences)
// Backend calls Gemini/Mistral internally, returns results
```

---

### **Problem 3: FIREBASE_PRIVATE_KEY on Frontend (if anyone considers it)**
```dart
// ❌ CRITICAL: Never expose Firebase admin key
FIREBASE_PRIVATE_KEY=...
```

**Risk**: Complete database access, can delete everything.

**Fix**: Only in backend, never in frontend or `.env` files.

---

## 🏗️ Production-Grade Architecture for Vastra

### **Correct Data Flow**

```
Frontend (Flutter)                Backend (Node.js/Express)      External API
─────────────────                ──────────────────────          ─────────────

User wants outfit suggestion
         │
         ├─ POST /api/v1/outfits
         │   (occasion, preferences, photo)
         │
         └──────────────────────────→  Receives request
                                      │
                                      ├─ Query Isar/PostgreSQL
                                      │
                                      ├─ Call Gemini API ────→ Gemini
                                      │   (sends API_KEY safely)
                                      │   ←────── Returns suggestions
                                      │
                                      ├─ Call OpenWeather API ──→ OpenWeather
                                      │   (uses API_KEY)
                                      │   ←────── Returns weather
                                      │
                                      ├─ Process + combine data
                                      │
                                      └─ Return outfit to frontend ←─ Returns outfit
                                      
Frontend receives:
{
  "success": true,
  "data": {
    "outfit": {...},
    "reason": "Based on your preferences..."
  }
}
```

**Key principle: Backend is the API consumer, frontend is API client.**

---

## ✅ What Frontend CAN Have (Safe)

### **In Flutter `.env`:**
```env
# ✅ OK to expose
BACKEND_URL=https://your-app.azurewebsites.net/api/v1
CLOUDINARY_CLOUD_NAME=vastraRoot
FIREBASE_PROJECT_ID=vastra-7f311

# ❌ NEVER expose these
# OPENWEATHER_API_KEY=...        # Keep in backend only
# GEMINI_API_KEY=...              # Keep in backend only
# MISTRAL_API_KEY=...             # Keep in backend only
# FIREBASE_PRIVATE_KEY=...        # CRITICAL: Backend only
# CLOUDINARY_API_SECRET=...       # Keep in backend only
```

### **Safe API calls from Frontend:**
```dart
// ✅ These are safe (backend handles secrets)
POST /api/v1/outfits          → Backend uses Gemini internally
POST /api/v1/clothes          → Backend uploads to Cloudinary
GET /api/v1/weather           → Backend uses OpenWeather API
GET /api/v1/quality/:clothId  → Backend processes data
```

---

## 🔄 Refactor: Move API Calls to Backend

### **Current (❌ Unsafe) if Frontend calls OpenWeather directly:**

```dart
// lib/data/datasources/remote/weather_datasource.dart
class WeatherDataSource {
  Future<Map> getWeather(double lat, double lon) async {
    final apiKey = EnvironmentConfig.openweatherApiKey; // ❌ Exposed
    
    return dio.get(
      'https://api.openweathermap.org/data/2.5/weather',
      queryParameters: {
        'lat': lat,
        'lon': lon,
        'appid': apiKey, // ❌ Sent from frontend
      },
    );
  }
}
```

**Problem**: 
- Anyone debugging can see API key in Dio logs
- Key visible in network inspector
- Quota burned if key leaked

---

### **Correct (✅ Secure) Refactored Approach:**

#### **Frontend (No secrets):**
```dart
// lib/data/datasources/remote/weather_datasource.dart
class WeatherDataSource {
  final ApiClient apiClient;

  WeatherDataSource({required this.apiClient});

  Future<Map> getWeather(double lat, double lon) async {
    // ✅ Backend handles the API key internally
    return apiClient.get(
      '/weather',
      queryParameters: {
        'lat': lat,
        'lon': lon,
        // NO API_KEY sent from frontend
      },
    );
  }
}
```

#### **Backend (Secrets safe):**
```typescript
// src/modules/weather/weather.controller.ts
async getWeather(request: Request, response: Response) {
  const { lat, lon } = request.query;

  try {
    // Backend safely uses the API key (never exposed to frontend)
    const weatherData = await axios.get(
      'https://api.openweathermap.org/data/2.5/weather',
      {
        params: {
          lat,
          lon,
          appid: environment.OPENWEATHER_API_KEY, // ✅ Secure in backend .env
        },
      }
    );

    return sendSuccess(response, 200, 'Weather fetched', weatherData.data);
  } catch (error) {
    return sendError(response, 500, 'Weather fetch failed', error);
  }
}
```

**Benefits**:
- ✅ API key never leaves backend
- ✅ Quota tied to your backend, not exposed
- ✅ Can rate-limit/validate frontend requests
- ✅ Easier to rotate keys (only in backend)

---

## 🎯 Vastra-Specific Refactoring

### **What Needs to Change**

#### **1. Weather Module** ← Already good (backend fetches)
Your backend already handles this correctly. Frontend just calls `/api/v1/weather`.

#### **2. AI Suggestions** ← Already good (backend handles)
Frontend calls `/api/v1/outfits` (with occasion/preferences).
Backend calls Gemini/Mistral internally with API_KEY.

#### **3. Image Upload** ← Already good (via backend)
Frontend calls `/api/v1/uploads` (POST with file).
Backend uploads to Cloudinary with API_SECRET safely.

#### **4. Firebase** ← Needs careful handling
Frontend uses **browser SDK** (safe public config).
Backend uses **Admin SDK** (private key, backend only).

---

## 🔐 Firebase: Hybrid Approach (Frontend + Backend)

Firebase is special — it has **two different key types**:

### **Frontend (Public Firebase Config):**
```dart
// ✅ SAFE: Publicly available Firebase web config
const firebaseConfig = {
  "apiKey": "AIzaSy...", // This is PUBLIC
  "projectId": "vastra-7f311",
  "databaseURL": "https://vastra-7f311.firebaseio.com",
  "authDomain": "vastra-7f311.firebaseapp.com",
  // These are NOT secret, they're in your app publicly
};
```

**Why it's safe**: 
- Firebase restricts what each API key can do
- Auth key can only do auth operations
- Security rules in Firestore/Realtime DB protect data

### **Backend (Admin SDK):**
```typescript
// ❌ CRITICAL: Never expose admin key
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvA... (in backend .env only)
```

**Why it's critical**:
- Admin key bypasses all security rules
- Can delete entire database
- Can impersonate any user

---

## 📋 Checklist: Production-Grade Security

### **Frontend `.env` (Safe to expose in repo if needed):**
- [ ] ✅ `BACKEND_URL` — Your own server
- [ ] ✅ `CLOUDINARY_CLOUD_NAME` — No secrets
- [ ] ✅ `FIREBASE_PROJECT_ID` — Public config only
- [ ] ❌ NO API_KEY for external services
- [ ] ❌ NO secrets or private keys

### **Backend `.env` (NEVER commit to git):**
- [ ] ✅ `DATABASE_URL` — In .env.example only
- [ ] ✅ `OPENWEATHER_API_KEY` — Backend only
- [ ] ✅ `MISTRAL_API_KEY` — Backend only
- [ ] ✅ `GEMINI_API_KEY` — Backend only
- [ ] ✅ `FIREBASE_PRIVATE_KEY` — Backend only
- [ ] ✅ `CLOUDINARY_API_SECRET` — Backend only
- [ ] ✅ Add `.env` to `.gitignore`

### **Frontend API Design:**
- [ ] ✅ All calls go to backend (`/api/v1/...`)
- [ ] ✅ No direct calls to external APIs (Gemini, OpenWeather, etc.)
- [ ] ✅ Backend proxies external API calls
- [ ] ✅ Error messages don't leak API details

### **Deployment:**
- [ ] ✅ Backend `.env` stored in Azure Key Vault (production)
- [ ] ✅ Or as Azure App Service Environment Variables (current setup — OK)
- [ ] ✅ Frontend only needs `BACKEND_URL` in deployment config
- [ ] ✅ No secrets in frontend build

---

## 🚨 Common Mistakes (Don't Do These)

### **❌ Mistake 1: Frontend calls external API directly**
```dart
// DON'T do this:
final response = await dio.get(
  'https://api.mistral.ai/v1/chat/completions',
  options: Options(
    headers: {
      'Authorization': 'Bearer $mistralApiKey', // ❌ Exposed!
    },
  ),
  data: {'messages': [...]},
);
```

**Why bad**: Key visible in Dio logs, network traffic, reverse engineering.

---

### **❌ Mistake 2: Committing `.env` to git**
```bash
# DON'T
git add .env
git commit -m "add env"

# DO (already in your .gitignore)
echo ".env" >> .gitignore
```

---

### **❌ Mistake 3: Logging API keys**
```typescript
// DON'T
console.log(`Calling Gemini with key: ${GEMINI_API_KEY}`);

// DO
logger.info('Calling Gemini API'); // No key logged
```

---

### **❌ Mistake 4: Frontend reads backend .env**
```dart
// DON'T build a frontend endpoint that returns backend secrets
// GET /api/v1/config (returning OPENWEATHER_API_KEY) ← BAD
```

---

## ✅ Best Practices for Vastra

### **1. Backend as API Gateway Pattern**
```
Frontend → Your Backend → External APIs
                ↑
         (Safe API key storage)
```

All external API keys stay in backend.env only.

### **2. Environment Variables Hierarchy**
```
Development (your machine)
  └─ .env file (local only, never commit)

Staging
  └─ Azure App Service → Environment Variables

Production
  └─ Azure Key Vault (encrypted secrets) → App Service
```

### **3. Key Rotation**
```
To rotate OPENWEATHER_API_KEY:
1. Create new key in OpenWeather dashboard
2. Update backend .env or Azure App Settings
3. Restart backend
4. Old key still works for 30 days (transition period)
5. Delete old key
6. Redeploy frontend (no changes needed)
```

### **4. Monitoring & Alerts**
```
Backend should log:
- API calls to external services
- Rate limit hits
- Quota warnings
- Unusual access patterns

Example:
logger.info('OpenWeather API called', {
  endpoint: 'getWeather',
  lat, lon,
  quotaUsed: 45/1000,
  remainingToday: 955,
});
```

---

## 🎯 Current Vastra Status

### **✅ GOOD**
- Backend has all secrets in `.env` (Azure App Settings)
- Frontend only knows `BACKEND_URL`
- All AI calls proxied through backend
- All weather calls proxied through backend
- All image uploads proxied through backend

### **⚠️ WATCH OUT IF**
You planned to put these in Flutter `.env`:
```env
# ❌ DON'T do this:
OPENWEATHER_API_KEY=...
GEMINI_API_KEY=...
MISTRAL_API_KEY=...
```

---

## 📊 Security Comparison

| Approach | Frontend Security | Backend Security | Production Ready |
|----------|---|---|---|
| **API keys in frontend .env** | ❌ Poor | ❌ Poor | ❌ No |
| **API keys in backend .env** | ✅ Good | ✅ Good | ⚠️ Partial |
| **API keys in Azure Key Vault** | ✅ Good | ✅ Excellent | ✅ Yes |
| **Frontend calls external APIs** | ❌ Very Bad | N/A | ❌ No |
| **Backend proxies all APIs** | ✅ Excellent | ✅ Excellent | ✅ Yes |

---

## 🔄 Migration Plan: If You Added Keys to Frontend

If you accidentally added secrets to Flutter `.env`:

1. **Delete from frontend `.env`:**
   ```dart
   // Remove these lines
   // OPENWEATHER_API_KEY=...
   // GEMINI_API_KEY=...
   ```

2. **Verify backend has them:**
   ```typescript
   // src/config/environment.ts
   OPENWEATHER_API_KEY: z.string().min(1),
   MISTRAL_API_KEY: z.string().min(1),
   ```

3. **Test frontend calling backend:**
   ```dart
   // Frontend: No API keys needed
   final weather = await weatherService.getWeather(lat, lon);
   // Backend internally: Uses OPENWEATHER_API_KEY
   ```

4. **Commit with message:**
   ```
   git commit -m "security: remove API keys from frontend"
   ```

---

## 📚 References (Production-Grade Standards)

- **OWASP Top 10**: Never expose secrets on frontend
- **12-Factor App**: Config in environment variables (backend only)
- **Firebase Best Practices**: Public API key for SDK, admin key in backend
- **API Key Rotation**: Quarterly security standard

---

## Summary

**Can you put API keys on frontend?** ❌ No, it's insecure and not production-grade.

**What should be on frontend?** ✅ Only `BACKEND_URL` and non-secret Firebase config.

**Where do API keys go?** ✅ Backend `.env` (or Azure Key Vault for production).

**How does frontend use them?** ✅ Calls backend endpoints, backend proxies to external APIs.

**Is your Vastra setup production-grade?** ✅ Yes, you're doing it right — keep it that way!

---

**Questions?** Review your `azure_deployment_checklist.md` — all backend secrets stay in Azure App Settings. ✓
