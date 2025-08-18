# GraphQL API Test Suite

This directory contains comprehensive test cases for the GraphQL API of the Integration Control Plane (ICP) server.

## Test Structure

### Test Files

1. **`graphql_unit_test.bal`** - Unit tests for type definitions and data structures
   - Tests type creation and validation
   - Tests JSON parsing functionality
   - Tests edge cases and boundary conditions

2. **`graphql_mock_test.bal`** - Mock data tests and integration scenarios
   - Tests mock data creation utilities
   - Tests data transformation logic
   - Tests filtering and query logic simulation
   - Performance tests with large datasets

3. **`graphql_api_simple_test.bal`** - Integration tests for HTTP endpoints (requires running server)
   - Tests GraphQL endpoint accessibility
   - Tests GraphQL queries with various filters
   - Tests error handling and malformed requests

## Running the Tests

### Prerequisites

1. Ensure you have Ballerina installed (version 2201.7.0 or later)
2. For integration tests, ensure the GraphQL service is running on port 9090
3. Ensure the database is set up and accessible

### Running Unit Tests Only

```bash
# Run only unit tests (no external dependencies)
bal test --groups unit

# Run only mock tests
bal test --groups mock

# Run type-related tests
bal test --groups types
```

### Running Integration Tests

```bash
# Start the GraphQL service first
bal run

# In another terminal, run integration tests
bal test --groups integration

# Run all tests
bal test
```

### Running Tests by Group

```bash
# Run GraphQL-specific tests
bal test --groups graphql

# Run error handling tests
bal test --groups error

# Run performance tests
bal test --groups performance

# Run validation tests
bal test --groups validation
```

## Test Groups

- **unit**: Tests that don't require external dependencies
- **integration**: Tests that require the GraphQL service to be running
- **mock**: Tests using mock data and utilities
- **types**: Tests for type definitions and structures
- **graphql**: All GraphQL-related tests
- **error**: Error handling and edge case tests
- **performance**: Performance and load tests
- **validation**: Data validation tests
- **json**: JSON parsing and handling tests
- **boundary**: Boundary condition tests

## Test Coverage

### Unit Tests
- ✅ Runtime record creation and validation
- ✅ Service record creation and validation
- ✅ Listener record creation and validation
- ✅ Resource record creation and validation
- ✅ GraphQL response type creation
- ✅ JSON methods parsing
- ✅ Null value handling
- ✅ Edge case validation
- ✅ Large dataset handling

### Mock Tests
- ✅ Mock data creation utilities
- ✅ Data transformation from DB records to GraphQL types
- ✅ Filtering logic simulation
- ✅ Empty result set handling
- ✅ Performance testing with large datasets
- ✅ JSON parsing for methods arrays
- ✅ Null value handling in records

### Integration Tests (requires running server)
- ✅ GraphQL endpoint health check
- ✅ Get all runtimes query
- ✅ Get runtimes with status filter
- ✅ Get runtimes with runtime type filter
- ✅ Get runtimes with combined filters
- ✅ Get specific runtime by ID
- ✅ Get services for runtime
- ✅ Get listeners for runtime
- ✅ Complex nested queries
- ✅ GraphQL variables usage
- ✅ GraphQL introspection
- ✅ Error handling for invalid queries
- ✅ Malformed request handling

## Sample Test Commands

```bash
# Run all tests with detailed output
bal test --debug

# Run tests and generate coverage report
bal test --code-coverage

# Run specific test function
bal test --tests testMockDataCreation

# Run tests matching a pattern
bal test --tests "*Runtime*"

# Run with specific configuration
bal test --offline
```

## GraphQL Test Queries

The integration tests use various GraphQL queries:

### Basic Queries
```graphql
query { runtimes { runtimeId runtimeType status } }
query { runtime(runtimeId: "test-id") { runtimeId status } }
```

### Filtered Queries
```graphql
query { runtimes(status: "RUNNING") { runtimeId status } }
query { runtimes(runtimeType: "MI") { runtimeId runtimeType } }
```

### Nested Queries
```graphql
query {
  runtimes {
    runtimeId
    services { name resources { url methods } }
    listeners { name protocol }
  }
}
```

### Queries with Variables
```graphql
query GetRuntimes($status: String) {
  runtimes(status: $status) { runtimeId status }
}
```

## Troubleshooting

### Common Issues

1. **Connection refused errors**: Ensure GraphQL service is running on port 9090
2. **Database connection errors**: Check database configuration in `Config.toml`
3. **Compilation errors**: Ensure all dependencies are properly imported
4. **Test timeouts**: Increase timeout values for integration tests if needed

### Debug Mode

```bash
# Run tests with debug logging
bal test --debug

# Run with verbose output
bal test -v
```

## Contributing

When adding new tests:

1. Follow the existing naming conventions
2. Use appropriate test groups
3. Include both positive and negative test cases
4. Add mock data utilities for reusable test data
5. Document any special setup requirements
6. Update this README if adding new test categories

## Test Data

All tests use either:
- Mock data created by utility functions
- In-memory test data that doesn't require external systems
- For integration tests: data from the running GraphQL service

No persistent test data is created or modified during testing.
