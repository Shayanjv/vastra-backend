# Vastra Backend API Contract for Frontend

**Backend URL**: `https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1`

---

## 📋 All Endpoints

### **Authentication (Public)**

#### 1. Signup
```
POST /auth/signup
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (201 Created):
{
  "success": true,
  "message": "Signup successful",
  "data": {
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "name": null,
      "createdAt": "2026-04-26T10:00:00Z"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  },
  "timestamp": "2026-04-26T10:00:00Z"
}

Error (400 Bad Request):
{
  "success": false,
  "message": "Email already registered",
  "error": "User with this email exists",
  "code": "USER_001",
  "timestamp": "2026-04-26T10:00:00Z"
}
```

#### 2. Login
```
POST /auth/login
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (200 OK):
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  },
  "timestamp": "2026-04-26T10:00:00Z"
}

Error (401 Unauthorized):
{
  "success": false,
  "message": "Invalid credentials",
  "error": "Email or password is incorrect",
  "code": "AUTH_003",
  "timestamp": "2026-04-26T10:00:00Z"
}
```

#### 3. Refresh Token
```
POST /auth/refresh
Content-Type: application/json

Request:
{
  "refreshToken": "eyJhbGc..."
}

Response (200 OK):
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGc..."
  },
  "timestamp": "2026-04-26T10:00:00Z"
}

Error (401 Unauthorized):
{
  "success": false,
  "message": "Refresh token expired",
  "error": "Please login again",
  "code": "AUTH_002",
  "timestamp": "2026-04-26T10:00:00Z"
}
```

---

### **Wardrobe Management (Auth Required)**

#### 1. Get All Clothes (Paginated)
```
GET /clothes?page=1&limit=20
Authorization: Bearer <accessToken>

Response (200 OK):
{
  "success": true,
  "message": "Clothes fetched successfully",
  "data": [
    {
      "id": "cloth-1",
      "name": "Blue Shirt",
      "description": "Cotton blue shirt",
      "materials": ["cotton"],
      "color": "blue",
      "imageUrl": "https://res.cloudinary.com/...",
      "createdAt": "2026-04-20T10:00:00Z",
      "updatedAt": "2026-04-25T15:30:00Z"
    },
    {
      "id": "cloth-2",
      "name": "Black Jeans",
      "description": "Slim fit jeans",
      "materials": ["denim"],
      "color": "black",
      "imageUrl": "https://res.cloudinary.com/...",
      "createdAt": "2026-04-18T10:00:00Z",
      "updatedAt": "2026-04-25T15:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  },
  "timestamp": "2026-04-26T10:00:00Z"
}

Error (401 Unauthorized):
{
  "success": false,
  "message": "Unauthorized",
  "error": "Invalid or expired token",
  "code": "AUTH_003",
  "timestamp": "2026-04-26T10:00:00Z"
}
```

#### 2. Add Cloth
```
POST /clothes
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "name": "Red T-Shirt",
  "description": "Cotton t-shirt",
  "materials": ["cotton"],
  "color": "red",
  "imageUrl": "https://res.cloudinary.com/..." (from /uploads endpoint)
}

Response (201 Created):
{
  "success": true,
  "message": "Cloth added successfully",
  "data": {
    "id": "cloth-123",
    "name": "Red T-Shirt",
    "description": "Cotton t-shirt",
    "materials": ["cotton"],
    "color": "red",
    "imageUrl": "https://res.cloudinary.com/...",
    "createdAt": "2026-04-26T10:00:00Z",
    "updatedAt": "2026-04-26T10:00:00Z"
  },
  "timestamp": "2026-04-26T10:00:00Z"
}
```

#### 3. Get Cloth Details
```
GET /clothes/:clothId
Authorization: Bearer <accessToken>

Response (200 OK):
{
  "success": true,
  "message": "Cloth fetched",
  "data": {
    "id": "cloth-123",
    "name": "Red T-Shirt",
    "description": "Cotton t-shirt",
    "materials": ["cotton"],
    "color": "red",
    "imageUrl": "https://res.cloudinary.com/...",
    "createdAt": "2026-04-26T10:00:00Z",
    "updatedAt": "2026-04-26T10:00:00Z"
  },
  "timestamp": "2026-04-26T10:00:00Z"
}
```

