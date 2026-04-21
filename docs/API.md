# SpeakFlow API Documentation

## Base URL
Production: https://api.speakflow.com/v1
Staging: https://staging-api.speakflow.com/v1
Development: http://localhost:3000/api/v1

## Authentication

Most API endpoints require authentication using JWT token.

### Headers

```http
Authorization: Bearer <your_access_token>
Content-Type: application/json

Response Forma
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "code": "OPTIONAL_ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z"
}

Error Response
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": [],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
Authentication Endpoints
Register User
POST /auth/register
Request Body:
{
  "email": "user@example.com",
  "password": "Password123",
  "name": "John Doe",
  "confirmPassword": "Password123",
  "termsAccepted": true
}
Response:
{
  "success": true,
  "message": "User registered successfully. Please verify your email.",
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": "7d"
    }
  }
}
Login
POST /auth/login
Request Body:
{
  "email": "user@example.com",
  "password": "Password123"
}
Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "avatar": "https://...",
      "stats": {
        "level": 5,
        "xp": 1250,
        "streak": 7
      }
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": "7d"
    }
  }
}
Refresh Token
POST /auth/refresh
Request Body:
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "7d"
  }
}
Logout
POST /auth/logout
Headers: Authorization: Bearer <token>
{
  "success": true,
  "message": "Logout successful"
}
Forgot Password
POST /auth/forgot-password
Request Body:
{
  "email": "user@example.com"
}
Response:
{
  "success": true,
  "message": "If your email is registered, you will receive a password reset link"
}
Reset Password
POST /auth/reset-password
Request Body:
{
  "token": "reset_token_123",
  "password": "NewPassword123",
  "confirmPassword": "NewPassword123"
}
Response:
{
  "success": true,
  "message": "Password reset successfully"
}
Verify Email
GET /auth/verify-email?token={verification_token}
Response:
{
  "success": true,
  "message": "Email verified successfully"
}
User Endpoints
Get Current User
GET /users/profile
Headers: Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "https://...",
    "bio": "Learning English",
    "country": "US",
    "timezone": "America/New_York",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
Update Profile
PUT /users/profile
Headers: Authorization: Bearer <token>

Request Body:
{
  "name": "John Updated",
  "bio": "New bio",
  "avatar": "https://...",
  "country": "US"
}


Response:
