# Flutter Frontend Environment Configuration

Your backend is now live. Use these exact values in your Flutter `.env` file.

---

## 📝 `.env` File Setup

Create or update: **`lib/.env`** or **root `.env`** (depending on your flutter_dotenv setup)

```env
# ===== BACKEND API (CRITICAL) =====
# This must match your Azure backend domain
BACKEND_URL=https://your-app-name.azurewebsites.net/api/v1

# For local development (testing before Azure):
# BACKEND_URL=http://localhost:4000/api/v1

# ===== EXTERNAL APIS =====
# OpenWeather API (Weather suggestions)
OPENWEATHER_API_KEY=your-openweather-api-key
OPENWEATHER_BASE_URL=https://api.openweathermap.org/data/2.5

# ===== IMAGE UPLOAD =====
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name

# ===== OPTIONAL: AI PROVIDERS =====
# Only needed if implementing premium AI suggestions
GEMINI_API_KEY=
MISTRAL_API_KEY=

# ===== FIREBASE CONFIG =====
FIREBASE_PROJECT_ID=vastra-7f311

# ===== FEATURE FLAGS =====
ENABLE_ANALYTICS=true
ENABLE_CRASH_REPORTING=true
LOG_LEVEL=info
```

---

## 🔧 Load Environment Variables in Flutter

### Method 1: Using `flutter_dotenv` (Recommended)

**In `pubspec.yaml`:**
```yaml
dev_dependencies:
  flutter_dotenv: ^5.1.0
```

**In `lib/core/config/environment.dart`:**
```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

class EnvironmentConfig {
  static Future<void> initialize() async {
    await dotenv.load(
      fileName: '.env',
      // or specify path: 'assets/config/.env'
    );
  }

  // Getters for all environment variables
  static String get backendUrl {
    return dotenv.env['BACKEND_URL'] ?? 'http://localhost:4000/api/v1';
  }

  static String get openweatherApiKey {
    return dotenv.env['OPENWEATHER_API_KEY'] ?? '';
  }

  static String get openweatherBaseUrl {
    return dotenv.env['OPENWEATHER_BASE_URL'] ?? 'https://api.openweathermap.org/data/2.5';
  }

  static String get cloudinaryCloudName {
    return dotenv.env['CLOUDINARY_CLOUD_NAME'] ?? '';
  }

  static String get geminiApiKey {
    return dotenv.env['GEMINI_API_KEY'] ?? '';
  }

  static String get mistralApiKey {
    return dotenv.env['MISTRAL_API_KEY'] ?? '';
  }

  static String get firebaseProjectId {
    return dotenv.env['FIREBASE_PROJECT_ID'] ?? '';
  }

  static bool get enableAnalytics {
    return dotenv.env['ENABLE_ANALYTICS']?.toLowerCase() == 'true';
  }

  static bool get enableCrashReporting {
    return dotenv.env['ENABLE_CRASH_REPORTING']?.toLowerCase() == 'true';
  }

  static String get logLevel {
    return dotenv.env['LOG_LEVEL'] ?? 'info';
  }
}
```

**In `lib/main.dart`:**
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Load environment variables
  await EnvironmentConfig.initialize();
  
  // Initialize Firebase
  await Firebase.initializeApp();
  
  // Initialize Isar
  await Isar.initialize();
  
  // Setup service locator
  setupServiceLocator();
  
  runApp(const MyApp());
}
```

**In `pubspec.yaml` assets:**
```yaml
flutter:
  assets:
    - .env
```

---

### Method 2: Using `--dart-define` (Build-time)

For CI/CD or per-flavor configuration:

```bash
# Development
flutter run --dart-define=BACKEND_URL=http://localhost:4000/api/v1

# Production (Azure)
flutter run --dart-define=BACKEND_URL=https://your-app.azurewebsites.net/api/v1
```

Access in code:
```dart
const String backendUrl = String.fromEnvironment('BACKEND_URL');
```

---

### Method 3: Using `xcconfig` / `gradle` (Platform-specific)

For platform-specific environment variables (advanced):

**Android (`android/app/build.gradle`):**
```gradle
buildTypes {
  debug {
    buildConfigField "String", "BACKEND_URL", '"http://localhost:4000/api/v1"'
  }
  release {
    buildConfigField "String", "BACKEND_URL", '"https://your-app.azurewebsites.net/api/v1"'
  }
}
```

Access in Dart:
```dart
import 'package:your_app/generated_plugin_registrant.dart';

