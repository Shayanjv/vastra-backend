# Frontend Integration Guide for Vastra Backend

Your backend is now live on Azure. Follow this guide to connect your frontend.

---

## **Quick Start (2 minutes)**

### 1. Get Your Backend URL
Your backend is running at:
```
https://your-app-name.azurewebsites.net
```

Replace `your-app-name` with your actual Azure App Service name.

### 2. Set Frontend Environment Variable
Create `.env.local` in your frontend project:
```env
REACT_APP_API_URL=https://your-app-name.azurewebsites.net/api/v1
VITE_API_URL=https://your-app-name.azurewebsites.net/api/v1  # For Vite/Next.js
```

### 3. Make API Calls
```javascript
const API_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL;

// Example: Get user profile
const response = await fetch(`${API_URL}/users/profile`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});
```

---

## **Complete Setup by Framework**

### **React (Create React App)**

#### Install Axios (Optional but Recommended)
```bash
npm install axios
```

#### Create API Service (src/services/api.ts)
```typescript
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

// Add JWT token to all requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (refresh token)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired — refresh it
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken
          });
          localStorage.setItem('accessToken', data.data.accessToken);
          // Retry original request
          return apiClient(error.config);
        } catch {
          // Refresh failed — redirect to login
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

#### Use in Components
```typescript
import apiClient from '../services/api';

function UserProfile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    apiClient.get('/users/profile')
      .then(res => setUser(res.data.data))
      .catch(err => console.error(err));
  }, []);

  return <div>{user?.email}</div>;
}
```

#### .env.local
```env
REACT_APP_API_URL=https://your-app-name.azurewebsites.net/api/v1
```

---

### **Next.js / React with Server Components**

#### Create API Route Wrapper (lib/api.ts)
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
) {
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('accessToken')
    : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
```

#### Use in Client Component
```typescript
'use client';
import { apiCall } from '@/lib/api';

export default function Wardrobe() {
  const [clothes, setClothes] = useState([]);

  useEffect(() => {
    apiCall('/clothes')
      .then(res => setClothes(res.data))
      .catch(err => console.error(err));
  }, []);

  return <div>{clothes.length} items</div>;
}
```

#### .env.local
```env
NEXT_PUBLIC_API_URL=https://your-app-name.azurewebsites.net/api/v1
```

---

### **Vue 3 + Vite**

#### Create Composable (src/composables/useApi.ts)
```typescript
import { ref } from 'vue';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function useApi() {
  const loading = ref(false);
  const error = ref(null);

  const get = async (url: string) => {
    loading.value = true;
    try {
      const { data } = await api.get(url);
      return data.data;
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const post = async (url: string, payload: any) => {
    loading.value = true;
    try {
      const { data } = await api.post(url, payload);
      return data.data;
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return { get, post, loading, error };
}
```

#### Use in Components
```vue
<template>
  <div v-if="loading">Loading...</div>
  <ul v-else>
    <li v-for="item in clothes" :key="item.id">{{ item.name }}</li>
  </ul>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@/composables/useApi';

const clothes = ref([]);
const { get, loading } = useApi();

onMounted(async () => {
  clothes.value = await get('/clothes');
});
</script>
```

#### .env.local
```env
VITE_API_URL=https://your-app-name.azurewebsites.net/api/v1
```

---

## **Authentication Flow**

