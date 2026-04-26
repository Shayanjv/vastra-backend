# ⚙️ Frontend Setup Instructions & Copilot Prompt

**Your Backend URL**: `https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1`

---

## 🎯 What Frontend Developers Need to Know

### **Safe to Expose in Frontend `.env`:**

| Key | Value | Visibility |
|-----|-------|-----------|
| `BACKEND_URL` | `https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1` | ✅ Public |
| `CLOUDINARY_CLOUD_NAME` | `vastraRoot` | ✅ Public |
| `FIREBASE_PROJECT_ID` | `vastra-7f311` | ✅ Public |
| `FIREBASE_AUTH_DOMAIN` | `vastra-7f311.firebaseapp.com` | ✅ Public |

### **NEVER expose in Frontend:**

| Key | Reason | Location |
|-----|--------|----------|
| `OPENWEATHER_API_KEY` | ❌ Quota attacks | Backend only |
| `MISTRAL_API_KEY` | ❌ Cost explosion | Backend only |
| `NVIDIA_GEMMA_API_KEY` | ❌ API abuse | Backend only |
| `FIREBASE_PRIVATE_KEY` | ❌ Total DB access | Backend only |
| `CLOUDINARY_API_SECRET` | ❌ Image deletion | Backend only |
| `JWT_REFRESH_SECRET` | ❌ Token forgery | Backend only |

---

## 📋 Frontend `.env` Template

Copy this into your Flutter project:

```env
# ===== BACKEND API (YOUR AZURE SERVER) =====
BACKEND_URL=https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1

# ===== PUBLIC FIREBASE CONFIG =====
FIREBASE_PROJECT_ID=vastra-7f311
FIREBASE_AUTH_DOMAIN=vastra-7f311.firebaseapp.com

# ===== PUBLIC CLOUDINARY CONFIG =====
CLOUDINARY_CLOUD_NAME=vastraRoot

# ===== FEATURE FLAGS =====
LOG_LEVEL=info
ENABLE_ANALYTICS=true
```

**That's it! No secrets, no API keys.**

---

## 🔄 API Calls from Frontend → Backend

### **All External API calls go through Backend**

```
Frontend Request                Backend Processing              External API
─────────────────                ──────────────────              ────────────

GET /weather?lat=...     →       Calls OpenWeather          →    OpenWeather API
                                 (uses OPENWEATHER_API_KEY)      (secret safe)

POST /outfits             →      Calls Gemini/Mistral       →    Gemini/Mistral
(occasion, preferences)          (uses GEMINI_API_KEY)           (secret safe)

POST /clothes/upload      →      Calls Cloudinary           →    Cloudinary
(with file)                      (uses CLOUDINARY_SECRET)        (secret safe)
```

**All secrets stay in backend `.env` / Azure App Settings.**

---

## 📲 Frontend `.env` File (Ready to Copy)

Create **`lib/.env`** in your Flutter project with:

```env
# Backend API Base URL
BACKEND_URL=https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1

# Firebase Public Config (safe to expose)
FIREBASE_PROJECT_ID=vastra-7f311
FIREBASE_AUTH_DOMAIN=vastra-7f311.firebaseapp.com

# Cloudinary Public Config (safe to expose)
CLOUDINARY_CLOUD_NAME=vastraRoot

# Logging & Features
LOG_LEVEL=info
ENABLE_ANALYTICS=true
ENABLE_CRASH_REPORTING=true
```

---

## 🤖 Copilot Prompt for Frontend Developer

**Give this to your frontend team / Copilot:**

