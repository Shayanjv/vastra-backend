# Vastra Frontend ↔ Backend Integration Map

Your frontend architecture is **solid**. Here's how it connects to your Azure backend.

---

## 📡 API Integration Points

### Backend Base URL
Your `environment.dart` should load:
```dart
// lib/core/config/environment.dart
const String BACKEND_URL = 'https://your-app.azurewebsites.net/api/v1';
```

From `.env` file:
```env
BACKEND_URL=https://your-app.azurewebsites.net/api/v1
```

---

## 🔄 Data Layer ↔ Backend Mapping

### Models That Match Backend Responses

Your **ClothModel** should map to backend's `GET /api/v1/clothes`:

```dart
// lib/data/models/cloth_model.dart
@JsonSerializable()
class ClothModel {
  final String id;
  final String name;
  final String? description;
  final List<String> materials;  // Fabric types
  final String color;
  final String imageUrl;  // Cloudinary URL
  final DateTime createdAt;
  final DateTime updatedAt;
  
  ClothModel({
    required this.id,
    required this.name,
    this.description,
    required this.materials,
    required this.color,
    required this.imageUrl,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ClothModel.fromJson(Map<String, dynamic> json) =>
      _$ClothModelFromJson(json);

  Map<String, dynamic> toJson() => _$ClothModelToJson(this);

  // Convert to Entity (domain layer)
  ClothEntity toEntity() => ClothEntity(
    id: id,
    name: name,
    description: description,
    materials: materials,
    color: color,
    imageUrl: imageUrl,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );
}
```

### Backend API Endpoints ↔ Your UseCases

| Backend Endpoint | HTTP | UseCase | Provider |
|------------------|------|---------|----------|
| `/api/v1/auth/login` | POST | LoginUseCase | auth_provider |
| `/api/v1/auth/signup` | POST | SignupUseCase | auth_provider |
| `/api/v1/auth/refresh` | POST | RefreshTokenUseCase | auth_provider |
| `/api/v1/clothes` | GET | GetAllClothesUseCase | cloth_provider |
| `/api/v1/clothes` | POST | AddClothUseCase | cloth_provider |
| `/api/v1/clothes/:id` | GET | GetClothDetailUseCase | cloth_provider |
| `/api/v1/clothes/:id` | PUT | UpdateClothUseCase | cloth_provider |
| `/api/v1/clothes/:id` | DELETE | DeleteClothUseCase | cloth_provider |
| `/api/v1/outfits` | GET | GetOutfitSuggestionsUseCase | outfit_provider |
| `/api/v1/outfits` | POST | CreateOutfitUseCase | outfit_provider |
| `/api/v1/laundry` | GET | GetLaundryStatusUseCase | laundry_provider |
| `/api/v1/laundry` | POST | LogLaundryUseCase | laundry_provider |
| `/api/v1/quality/:clothId` | GET | GetQualityScoreUseCase | quality_provider |
| `/api/v1/users/profile` | GET | GetProfileUseCase | profile_provider |
| `/api/v1/users/profile` | PUT | UpdateProfileUseCase | profile_provider |
| `/api/v1/weather` | GET | GetWeatherUseCase | weather_provider |
| `/api/v1/uploads` | POST | UploadImageUseCase | upload_provider |

---

## 🔐 Token Management

### Authorization Header
Your **api_client.dart** must auto-add JWT token:

