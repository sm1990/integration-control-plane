# Implementing a Custom Authentication Backend

This guide explains how to implement a custom authentication backend for the Integration Control Plane (ICP).

## Overview

The ICP authentication architecture separates credential verification from the main application. This allows you to integrate with any authentication system (LDAP, OAuth, custom databases, etc.) by implementing a simple REST API.

## Quick Start

### 1. Review the OpenAPI Specification

See `auth-backend-openapi.yaml` for the complete API specification.

### 2. Implement the `/authenticate` Endpoint

Your authentication backend must implement a single endpoint:

**Endpoint:** `POST /authenticate`

**Request Headers:**
- `X-API-Key`: API key for authentication (configured in both ICP server and your backend)
- `Content-Type`: `application/json`

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin"
}
```

**Success Response (200):**
```json
{
  "authenticated": true,
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "displayName": "John Doe",
  "timestamp": "2025-10-10T04:26:39.123Z"
}
```

**Error Response (401):**
```json
{
  "message": "Invalid credentials"
}
```

### 3. Database Schema

Your authentication backend needs a `user_credentials` table:

```sql
CREATE TABLE user_credentials (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
);
```

**Fields:**
- `user_id`: UUID that uniquely identifies the user (shared with ICP server)
- `username`: Username for login
- `display_name`: User's display name for UI
- `password_hash`: Hashed password (bcrypt recommended)

### 4. Configure ICP Server

Update your ICP server configuration to point to your authentication backend:

```toml
# Config.toml
authBackendUrl = "https://your-auth-backend.example.com"
authBackendApiKey = "your-secure-api-key"
```

## Implementation Examples

### Example 1: Python with Flask

```python
from flask import Flask, request, jsonify
import bcrypt
import uuid
from datetime import datetime
import mysql.connector

app = Flask(__name__)
API_KEY = "your-secure-api-key"

@app.route('/authenticate', methods=['POST'])
def authenticate():
    # Validate API key
    api_key = request.headers.get('X-API-Key')
    if api_key != API_KEY:
        return jsonify({"message": "Invalid API key"}), 400
    
    # Get credentials from request
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Connect to database
    conn = mysql.connector.connect(
        host="localhost",
        user="root",
        password="password",
        database="auth_db"
    )
    cursor = conn.cursor(dictionary=True)
    
    # Query user credentials
    cursor.execute(
        "SELECT user_id, username, display_name, password_hash "
        "FROM user_credentials WHERE username = %s",
        (username,)
    )
    user = cursor.fetchone()
    
    if not user:
        return jsonify({"message": "Invalid credentials"}), 401
    
    # Verify password
    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({"message": "Invalid credentials"}), 401
    
    # Return success response
    return jsonify({
        "authenticated": True,
        "userId": user['user_id'],
        "displayName": user['display_name'],
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9447, ssl_context='adhoc')
```

### Example 2: Node.js with Express

```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const API_KEY = 'your-secure-api-key';
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'auth_db'
};

