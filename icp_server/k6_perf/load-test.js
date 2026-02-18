// K6 Load Test for ICP GraphQL API
// This script tests read operations (queries) on the GraphQL API

import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Import our modules
import { 
  config, 
  thresholds, 
  httpConfig, 
  getGraphQLUrl, 
  getAuthUrl,
  getScenarioConfig 
} from './test-config.js';

import {
  getProjects,
  getProject,
  getComponents,
  getComponentsForOrg,
  getComponent,
  getRuntimes,
  getRuntime,
  getEnvironments,
  getServicesByEnvironmentAndComponent,
  getListenersByEnvironmentAndComponent,
  getDataServicesByEnvironmentAndComponent,
  getRestApisByEnvironmentAndComponent,
  getComponentArtifactTypes,
  extractData,
} from './graphql-queries.js';

import {
  discoverTestData,
  validateTestData,
  getRandomItem,
  createDataSelector,
} from './setup-data.js';

// =============================================================================
// TEST OPTIONS
// =============================================================================

export const options = {
  // Scenario configuration
  scenarios: {
    load_test: getScenarioConfig(),
  },
  
  // Performance thresholds
  thresholds: thresholds,
  
  // HTTP configuration
  insecureSkipTLSVerify: httpConfig.insecureSkipTLSVerify,
  
  // Summary configuration
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  summaryTimeUnit: 'ms',
};

// =============================================================================
// SETUP PHASE - Runs once before the test
// =============================================================================

export function setup() {
  console.log('🚀 Starting ICP GraphQL API Load Test\n');
  console.log('Configuration:');
  console.log(`  GraphQL URL: ${getGraphQLUrl()}`);
  console.log(`  Auth URL: ${getAuthUrl()}`);
  console.log(`  Username: ${config.credentials.username}`);
  console.log('');
  
  // 1. Authenticate and get token
  console.log('🔐 Authenticating...');
  const authPayload = JSON.stringify(config.credentials);
  const authParams = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '30s',
  };
  
  const authResponse = http.post(getAuthUrl(), authPayload, authParams);
  
  // Check status code first
  if (authResponse.status !== 200) {
    console.error('❌ Authentication failed!');
    console.error(`Status: ${authResponse.status}`);
    console.error(`Body: ${authResponse.body}`);
    throw new Error('Authentication failed - cannot proceed with tests');
  }
  
  // Parse response
  let authData;
  try {
    authData = JSON.parse(authResponse.body);
  } catch (e) {
    console.error('❌ Failed to parse auth response!');
    console.error(`Body: ${authResponse.body}`);
    console.error(`Error: ${e.message}`);
    throw new Error('Authentication failed - invalid JSON response');
  }
  
  // Check for token (the auth endpoint returns 'token', not 'accessToken')
  if (!authData.token) {
    console.error('❌ Authentication response missing token!');
    console.error(`Response: ${JSON.stringify(authData)}`);
    throw new Error('Authentication failed - no token in response');
  }
  
  const token = authData.token;
  console.log('✓ Authentication successful\n');
  
  // 2. Discover test data
  const testData = discoverTestData(getGraphQLUrl(), token);
  
  // 3. Validate test data
  if (!validateTestData(testData)) {
    console.warn('⚠️  Proceeding with limited test coverage due to missing test data');
  }
  
  console.log('✓ Setup complete, starting load test...\n');
  
  // Debug: Show what will be tested
  console.log('📋 Test execution plan:');
  console.log('   ✓ projects query - will execute');
  console.log('   ✓ environments query - will execute');
  console.log(`   ${testData.orgHandler ? '✓' : '✗'} componentsForOrg query - ${testData.orgHandler ? 'will execute' : 'SKIPPED (no orgHandler)'}`);
  console.log(`   ${testData.projectId ? '✓' : '✗'} project query - ${testData.projectId ? 'will execute' : 'SKIPPED (no projectId)'}`);
  console.log(`   ${testData.orgHandler && testData.projectId ? '✓' : '✗'} components query - ${testData.orgHandler && testData.projectId ? 'will execute' : 'SKIPPED (no orgHandler or projectId)'}`);
  console.log(`   ${testData.componentId ? '✓' : '✗'} component query - ${testData.componentId ? 'will execute' : 'SKIPPED (no componentId)'}`);

  console.log(`   ${testData.componentId ? '✓' : '✗'} runtimes query - ${testData.componentId ? 'will execute' : 'SKIPPED (no componentId)'}`);
  console.log(`   ${testData.runtimeId ? '✓' : '✗'} runtime query - ${testData.runtimeId ? 'will execute' : 'SKIPPED (no runtimeId)'}`);
  console.log(`   ${testData.componentId && testData.environmentId ? '✓' : '✗'} componentArtifactTypes - ${testData.componentId && testData.environmentId ? 'will execute' : 'SKIPPED (no componentId or environmentId)'}`);
  console.log(`   ${testData.componentId && testData.environmentId ? '✓' : '✗'} servicesByEnvAndComp - ${testData.componentId && testData.environmentId ? 'will execute' : 'SKIPPED (no componentId or environmentId)'}`);
  console.log(`   ${testData.componentId && testData.environmentId ? '✓' : '✗'} listenersByEnvAndComp - ${testData.componentId && testData.environmentId ? 'will execute' : 'SKIPPED (no componentId or environmentId)'}`);
  console.log(`   ${testData.componentId && testData.environmentId ? '✓' : '✗'} dataServicesByEnvAndComp - ${testData.componentId && testData.environmentId ? 'will execute' : 'SKIPPED (no componentId or environmentId)'}`);
  console.log(`   ${testData.componentId && testData.environmentId ? '✓' : '✗'} restApisByEnvAndComp - ${testData.componentId && testData.environmentId ? 'will execute' : 'SKIPPED (no componentId or environmentId)'}`);
  console.log('');
  console.log('═'.repeat(80));
  console.log('');
  
  return {
    token: token,
    testData: testData,
  };
}