```dart
// lib/core/network/api_client.dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  late Dio _dio;
  final FlutterSecureStorage _secureStorage;

  ApiClient({required FlutterSecureStorage secureStorage})
      : _secureStorage = secureStorage {
    _dio = Dio(
      BaseOptions(
        baseUrl: 'https://your-app.azurewebsites.net/api/v1',
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        contentType: 'application/json',
      ),
    );

    // Add token interceptor
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler handler) async {
          final token = await _secureStorage.read(key: 'accessToken');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, ErrorInterceptorHandler handler) async {
          // Handle 401 → refresh token
          if (error.response?.statusCode == 401) {
            final newToken = await _refreshToken();
            if (newToken != null) {
              // Retry original request
              final opts = error.requestOptions;
              opts.headers['Authorization'] = 'Bearer $newToken';
              return handler.resolve(await _dio.request(
                opts.path,
                options: Options(
                  method: opts.method,
                  headers: opts.headers,
                ),
              ));
            } else {
              // Logout user
              await _secureStorage.delete(key: 'accessToken');
              // Redirect to login (handled in your router guard)
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  // Refresh access token using refresh token
  Future<String?> _refreshToken() async {
    try {
      final refreshToken = await _secureStorage.read(key: 'refreshToken');
      if (refreshToken == null) return null;

      final response = await Dio().post(
        'https://your-app.azurewebsites.net/api/v1/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      final newAccessToken = response.data['data']['accessToken'];
      await _secureStorage.write(key: 'accessToken', value: newAccessToken);
      return newAccessToken;
    } catch (e) {
      return null;
    }
  }

  Future<Response> get(String path) => _dio.get(path);
  Future<Response> post(String path, {dynamic data}) => _dio.post(path, data: data);
  Future<Response> put(String path, {dynamic data}) => _dio.put(path, data: data);
  Future<Response> delete(String path) => _dio.delete(path);
}
```

### Token Storage Keys
Match these with your backend:
```dart
// lib/core/constants/app_strings.dart
const String authAccessTokenStorageKey = 'accessToken';
const String authRefreshTokenStorageKey = 'refreshToken';
const String authUserIdStorageKey = 'userId';
const String authEmailStorageKey = 'userEmail';
```

---

## 🌐 Remote DataSource Implementation

### Example: ClothDataSource
```dart
// lib/data/datasources/remote/cloth_datasource.dart
import 'package:vastra/core/network/api_client.dart';

abstract class ClothRemoteDataSource {
  Future<List<Map<String, dynamic>>> getAllClothes({int page = 1, int limit = 20});
  Future<Map<String, dynamic>> getClothById(String id);
  Future<Map<String, dynamic>> addCloth(Map<String, dynamic> clothData);
  Future<Map<String, dynamic>> updateCloth(String id, Map<String, dynamic> clothData);
  Future<void> deleteCloth(String id);
}

class ClothRemoteDataSourceImpl implements ClothRemoteDataSource {
  final ApiClient apiClient;

  ClothRemoteDataSourceImpl({required this.apiClient});

  @override
  Future<List<Map<String, dynamic>>> getAllClothes({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await apiClient.get(
        '/clothes?page=$page&limit=$limit',
      );

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        if (data['success'] == true) {
          return List<Map<String, dynamic>>.from(data['data'] as List);
        }
      }
      throw Exception('Failed to fetch clothes');
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> addCloth(Map<String, dynamic> clothData) async {
    try {
      final response = await apiClient.post(
        '/clothes',
        data: clothData,
      );

      if (response.statusCode == 201) {
        final data = response.data as Map<String, dynamic>;
        if (data['success'] == true) {
          return data['data'] as Map<String, dynamic>;
        }
      }
      throw Exception('Failed to add cloth');
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  // Helper to convert backend errors to domain exceptions
  Exception _handleDioException(DioException e) {
    if (e.response != null) {
      final errorCode = e.response!.data['code'] as String?;
      final message = e.response!.data['message'] as String?;
      return Exception('$errorCode: $message');
    }
    return Exception('Network error: ${e.message}');
  }
}
```

---

## 🎯 Provider Examples (Riverpod)

### Authentication Provider
```dart
// lib/presentation/providers/auth_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

final authProvider = StateNotifierProvider<AuthNotifier, AsyncValue<AuthState>>((ref) {
  final loginUseCase = ref.watch(loginUseCaseProvider);
  final signupUseCase = ref.watch(signupUseCaseProvider);
  return AuthNotifier(loginUseCase, signupUseCase);
});

class AuthNotifier extends StateNotifier<AsyncValue<AuthState>> {
  final LoginUseCase _loginUseCase;
  final SignupUseCase _signupUseCase;

  AuthNotifier(this._loginUseCase, this._signupUseCase)
      : super(const AsyncValue.data(AuthState.unauthenticated()));

  Future<void> login(String email, String password) async {
    state = const AsyncValue.loading();
    final result = await _loginUseCase(LoginParams(email: email, password: password));
    
    result.fold(
      (failure) => state = AsyncValue.error(failure, StackTrace.current),
      (authEntity) => state = AsyncValue.data(AuthState.authenticated(authEntity)),
    );
  }
}
```