app.post('/authenticate', async (req, res) => {
  // Validate API key
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(400).json({ message: 'Invalid API key' });
  }

  const { username, password } = req.body;

  try {
    // Connect to database
    const connection = await mysql.createConnection(dbConfig);

    // Query user credentials
    const [rows] = await connection.execute(
      'SELECT user_id, username, display_name, password_hash FROM user_credentials WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];

    // Verify password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Return success response
    res.json({
      authenticated: true,
      userId: user.user_id,
      displayName: user.display_name,
      timestamp: new Date().toISOString()
    });

    await connection.end();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(9447, () => {
  console.log('Auth backend listening on port 9447');
});
```

### Example 3: LDAP Integration

```python
from flask import Flask, request, jsonify
import ldap
import uuid
from datetime import datetime

app = Flask(__name__)
API_KEY = "your-secure-api-key"
LDAP_SERVER = "ldap://ldap.example.com"
LDAP_BASE_DN = "dc=example,dc=com"

@app.route('/authenticate', methods=['POST'])
def authenticate():
    # Validate API key
    api_key = request.headers.get('X-API-Key')
    if api_key != API_KEY:
        return jsonify({"message": "Invalid API key"}), 400
    
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    try:
        # Connect to LDAP
        conn = ldap.initialize(LDAP_SERVER)
        conn.set_option(ldap.OPT_REFERRALS, 0)
        
        # Attempt to bind with user credentials
        user_dn = f"uid={username},ou=users,{LDAP_BASE_DN}"
        conn.simple_bind_s(user_dn, password)
        
        # If bind succeeds, fetch user attributes
        result = conn.search_s(
            user_dn,
            ldap.SCOPE_BASE,
            attrlist=['uid', 'displayName', 'entryUUID']
        )
        
        if result:
            attrs = result[0][1]
            user_id = attrs.get('entryUUID', [str(uuid.uuid4()).encode()])[0].decode()
            display_name = attrs.get('displayName', [username.encode()])[0].decode()
            
            return jsonify({
                "authenticated": True,
                "userId": user_id,
                "displayName": display_name,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }), 200
        
    except ldap.INVALID_CREDENTIALS:
        return jsonify({"message": "Invalid credentials"}), 401
    except Exception as e:
        print(f"LDAP error: {e}")
        return jsonify({"message": "Internal server error"}), 500
    finally:
        if conn:
            conn.unbind_s()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9447, ssl_context='adhoc')
```

## Important Requirements

### 1. User ID (UUID)

- **Must be a valid UUID** (RFC 4122 format)
- **Must be consistent** - Same user always gets the same UUID
- **Must be unique** across all users
- Used as the primary key in the ICP server's `users` table

### 2. Display Name

- User-facing name shown in the UI
- Can be different from username
- Should be the user's full name or preferred display name
- Max 200 characters

### 3. Security

- **HTTPS required** in production
- API key must be kept secret
- Use strong password hashing (bcrypt, argon2, etc.)
- Implement rate limiting to prevent brute force attacks
- Log authentication attempts for security auditing

### 4. Error Handling

Return appropriate HTTP status codes:
- `200`: Authentication successful
- `400`: Bad request (invalid API key, malformed request)
- `401`: Authentication failed (invalid credentials)
- `500`: Internal server error

## Testing Your Implementation

### 1. Test with curl

```bash
curl -X POST https://localhost:9447/authenticate \
  -H "X-API-Key: your-secure-api-key" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}' \
  -k
```

### 2. Validate OpenAPI Compliance

Use tools like Swagger Editor or Postman to validate your API against the OpenAPI spec.

### 3. Integration Test

Configure ICP server to use your backend and test the full login flow.

## Troubleshooting

### Common Issues

1. **401 Unauthorized from ICP**
   - Check API key configuration matches on both sides
   - Verify HTTPS is properly configured

2. **User not created in ICP**
   - Ensure userId is a valid UUID format
   - Check ICP server logs for detailed error messages

3. **"Invalid response from authentication service"**
   - Verify your response matches the required schema
   - Check that all required fields are present (authenticated, userId, displayName, timestamp)

## Security Best Practices

1. **Use HTTPS** - Never transmit credentials over plain HTTP
2. **Rotate API Keys** - Change API keys periodically
3. **Rate Limiting** - Implement rate limiting on authentication endpoint
4. **Audit Logging** - Log all authentication attempts
5. **Password Policies** - Enforce strong password requirements
6. **Account Lockout** - Lock accounts after failed attempts
7. **Secure Storage** - Use proper password hashing (bcrypt with high cost factor)

## Support

For questions or issues:
- Review the OpenAPI specification: `auth-backend-openapi.yaml`
- Check ICP server logs for detailed error messages
- Refer to the default Ballerina implementation in `default_auth_backend.bal`

## License

Copyright (c) 2025, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.

Licensed under the Apache License, Version 2.0.

