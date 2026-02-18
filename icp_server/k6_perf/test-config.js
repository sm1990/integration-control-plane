// K6 Load Test Configuration
// This file contains all configuration parameters for the load tests

// =============================================================================
// SERVER CONFIGURATION
// =============================================================================

export const config = {
  // Base URLs (auth and GraphQL run on different ports)
  authBaseUrl: __ENV.AUTH_BASE_URL || 'https://localhost:9445',
  graphqlBaseUrl: __ENV.GRAPHQL_BASE_URL || 'http://localhost:9446',
  graphqlEndpoint: '/graphql',
  authEndpoint: '/auth/login',
  
  // Authentication
  credentials: {
    username: __ENV.USERNAME || 'admin',
    password: __ENV.PASSWORD || 'admin',
  },
  
  // Test execution parameters (can be overridden by SCENARIO env var)
  scenarios: {
    // Quick validation - 1 VU for 30 seconds
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
    },
    
    // Normal load - 10 VUs for 2 minutes
    load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },  // Ramp up to 10 VUs
        { duration: '1m30s', target: 10 }, // Stay at 10 VUs
        { duration: '30s', target: 0 },   // Ramp down
      ],
    },
    
    // Stress test - gradually increase to 50 VUs
    stress: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 20 },   // Ramp up to 20
        { duration: '2m', target: 20 },   // Stay at 20
        { duration: '1m', target: 50 },   // Ramp up to 50
        { duration: '2m', target: 50 },   // Stay at 50
        { duration: '1m', target: 0 },    // Ramp down
      ],
    },
    
    // Spike test - sudden increase in traffic
    spike: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 10 },  // Normal load
        { duration: '10s', target: 50 },  // Sudden spike
        { duration: '1m', target: 50 },   // Maintain spike
        { duration: '10s', target: 10 },  // Drop back
        { duration: '1m', target: 10 },   // Normal load
        { duration: '10s', target: 0 },   // Ramp down
      ],
    },
  },
};

// =============================================================================
// PERFORMANCE THRESHOLDS
// =============================================================================

export const thresholds = {
  // HTTP-level thresholds
  'http_req_duration': ['p(95)<500', 'p(99)<1000'],  // 95% under 500ms, 99% under 1s
  'http_req_failed': ['rate<0.01'],                   // Less than 1% failures
  
  // Custom checks
  'checks': ['rate>0.99'],                            // 99% of checks pass
  
  // Per-query thresholds (automatically tagged)
  'http_req_duration{query:projects}': ['p(95)<400'],
  'http_req_duration{query:project}': ['p(95)<300'],
  'http_req_duration{query:components}': ['p(95)<500'],
  'http_req_duration{query:componentsForOrg}': ['p(95)<600'],
  'http_req_duration{query:component}': ['p(95)<300'],
  'http_req_duration{query:runtimes}': ['p(95)<500'],
  'http_req_duration{query:runtime}': ['p(95)<400'],
  'http_req_duration{query:environments}': ['p(95)<400'],
  'http_req_duration{query:servicesByEnvAndComp}': ['p(95)<400'],
  'http_req_duration{query:listenersByEnvAndComp}': ['p(95)<400'],
  'http_req_duration{query:dataServicesByEnvAndComp}': ['p(95)<400'],
  'http_req_duration{query:restApisByEnvAndComp}': ['p(95)<400'],
  'http_req_duration{query:componentArtifactTypes}': ['p(95)<300'],
  
  // GraphQL-specific thresholds
  'graphql_errors': ['count==0'],                     // No GraphQL errors
};

// =============================================================================
// TEST DATA CONFIGURATION
// =============================================================================

export const testDataConfig = {
  // Whether to fail if test data is not found
  failOnMissingData: false,
  
  // Number of items to fetch in list queries (for pagination testing)
  defaultPageSize: 10,
  
  // Whether to validate response schema
  validateSchema: true,
};

// =============================================================================
// HTTP CLIENT CONFIGURATION
// =============================================================================

export const httpConfig = {
  // Disable SSL verification for self-signed certificates
  insecureSkipTLSVerify: true,
  
  // Request timeout
  timeout: '30s',
  
  // Headers
  headers: {
    'Content-Type': 'application/json',
  },
};

// =============================================================================
// REPORTING CONFIGURATION
// =============================================================================

export const reportingConfig = {
  // Summary trend stats to show
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  
  // Time unit for durations
  summaryTimeUnit: 'ms',
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the scenario configuration based on environment variable
 * @returns {object} Scenario configuration
 */
export function getScenarioConfig() {
  const scenarioName = __ENV.SCENARIO || 'load';
  const scenario = config.scenarios[scenarioName];
  
  if (!scenario) {
    console.warn(`Unknown scenario: ${scenarioName}, falling back to 'load'`);
    return config.scenarios.load;
  }
  
  return scenario;
}

/**
 * Get full GraphQL endpoint URL
 * @returns {string} Full URL
 */
export function getGraphQLUrl() {
  return `${config.graphqlBaseUrl}${config.graphqlEndpoint}`;
}

/**
 * Get full auth endpoint URL
 * @returns {string} Full URL
 */
export function getAuthUrl() {
  return `${config.authBaseUrl}${config.authEndpoint}`;
}

/**
 * Apply environment variable overrides to configuration
 */
export function applyEnvOverrides() {
  // Allow overriding VUs and duration via environment variables
  if (__ENV.VUS) {
    const vus = parseInt(__ENV.VUS);
    if (!isNaN(vus)) {
      // Override VUs in all scenarios
      Object.keys(config.scenarios).forEach(key => {
        if (config.scenarios[key].vus) {
          config.scenarios[key].vus = vus;
        }
        if (config.scenarios[key].startVUs) {
          config.scenarios[key].startVUs = Math.max(1, Math.floor(vus / 10));
        }
        if (config.scenarios[key].stages) {
          config.scenarios[key].stages = config.scenarios[key].stages.map(stage => ({
            ...stage,
            target: stage.target > 0 ? vus : 0,
          }));
        }
      });
    }
  }
  
  if (__ENV.DURATION) {
    // Override duration (for constant-vus executor only)
    Object.keys(config.scenarios).forEach(key => {
      if (config.scenarios[key].executor === 'constant-vus') {
        config.scenarios[key].duration = __ENV.DURATION;
      }
    });
  }
}

// Apply any environment overrides
applyEnvOverrides();
