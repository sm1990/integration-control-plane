// GraphQL Query Definitions
// This module contains all GraphQL queries used in the load tests

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

export const graphqlErrors = new Counter('graphql_errors');
export const graphqlDuration = new Trend('graphql_duration', true);

// =============================================================================
// QUERY DEFINITIONS
// =============================================================================

export const queries = {
  // Get all projects
  projects: `
    query GetProjects {
      projects {
        id
        name
        orgId
        handler
        description
        createdDate
        version
        owner
      }
    }
  `,
  
  // Get single project by ID
  project: `
    query GetProject($projectId: String!) {
      project(projectId: $projectId) {
        id
        name
        orgId
        handler
        description
        createdDate
        version
        owner
        region
        type
        gitProvider
        gitOrganization
        repository
        branch
      }
    }
  `,
  
  // Get components for a project
  components: `
    query GetComponents($orgHandler: String!, $projectId: String) {
      components(orgHandler: $orgHandler, projectId: $projectId) {
        id
        projectId
        orgHandler
        name
        handler
        displayName
        displayType
        description
        status
        componentType
        version
        createdAt
        updatedAt
        ownerName
        httpBased
        apiId
      }
    }
  `,
  
  // Get all components for an organization (no project filter)
  componentsForOrg: `
    query Components($orgHandler: String!) {
      components(orgHandler: $orgHandler) {
        id
        projectId
        orgHandler
        orgId
        name
        handler
        displayName
        displayType
        description
        ownerName
        status
        initStatus
        version
        createdAt
        lastBuildDate
        updatedAt
        componentSubType
        componentType
        labels
        isSystemComponent
        apiId
        httpBased
        isMigrationCompleted
        skipDeploy
        endpointShortUrlEnabled
        isUnifiedConfigMapping
        serviceAccessMode
        gitProvider
        gitOrganization
        gitRepository
        branch
        componentId
        createdBy
        updatedBy
      }
    }
  `,
  
  // Get single component by ID
  component: `
    query GetComponent($componentId: String!) {
      component(componentId: $componentId) {
        id
        projectId
        orgHandler
        name
        handler
        displayName
        displayType
        description
        status
        componentType
        version
        createdAt
        updatedAt
        ownerName
        repository {
          repositoryType
          repositoryBranch
          repositoryUrl
          gitProvider
        }
      }
    }
  `,
  
  // Get all runtimes (with optional filters)
  // Note: componentId is REQUIRED in the schema
  runtimes: `
    query GetRuntimes($componentId: String!, $projectId: String, $environmentId: String, $status: String) {
      runtimes(componentId: $componentId, projectId: $projectId, environmentId: $environmentId, status: $status) {
        runtimeId
        runtimeType
        status
        version
        platformName
        platformVersion
        registrationTime
        lastHeartbeat
        component {
          id
          name
          displayName
          projectId
        }
        environment {
          id
          name
          critical
        }
      }
    }
  `,
  
  // Get single runtime with nested artifacts (deep nesting test)
  runtime: `
    query GetRuntime($runtimeId: String!) {
      runtime(runtimeId: $runtimeId) {
        runtimeId
        runtimeType
        status
        version
        platformName
        platformVersion
        osName
        osVersion
        registrationTime
        lastHeartbeat
        component {
          id
          name
          displayName
          projectId
          componentType
        }
        environment {
          id
          name
          critical
          region
        }
        artifacts {
          services {
            name
            package
            basePath
            state
            resources {
              methods
              url
            }
          }
          listeners {
            name
            package
            protocol
            state
          }
        }
      }
    }
  `,
  
  // Get all environments
  environments: `
    query GetEnvironments($type: String, $projectId: String) {
      environments(type: $type, projectId: $projectId) {
        id
        name
        description
        critical
        region
        clusterId
        createdAt
        updatedAt
      }
    }
  `,
  
  // Get component deployment (complex query with multiple parameters)
  componentDeployment: `
    query GetComponentDeployment(
      $orgHandler: String!,
      $orgUuid: String!,
      $componentId: String!,
      $versionId: String!,
      $environmentId: String!
    ) {
      componentDeployment(
        orgHandler: $orgHandler,
        orgUuid: $orgUuid,
        componentId: $componentId,
        versionId: $versionId,
        environmentId: $environmentId
      ) {
        environmentId
        configCount
        apiId
        releaseId
        imageUrl
        invokeUrl
        versionId
        deploymentStatus
        deploymentStatusV2
        version
        build {
          buildId
          deployedAt
          runId
        }
      }
    }
  `,
  
  // Get services by environment and component
  servicesByEnvironmentAndComponent: `
    query GetServicesByEnvAndComponent($environmentId: String!, $componentId: String!) {
      servicesByEnvironmentAndComponent(environmentId: $environmentId, componentId: $componentId) {
        name
        package
        basePath
        state
        resources {
          methods
          url
        }
      }
    }
  `,
  
  // Get listeners by environment and component
  listenersByEnvironmentAndComponent: `
    query GetListenersByEnvAndComponent($environmentId: String!, $componentId: String!) {
      listenersByEnvironmentAndComponent(environmentId: $environmentId, componentId: $componentId) {
        name
        package
        protocol
        state
      }
    }
  `,
  
  // Get data services by environment and component
  dataServicesByEnvironmentAndComponent: `
    query GetDataServicesByEnvAndComponent($environmentId: String!, $componentId: String!) {
      dataServicesByEnvironmentAndComponent(environmentId: $environmentId, componentId: $componentId) {
        name
        description
        state
      }
    }
  `,
  
  // Get REST APIs by environment and component
  restApisByEnvironmentAndComponent: `
    query GetRestApisByEnvAndComponent($environmentId: String!, $componentId: String!) {
      restApisByEnvironmentAndComponent(environmentId: $environmentId, componentId: $componentId) {
        name
        context
        version
      }
    }
  `,
  
  // Get component artifact types
  componentArtifactTypes: `
    query GetComponentArtifactTypes($componentId: String!, $environmentId: String) {
      componentArtifactTypes(componentId: $componentId, environmentId: $environmentId) {
        artifactType
        artifactCount
      }
    }
  `,
};

