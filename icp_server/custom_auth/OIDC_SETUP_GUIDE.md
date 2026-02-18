# OIDC Single Sign-On (SSO) Setup Guide

This guide explains how to configure Single Sign-On (SSO) using OpenID Connect (OIDC) for the Integration Control Plane (ICP).

## Overview

ICP supports OIDC-based authentication, allowing users to log in using your organization's existing identity provider. SSO works alongside traditional username/password authentication, giving users the choice of login method.

**Supported Identity Providers:**
- Asgardeo (WSO2)
- Okta
- Auth0
- Azure AD
- Keycloak
- Any OIDC-compliant identity provider

---

## Prerequisites

Before configuring ICP:

1. **OIDC Application registered** with your identity provider
2. **Client ID and Client Secret** from your identity provider
3. **Redirect URI configured** in your identity provider to point to: `https://your-icp-domain.com/auth/callback`
4. **Required claims** enabled in your identity provider:
   - `sub` (Subject/User ID) - Required
   - `email` OR `preferred_username` - Required
   - `name` - Recommended (for display names)

---

## Configuration

### Step 1: Gather Your OIDC Provider Information

You'll need the following information from your identity provider:

| Information | Example | Where to Find |
|------------|---------|---------------|
| **Issuer** | `https://provider.com/oauth2/token` | Provider's application settings or OpenID configuration |
| **Authorization Endpoint** | `https://provider.com/oauth2/authorize` | Provider's endpoint documentation |
| **Token Endpoint** | `https://provider.com/oauth2/token` | Provider's endpoint documentation |
| **Logout/Revoke Endpoint** | `https://provider.com/oauth2/logout` or `https://provider.com/oauth2/revoke` | Provider's endpoint documentation (can be logout or token revocation endpoint) |
| **Client ID** | `abc123xyz` | Your application settings |
| **Client Secret** | `secret_key` | Your application settings |

💡 **Tip**: Many providers offer an OpenID Configuration endpoint (`.well-known/openid-configuration`) that lists all required endpoints.

### Step 2: Configure ICP Server

Edit the `icp_server/Config.toml` file and add the SSO configuration:

```toml
# =============================================================================
# SSO (OIDC) CONFIGURATION
# =============================================================================
ssoEnabled = true
ssoIssuer = "https://your-provider.com/oauth2/token"
ssoAuthorizationEndpoint = "https://your-provider.com/oauth2/authorize"
ssoTokenEndpoint = "https://your-provider.com/oauth2/token"
ssoLogoutEndpoint = "https://your-provider.com/oauth2/logout"
ssoClientId = "your-client-id"
ssoClientSecret = "your-client-secret"
ssoRedirectUri = "https://your-icp-domain.com/auth/callback"
ssoUsernameClaim = "email"
ssoScopes = ["openid", "email", "profile"]
```

**Replace the values** with your actual OIDC provider configuration.

### Configuration Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `ssoEnabled` | Enable or disable SSO (set to `true`) | `true` |
| `ssoIssuer` | Issuer URL from your OIDC provider | `https://provider.com/oauth2/token` |
| `ssoAuthorizationEndpoint` | Authorization endpoint URL | `https://provider.com/oauth2/authorize` |
| `ssoTokenEndpoint` | Token endpoint URL | `https://provider.com/oauth2/token` |
| `ssoLogoutEndpoint` | Logout endpoint URL | `https://provider.com/oauth2/logout` |
| `ssoClientId` | Your application's Client ID | `abc123xyz` |
| `ssoClientSecret` | Your application's Client Secret | `secret_key` |
| `ssoRedirectUri` | Callback URL (must match provider config) | `https://your-domain.com/auth/callback` |
| `ssoUsernameClaim` | Claim to use as username: `email` or `preferred_username` | `email` |
| `ssoScopes` | OIDC scopes to request (minimum: `openid`) | `["openid", "email", "profile"]` |

---

## Provider-Specific Examples

### Asgardeo (WSO2)