const String backendUrl = BuildConfig.BACKEND_URL;
```

---

## ⚙️ Configuration in `api_client.dart`

```dart
// lib/core/network/api_client.dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:vastra/core/config/environment.dart';

class ApiClient {
  late Dio _dio;
  final FlutterSecureStorage _secureStorage;

  ApiClient({required FlutterSecureStorage secureStorage})
      : _secureStorage = secureStorage {
    _initializeDio();
  }

  void _initializeDio() {
    _dio = Dio(
      BaseOptions(
        baseUrl: EnvironmentConfig.backendUrl, // Uses .env or --dart-define
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        contentType: Headers.jsonContentType,
        headers: {
          'Accept': 'application/json',
        },
      ),
    );

    // Request interceptor: Add JWT token
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler handler) async {
          final token = await _secureStorage.read(key: 'accessToken');
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },

        // Response interceptor: Handle errors
        onResponse: (Response response, ResponseInterceptorHandler handler) {
          // Check backend success flag
          if (response.data is Map<String, dynamic>) {
            final data = response.data as Map<String, dynamic>;
            if (data['success'] != true) {
              return handler.reject(
                DioException(
                  requestOptions: response.requestOptions,
                  response: response,
                  type: DioExceptionType.badResponse,
                  error: data['error'] ?? 'API returned success: false',
                ),
              );
            }
          }
          return handler.next(response);
        },

        // Error interceptor: Handle 401 and retry
        onError: (DioException error, ErrorInterceptorHandler handler) async {
          // Token expired (401)
          if (error.response?.statusCode == 401) {
            try {
              final newToken = await _refreshToken();
              if (newToken != null) {
                // Retry original request with new token
                final opts = error.requestOptions;
                opts.headers['Authorization'] = 'Bearer $newToken';
                final response = await _dio.request(
                  opts.path,
                  options: Options(
                    method: opts.method,
                    headers: opts.headers,
                  ),
                  data: opts.data,
                  queryParameters: opts.queryParameters,
                );
                return handler.resolve(response);
              }
            } catch (e) {
              // Refresh failed, logout user
              await _logout();
            }
          }

          // Rate limited
          if (error.response?.statusCode == 429) {
            // Implement exponential backoff
            await Future.delayed(const Duration(seconds: 2));
            final retryResponse = await _dio.request(
              error.requestOptions.path,
              options: Options(method: error.requestOptions.method),
            );
            return handler.resolve(retryResponse);
          }

          return handler.next(error);
        },
      ),
    );

    // Logging interceptor (development only)
    if (EnvironmentConfig.logLevel == 'debug') {
      _dio.interceptors.add(LoggingInterceptor());
    }
  }

  // Refresh access token
  Future<String?> _refreshToken() async {
    try {
      final refreshToken = await _secureStorage.read(key: 'refreshToken');
      if (refreshToken == null || refreshToken.isEmpty) {
        return null;
      }

      // Create temporary Dio instance without auth header
      final tempDio = Dio(
        BaseOptions(
          baseUrl: EnvironmentConfig.backendUrl,
          connectTimeout: const Duration(seconds: 10),
          contentType: Headers.jsonContentType,
        ),
      );

      final response = await tempDio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      if (response.statusCode == 200 && response.data['success'] == true) {
        final newAccessToken = response.data['data']['accessToken'];
        await _secureStorage.write(key: 'accessToken', value: newAccessToken);
        return newAccessToken;
      }
    } catch (e) {
      // Refresh failed
      print('Token refresh failed: $e');
    }
    return null;
  }

  // Logout and clear tokens
  Future<void> _logout() async {
    await _secureStorage.delete(key: 'accessToken');
    await _secureStorage.delete(key: 'refreshToken');
    // Trigger navigation to login screen (via your app's state management)
  }

  // Public methods
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.get<T>(path, queryParameters: queryParameters, options: options);

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.post<T>(path, data: data, queryParameters: queryParameters, options: options);

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.put<T>(path, data: data, queryParameters: queryParameters, options: options);

  Future<Response<T>> delete<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.delete<T>(path, queryParameters: queryParameters, options: options);
}