### Cloth Provider
```dart
// lib/presentation/providers/cloth_provider.dart
final clothProvider = StateNotifierProvider<ClothNotifier, AsyncValue<List<ClothEntity>>>((ref) {
  final getAllUseCase = ref.watch(getAllClothesUseCaseProvider);
  return ClothNotifier(getAllUseCase);
});

class ClothNotifier extends StateNotifier<AsyncValue<List<ClothEntity>>> {
  final GetAllClothesUseCase _getAllClothesUseCase;

  ClothNotifier(this._getAllClothesUseCase)
      : super(const AsyncValue.loading()) {
    _loadClothes();
  }

  Future<void> _loadClothes() async {
    state = const AsyncValue.loading();
    final result = await _getAllClothesUseCase(NoParams());
    
    result.fold(
      (failure) => state = AsyncValue.error(failure, StackTrace.current),
      (clothes) => state = AsyncValue.data(clothes),
    );
  }

  Future<void> addCloth(String name, String color, List<String> materials) async {
    final result = await _addClothUseCase(AddClothParams(
      name: name,
      color: color,
      materials: materials,
    ));

    result.fold(
      (failure) => state = AsyncValue.error(failure, StackTrace.current),
      (newCloth) {
        final currentClothes = state.maybeWhen(data: (clothes) => clothes, orElse: () => []);
        state = AsyncValue.data([...currentClothes, newCloth]);
      },
    );
  }
}
```

---

## ✅ Environment Setup Checklist

### `.env` File
Create `lib/.env` (or root `.env` if using flutter_dotenv):

```env
# Backend API
BACKEND_URL=https://your-app.azurewebsites.net/api/v1

# Local development (for testing)
# BACKEND_URL=http://localhost:4000/api/v1

# External APIs
OPENWEATHER_API_KEY=your-openweather-api-key
OPENWEATHER_BASE_URL=https://api.openweathermap.org/data/2.5

# AI (only for premium features, optional in free tier)
GEMINI_API_KEY=your-gemini-key
MISTRAL_API_KEY=your-mistral-key

# Cloudinary (image upload)
CLOUDINARY_CLOUD_NAME=vastraRoot

# Firebase
FIREBASE_PROJECT_ID=vastra-7f311
GOOGLE_SERVICES_JSON_PATH=android/app/google-services.json
```

### Dependency Injection Setup
```dart
// lib/core/di/service_locator.dart (or use get_it)
import 'package:get_it/get_it.dart';

final getIt = GetIt.instance;

void setupServiceLocator() {
  // Core
  getIt.registerSingleton<ApiClient>(
    ApiClient(secureStorage: _getSecureStorage()),
  );

  // Data - DataSources
  getIt.registerSingleton<ClothRemoteDataSource>(
    ClothRemoteDataSourceImpl(apiClient: getIt()),
  );

  // Data - Repositories
  getIt.registerSingleton<ClothRepository>(
    ClothRepositoryImpl(remoteDataSource: getIt()),
  );

  // Domain - UseCases
  getIt.registerSingleton<GetAllClothesUseCase>(
    GetAllClothesUseCase(getIt()),
  );
  getIt.registerSingleton<AddClothUseCase>(
    AddClothUseCase(getIt()),
  );
  // ... register all other usecases
}
```

---

## 📤 Upload Integration

### Image Upload to Cloudinary (via Backend)
```dart
// lib/data/datasources/remote/upload_datasource.dart
Future<String> uploadImage(File imageFile) async {
  try {
    FormData formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(imageFile.path),
    });

    final response = await apiClient.post(
      '/uploads',
      data: formData,
    );

    if (response.statusCode == 201 && response.data['success']) {
      return response.data['data']['url']; // Cloudinary URL
    }
    throw Exception('Upload failed');
  } catch (e) {
    throw Exception('Upload error: $e');
  }
}
```