```
You are a senior Flutter developer for Vastra, an AI wardrobe manager app.

## Backend Information
- Backend URL: https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1
- Architecture: Node.js + Express + PostgreSQL + Prisma
- Response Format: Always includes {success, message, data, pagination, timestamp}

## Your Task
Implement complete frontend integration for these features:

### 1. Environment Setup
- Create lib/.env with these values:
  - BACKEND_URL=https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1
  - FIREBASE_PROJECT_ID=vastra-7f311
  - FIREBASE_AUTH_DOMAIN=vastra-7f311.firebaseapp.com
  - CLOUDINARY_CLOUD_NAME=vastraRoot

- Do NOT add any API keys (OPENWEATHER_API_KEY, GEMINI_API_KEY, etc.)
- All external API calls are handled by backend

### 2. API Client Setup (Dio)
Implement lib/core/network/api_client.dart with:

Requirements:
- Base URL from environment: EnvironmentConfig.backendUrl
- All requests auto-add JWT token: Authorization: Bearer <token>
- Token stored in flutter_secure_storage (not SharedPreferences)
- Automatic token refresh on 401 errors
- Handle rate limiting (429 errors with exponential backoff)
- Error mapping: Convert backend error codes to domain Failure classes

Expected Backend Response Format:
{
  "success": true,
  "message": "Human readable message",
  "data": {...},
  "pagination": {"page": 1, "limit": 20, "total": 100},
  "timestamp": "ISO string"
}

### 3. Authentication Flow
Implement lib/presentation/providers/auth_provider.dart with:

Endpoints:
- POST /auth/signup (email, password) → returns {accessToken, refreshToken, user}
- POST /auth/login (email, password) → returns {accessToken, refreshToken, user}
- POST /auth/refresh (refreshToken) → returns {accessToken}

Token Management:
- Store accessToken in flutter_secure_storage (7 day expiry)
- Store refreshToken in flutter_secure_storage (30 day expiry)
- On 401 error, auto-refresh using refreshToken
- Clear tokens on logout

Routing:
- Use GoRouter with auth guard
- Redirect unauthenticated users to /auth/login
- After login, redirect to /

### 4. Wardrobe Management (Cloth CRUD)
Implement lib/modules/cloth/ with:

Endpoints:
- GET /clothes?page=1&limit=20 → List paginated clothes
- POST /clothes (name, color, materials[], imageUrl) → Add cloth
- GET /clothes/:clothId → Get cloth details
- PUT /clothes/:clothId (name, color, materials[]) → Update cloth
- DELETE /clothes/:clothId → Delete cloth

Models (lib/data/models/cloth_model.dart):
- id: String
- name: String
- color: String
- materials: List<String> (fabric types)
- imageUrl: String (Cloudinary URL)
- createdAt: DateTime
- updatedAt: DateTime

Provider Pattern (Riverpod):
- StateNotifierProvider for cloth list with CRUD operations
- Cache in Isar local DB for offline support
- Sync to backend when online

### 5. Weather Integration
Implement lib/modules/weather/ with:

Endpoint:
- GET /weather?lat=<double>&lon=<double> → Backend handles OpenWeather API call internally

Frontend:
- No weather API keys needed
- Backend safely calls OpenWeather with OPENWEATHER_API_KEY
- Cache weather data for 1 hour
- Geolocator plugin for getting user coordinates

### 6. Outfit Suggestions (AI)
Implement lib/modules/outfit/ with:

Endpoint:
- POST /outfits
  Input: {occasionId, preferences, clothIds[], lat, lon, weather}
  Output: {outfits[], reason, recommendation}

Frontend:
- No Gemini/Mistral API keys needed
- Backend safely calls AI with GEMINI_API_KEY or MISTRAL_API_KEY
- Cache suggestions for 30 minutes
- Use Riverpod for state management

### 7. Laundry Tracking
Implement lib/modules/laundry/ with:

Endpoints:
- GET /laundry → Get laundry status
- POST /laundry (clothId, washType) → Log wash
- GET /laundry/history/:clothId → Wash history

### 8. Quality Scoring
Implement lib/modules/quality/ with:

Endpoints:
- GET /quality/:clothId → Get current quality score
- GET /quality/history/:clothId → Quality degradation timeline

Model:
- clothId, currentScore, degradationRate, remainingMonths, recommendation

### 9. Image Upload (to Cloudinary via Backend)
Implement lib/modules/upload/ with:

Endpoint:
- POST /uploads (multipart file)
  Backend handles Cloudinary upload with CLOUDINARY_API_SECRET
  Returns: {url, publicId}

Frontend:
- Use image_picker for gallery/camera
- Send file to /uploads endpoint
- Get Cloudinary URL back
- No Cloudinary API secret needed on frontend

### 10. User Profile
Implement lib/modules/profile/ with:

Endpoints:
- GET /users/profile → Get current user
- PUT /users/profile (name, email, preferences) → Update profile

### Error Handling
- Implement Failure classes for all error types:
  - NetworkFailure
  - ServerFailure (HTTP errors)
  - AuthenticationFailure (401)
  - ValidationFailure (400)
  - CacheFailure (Local DB)

- Use Either<Failure, Success> pattern from dartz
- Convert backend error codes (AUTH_001, CLOTH_001, etc.) to domain Failure

### Testing
- Mock ApiClient for all datasource tests
- Test token refresh logic on 401
- Test pagination and list endpoints
- Test error handling and retry logic

### Security
- Never expose API keys on frontend
- All external API calls go through backend
- Use flutter_secure_storage for tokens (not SharedPreferences)
- Validate all user input before sending to backend
- Don't log sensitive data (tokens, passwords)

### State Management
Use Riverpod (flutter_riverpod):
- One provider per feature
- StateNotifierProvider for mutations (CRUD)
- FutureProvider for read-only data
- Use ref.invalidate() to refresh after mutations

### Navigation
Use GoRouter (go_router):
- Define all routes in app_router.dart
- Named routes for type safety
- Auth guard to redirect unauthenticated users
- Deep linking support

### Database
Use Isar for local caching:
- Cache clothes list locally
- Offline-first: show cached data, sync when online
- Mark items as synced/unsynced for background sync

## All Backend Endpoints Reference

### Public Routes (No Auth Required)
- POST /auth/signup
- POST /auth/login
- POST /auth/refresh
- GET /health

### Protected Routes (Auth Required)
- GET /clothes (paginated)
- POST /clothes
- PUT /clothes/:id
- DELETE /clothes/:id
- GET /outfits
- POST /outfits
- GET /laundry
- POST /laundry
- GET /quality/:clothId
- GET /users/profile
- PUT /users/profile
- GET /weather
- POST /uploads
- GET /notifications
- POST /notifications/subscribe

## Important Rules
1. NEVER put API keys in frontend code or .env
2. Backend handles all external API calls
3. Always include Authorization header for protected routes
4. Handle 401 errors with token refresh
5. Implement exponential backoff for rate limits
6. Cache responsibly (weather 1h, outfit 30m, clothes 5m)
7. Use Isar for offline-first caching
8. Validate input before sending to backend
9. Clean up UI state on logout
10. Test all flows end-to-end against live backend

## Links to Documentation
- Backend API: https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/health
- Firebase: https://console.firebase.google.com (project: vastra-7f311)
- Cloudinary: https://cloudinary.com/console/c_8f3e0d/media_library

## Environment File (.env)
```env
BACKEND_URL=https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1
FIREBASE_PROJECT_ID=vastra-7f311
FIREBASE_AUTH_DOMAIN=vastra-7f311.firebaseapp.com
CLOUDINARY_CLOUD_NAME=vastraRoot
LOG_LEVEL=info
ENABLE_ANALYTICS=true
```

Build a production-grade Flutter app that:
- ✅ Integrates with this backend perfectly
- ✅ Handles all errors gracefully
- ✅ Works offline-first with Isar
- ✅ Uses Riverpod for state
- ✅ Implements token refresh automatically
- ✅ Validates all inputs
- ✅ Never exposes secrets
- ✅ Tests all critical flows

Start with environment setup, then implement API client, then build features one by one.
```

