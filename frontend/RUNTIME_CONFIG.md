# Runtime Configuration

## Overview

This application supports runtime configuration, allowing you to modify backend API URLs **after building** without needing to rebuild the application.

## How It Works

1. **Build time**: Hardcoded fallback defaults are included in the build
2. **Runtime**: The app loads `/config.json` on startup with the actual configuration
3. **Priority**: Runtime config (`config.json`) overrides hardcoded defaults

## Files

- `public/config.json` - Runtime configuration (copied to `dist/config.json` on build)
- `public/config.json.example` - Template for reference

## Configuration Format

```json
{
  "VITE_GRAPHQL_URL": "https://localhost:9446/graphql",
  "VITE_AUTH_BASE_URL": "https://localhost:9445/auth",
  "VITE_LOGS_URL": "https://localhost:9448/icp/observability/logs?live=true"
}
```

## Usage

### Local Development

Edit `public/config.json` with your backend URLs, then restart the dev server:

```json
{
  "VITE_GRAPHQL_URL": "https://localhost:9446/graphql",
  "VITE_AUTH_BASE_URL": "https://localhost:9445/auth",
  "VITE_OBSERVABILITY_URL": "https://localhost:9448/icp/observability"
}
```

### Production Deployment

#### Option 1: Modify config.json After Build

```bash
# Build the app
pnpm build

# Edit the config in dist/
nano dist/config.json

# Deploy dist/ folder
```

#### Option 2: Docker with Environment Variables

Create a `docker-entrypoint.sh`:

```bash
#!/bin/sh
# Generate config.json from environment variables
cat > /usr/share/nginx/html/config.json <<EOF
{
  "VITE_GRAPHQL_URL": "${GRAPHQL_URL:-https://localhost:9446/graphql}",
  "VITE_AUTH_BASE_URL": "${AUTH_BASE_URL:-https://localhost:9445/auth}",
  "VITE_LOGS_URL": "${LOGS_URL:-https://localhost:9448/icp/observability/logs?live=true}"
}
EOF

# Start nginx
nginx -g 'daemon off;'
```

Dockerfile:

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
```

Run with:

```bash
docker run -e GRAPHQL_URL=https://api.prod.com/graphql \
           -e AUTH_BASE_URL=https://auth.prod.com/auth \
           -e LOGS_URL=https://logs.prod.com/logs \
           my-app
```

#### Option 3: Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  config.json: |
    {
      "VITE_GRAPHQL_URL": "https://api.k8s.com/graphql",
      "VITE_AUTH_BASE_URL": "https://auth.k8s.com/auth",
      "VITE_LOGS_URL": "https://logs.k8s.com/logs"
    }
---
apiVersion: v1
kind: Pod
metadata:
  name: frontend
spec:
  containers:
    - name: nginx
      image: my-frontend:latest
      volumeMounts:
        - name: config
          mountPath: /usr/share/nginx/html/config.json
          subPath: config.json
  volumes:
    - name: config
      configMap:
        name: app-config
```

## Verification

Open browser console after app loads - you should see:

```
✓ Runtime configuration loaded from config.json
```

## Fallback Behavior

If `config.json` fails to load:

- Falls back to hardcoded defaults in the application
- Shows warning in console: `"Failed to load runtime config, using defaults"`
- App continues to work with default localhost URLs

**Default values:**

```typescript
graphqlUrl: 'https://localhost:9446/graphql';
authBaseUrl: 'https://localhost:9445/auth';
logsUrl: 'https://localhost:9448/icp/observability/logs?live=true';
metricsUrl: 'https://localhost:9448/icp/observability/metrics';
```

## Benefits

✅ **One build, multiple environments** - Build once, deploy everywhere  
✅ **No rebuild required** - Change URLs instantly  
✅ **DevOps friendly** - Easy to configure via ConfigMaps, env vars, or direct file modification  
✅ **Safe fallbacks** - Works even if config.json is missing