// =============================================================================
// MAIN TEST SCENARIO
// =============================================================================

export default function(data) {
  const { token, testData } = data;
  const graphqlUrl = getGraphQLUrl();
  
  // Create data selectors for cycling through test data
  const projectSelector = createDataSelector(testData.projects);
  const componentSelector = createDataSelector(testData.components);
  const runtimeSelector = createDataSelector(testData.runtimes);
  
  // Query 1: Get all projects (common dashboard view)
  getProjects(graphqlUrl, token);
  sleep(0.5);
  
  // Query 2: Get environments (common for filtering)
  getEnvironments(graphqlUrl, token);
  sleep(0.5);
  
  // Query 3: Get all components for organization (if available)
  if (testData.orgHandler) {
    getComponentsForOrg(graphqlUrl, token, testData.orgHandler);
    sleep(0.5);
  }
  
  // Query 4: Get single project (if available)
  const project = projectSelector();
  if (project && project.id) {
    getProject(graphqlUrl, token, project.id);
    sleep(0.5);
  }
  
  // Query 5: Get components for a project (if available)
  if (testData.orgHandler && testData.projectId) {
    getComponents(graphqlUrl, token, testData.orgHandler, testData.projectId);
    sleep(0.5);
  }
  
  // Query 6: Get single component (if available)
  const component = componentSelector();
  if (component && component.id) {
    getComponent(graphqlUrl, token, component.id);
    sleep(0.5);
  }
  
  // Query 6: Get runtimes with filter (requires componentId)
  if (testData.componentId) {
    const filters = testData.projectId ? { projectId: testData.projectId } : {};
    getRuntimes(graphqlUrl, token, testData.componentId, filters);
    sleep(0.5);
  }
  
  // Query 7: Get single runtime with artifacts (deep nesting - if available)
  const runtime = runtimeSelector();
  if (runtime && runtime.runtimeId) {
    getRuntime(graphqlUrl, token, runtime.runtimeId);
    sleep(0.5);
  }
  
  // Query 8: Get artifact types for component (if available)
  if (testData.componentId && testData.environmentId) {
    getComponentArtifactTypes(graphqlUrl, token, testData.componentId, testData.environmentId);
    sleep(0.5);
  }
  
  // Query 9: Get services by environment and component (artifact query)
  if (testData.componentId && testData.environmentId) {
    getServicesByEnvironmentAndComponent(graphqlUrl, token, testData.environmentId, testData.componentId);
    sleep(0.5);
  }
  
  // Query 10: Get listeners by environment and component (artifact query)
  if (testData.componentId && testData.environmentId) {
    getListenersByEnvironmentAndComponent(graphqlUrl, token, testData.environmentId, testData.componentId);
    sleep(0.5);
  }
  
  // Query 11: Get data services by environment and component (artifact query)
  if (testData.componentId && testData.environmentId) {
    getDataServicesByEnvironmentAndComponent(graphqlUrl, token, testData.environmentId, testData.componentId);
    sleep(0.5);
  }
  
  // Query 12: Get REST APIs by environment and component (artifact query)
  if (testData.componentId && testData.environmentId) {
    getRestApisByEnvironmentAndComponent(graphqlUrl, token, testData.environmentId, testData.componentId);
    sleep(0.5);
  }
  
  // Add some think time between iterations (simulating user behavior)
  sleep(1);
}

