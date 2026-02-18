# Implementing a Custom Authentication Backend

This guide explains how to implement a custom authentication backend for the Integration Control Plane (ICP).

## Overview

The ICP authentication architecture separates credential verification from the main application. You can integrate any user store (databases, LDAP, IdPs, etc.) by implementing a simple REST API.

## Quick Start

### 1. Review the OpenAPI Specification

See `auth-backend-openapi.yaml` for the complete API specification.

### 2. Implement the Required Endpoints

Your authentication backend must implement the following endpoints. ICP will send the specified fields; your backend should update your user store accordingly and return the specified fields. The exact implementation and storage technology are entirely up to you.

#### POST /authenticate
- ICP sends: `username`, `password`
- You return: `authenticated`, `userId`, `displayName`, `timestamp`

#### POST /users (Create User)
- ICP sends: `username`, `displayName`, `password`
- You add this user to your user store and return: `userId`, `username`, `displayName`

#### POST /change-password
- ICP sends: `userId`, `currentPassword`, `newPassword`
- You validate the current credentials, update the password in your user store, and return a success message

### 3. Security
- All requests include `X-API-Key` for backend authentication
- Use HTTPS in production

### 4. Error Handling
Return appropriate HTTP status codes with a standard error body `{ "message": "..." }`.
- `200/201`: Success
- `400`: Validation or bad request
- `401`: Unauthorized (e.g., invalid API key or credentials)
- `500`: Internal server error

## Database/User Store

You can use any user store. ICP does not mandate schemas or technologies. Ensure you can:
- Verify credentials in `/authenticate`
- Create users in `/users`
- Change passwords in `/change-password`

## Testing Your Implementation

### 1. Test with curl (examples)

Authentication
```
curl -X POST https://localhost:9447/authenticate \
  -H "X-API-Key: <api-key>" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}' -k
```

Create User
```
curl -X POST https://localhost:9447/users \
  -H "X-API-Key: <api-key>" \
  -H "Content-Type: application/json" \
  -d '{"username": "johndoe", "displayName": "John Doe", "password": "securepassword123"}' -k
```

Change Password
```
curl -X POST https://localhost:9447/change-password \
  -H "X-API-Key: <api-key>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "<uuid>", "currentPassword": "old", "newPassword": "newsecret"}' -k
```

## Troubleshooting
- Ensure API keys match between ICP and your backend
- Return exactly the fields specified above for each endpoint
- Use clear error messages in `{ "message": "..." }`

## License

Apache License 2.0

