# Flutter Frontend .env Configuration

## 📋 Copy-Paste This Into Your Flutter Project

### **Location**: `lib/.env` or root `.lib/.env` depending on your flutter_dotenv setup

---

## 🔧 EXACT ENV SETTINGS (Copy-Paste This)

```env
# ========== BACKEND API (REQUIRED) ==========
# Your live Azure backend — all API calls go here
BACKEND_URL=https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1

# ========== FIREBASE CONFIG (REQUIRED) ==========
# Public Firebase project config (NOT SECRET - safe to expose)
FIREBASE_PROJECT_ID=vastra-7f311
FIREBASE_AUTH_DOMAIN=vastra-7f311.firebaseapp.com
FIREBASE_DATABASE_URL=https://vastra-7f311.firebaseio.com
FIREBASE_STORAGE_BUCKET=vastra-7f311.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id

# ========== IMAGE UPLOAD (REQUIRED) ==========
# Cloudinary account name (NOT SECRET - just account name)
CLOUDINARY_CLOUD_NAME=vastraRoot

# ========== OPTIONAL: LOGGING & FEATURES ==========
# Log level: debug, info, warn, error
LOG_LEVEL=info

# Enable/disable analytics
ENABLE_ANALYTICS=true

# Enable/disable crash reporting
ENABLE_CRASH_REPORTING=true
```

---

## 📖 What Each Variable Does

| Variable | Purpose | Can Expose? | Example |
|----------|---------|---|---------|
| `BACKEND_URL` | Base URL for all API calls | ✅ YES | `https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1` |
| `FIREBASE_PROJECT_ID` | Firebase project identifier | ✅ YES | `vastra-7f311` |
| `FIREBASE_AUTH_DOMAIN` | Firebase auth domain | ✅ YES | `vastra-7f311.firebaseapp.com` |
| `FIREBASE_DATABASE_URL` | Realtime DB URL | ✅ YES | `https://vastra-7f311.firebaseio.com` |
| `FIREBASE_STORAGE_BUCKET` | Cloud Storage bucket | ✅ YES | `vastra-7f311.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID | ✅ YES | (from Firebase) |
| `FIREBASE_APP_ID` | Firebase app identifier | ✅ YES | (from Firebase) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name | ✅ YES | `vastraRoot` |
| `LOG_LEVEL` | Verbosity of logs | ✅ YES | `info` |
| `ENABLE_ANALYTICS` | Enable Firebase Analytics | ✅ YES | `true` |
| `ENABLE_CRASH_REPORTING` | Enable Crash Reporting | ✅ YES | `true` |

---

## ⚠️ What NOT to Add

These should NEVER be in frontend `.env`:
```env
# ❌ NEVER add these:
OPENWEATHER_API_KEY=...      # Backend calls OpenWeather
GEMINI_API_KEY=...            # Backend calls Gemini
MISTRAL_API_KEY=...           # Backend calls Mistral
CLOUDINARY_API_SECRET=...     # Backend uploads to Cloudinary
FIREBASE_PRIVATE_KEY=...      # Backend only!
JWT_SECRET=...                # Backend only!
```

**Why?** Backend handles these securely. Frontend doesn't need them.

---

## 🚀 How to Set Up

### **Step 1: Create `.env` File**

In your Flutter project root or `lib/` folder:

```bash
# Option 1: In project root
touch .env

# Option 2: In lib folder
touch lib/.env
```

### **Step 2: Paste the Env Settings**

Copy the section above (from `BACKEND_URL=...` to the last variable) into your `.env` file.

### **Step 3: Verify pubspec.yaml**

Make sure your `pubspec.yaml` has flutter_dotenv:

```yaml
dev_dependencies:
  flutter_dotenv: ^5.1.0

flutter:
  assets:
    - .env
```

### **Step 4: Update main.dart**

Your `main.dart` should load the env before running the app:

```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Load .env file
  await dotenv.load(fileName: '.env');
  
  // Initialize Firebase
  await Firebase.initializeApp();
  
  // Initialize Isar
  await Isar.initialize();
  
  // Run app
  runApp(const MyApp());
}
```

### **Step 5: Access in Code**

In your `environment.dart` or where you read config:

```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