// =============================================================================
// REQUEST BUILDER
// =============================================================================

/**
 * Execute a GraphQL query
 * @param {string} url - The GraphQL endpoint URL
 * @param {string} query - The GraphQL query string
 * @param {object} variables - Query variables
 * @param {string} token - Authentication token
 * @param {string} queryName - Name for tagging metrics
 * @returns {object} Response object
 */
export function executeGraphQLQuery(url, query, variables, token, queryName) {
  const payload = JSON.stringify({
    query: query,
    variables: variables || {},
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: {
      query: queryName,
    },
  };
  
  const startTime = new Date().getTime();
  const response = http.post(url, payload, params);
  const duration = new Date().getTime() - startTime;
  
  // Record custom metrics
  graphqlDuration.add(duration, { query: queryName });
  
  // Check for HTTP-level errors
  const statusOk = check(response, {
    'is status 200': (r) => r.status === 200,
  }, { query: queryName });
  
  if (!statusOk) {
    console.error(`HTTP error for ${queryName}: ${response.status} ${response.body}`);
    return response;
  }
  
  // Parse response
  let jsonResponse;
  try {
    jsonResponse = JSON.parse(response.body);
  } catch (e) {
    console.error(`Failed to parse JSON response for ${queryName}: ${e.message}`);
    return response;
  }
  
  // Check for GraphQL errors
  if (jsonResponse.errors && jsonResponse.errors.length > 0) {
    console.error(`GraphQL errors for ${queryName}:`, JSON.stringify(jsonResponse.errors));
    graphqlErrors.add(1, { query: queryName });
    
    check(response, {
      'has no graphql errors': () => false,
    }, { query: queryName });
  } else {
    check(response, {
      'has no graphql errors': () => true,
    }, { query: queryName });
  }
  
  // Validate data exists
  if (!jsonResponse.data) {
    console.warn(`No data in response for ${queryName}`);
  }
  
  return response;
}

// =============================================================================
// CONVENIENCE FUNCTIONS FOR EACH QUERY
// =============================================================================

export function getProjects(url, token) {
  return executeGraphQLQuery(url, queries.projects, {}, token, 'projects');
}

export function getProject(url, token, projectId) {
  return executeGraphQLQuery(
    url,
    queries.project,
    { projectId },
    token,
    'project'
  );
}

export function getComponents(url, token, orgHandler, projectId) {
  return executeGraphQLQuery(
    url,
    queries.components,
    { orgHandler, projectId },
    token,
    'components'
  );
}

export function getComponentsForOrg(url, token, orgHandler) {
  return executeGraphQLQuery(
    url,
    queries.componentsForOrg,
    { orgHandler },
    token,
    'componentsForOrg'
  );
}

export function getComponent(url, token, componentId) {
  return executeGraphQLQuery(
    url,
    queries.component,
    { componentId },
    token,
    'component'
  );
}

export function getRuntimes(url, token, componentId, filters = {}) {
  return executeGraphQLQuery(
    url,
    queries.runtimes,
    { componentId, ...filters },
    token,
    'runtimes'
  );
}

export function getRuntime(url, token, runtimeId) {
  return executeGraphQLQuery(
    url,
    queries.runtime,
    { runtimeId },
    token,
    'runtime'
  );
}

export function getEnvironments(url, token, filters = {}) {
  return executeGraphQLQuery(
    url,
    queries.environments,
    filters,
    token,
    'environments'
  );
}

export function getComponentDeployment(url, token, params) {
  return executeGraphQLQuery(
    url,
    queries.componentDeployment,
    params,
    token,
    'componentDeployment'
  );
}

export function getServicesByEnvironmentAndComponent(url, token, environmentId, componentId) {
  return executeGraphQLQuery(
    url,
    queries.servicesByEnvironmentAndComponent,
    { environmentId, componentId },
    token,
    'servicesByEnvAndComp'
  );
}

export function getListenersByEnvironmentAndComponent(url, token, environmentId, componentId) {
  return executeGraphQLQuery(
    url,
    queries.listenersByEnvironmentAndComponent,
    { environmentId, componentId },
    token,
    'listenersByEnvAndComp'
  );
}

export function getDataServicesByEnvironmentAndComponent(url, token, environmentId, componentId) {
  return executeGraphQLQuery(
    url,
    queries.dataServicesByEnvironmentAndComponent,
    { environmentId, componentId },
    token,
    'dataServicesByEnvAndComp'
  );
}

export function getRestApisByEnvironmentAndComponent(url, token, environmentId, componentId) {
  return executeGraphQLQuery(
    url,
    queries.restApisByEnvironmentAndComponent,
    { environmentId, componentId },
    token,
    'restApisByEnvAndComp'
  );
}

export function getComponentArtifactTypes(url, token, componentId, environmentId) {
  return executeGraphQLQuery(
    url,
    queries.componentArtifactTypes,
    { componentId, environmentId },
    token,
    'componentArtifactTypes'
  );
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Extract data from GraphQL response
 * @param {object} response - HTTP response
 * @param {string} queryName - Name of the query (matches root field)
 * @returns {any} The data or null
 */
export function extractData(response, queryName) {
  try {
    const json = JSON.parse(response.body);
    return json.data ? json.data[queryName] : null;
  } catch (e) {
    console.error(`Failed to extract data for ${queryName}: ${e.message}`);
    return null;
  }
}

/**
 * Check if response has data
 * @param {object} response - HTTP response
 * @returns {boolean}
 */
export function hasData(response) {
  try {
    const json = JSON.parse(response.body);
    return json.data !== null && json.data !== undefined;
  } catch (e) {
    return false;
  }
}
