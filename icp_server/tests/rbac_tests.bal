// Copyright (c) 2025, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
//
// WSO2 Inc. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import ballerina/jwt;
import ballerina/test;
import icp_server.types;
import icp_server.utils;

// Test configuration for JWT
final readonly & jwt:IssuerSignatureConfig testJwtSignatureConfig = {
    algorithm: jwt:HS256,
    config: "test-secret-key-for-rbac-testing-12345"
};

@test:Config {
    groups: ["rbac"]
}
function testExtractUserContextWithRoles() returns error? {
    // Create a test JWT token with roles (minimal RoleInfo format)
    jwt:IssuerConfig issuerConfig = {
        username: "test-user-123",
        issuer: "test-issuer",
        expTime: 3600,
        audience: "test-audience",
        signatureConfig: testJwtSignatureConfig,
        customClaims: {
            "username": "john.doe",
            "displayName": "John Doe",
            "roles": [
                {
                    "projectId": "project-1",
                    "environmentType": "prod",
                    "privilegeLevel": "admin"
                },
                {
                    "projectId": "project-2",
                    "environmentType": "non-prod",
                    "privilegeLevel": "developer"
                }
            ]
        }
    };
    
    string token = check jwt:issue(issuerConfig);
    string authHeader = string `Bearer ${token}`;
    
    // Extract user context
    types:UserContext userContext = check utils:extractUserContext(authHeader);
    
    // Verify user context
    test:assertEquals(userContext.userId, "test-user-123", "User ID should match");
    test:assertEquals(userContext.username, "john.doe", "Username should match");
    test:assertEquals(userContext.displayName, "John Doe", "Display name should match");
    test:assertEquals(userContext.roles.length(), 2, "Should have 2 roles");
    
    // Verify first role (no roleId in token)
    types:RoleInfo role1 = userContext.roles[0];
    test:assertEquals(role1.projectId, "project-1");
    test:assertEquals(role1.environmentType, types:PROD);
    test:assertEquals(role1.privilegeLevel, types:ADMIN);
    
    // Verify second role
    types:RoleInfo role2 = userContext.roles[1];
    test:assertEquals(role2.projectId, "project-2");
    test:assertEquals(role2.environmentType, types:NON_PROD);
    test:assertEquals(role2.privilegeLevel, types:DEVELOPER);
}

@test:Config {
    groups: ["rbac"]
}
function testExtractUserContextWithoutRoles() returns error? {
    // Create a test JWT token without roles
    jwt:IssuerConfig issuerConfig = {
        username: "test-user-456",
        issuer: "test-issuer",
        expTime: 3600,
        audience: "test-audience",
        signatureConfig: testJwtSignatureConfig,
        customClaims: {
            "username": "jane.smith",
            "displayName": "Jane Smith"
        }
    };
    
    string token = check jwt:issue(issuerConfig);
    string authHeader = string `Bearer ${token}`;
    
    // Extract user context
    types:UserContext userContext = check utils:extractUserContext(authHeader);
    
    // Verify user context
    test:assertEquals(userContext.userId, "test-user-456");
    test:assertEquals(userContext.username, "jane.smith");
    test:assertEquals(userContext.displayName, "Jane Smith");
    test:assertEquals(userContext.roles.length(), 0, "Should have 0 roles");
}

@test:Config {
    groups: ["rbac"]
}
function testHasAccessToProject() returns error? {
    types:UserContext userContext = {
        userId: "user-1",
        username: "testuser",
        displayName: "Test User",
        roles: [
            {
                projectId: "project-1",
                environmentType: types:PROD,
                privilegeLevel: types:ADMIN
            },
            {
                projectId: "project-2",
                environmentType: types:PROD,
                privilegeLevel: types:DEVELOPER
            }
        ]
    };
    
    // Test positive cases
    test:assertTrue(utils:hasAccessToProject(userContext, "project-1"), "Should have access to project-1");
    test:assertTrue(utils:hasAccessToProject(userContext, "project-2"), "Should have access to project-2");
    
    // Test negative case
    test:assertFalse(utils:hasAccessToProject(userContext, "project-3"), "Should NOT have access to project-3");
}