---

## 🚀 Step-by-Step Frontend Setup

### **Step 1: Environment Setup** (5 minutes)

```bash
cd your-flutter-project

# Create .env file
cat > lib/.env << 'EOF'
BACKEND_URL=https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1
FIREBASE_PROJECT_ID=vastra-7f311
FIREBASE_AUTH_DOMAIN=vastra-7f311.firebaseapp.com
CLOUDINARY_CLOUD_NAME=vastraRoot
LOG_LEVEL=info
ENABLE_ANALYTICS=true
EOF

# Add to pubspec.yaml
flutter pub add flutter_dotenv
```

### **Step 2: Environment Config** (5 minutes)

```dart
// lib/core/config/environment.dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

class EnvironmentConfig {
  static Future<void> initialize() async {
    await dotenv.load(fileName: 'lib/.env');
  }

  static String get backendUrl {
    return dotenv.env['BACKEND_URL'] ?? 'http://localhost:4000/api/v1';
  }

  static String get firebaseProjectId {
    return dotenv.env['FIREBASE_PROJECT_ID'] ?? '';
  }

  static String get firebaseAuthDomain {
    return dotenv.env['FIREBASE_AUTH_DOMAIN'] ?? '';
  }

  static String get cloudinaryCloudName {
    return dotenv.env['CLOUDINARY_CLOUD_NAME'] ?? '';
  }

  static String get logLevel {
    return dotenv.env['LOG_LEVEL'] ?? 'info';
  }
}
```