#### 4. Update Cloth
```
PUT /clothes/:clothId
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "name": "Red T-Shirt (Updated)",
  "color": "darkred"
}

Response (200 OK):
{
  "success": true,
  "message": "Cloth updated",
  "data": { ...updated cloth },
  "timestamp": "2026-04-26T10:00:00Z"
}
```

#### 5. Delete Cloth
```
DELETE /clothes/:clothId
Authorization: Bearer <accessToken>

Response (200 OK):
{
  "success": true,
  "message": "Cloth deleted successfully",
  "timestamp": "2026-04-26T10:00:00Z"
}
```

---

### **AI Outfit Suggestions (Auth Required)**

#### 1. Get Outfit Suggestions
```
POST /outfits
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "occasionId": "formal",
  "preferences": {
    "style": "modern",
    "comfort": "high",
    "colors": ["blue", "black"]
  },
  "clothIds": ["cloth-1", "cloth-2"],
  "lat": 28.7041,
  "lon": 77.1025
}

Response (200 OK):
{
  "success": true,
  "message": "Outfit suggestions generated",
  "data": {
    "outfits": [
      {
        "id": "outfit-1",
        "clothes": [
          { "id": "cloth-1", "name": "Blue Shirt", "imageUrl": "..." },
          { "id": "cloth-2", "name": "Black Jeans", "imageUrl": "..." }
        ],
        "reason": "Perfect formal outfit matching your preferences",
        "score": 95,
        "weather": "Sunny, 28°C"
      }
    ]
  },
  "timestamp": "2026-04-26T10:00:00Z"
}

Error (OUTFIT_001 - No clean clothes):
{
  "success": false,
  "message": "No clean clothes available",
  "error": "All clothes need washing",
  "code": "OUTFIT_001",
  "timestamp": "2026-04-26T10:00:00Z"
}
```

---

### **Weather (Public)**

#### Get Weather
```
GET /weather?lat=28.7041&lon=77.1025
(No auth required)

Response (200 OK):
{
  "success": true,
  "message": "Weather fetched",
  "data": {
    "city": "Delhi",
    "temperature": 28,
    "humidity": 65,
    "condition": "Sunny",
    "windSpeed": 12,
    "feelsLike": 30
  },
  "timestamp": "2026-04-26T10:00:00Z"
}
```

---

### **Image Upload (Auth Required)**

#### Upload Image
```
POST /uploads
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

Request:
FormData {
  "file": <image file from image_picker>
}

Response (201 Created):
{
  "success": true,
  "message": "Image uploaded",
  "data": {
    "url": "https://res.cloudinary.com/vastraRoot/image/upload/v123/...",
    "publicId": "vastra/cloth-photo-123"
  },
  "timestamp": "2026-04-26T10:00:00Z"
}

Error (UPLOAD_002 - Invalid file type):
{
  "success": false,
  "message": "Invalid file type",
  "error": "Only PNG, JPG, JPEG allowed",
  "code": "UPLOAD_002",
  "timestamp": "2026-04-26T10:00:00Z"
}
```

---

### **Quality Scoring (Auth Required)**

#### Get Quality Score
```
GET /quality/:clothId
Authorization: Bearer <accessToken>

Response (200 OK):
{
  "success": true,
  "message": "Quality score calculated",
  "data": {
    "clothId": "cloth-123",
    "currentScore": 85,
    "degradationRate": 2.5,
    "estimatedRemainingMonths": 8,
    "recommendation": "Consider washing carefully, avoid bleach"
  },
  "timestamp": "2026-04-26T10:00:00Z"
}
```

---

### **Laundry Tracking (Auth Required)**

#### Get Laundry Status
```
GET /laundry
Authorization: Bearer <accessToken>

Response (200 OK):
{
  "success": true,
  "message": "Laundry status fetched",
  "data": [
    {
      "id": "laundry-1",
      "clothId": "cloth-1",
      "clothName": "Blue Shirt",
      "lastWashed": "2026-04-20T10:00:00Z",
      "daysSinceWash": 6,
      "washCount": 12,
      "needsWashing": false
    },
    {
      "id": "laundry-2",
      "clothId": "cloth-2",
      "clothName": "Black Jeans",
      "lastWashed": "2026-04-15T10:00:00Z",
      "daysSinceWash": 11,
      "washCount": 8,
      "needsWashing": true
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 2 },
  "timestamp": "2026-04-26T10:00:00Z"
}
```