@test:Config {
    groups: ["rbac"]
}
function testHasAccessToEnvironment() returns error? {
    types:UserContext userContext = {
        userId: "user-1",
        username: "testuser",
        displayName: "Test User",
        roles: [
            {
                projectId: "project-1",
                environmentType: types:NON_PROD,
                privilegeLevel: types:ADMIN
            },
            {
                projectId: "project-1",
                environmentType: types:PROD,
                privilegeLevel: types:DEVELOPER
            }
        ]
    };
    
    // Test positive cases (use seeded environment IDs: dev/prod)
    test:assertTrue(utils:hasAccessToEnvironment(userContext, "project-1", "750e8400-e29b-41d4-a716-446655440001"), 
        "Should have access to project-1/dev");
    test:assertTrue(utils:hasAccessToEnvironment(userContext, "project-1", "750e8400-e29b-41d4-a716-446655440002"), 
        "Should have access to project-1/prod");
    
    // Test negative cases
    test:assertFalse(utils:hasAccessToEnvironment(userContext, "project-1", "env-staging"), 
        "Should NOT have access to project-1/env-staging");
    test:assertFalse(utils:hasAccessToEnvironment(userContext, "project-2", "750e8400-e29b-41d4-a716-446655440001"), 
        "Should NOT have access to project-2/env-dev");
}

@test:Config {
    groups: ["rbac"]
}
function testHasAdminAccess() returns error? {
    types:UserContext userContext = {
        userId: "user-1",
        username: "testuser",
        displayName: "Test User",
        roles: [
            {
                projectId: "project-1",
                environmentType: types:NON_PROD,
                privilegeLevel: types:ADMIN
            },
            {
                projectId: "project-1",
                environmentType: types:PROD,
                privilegeLevel: types:DEVELOPER
            }
        ]
    };
    
    // Test positive case (dev environment ID)
    test:assertTrue(utils:hasAdminAccess(userContext, "project-1", "750e8400-e29b-41d4-a716-446655440001"), 
        "Should have admin access to project-1/dev");
    
    // Test negative cases (prod environment ID and project-2 dev ID)
    test:assertFalse(utils:hasAdminAccess(userContext, "project-1", "750e8400-e29b-41d4-a716-446655440002"), 
        "Should NOT have admin access to project-1/prod (only developer)");
    test:assertFalse(utils:hasAdminAccess(userContext, "project-2", "750e8400-e29b-41d4-a716-446655440001"), 
        "Should NOT have admin access to project-2/dev");
}

@test:Config {
    groups: ["rbac"]
}
function testIsAdminInProject() returns error? {
    types:UserContext userContext = {
        userId: "user-1",
        username: "testuser",
        displayName: "Test User",
        roles: [
            {
                projectId: "project-1",
                environmentType: types:NON_PROD,
                privilegeLevel: types:ADMIN
            },
            {
                projectId: "project-2",
                environmentType: types:PROD,
                privilegeLevel: types:DEVELOPER
            }
        ]
    };
    
    // Test positive case
    test:assertTrue(utils:isAdminInProject(userContext, "project-1"), 
        "Should be admin in project-1");
    
    // Test negative cases
    test:assertFalse(utils:isAdminInProject(userContext, "project-2"), 
        "Should NOT be admin in project-2 (only developer)");
    test:assertFalse(utils:isAdminInProject(userContext, "project-3"), 
        "Should NOT be admin in project-3");
}

@test:Config {
    groups: ["rbac"]
}
function testGetAccessibleProjectIds() returns error? {
    types:UserContext userContext = {
        userId: "user-1",
        username: "testuser",
        displayName: "Test User",
        roles: [
            {
                projectId: "project-1",
                environmentType: types:NON_PROD,
                privilegeLevel: types:ADMIN
            },
            {
                projectId: "project-1",
                environmentType: types:PROD,
                privilegeLevel: types:DEVELOPER
            },
            {
                projectId: "project-2",
                environmentType: types:NON_PROD,
                privilegeLevel: types:ADMIN
            }
        ]
    };
    
    string[] projectIds = utils:getAccessibleProjectIds(userContext);
    
    // Should return unique project IDs (no duplicates)
    test:assertEquals(projectIds.length(), 2, "Should have 2 unique projects");
    test:assertTrue(projectIds.indexOf("project-1") != (), "Should include project-1");
    test:assertTrue(projectIds.indexOf("project-2") != (), "Should include project-2");
}