### **Step 3: API Client with Token Refresh** (15 minutes)

[See FLUTTER_ENV_CONFIGURATION.md for complete api_client.dart code]

### **Step 4: Models** (20 minutes)

Create models for all entities:
- ClothModel
- OutfitModel
- QualityModel
- LaundryModel
- ProfileModel
- UserModel

### **Step 5: DataSources** (30 minutes)

Implement RemoteDataSource for:
- AuthDataSource
- ClothDataSource
- OutfitDataSource
- WeatherDataSource
- QualityDataSource
- LaundryDataSource
- ProfileDataSource
- UploadDataSource

### **Step 6: Repositories & UseCases** (40 minutes)

Implement repositories and use cases following domain-driven design.

### **Step 7: Riverpod Providers** (30 minutes)

Create providers for state management.

### **Step 8: Screens & UI** (ongoing)

Build UI screens using providers.

---

## ✅ Testing Before Launch

```dart
// Test 1: Health check
curl https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/health

// Expected: 200 OK with healthy response

// Test 2: Login flow
POST /auth/login
{
  "email": "test@example.com",
  "password": "testpass123"
}

// Expected: 200 OK with accessToken + refreshToken

// Test 3: Get clothes
GET /clothes
Authorization: Bearer <accessToken>

// Expected: 200 OK with clothes array

// Test 4: Create outfit suggestion
POST /outfits
{
  "occasionId": "formal",
  "preferences": {...},
  "clothIds": ["cloth1", "cloth2"]
}

// Expected: 200 OK with outfit suggestions
```

---

## 🔒 Security Checklist for Frontend

- [ ] No API keys in code or .env
- [ ] flutter_secure_storage for tokens
- [ ] Authorization header on protected routes
- [ ] Token refresh on 401 error
- [ ] Exponential backoff on 429 error
- [ ] Input validation before API call
- [ ] Error messages don't leak details
- [ ] Logging disabled in release build
- [ ] No logging of sensitive data
- [ ] .env in .gitignore

---

## 📱 What Frontend Developers Should Know

1. **Backend URL**: `https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1`
2. **No external API keys needed** — backend handles all
3. **All responses follow standard format** (success, message, data, pagination, timestamp)
4. **Token expires in 7 days** — implement refresh logic
5. **Rate limit**: 120 requests per 15 minutes
6. **Status codes**: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Server Error

---

## 📞 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `Connection refused` | Verify backend URL is correct |
| `401 Unauthorized` | Implement token refresh |
| `CORS error` | Backend already configured with CORS |
| `404 endpoint` | Check API path and HTTP method |
| `Timeout` | Increase Dio timeout, check network |
| `.env not loaded` | Call `await EnvironmentConfig.initialize()` in main |

---

**Your complete frontend setup is ready to build!** 🎉

All backend endpoints are documented, all environment variables are configured, and all security practices are in place.