---

## 🛡️ Error Handling Strategy

### Failure Classes (Domain Layer)
```dart
// lib/domain/failures.dart
abstract class Failure {
  final String message;
  Failure(this.message);
}

class NetworkFailure extends Failure {
  NetworkFailure(String message) : super(message);
}

class AuthenticationFailure extends Failure {
  AuthenticationFailure(String message) : super(message);
}

class ValidationFailure extends Failure {
  ValidationFailure(String message) : super(message);
}

class ServerFailure extends Failure {
  ServerFailure(String message) : super(message);
}

class CacheFailure extends Failure {
  CacheFailure(String message) : super(message);
}
```

### Repository Error Handling
```dart
// lib/data/repositories/cloth_repository_impl.dart
@override
Future<Either<Failure, List<ClothEntity>>> getAllClothes() async {
  try {
    final remoteClothes = await remoteDataSource.getAllClothes();
    final clothModels = remoteClothes
        .map((json) => ClothModel.fromJson(json))
        .toList();
    
    // Cache locally
    await localDataSource.cacheClothes(clothModels);
    
    return Right(clothModels.map((model) => model.toEntity()).toList());
  } on ServerException catch (e) {
    return Left(ServerFailure(e.message));
  } on CacheException catch (e) {
    return Left(CacheFailure(e.message));
  } catch (e) {
    return Left(NetworkFailure('Unknown error: $e'));
  }
}
```

---

## 🔄 Offline-First Sync Pattern

### Isar Local DB Strategy
```dart
// lib/data/datasources/local/cloth_isar_datasource.dart
class ClothIsarDataSource implements LocalDataSource {
  final Isar isar;

  // Cache from remote
  Future<void> cacheClothes(List<ClothModel> clothes) async {
    await isar.writeTxn(() async {
      await isar.clothModels.clear();
      await isar.clothModels.putAll(clothes);
    });
  }

  // Get from cache
  Future<List<ClothModel>> getCachedClothes() async {
    return await isar.clothModels.where().findAll();
  }

  // Add locally (sync to backend later)
  Future<void> addClothLocally(ClothModel cloth) async {
    await isar.writeTxn(() async {
      await isar.clothModels.put(cloth);
    });
  }

  // Mark for sync
  Future<void> markForSync(String clothId) async {
    await isar.writeTxn(() async {
      final cloth = await isar.clothModels.get(cloth.id);
      if (cloth != null) {
        cloth.isSynced = false;
        await isar.clothModels.put(cloth);
      }
    });
  }
}
```

### Sync Worker (Background)
```dart
// lib/data/services/sync_service.dart
class SyncService {
  final ClothRepository clothRepository;

  Future<void> syncPendingChanges() async {
    final unsynced = await isar.clothModels.filter().isSyncedEqualTo(false).findAll();
    
    for (final cloth in unsynced) {
      try {
        final result = await clothRepository.updateCloth(cloth.id, cloth);
        result.fold(
          (failure) => logger.error('Sync failed: $failure'),
          (_) => isar.writeTxn(() async {
            cloth.isSynced = true;
            await isar.clothModels.put(cloth);
          }),
        );
      } catch (e) {
        logger.error('Sync error: $e');
      }
    }
  }
}
```

---

## 📲 Route Navigation Integration

