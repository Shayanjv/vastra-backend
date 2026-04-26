# 🚀 Backend Ready — Frontend Integration Quick Start

## Your Backend Status
✅ **Backend is LIVE and HEALTHY**
- URL: `https://your-app-name.azurewebsites.net`
- Health Check: Working (you just tested it!)
- Database: Connected ✓
- Authentication: Enabled ✓

---

## Connect Your Frontend in 3 Steps

### Step 1: Copy Backend URL
```
https://your-app-name.azurewebsites.net/api/v1
```
(Replace `your-app-name` with your actual Azure App Service name)

### Step 2: Add to Frontend `.env.local`
```env
REACT_APP_API_URL=https://your-app-name.azurewebsites.net/api/v1
```
Or for Next.js/Vite:
```env
VITE_API_URL=https://your-app-name.azurewebsites.net/api/v1
```

### Step 3: Make API Calls
```javascript
const API_URL = process.env.REACT_APP_API_URL;

// Login
const response = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { data: { accessToken } } = await response.json();

// Get user profile
const profileRes = await fetch(`${API_URL}/users/profile`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

---

## Complete Integration Guide
📖 **See [FRONTEND_INTEGRATION_GUIDE.md](FRONTEND_INTEGRATION_GUIDE.md)** for:
- Framework-specific setup (React, Next.js, Vue)
- Token management & refresh logic
- Error handling
- All API endpoints
- Troubleshooting

---

## API Endpoints

### Public (No Auth Required)
- `POST /auth/signup` — Register
- `POST /auth/login` — Login
- `POST /auth/refresh` — Refresh token
- `GET /health` — Health check
- `GET /weather` — Get weather

### Protected (Auth Required)
All other endpoints require:
```
Authorization: Bearer <accessToken>
```

Examples:
- `GET /users/profile` — User profile
- `GET /clothes` — List wardrobe
- `POST /clothes` — Add item
- `GET /outfits` — Outfit suggestions
- And more...

---

## Important: Update Azure CORS

**Your backend needs to know your frontend domain.**

1. Go to **Azure Portal**
2. Find **Your App Service → Settings → Configuration**
3. Find `CORS_ORIGIN` app setting
4. Change value to your frontend domain:
   - Local dev: `http://localhost:3000`
   - Production: `https://yourdomain.com`

---

## Test It Works

### From Your Frontend Code:
```javascript
// This should work
const res = await fetch('https://your-app.azurewebsites.net/health');
const data = await res.json();
console.log(data); // Should show healthy status
```

If you see a CORS error, check step above (CORS_ORIGIN).

---

## Still Need Help?

1. **See [FRONTEND_INTEGRATION_GUIDE.md](FRONTEND_INTEGRATION_GUIDE.md)** for complete examples for your framework
2. **Check Azure Portal → Log Stream** for backend errors
3. **Verify your backend URL** is correct (replace app-name)
4. **Ensure CORS_ORIGIN** is set to your frontend domain

---

## Your Backend API Contract

**Success Response:**
```json
{
  "success": true,
  "message": "Description",
  "data": {},
  "pagination": { "page": 1, "limit": 20, "total": 100 },
  "timestamp": "ISO string"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "User-friendly error",
  "error": "Technical details",
  "code": "ERROR_CODE",
  "timestamp": "ISO string"
}
```

Always check `response.success` before accessing `response.data`.

---

## Rate Limiting & Timeouts

- **Rate Limit**: 120 requests per 15 minutes
- **Request Timeout**: 10 seconds
- **Token Expiry**: 7 days (access), 30 days (refresh)

Implement exponential backoff for retries — see integration guide.

---

**You're all set! 🎉 Start integrating your frontend.**
