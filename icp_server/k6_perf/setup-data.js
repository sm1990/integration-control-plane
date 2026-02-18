// Setup Data Discovery
// This module discovers test data (projects, components, runtimes) during setup phase

import http from 'k6/http';
import { check } from 'k6';
import { getProjects, getComponents, getRuntimes, getEnvironments, extractData } from './graphql-queries.js';

/**
 * Discover test data by querying the GraphQL API
 * This runs once during the setup phase
 * @param {string} graphqlUrl - GraphQL endpoint URL
 * @param {string} token - Auth token
 * @returns {object} Test data object with IDs for use in tests
 */
export function discoverTestData(graphqlUrl, token) {
  console.log('🔍 Discovering test data...');
  
  const testData = {
    projects: [],
    components: [],
    runtimes: [],
    environments: [],
    // Specific IDs for testing
    projectId: null,
    componentId: null,
    runtimeId: null,
    environmentId: null,
    orgHandler: null,
    orgUuid: null,
  };
  
  // 1. Get Projects
  console.log('  → Fetching projects...');
  const projectsResponse = getProjects(graphqlUrl, token);
  const projects = extractData(projectsResponse, 'projects');
  
  if (projects && projects.length > 0) {
    testData.projects = projects;
    testData.projectId = projects[0].id; // Use 'id' not 'projectId'
    testData.orgHandler = projects[0].handler; // Use project handler as org handler
    console.log(`  ✓ Found ${projects.length} project(s), using projectId: ${testData.projectId}`);
  } else {
    console.warn('  ⚠ No projects found - create at least one project for better test coverage');
  }
  
  // 2. Get Environments
  console.log('  → Fetching environments...');
  const environmentsResponse = getEnvironments(graphqlUrl, token);
  const environments = extractData(environmentsResponse, 'environments');
  
  if (environments && environments.length > 0) {
    testData.environments = environments;
    testData.environmentId = environments[0].id; // Use 'id' not 'environmentId'
    // Try to get orgUuid from environment if available
    if (environments[0].orgUuid) {
      testData.orgUuid = environments[0].orgUuid;
    }
    console.log(`  ✓ Found ${environments.length} environment(s), using environmentId: ${testData.environmentId}`);
  } else {
    console.warn('  ⚠ No environments found - create at least one environment for better test coverage');
  }
  
  // 3. Get Components (if we have a project and orgHandler)
  if (testData.projectId && testData.orgHandler) {
    console.log('  → Fetching components...');
    const componentsResponse = getComponents(graphqlUrl, token, testData.orgHandler, testData.projectId);
    const components = extractData(componentsResponse, 'components');
    
    if (components && components.length > 0) {
      testData.components = components;
      testData.componentId = components[0].id;
      console.log(`  ✓ Found ${components.length} component(s), using componentId: ${testData.componentId}`);
    } else {
      console.warn('  ⚠ No components found for this project');
    }
  } else {
    console.warn('  ⚠ Skipping component fetch (no project or orgHandler available)');
  }
  
  // 4. Get Runtimes (requires componentId)
  if (testData.componentId) {
    console.log('  → Fetching runtimes...');
    const runtimeFilters = testData.projectId ? { projectId: testData.projectId } : {};
    const runtimesResponse = getRuntimes(graphqlUrl, token, testData.componentId, runtimeFilters);
    const runtimes = extractData(runtimesResponse, 'runtimes');
  
    if (runtimes && runtimes.length > 0) {
      testData.runtimes = runtimes;
      testData.runtimeId = runtimes[0].runtimeId;
      console.log(`  ✓ Found ${runtimes.length} runtime(s), using runtimeId: ${testData.runtimeId}`);
    } else {
      console.warn('  ⚠ No runtimes found - some tests may be skipped');
    }
  } else {
    console.warn('  ⚠ Skipping runtime fetch (no componentId available)');
  }
  
  // Summary
  console.log('\n📊 Test Data Summary:');
  console.log(`   Projects: ${testData.projects.length}`);
  console.log(`   Components: ${testData.components.length}`);
  console.log(`   Runtimes: ${testData.runtimes.length}`);
  console.log(`   Environments: ${testData.environments.length}`);
  console.log('');
  
  if (testData.projects.length === 0) {
    console.warn('⚠️  WARNING: No test data found. Tests will have limited coverage.');
    console.warn('   Please create at least one project, component, and runtime for full test coverage.');
  }
  
  return testData;
}

/**
 * Validate that we have minimum required test data
 * @param {object} testData - Test data object
 * @returns {boolean} True if we have minimum data
 */
export function validateTestData(testData) {
  const hasMinimumData = testData.projects.length > 0;
  
  if (!hasMinimumData) {
    console.error('❌ Minimum test data not available. Please create test data before running load tests.');
    return false;
  }
  
  return true;
}

/**
 * Get a random item from an array
 * @param {array} array - Array to pick from
 * @returns {any} Random item or null
 */
export function getRandomItem(array) {
  if (!array || array.length === 0) {
    return null;
  }
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Create a data selector that cycles through test data
 * Useful for distributing load across different entities
 * @param {array} array - Array to cycle through
 * @returns {function} Function that returns next item
 */
export function createDataSelector(array) {
  let index = 0;
  return function() {
    if (!array || array.length === 0) {
      return null;
    }
    const item = array[index % array.length];
    index++;
    return item;
  };
}