```toml
ssoEnabled = true
ssoIssuer = "https://api.asgardeo.io/t/YOUR_ORG/oauth2/token"
ssoAuthorizationEndpoint = "https://api.asgardeo.io/t/YOUR_ORG/oauth2/authorize"
ssoTokenEndpoint = "https://api.asgardeo.io/t/YOUR_ORG/oauth2/token"
ssoLogoutEndpoint = "https://api.asgardeo.io/t/YOUR_ORG/oidc/logout"
ssoClientId = "your-client-id"
ssoClientSecret = "your-client-secret"
ssoRedirectUri = "https://your-icp-domain.com/auth/callback"
ssoUsernameClaim = "email"
ssoScopes = ["openid", "email", "profile"]
```

### Okta

```toml
ssoEnabled = true
ssoIssuer = "https://YOUR_DOMAIN.okta.com/oauth2/default"
ssoAuthorizationEndpoint = "https://YOUR_DOMAIN.okta.com/oauth2/default/v1/authorize"
ssoTokenEndpoint = "https://YOUR_DOMAIN.okta.com/oauth2/default/v1/token"
ssoLogoutEndpoint = "https://YOUR_DOMAIN.okta.com/oauth2/default/v1/logout"
ssoClientId = "your-client-id"
ssoClientSecret = "your-client-secret"
ssoRedirectUri = "https://your-icp-domain.com/auth/callback"
ssoUsernameClaim = "email"
ssoScopes = ["openid", "email", "profile"]
```

### Auth0

```toml
ssoEnabled = true
ssoIssuer = "https://YOUR_DOMAIN.auth0.com/"
ssoAuthorizationEndpoint = "https://YOUR_DOMAIN.auth0.com/authorize"
ssoTokenEndpoint = "https://YOUR_DOMAIN.auth0.com/oauth/token"
ssoLogoutEndpoint = "https://YOUR_DOMAIN.auth0.com/v2/logout"
ssoClientId = "your-client-id"
ssoClientSecret = "your-client-secret"
ssoRedirectUri = "https://your-icp-domain.com/auth/callback"
ssoUsernameClaim = "email"
ssoScopes = ["openid", "email", "profile"]
```

### Azure AD

```toml
ssoEnabled = true
ssoIssuer = "https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0"
ssoAuthorizationEndpoint = "https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/authorize"
ssoTokenEndpoint = "https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/token"
ssoLogoutEndpoint = "https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/logout"
ssoClientId = "your-client-id"
ssoClientSecret = "your-client-secret"
ssoRedirectUri = "https://your-icp-domain.com/auth/callback"
ssoUsernameClaim = "email"
ssoScopes = ["openid", "email", "profile"]
```

### Keycloak

```toml
ssoEnabled = true
ssoIssuer = "https://YOUR_KEYCLOAK_DOMAIN/realms/YOUR_REALM"
ssoAuthorizationEndpoint = "https://YOUR_KEYCLOAK_DOMAIN/realms/YOUR_REALM/protocol/openid-connect/auth"
ssoTokenEndpoint = "https://YOUR_KEYCLOAK_DOMAIN/realms/YOUR_REALM/protocol/openid-connect/token"
ssoLogoutEndpoint = "https://YOUR_KEYCLOAK_DOMAIN/realms/YOUR_REALM/protocol/openid-connect/logout"
ssoClientId = "your-client-id"
ssoClientSecret = "your-client-secret"
ssoRedirectUri = "https://your-icp-domain.com/auth/callback"
ssoUsernameClaim = "preferred_username"
ssoScopes = ["openid", "email", "profile"]
```

---

## Using SSO

### Login Flow

1. Users navigate to the ICP login page
2. Click **"Login with SSO"** button
3. They're redirected to your organization's identity provider
4. After successful authentication, they're redirected back to ICP
5. Users are logged in and can access ICP resources based on their assigned roles

### First Time Login

When a user logs in via SSO for the first time:
- A new user account is automatically created in ICP
- The username and display name are extracted from the identity provider
- An administrator must assign appropriate roles and permissions to the user

### Display Names

ICP extracts display names from the identity provider using the following priority:
1. `name` claim (full name)
2. `email` claim (local part before @)
3. `preferred_username` claim