// Optional: Logging interceptor for debugging
class LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    print('→ ${options.method.toUpperCase()} ${options.path}');
    if (options.data != null) print('  Body: ${options.data}');
    super.onRequest(options, handler);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    print('← ${response.statusCode} ${response.requestOptions.path}');
    super.onResponse(response, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    print('✗ Error: ${err.message}');
    if (err.response != null) print('  Status: ${err.response?.statusCode}');
    super.onError(err, handler);
  }
}
```

---

## 🎯 Replace `your-app-name` Everywhere

Your backend domain:
- **Azure URL**: `https://your-app-name.azurewebsites.net`
- **API Base**: `https://your-app-name.azurewebsites.net/api/v1`

Find your actual app name in **Azure Portal → App Services → your-app-name**.

Replace all instances of `your-app-name` in:
1. ✅ This guide
2. ✅ `.env` file (BACKEND_URL)
3. ✅ `environment.dart` (backendUrl getter)
4. ✅ `api_client.dart` (BaseOptions baseUrl)

---

## 🌍 Multi-Environment Setup

For Development, Staging, and Production:

**`.env.dev`:**
```env
BACKEND_URL=http://localhost:4000/api/v1
LOG_LEVEL=debug
ENABLE_ANALYTICS=false
```

**`.env.stg`:**
```env
BACKEND_URL=https://vastra-staging.azurewebsites.net/api/v1
LOG_LEVEL=info
ENABLE_ANALYTICS=true
```

**`.env.prod`:**
```env
BACKEND_URL=https://vastra-api.azurewebsites.net/api/v1
LOG_LEVEL=warn
ENABLE_ANALYTICS=true
```

**In `main.dart`:**
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  const String environment = String.fromEnvironment('ENV', defaultValue: 'dev');
  await EnvironmentConfig.initialize(environment: environment);
  
  runApp(const MyApp());
}
```

**Run with:**
```bash
flutter run --dart-define=ENV=prod
```

---

## ✅ Pre-Deployment Checklist

- [ ] `.env` file created with correct `BACKEND_URL`
- [ ] `BACKEND_URL` points to Azure backend (not localhost)
- [ ] `api_client.dart` loads BACKEND_URL from `EnvironmentConfig`
- [ ] Token interceptor adds `Authorization: Bearer <token>` header
- [ ] Token refresh logic implemented for 401 errors
- [ ] Secure storage used for tokens (not SharedPreferences)
- [ ] Error handling converts backend error codes to UI messages
- [ ] `CORS_ORIGIN` in Azure includes your frontend app domain
- [ ] Rate limiting retry logic implemented
- [ ] Logging only enabled in debug mode

---

## 🚀 Testing Against Live Backend

```bash
# Build and run against Azure
flutter run --dart-define=BACKEND_URL=https://your-app-name.azurewebsites.net/api/v1

# Or use .env with flutter_dotenv
flutter run
```

**Test these flows:**
1. **Login** → Should receive tokens ✓
2. **Get Profile** → Should show user info ✓
3. **Add Cloth** → Should see it in wardrobe ✓
4. **Get Outfits** → Should get AI suggestions ✓
5. **Logout** → Should redirect to login ✓

---

## 🆘 Troubleshooting

| Issue | Debug Step |
|-------|-----------|
| `Connection refused` | Verify BACKEND_URL points to Azure, not localhost |
| `401 Unauthorized` | Check token in SecureStorage, implement refresh |
| `CORS error` | Verify frontend domain in Azure CORS_ORIGIN setting |
| `404 endpoint` | Check API path matches backend (case-sensitive) |
| `Timeout` | Increase Dio timeout, check network connectivity |
| `.env not loaded` | Verify `await dotenv.load()` called in main |

---

**You're all set! Deploy with confidence.** 🎉