// =============================================================================
// TEARDOWN PHASE - Runs once after the test
// =============================================================================

export function teardown(data) {
  console.log('');
  console.log('═'.repeat(80));
  console.log('');
  console.log('✅ Load test completed');
}

// =============================================================================
// CUSTOM SUMMARY REPORT
// =============================================================================

export function handleSummary(data) {
  // First, generate the standard text summary (this will be printed)
  const stdoutSummary = textSummary(data, { indent: '  ', enableColors: true });
  
  // Extract per-endpoint metrics from the data.metrics object
  const metrics = data.metrics;
  const queryMetrics = {};
  
  // Look through all metrics to find those with query tags
  Object.keys(metrics).forEach(metricName => {
    // Look for metrics like "http_req_duration{query:projects}"
    const match = metricName.match(/http_req_duration\{query:([^}]+)\}/);
    if (match) {
      const queryName = match[1];
      const metricData = metrics[metricName];
      
      if (metricData && metricData.values) {
        queryMetrics[queryName] = {
          avg: metricData.values.avg,
          min: metricData.values.min,
          med: metricData.values.med,
          max: metricData.values.max,
          p90: metricData.values['p(90)'],
          p95: metricData.values['p(95)'],
          p99: metricData.values['p(99)'],
        };
      }
    }
  });
  
  // Build the per-endpoint table as a string
  let endpointTable = '\n\n';
  endpointTable += '═'.repeat(100) + '\n';
  endpointTable += '                         PER-ENDPOINT PERFORMANCE METRICS\n';
  endpointTable += '═'.repeat(100) + '\n\n';
  
  if (Object.keys(queryMetrics).length > 0) {
    endpointTable += 'Query Name                      │   Avg │   Min │   Med │   Max │   P90 │   P95 │   P99\n';
    endpointTable += '─'.repeat(100) + '\n';
    
    // Sort by query name for consistent output
    const sortedQueries = Object.keys(queryMetrics).sort();
    
    sortedQueries.forEach(queryName => {
      const m = queryMetrics[queryName];
      if (m.avg !== undefined) {
        const name = queryName.padEnd(31);
        const avg = (m.avg || 0).toFixed(2).padStart(6);
        const min = (m.min || 0).toFixed(2).padStart(6);
        const med = (m.med || 0).toFixed(2).padStart(6);
        const max = (m.max || 0).toFixed(2).padStart(6);
        const p90 = (m.p90 || 0).toFixed(2).padStart(6);
        const p95 = (m.p95 || 0).toFixed(2).padStart(6);
        const p99 = (m.p99 || 0).toFixed(2).padStart(6);
        
        endpointTable += `${name}│${avg} │${min} │${med} │${max} │${p90} │${p95} │${p99}\n`;
      }
    });
    
    endpointTable += '\n';
    endpointTable += 'All times in milliseconds (ms)\n';
  } else {
    endpointTable += '⚠️  No per-endpoint metrics found\n';
    endpointTable += 'Debug: Available metric keys:\n';
    endpointTable += Object.keys(metrics).slice(0, 10).join('\n') + '\n';
  }
  
  endpointTable += '\n' + '═'.repeat(100) + '\n\n';
  
  // Combine stdout summary with endpoint table
  const combinedOutput = stdoutSummary + endpointTable;
  
  // Return the outputs
  return {
    'stdout': combinedOutput,
    'summary.html': htmlReport(data),
  };
}