### **1. Login**
```javascript
const loginResponse = await apiCall('/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { accessToken, refreshToken } = loginResponse.data;
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

**Response Format:**
```json
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
  "timestamp": "2026-04-26T04:40:18.660Z"
}
```

### **2. Authenticated Requests**
All endpoints except `/health` and `/auth/*` require:
```javascript
headers: {
  'Authorization': `Bearer ${accessToken}`
}
```

### **3. Token Refresh**
When access token expires (7 days), use refresh token:
```javascript
const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
});

const { accessToken: newToken } = await refreshResponse.json();
localStorage.setItem('accessToken', newToken);
```

---

## **API Endpoints Summary**

### **Auth Endpoints** (No auth required)
- `POST /auth/signup` — Register new user
- `POST /auth/login` — Login with email/password
- `POST /auth/refresh` — Get new access token

### **User Endpoints** (Auth required)
- `GET /users/profile` — Get current user profile
- `PUT /users/profile` — Update user profile
- `GET /users/preferences` — Get user preferences

### **Clothes Endpoints** (Auth required)
- `GET /clothes` — List wardrobe items (paginated)
- `POST /clothes` — Add new clothing item
- `PUT /clothes/:id` — Update clothing item
- `DELETE /clothes/:id` — Remove clothing item

### **Outfit Endpoints** (Auth required)
- `GET /outfits` — Get outfit suggestions
- `POST /outfits` — Create outfit combination
- `GET /outfits/:id` — Get outfit details

### **Quality Endpoints** (Auth required)
- `GET /quality/:clothId` — Get garment quality score
- `POST /quality/:clothId/assess` — Assess clothing quality

### **Weather Endpoints** (No auth required)
- `GET /weather` — Get current weather (requires lat/lon query params)

### **Laundry Endpoints** (Auth required)
- `GET /laundry` — Get laundry schedule
- `POST /laundry` — Log laundry for an item
- `PUT /laundry/:id` — Update laundry record

### **Notifications Endpoints** (Auth required)
- `GET /notifications` — Get user notifications
- `POST /notifications/subscribe` — Subscribe to FCM notifications

### **Upload Endpoints** (Auth required)
- `POST /uploads` — Upload image to Cloudinary
- `GET /uploads` — List uploaded images

---

## **Error Handling**

### **Standard Error Response**
```json
{
  "success": false,
  "message": "User-friendly error message",
  "error": "Technical error details",
  "code": "ERROR_CODE",
  "timestamp": "2026-04-26T04:40:18.660Z"
}
```

### **Common Error Codes**
| Code | Meaning | Action |
|------|---------|--------|
| `AUTH_001` | Invalid Firebase token | Redirect to login |
| `AUTH_002` | Token expired | Refresh token |
| `AUTH_003` | Unauthorized | Add `Authorization` header |
| `USER_001` | User not found | Create account |
| `CLOTH_001` | Cloth not found | Verify cloth ID |
| `OUTFIT_001` | No clean clothes | Add clothes to wardrobe |

### **Handle Errors in Code**
```javascript
try {
  const response = await apiCall('/clothes');
} catch (error) {
  if (error.response?.status === 401) {
    // Unauthorized — refresh token or redirect to login
  } else if (error.response?.status === 404) {
    // Resource not found
  } else if (error.response?.status === 500) {
    // Server error — show generic message
    console.error('Server error:', error.response?.data?.error);
  }
}
```

---

## **CORS Configuration**

Your backend CORS is configured to accept:
```env
CORS_ORIGIN=https://your-app-name.azurewebsites.net
```

**For local development**, update Azure App Settings:
```
CORS_ORIGIN=http://localhost:3000
```

(Update this back to your production domain before deploying frontend.)

---

## **Rate Limiting**

Your backend has rate limiting enabled:
- **Window**: 15 minutes (900,000 ms)
- **Limit**: 120 requests per window
- **Auth endpoints**: Stricter limits apply

If you hit the limit, you'll get:
```json
{
  "success": false,
  "message": "Too many requests, please try again later",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

**Solution**: Implement exponential backoff in your frontend:
```javascript
async function apiCallWithRetry(endpoint, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall(endpoint, options);
    } catch (error) {
      if (error.response?.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

---

## **Testing Your Connection**

### **1. Test Health Endpoint (No Auth)**
```bash
curl https://your-app-name.azurewebsites.net/health
```

Response:
```json
{
  "success": true,
  "message": "Vastra backend is healthy",
  "data": {
    "service": "vastra-backend",
    "environment": "production"
  },
  "timestamp": "2026-04-26T04:40:18.660Z"
}
```

### **2. Test Login Flow (From Frontend)**
```javascript
const loginRes = await fetch('https://your-app-name.azurewebsites.net/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'testpass123'
  })
});

const { data: { accessToken } } = await loginRes.json();
console.log('Login successful! Token:', accessToken);
```

### **3. Test Authenticated Endpoint**
```javascript
const profileRes = await fetch('https://your-app-name.azurewebsites.net/api/v1/users/profile', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});

const profile = await profileRes.json();
console.log('User profile:', profile.data);
```

---

## **Troubleshooting**

### **Problem: CORS Error**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Fix:**
1. Check `CORS_ORIGIN` in Azure App Settings
2. Ensure it matches your frontend domain (with https://)
3. Restart the App Service

### **Problem: 401 Unauthorized**
```
{"success": false, "code": "AUTH_003"}
```

**Fix:**
1. Verify you have `Authorization: Bearer <token>` header
2. Check token isn't expired (7 days)
3. Refresh token if needed

### **Problem: 504 Gateway Timeout**
```
Service Unavailable (504)
```

**Fix:**
1. Check Azure App Service logs
2. Ensure database is accessible
3. Restart the App Service

### **Problem: Environment Variable Not Loading**
Frontend still hitting localhost instead of Azure:

**Fix:**
1. Verify `.env.local` file exists (not `.env`)
2. Restart dev server: `npm start`
3. Check `console.log(process.env.REACT_APP_API_URL)` in browser console

---

## **Production Checklist**

Before deploying frontend to production:

- [ ] API_URL points to your Azure domain (not localhost)
- [ ] `CORS_ORIGIN` in Azure is set to your frontend domain
- [ ] Access token stored securely (localStorage for now, httpOnly cookie ideally)
- [ ] Error messages don't expose sensitive data
- [ ] Rate limiting handled gracefully
- [ ] Token refresh logic implemented
- [ ] Health check passes: `curl https://your-app/health`

---

## **Next Steps**

1. **Update your `.env` file** with your Azure backend URL
2. **Test login** on your frontend
3. **Create a cloth item** to test authenticated endpoints
4. **Monitor logs** if something fails

Need help? Check the logs in **Azure Portal → Log Stream**.