class EnvironmentConfig {
  static String get backendUrl => dotenv.env['BACKEND_URL'] ?? '';
  static String get firebaseProjectId => dotenv.env['FIREBASE_PROJECT_ID'] ?? '';
  static String get cloudinaryCloudName => dotenv.env['CLOUDINARY_CLOUD_NAME'] ?? '';
  static String get logLevel => dotenv.env['LOG_LEVEL'] ?? 'info';
}
```

Then use in your API client:

```dart
final dio = Dio(
  BaseOptions(
    baseUrl: EnvironmentConfig.backendUrl,
    // ...
  ),
);
```

---

## ✅ Step-by-Step: From Zero to Running

### **1. Create `.env` File**
```bash
cd /path/to/your/flutter/project
touch .env
```

### **2. Copy Env Settings**
Paste the exact settings from above into `.env`

### **3. Update main.dart**
Add `await dotenv.load()` before app runs

### **4. Update environment.dart**
Create getters for each env variable

### **5. Update api_client.dart**
Use `EnvironmentConfig.backendUrl` as Dio baseUrl

### **6. Get Firebase Config**
- Go to: Firebase Console → Project Settings
- Download `google-services.json` (Android)
- Download `GoogleService-Info.plist` (iOS)
- Place in correct project folders

### **7. Run Flutter**
```bash
flutter pub get
flutter run
```

---

## 🔍 Get Firebase IDs (If Not Available)

If you don't have Firebase messaging sender ID or app ID:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `vastra-7f311`
3. Project Settings (gear icon)
4. Copy values:
   - **Project ID**: `vastra-7f311`
   - **Auth Domain**: `vastra-7f311.firebaseapp.com`
   - **Database URL**: `https://vastra-7f311.firebaseio.com`
   - **Storage Bucket**: `vastra-7f311.appspot.com`
   - **Messaging Sender ID**: Under `google-services.json`
   - **App ID**: Under `google-services.json`

---

## 🛠️ Minimal .env (Bare Minimum to Start)

If you don't have Firebase initially, start with just:

```env
BACKEND_URL=https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1
CLOUDINARY_CLOUD_NAME=vastraRoot
LOG_LEVEL=info
```

Then add Firebase config later.

---

## 🧪 Test It Works

After setting up `.env`, test your connection:

```dart
// In your app, make a test API call
final response = await Dio()
  .get('${EnvironmentConfig.backendUrl}/health');

print(response.data);
// Should print: {success: true, message: "Vastra backend is healthy", ...}
```

---

## 📋 Checklist Before Running

- [ ] `.env` file created in correct location (`lib/.env` or root)
- [ ] All env variables copied exactly as shown above
- [ ] `pubspec.yaml` includes `flutter_dotenv: ^5.1.0`
- [ ] `pubspec.yaml` assets includes `.env`
- [ ] `main.dart` calls `await dotenv.load()`
- [ ] `api_client.dart` uses `EnvironmentConfig.backendUrl`
- [ ] Firebase config files (`google-services.json` / `GoogleService-Info.plist`) added
- [ ] `flutter pub get` run
- [ ] Ready to run: `flutter run`

---

## 🆘 If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| `.env` file not loading | Check path is correct, run `flutter pub get` again |
| `backendUrl` returns null | Verify `.env` file exists and is in assets in `pubspec.yaml` |
| API returns CORS error | Your backend CORS is not set to your app domain (contact backend team) |
| Connection refused | Check `BACKEND_URL` is correct (copy from above exactly) |
| Firebase not initializing | Check `google-services.json` and `GoogleService-Info.plist` are in correct folders |

---

## 🎯 Summary

**Copy-paste the `.env` settings above, add to your Flutter project, and run!**

```bash
flutter run
```

That's it. Backend is live and waiting. ✅