### Username Claim

The `ssoUsernameClaim` parameter determines which claim is used as the username:
- **`email`** (recommended) - Uses the email address
- **`preferred_username`** - Uses the preferred username

Choose the option that best matches what your identity provider returns and your organization's needs.

---

## Security Best Practices

### Protect Your Client Secret

⚠️ **Never commit secrets to version control**

**For Production:**
- Use environment variables or a secret management system
- Rotate secrets periodically
- Restrict access to configuration files

**Example using environment variables:**
```bash
export SSO_CLIENT_SECRET="your-secret-here"
```

Then reference it in your deployment process.

### Use HTTPS

🔒 **Always use HTTPS in production**

- Ensure `ssoRedirectUri` uses `https://`
- Configure SSL/TLS certificates for your ICP deployment
- Never use `http://` in production environments

### Verify Redirect URI

✓ **Redirect URI must match exactly**

The `ssoRedirectUri` in ICP configuration must **exactly match** the redirect URI registered with your identity provider:
- Protocol (https)
- Domain name
- Path
- Port (if non-standard)
- No trailing slash differences

---

## Troubleshooting

### "SSO authentication is not enabled"

**Cause**: SSO configuration is disabled or not properly loaded

**Solutions**:
1. Verify `ssoEnabled = true` in `Config.toml`
2. Restart the ICP server after configuration changes
3. Check server startup logs for configuration validation errors

### "Invalid authorization code"

**Cause**: Problem during token exchange with identity provider

**Solutions**:
1. Verify `ssoClientId` and `ssoClientSecret` are correct
2. Check that the redirect URI in config matches your provider configuration exactly
3. Ensure your identity provider application is active/enabled
4. Review server logs for detailed error messages

### Redirect URI Mismatch

**Cause**: Redirect URI doesn't match between ICP and identity provider

**Solutions**:
1. Verify the `ssoRedirectUri` in `Config.toml` matches your provider configuration
2. Check for differences in:
   - Protocol (`http` vs `https`)
   - Domain name (exact spelling, subdomains)
   - Port numbers
   - Trailing slashes
3. Update the redirect URI in either ICP config or provider settings to match

### Missing Required Claims

**Cause**: Identity provider not returning required claims

**Solutions**:
1. Check that your identity provider includes these claims in the ID token:
   - `sub` (required)
   - `email` or `preferred_username` (required)
   - `name` (recommended)
2. Configure your identity provider to include these claims
3. Verify the `ssoUsernameClaim` setting matches what your provider returns
4. Check with your identity provider administrator if claims need to be enabled

### Login Succeeds but No Access

**Cause**: User has no assigned roles

**Solution**: Have an administrator assign appropriate roles and permissions to the newly created user account.

---

## FAQ

**Q: Can users login with both SSO and password?**  
A: Users should use one authentication method. If a user logs in via SSO and separately via password with the same email, these will be treated as separate user accounts.

**Q: What happens if the identity provider is unavailable?**  
A: Users won't be able to login via SSO during the outage. Traditional password authentication (if enabled) will still work.

**Q: How do I disable password login?**  
A: Stop the default authentication backend service to enforce SSO-only login. Ensure you have admin access via SSO before disabling password authentication.

**Q: Can I use multiple identity providers?**  
A: Currently, ICP supports one OIDC provider per deployment.

**Q: How do I rotate the client secret?**  
A: Generate a new secret in your identity provider, update `ssoClientSecret` in `Config.toml`, and restart the ICP server. Existing user sessions remain valid.

---

## Getting Help

If you encounter issues:

1. **Check server logs** for detailed error messages and stack traces
2. **Verify configuration** matches your identity provider exactly
3. **Test connectivity** to identity provider endpoints
4. **Review this guide** for common troubleshooting steps
5. **Contact your identity provider support** for provider-specific issues

---

## Related Documentation

- [Custom Authentication Backend Guide](AUTH_BACKEND_IMPLEMENTATION.md) - For password-based authentication

---

**Last Updated**: January 2025
