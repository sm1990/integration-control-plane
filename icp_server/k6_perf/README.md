# K6 Load Testing Suite for ICP GraphQL API

This directory contains k6 load tests for the Integration Control Plane (ICP) GraphQL API, focusing on read operations performance.

## Prerequisites

1. **Install k6**: 
   ```bash
   # macOS
   brew install k6
   
   # Or download from https://k6.io/docs/getting-started/installation/
   ```

2. **Running ICP Server**: Ensure the ICP server is running with:
   - Auth service on `https://localhost:9445`
   - GraphQL service on `http://localhost:9446`

3. **Test Data**: The tests assume you have some existing data. See [Generate and Connect to the Test Database](#generate-and-connect-to-the-test-database) for setting up a comprehensive test dataset.

## Quick Start

### Run All Tests (Default)
```bash
cd k6_perf
k6 run load-test.js
```

### Run Specific Scenarios

#### Smoke Test (Low Load - Quick Validation)
```bash
k6 run --env SCENARIO=smoke load-test.js
```

#### Load Test (Moderate Sustained Load)
```bash
k6 run --env SCENARIO=load load-test.js
```

#### Stress Test (High Load)
```bash
k6 run --env SCENARIO=stress load-test.js
```

#### Spike Test (Sudden Traffic Increase)
```bash
k6 run --env SCENARIO=spike load-test.js
```

### Custom Configuration

You can override configuration via environment variables:

```bash
# Custom endpoints
k6 run --env AUTH_BASE_URL=https://myserver:9445 --env GRAPHQL_BASE_URL=http://myserver:9446 load-test.js

# Custom credentials
k6 run --env USERNAME=myuser --env PASSWORD=mypass load-test.js

# Custom duration
k6 run --env DURATION=5m load-test.js

# Custom virtual users
k6 run --env VUS=20 load-test.js
```

## Test Structure

### Files

- **`load-test.js`**: Main test script with scenarios and test logic
- **`graphql-queries.js`**: GraphQL query definitions and request builders
- **`test-config.js`**: Configuration settings and thresholds
- **`setup-data.js`**: Helper to discover test data (projects, components, etc.)

### Test Scenarios

The suite includes multiple scenarios focusing on different read patterns:

1. **Projects List** - Fetch all projects (common dashboard view)
2. **Components List** - Fetch components for a project (nested data)
3. **Single Project** - Fetch single project details (by ID)
4. **Runtimes List** - Fetch runtimes with filters
5. **Runtime Details** - Fetch runtime with nested artifacts (deep nesting)
6. **Component Deployment** - Complex query with multiple parameters

### Metrics Collected

- **Response Time**: p50, p95, p99 percentiles
- **Throughput**: Requests per second
- **Error Rate**: Failed requests percentage
- **Success Rate**: Successful requests percentage
- **Per-Query Metrics**: Individual performance for each GraphQL query type

## Understanding Results

### Passing Criteria (Thresholds)

The tests are configured with the following default thresholds:

- **HTTP Request Duration (p95)**: < 500ms (95% of requests should complete within 500ms)
- **HTTP Request Duration (p99)**: < 1000ms (99% of requests should complete within 1s)
- **HTTP Request Failed**: < 1% (less than 1% error rate)
- **GraphQL Errors**: = 0 (no GraphQL-level errors)

### Example Output

```
scenarios: (100.00%) 1 scenario, 10 max VUs, 2m30s max duration
✓ is status 200
✓ has no graphql errors

checks.........................: 100.00% ✓ 2400      ✗ 0
data_received..................: 5.2 MB  43 kB/s
data_sent......................: 1.1 MB  9.1 kB/s
http_req_duration..............: avg=45ms   min=15ms med=42ms max=150ms p(95)=85ms p(99)=120ms
http_req_failed................: 0.00%   ✓ 0         ✗ 1200
http_reqs......................: 1200    10/s
iteration_duration.............: avg=250ms  min=200ms med=245ms max=450ms
iterations.....................: 1200    10/s
vus............................: 10      min=1       max=10
```

### What to Look For

- ✅ **All checks passing** (100% check rate)
- ✅ **p95 < 500ms**: Fast response times
- ✅ **http_req_failed = 0%**: No HTTP errors
- ⚠️ **p95 > 500ms**: Response times degrading under load
- ❌ **http_req_failed > 1%**: System errors under load
- ❌ **Failing thresholds**: Performance doesn't meet criteria

## Customization

### Adding New Queries

1. Add query definition to `graphql-queries.js`
2. Add scenario in `load-test.js`
3. Update thresholds in `test-config.js` if needed

### Adjusting Load

Edit `test-config.js` to modify:
- Virtual users (concurrent users)
- Test duration
- Ramp-up/ramp-down periods
- Thresholds

## Load Test Database Setup

A comprehensive test dataset is available in `k6-load-test-data-h2.sql` containing:
- 1,000 users (for RBAC stress testing)
- 30 groups with role assignments
- 50 projects
- 250 components (5 per project)
- 500 runtimes (dev/staging/prod environments)
- ~5,000 artifacts (services, listeners, data services, REST APIs)

### Generate and Connect to the Test Database

1. **Run base schema initialization:**
   ```bash
   java -cp ~/.ballerina/repositories/central.ballerina.io/bala/ballerinax/h2.driver/1.2.0/java21/platform/java21/h2-*.jar \
     org.h2.tools.RunScript \
     -url "jdbc:h2:file:./k6_perf/icp_load_test_db;MODE=MySQL;AUTO_SERVER=TRUE" \
     -user sa \
     -script resources/db/init-scripts/h2_init.sql
   ```

2. **Populate with load test data:**
   ```bash
   java -cp ~/.ballerina/repositories/central.ballerina.io/bala/ballerinax/h2.driver/1.2.0/java21/platform/java21/h2-*.jar \
     org.h2.tools.RunScript \
     -url "jdbc:h2:file:./k6_perf/icp_load_test_db;MODE=MySQL;AUTO_SERVER=TRUE" \
     -user sa \
     -script k6_perf/k6-load-test-data-h2.sql
   ```

3. **Update connection manager:**
   Edit `modules/storage/connection_manager.bal` to point to the test database:
   ```ballerina
   // Change the db client initialization line to:
   self.dbClient = check new jdbc:Client("jdbc:h2:file:./k6_perf/icp_load_test_db;MODE=MySQL;AUTO_SERVER=TRUE", "sa", "");
   ```

**Note:** You can modify `k6-load-test-data-h2.sql` to generate different data volumes or patterns based on your testing needs.

## Advanced Usage

### Generate HTML Report

```bash
k6 run --out json=test-results.json load-test.js
# Then convert to HTML using a reporting tool
```

### Run with InfluxDB + Grafana

```bash
k6 run --out influxdb=http://localhost:8086/k6 load-test.js
```