#### Log Wash
```
POST /laundry
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "clothId": "cloth-1",
  "washType": "hand_wash" (or "machine_wash", "dry_clean")
}

Response (201 Created):
{
  "success": true,
  "message": "Wash logged",
  "data": {
    "id": "laundry-1",
    "clothId": "cloth-1",
    "lastWashed": "2026-04-26T10:00:00Z",
    "washCount": 13
  },
  "timestamp": "2026-04-26T10:00:00Z"
}
```

---

### **User Profile (Auth Required)**

#### Get Profile
```
GET /users/profile
Authorization: Bearer <accessToken>

Response (200 OK):
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+91-9876543210",
    "preferences": {
      "style": "modern",
      "skinTone": "medium",
      "favoriteColors": ["blue", "black"]
    },
    "createdAt": "2026-04-20T10:00:00Z",
    "updatedAt": "2026-04-26T10:00:00Z"
  },
  "timestamp": "2026-04-26T10:00:00Z"
}
```

#### Update Profile
```
PUT /users/profile
Authorization: Bearer <accessToken>
Content-Type: application/json

Request:
{
  "name": "John Doe",
  "phone": "+91-9876543210",
  "preferences": {
    "style": "casual",
    "skinTone": "medium",
    "favoriteColors": ["blue", "white", "black"]
  }
}

Response (200 OK):
{
  "success": true,
  "message": "Profile updated",
  "data": { ...updated profile },
  "timestamp": "2026-04-26T10:00:00Z"
}
```

---

## 🔑 Token Management

### Store Tokens
```dart
// After login or signup, store tokens
await secureStorage.write(key: 'accessToken', value: response.accessToken);
await secureStorage.write(key: 'refreshToken', value: response.refreshToken);
```

### Use Token in Requests
```dart
// Dio interceptor auto-adds this
final token = await secureStorage.read(key: 'accessToken');
headers['Authorization'] = 'Bearer $token';
```

### Token Expiry
- **Access Token**: 7 days
- **Refresh Token**: 30 days
- When 401 received → Call `/auth/refresh` with refresh token
- If refresh fails → Clear tokens and redirect to login

---

## ⚠️ Error Codes Reference

| Code | Meaning | Action |
|------|---------|--------|
| `AUTH_001` | Invalid Firebase token | Logout user |
| `AUTH_002` | Token expired | Refresh token |
| `AUTH_003` | Unauthorized | Add Authorization header |
| `USER_001` | User not found | Redirect to signup |
| `CLOTH_001` | Cloth not found | Remove from list |
| `CLOTH_002` | Max clothes limit | Show error message |
| `OUTFIT_001` | No clean clothes | Show "Wash clothes" suggestion |
| `QUALITY_001` | Quality not calculated | Try again |
| `UPLOAD_001` | Image upload failed | Retry with different image |
| `UPLOAD_002` | Invalid file type | Show file type error |

---

## 📊 Response Format

**All responses follow this structure:**

```json
{
  "success": true/false,
  "message": "Human-readable message",
  "data": {} or [] or null,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  },
  "error": "Technical error (on failure only)",
  "code": "ERROR_CODE (on failure only)",
  "timestamp": "ISO 8601 timestamp"
}
```

---

## 🌐 Base URL

```
https://vastra-backend-fyefd2emhra7a8gg.centralindia-01.azurewebsites.net/api/v1
```

---

## 📝 Frontend Integration Rules

1. **Authorization**: Add `Authorization: Bearer <token>` to all protected routes
2. **Content-Type**: Always `application/json` except `/uploads` (multipart/form-data)
3. **Pagination**: Default page=1, limit=20. Adjust as needed
4. **Error Handling**: Check `success` flag first, then handle error codes
5. **Token Refresh**: On 401 error, refresh token and retry request
6. **Rate Limiting**: On 429 error, implement exponential backoff
7. **Caching**: Cache appropriately (weather 1h, outfit 30m, clothes 5m)
8. **Timeouts**: Set 10-second timeout for API calls
9. **Offline**: Show cached data, sync when online
10. **Validation**: Validate inputs before sending to backend

---

**Your complete API contract is ready! Start building!** 🚀
