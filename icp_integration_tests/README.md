# ICP Integration Tests

This directory contains integration tests for the ICP (Integration Control Plane) server. These tests verify the connection and authentication functionality with admin credentials.

## Prerequisites

1. **Running ICP Server**: Ensure the ICP server is running on `https://localhost:9445` (or update the `Config.toml` with your server URL)
2. **Admin Credentials**: Default admin username is `admin` and password is `admin` (configurable in `Config.toml`)
3. **SSL Certificates**: The truststore must be available at the configured path

## Test Suite

The integration tests include:

### 1. Connection Tests
- **testConnectWithAdminPassword**: Verifies successful authentication with admin credentials
- **testServerHealthCheck**: Checks if the ICP server is reachable

### 2. JWT Token Validation
- **testVerifyAdminJWTToken**: Validates the JWT token structure, claims, and signatures

### 3. API Access Tests
- **testAuthenticatedAPIAccess**: Tests authenticated access to GraphQL endpoints

### 4. Permission Tests
- **testAdminPermissions**: Verifies admin user has required permissions (user management, group management, role management)

### 5. Negative Tests
- **testInvalidAdminPassword**: Ensures invalid credentials are properly rejected

## Running the Tests

### Run All Tests
```bash
cd icp_integration_tests
bal test
```

### Run Specific Test Groups
```bash
# Run only connection tests
bal test --groups connection

# Run only authentication tests
bal test --groups admin-auth

# Run only integration tests
bal test --groups integration

# Run negative tests
bal test --groups negative
```

### Run with Custom Configuration
```bash
bal test --config-file=CustomConfig.toml
```

## Configuration

Edit `Config.toml` to customize test configuration:

```toml
# Server URL
icpServerUrl = "https://localhost:9445"

# Admin credentials
adminUsername = "admin"
adminPassword = "admin"

# SSL configuration
truststorePath = "../conf/security/ballerinaTruststore.p12"
truststorePassword = "ballerina"
```

## Test Output

The tests provide detailed logging including:
- Authentication status
- JWT token details (algorithm, issuer, claims)
- User ID and permissions
- API access results

Example output:
```
[INFO] Testing connection to ICP server with admin credentials...
[INFO] Login response received: {"token":"eyJ...","username":"admin","permissions":["user:manage-users",...]}
[INFO] Successfully authenticated as admin user: admin
[INFO] Authentication token obtained (length: 245 chars)
[INFO] Verifying JWT token structure and claims...
[INFO] User ID: 550e8400-e29b-41d4-a716-446655440000
[INFO] Verified permission: user:manage-users
```

## Troubleshooting

### Connection Refused
- Ensure the ICP server is running
- Check the `icpServerUrl` in `Config.toml` matches your server address

### SSL Certificate Errors
- Verify the `truststorePath` points to the correct truststore
- Ensure the truststore password is correct

### Authentication Failures
- Check admin credentials in `Config.toml`
- Verify the admin user exists in the ICP server database

### Test Failures
- Review the test logs for detailed error messages
- Ensure all dependencies in `Ballerina.toml` are resolved
- Run `bal build` before running tests

## Adding New Tests

To add new integration tests:

1. Create a new test function in `admin_connection_test.bal` or a new `.bal` file
2. Use the `@test:Config` annotation with appropriate groups
3. Set `dependsOn` if the test requires data from previous tests
4. Use the shared `icpClient` for HTTP requests
5. Document the test purpose in comments

Example:
```ballerina
@test:Config {
    groups: ["integration", "my-feature"],
    dependsOn: [testConnectWithAdminPassword]
}
function testMyFeature() returns error? {
    // Your test logic here
}
```

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```bash
#!/bin/bash
# Start ICP server
./start-icp-server.sh

# Wait for server to be ready
sleep 10

# Run integration tests
cd icp_integration_tests
bal test --groups integration

# Capture exit code
TEST_RESULT=$?

# Stop ICP server
./stop-icp-server.sh

# Exit with test result
exit $TEST_RESULT
```

## Related Documentation

- [ICP Server Documentation](../icp_server/README.md)
- [Authentication Documentation](../icp_server/custom_auth/AUTH_BACKEND_IMPLEMENTATION.md)
- [RBAC Implementation](../icp_server/rbac_v2_implementation.md)