@test:Config {
    groups: ["rbac"]
}
function testGetAccessibleEnvironmentIds() returns error? {
    types:UserContext userContext = {
        userId: "user-1",
        username: "testuser",
        displayName: "Test User",
        roles: [
            {
                projectId: "project-1",
                environmentType: types:NON_PROD,
                privilegeLevel: types:ADMIN
            },
            {
                projectId: "project-1",
                environmentType: types:PROD,
                privilegeLevel: types:DEVELOPER
            },
            {
                projectId: "project-2",
                environmentType: types:NON_PROD,
                privilegeLevel: types:ADMIN
            }
        ]
    };
    
    // Test for project-1 (has NON_PROD and PROD roles)
    string[] env1Ids = utils:getAccessibleEnvironmentIds(userContext, "project-1");
    test:assertEquals(env1Ids.length(), 2, "Should have 2 environments for project-1");
    // Environment IDs seeded in DB: dev -> 750e8400-e29b-41d4-a716-446655440001, prod -> 750e8400-e29b-41d4-a716-446655440002
    test:assertTrue(env1Ids.indexOf("750e8400-e29b-41d4-a716-446655440001") != (), "Should include dev env ID");
    test:assertTrue(env1Ids.indexOf("750e8400-e29b-41d4-a716-446655440002") != (), "Should include prod env ID");

    // Test for project-2 (has ONLY NON_PROD role -> dev)
    string[] env2Ids = utils:getAccessibleEnvironmentIds(userContext, "project-2");
    test:assertEquals(env2Ids.length(), 1, "Should have 1 environment for project-2");
    test:assertTrue(env2Ids.indexOf("750e8400-e29b-41d4-a716-446655440001") != (), "Should include dev env ID");
    
    // Test for project with no access
    string[] env3Ids = utils:getAccessibleEnvironmentIds(userContext, "project-3");
    test:assertEquals(env3Ids.length(), 0, "Should have 0 environments for project-3");
}

@test:Config {
    groups: ["rbac"]
}
function testGetAccessibleEnvironmentIdsByType() returns error? {
    types:UserContext userContext = {
        userId: "user-1",
        username: "testuser",
        displayName: "Test User",
        roles: [
            {
                projectId: "project-1",
                environmentType: types:NON_PROD,
                privilegeLevel: types:ADMIN
            },
            {
                projectId: "project-1",
                environmentType: types:PROD,
                privilegeLevel: types:DEVELOPER
            },
            {
                projectId: "project-2",
                environmentType: types:NON_PROD,
                privilegeLevel: types:ADMIN
            }
        ]
    };
    
    // Test getting all accessible environments across all projects
    string[] accessibleEnvIds = check utils:getAccessibleEnvironmentIdsByType(userContext);
    test:assertEquals(accessibleEnvIds.length(), 2, "Should have 2 environments (dev and prod)");
    // Environment IDs seeded in DB: dev -> 750e8400-e29b-41d4-a716-446655440001, prod -> 750e8400-e29b-41d4-a716-446655440002
    test:assertTrue(accessibleEnvIds.indexOf("750e8400-e29b-41d4-a716-446655440001") != (), "Should include dev env ID");
    test:assertTrue(accessibleEnvIds.indexOf("750e8400-e29b-41d4-a716-446655440002") != (), "Should include prod env ID");
}

@test:Config {
    groups: ["rbac"]
}
function testGetAccessibleEnvironmentIdsByTypeNoRoles() returns error? {
    types:UserContext userContext = {
        userId: "user-1",
        username: "testuser",
        displayName: "Test User",
        roles: []
    };
    
    // Test getting all accessible environments with no roles
    string[] accessibleEnvIds = check utils:getAccessibleEnvironmentIdsByType(userContext);
    test:assertEquals(accessibleEnvIds.length(), 0, "Should have 0 environments with no roles");
}