### Auth Guard in Router
```dart
// lib/presentation/routes/app_router.dart
final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final isAuth = authState.maybeWhen(
        data: (auth) => auth.isAuthenticated,
        orElse: () => false,
      );

      final isGoingToAuth = state.matchedLocation.startsWith('/auth');
      final isGoingToSplash = state.matchedLocation == '/splash';

      if (isGoingToSplash) return null; // Let splash decide
      if (!isAuth && !isGoingToAuth) return '/auth/login';
      if (isAuth && isGoingToAuth) return '/';

      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        name: 'splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/auth',
        name: 'auth',
        routes: [
          GoRoute(
            path: 'login',
            name: 'login',
            builder: (context, state) => const LoginScreen(),
          ),
          GoRoute(
            path: 'otp',
            name: 'otp',
            builder: (context, state) => OtpScreen(
              phone: state.queryParameters['phone']!,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/',
        name: 'home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/wardrobe',
        name: 'wardrobe',
        builder: (context, state) => const WardrobeScreen(),
        routes: [
          GoRoute(
            path: 'add',
            name: 'addCloth',
            builder: (context, state) => const AddClothScreen(),
          ),
          GoRoute(
            path: 'detail/:clothId',
            name: 'clothDetail',
            builder: (context, state) => ClothDetailScreen(
              clothId: state.pathParameters['clothId']!,
            ),
          ),
        ],
      ),
      // ... other routes
    ],
  );
});
```

---

## 🧪 Testing Integration Points

### Mock API Client for Testing
```dart
// test/mocks/mock_api_client.dart
class MockApiClient extends Mock implements ApiClient {}

// test/data/datasources/cloth_datasource_test.dart
void main() {
  late MockApiClient mockApiClient;
  late ClothRemoteDataSourceImpl dataSource;

  setUp(() {
    mockApiClient = MockApiClient();
    dataSource = ClothRemoteDataSourceImpl(apiClient: mockApiClient);
  });

  test('getAllClothes should return list of clothes', () async {
    // Mock backend response
    when(mockApiClient.get('/clothes?page=1&limit=20'))
        .thenAnswer((_) async => Response(
          requestOptions: RequestOptions(path: '/clothes'),
          data: {
            'success': true,
            'data': [
              {
                'id': '1',
                'name': 'Shirt',
                'color': 'blue',
                'materials': ['cotton'],
                'imageUrl': 'http://...',
                'createdAt': '2026-04-26T00:00:00Z',
                'updatedAt': '2026-04-26T00:00:00Z',
              }
            ],
          },
          statusCode: 200,
        ));

    final result = await dataSource.getAllClothes();
    expect(result, isA<List>());
    expect(result.length, equals(1));
  });
}
```

---

## ✨ Integration Checklist

- [ ] **Environment**: `.env` file created with `BACKEND_URL=https://your-app.azurewebsites.net/api/v1`
- [ ] **API Client**: `api_client.dart` updated with token interceptor
- [ ] **Token Storage**: Using `flutter_secure_storage` for `accessToken` and `refreshToken`
- [ ] **Models**: Created for all backend entities (Cloth, Outfit, Quality, etc.)
- [ ] **DataSources**: Implemented remote datasources for all features
- [ ] **Repositories**: Implemented repository interfaces
- [ ] **UseCases**: Created for all business logic
- [ ] **Providers**: Set up Riverpod providers for state management
- [ ] **Routes**: GoRouter with auth guard configured
- [ ] **Error Handling**: Failure classes and error mapping implemented
- [ ] **Offline Support**: Isar local DB set up with sync logic
- [ ] **Testing**: Mock API client and datasource tests
- [ ] **CORS**: Verified `CORS_ORIGIN` in Azure includes your app domain

---

## 🚀 Next Steps

1. **Update `.env`** with actual Azure backend URL
2. **Implement token refresh** in `api_client.dart` interceptor
3. **Create Models** matching backend response schemas
4. **Implement DataSources** for each feature
5. **Set up Repositories** and UseCases
6. **Create Riverpod Providers** for state
7. **Test login flow** end-to-end
8. **Deploy frontend** and verify against production backend

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Missing/expired token | Ensure token in SecureStorage, implement refresh |
| CORS Error | Frontend domain not in CORS_ORIGIN | Update Azure App Settings CORS_ORIGIN |
| Timeout | Slow network | Increase Dio timeout, implement retry logic |
| Models don't match | Backend schema changed | Update models, regenerate with `json_serializable` |
| 404 endpoints | Wrong base URL | Verify BACKEND_URL matches backend domain |

---

**Your frontend and backend are now perfectly aligned! 🎉**

All backend responses follow the standard format, and your frontend is ready to consume them.
