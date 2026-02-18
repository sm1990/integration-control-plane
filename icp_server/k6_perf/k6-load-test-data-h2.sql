-- ============================================================================
-- K6 LOAD TEST DATA GENERATION SCRIPT FOR H2 DATABASE
-- ============================================================================
-- This script generates realistic test data for load testing the ICP GraphQL API
-- Optimized for H2 database syntax
--
-- Data Scale:
-- - 1000 users (stress-test RBAC permission queries)
-- - 30 groups (realistic enterprise distribution)
-- - 50 projects
-- - 250 components (5 per project average)
-- - 500 runtimes (2 per component average, distributed across environments)
-- - 2000+ artifacts (services, listeners, data services, REST APIs)
--
-- Prerequisites: Run h2_init.sql first to create schema
-- ============================================================================

-- ============================================================================
-- 1. CREATE BASE ORGANIZATION, ENVIRONMENTS, AND ROLES
-- ============================================================================

-- Insert default organization if not exists
MERGE INTO organizations (org_id, org_name, org_handle, description) 
KEY(org_id)
VALUES (1, 'Load Test Organization', 'loadtest-org', 'Organization for K6 load testing');

-- Insert 3 environments (dev, staging, prod)
MERGE INTO environments (environment_id, name, description, critical, region)
KEY(environment_id)
VALUES
  ('750e8400-e29b-41d4-a716-446655440001', 'dev', 'Development environment', FALSE, 'us-west-2'),
  ('750e8400-e29b-41d4-a716-446655440003', 'staging', 'Staging environment', FALSE, 'us-west-2'),
  ('750e8400-e29b-41d4-a716-446655440002', 'prod', 'Production environment', TRUE, 'us-east-1');

-- Ensure all required roles exist (insert only if not exists to avoid conflicts)
INSERT INTO roles_v2 (role_id, role_name, org_id, description)
SELECT RANDOM_UUID(), 'Admin', 1, 'Administrative access to projects and integrations'
WHERE NOT EXISTS (SELECT 1 FROM roles_v2 WHERE role_name = 'Admin' AND org_id = 1);

INSERT INTO roles_v2 (role_id, role_name, org_id, description)
SELECT RANDOM_UUID(), 'Developer', 1, 'Development access with limited permissions'
WHERE NOT EXISTS (SELECT 1 FROM roles_v2 WHERE role_name = 'Developer' AND org_id = 1);

INSERT INTO roles_v2 (role_id, role_name, org_id, description)
SELECT RANDOM_UUID(), 'Viewer', 1, 'Read-only access with view permissions only'
WHERE NOT EXISTS (SELECT 1 FROM roles_v2 WHERE role_name = 'Viewer' AND org_id = 1);

INSERT INTO roles_v2 (role_id, role_name, org_id, description)
SELECT RANDOM_UUID(), 'Operator', 1, 'Operations access to manage environments and view logs'
WHERE NOT EXISTS (SELECT 1 FROM roles_v2 WHERE role_name = 'Operator' AND org_id = 1);

INSERT INTO roles_v2 (role_id, role_name, org_id, description)
SELECT RANDOM_UUID(), 'Monitor', 1, 'Monitoring access to view all resources and logs'
WHERE NOT EXISTS (SELECT 1 FROM roles_v2 WHERE role_name = 'Monitor' AND org_id = 1);

-- ============================================================================
-- 2. CREATE USERS (1000 users)
-- ============================================================================

-- Create super admin test user (use MERGE to avoid conflicts)
MERGE INTO users (user_id, username, display_name, is_super_admin) 
KEY(user_id)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'admin', 'Super Admin', TRUE);

-- Create test users for k6 with known credentials (use MERGE to avoid conflicts)
MERGE INTO users (user_id, username, display_name, is_super_admin) 
KEY(user_id)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'k6_developer', 'K6 Developer User', FALSE),
  ('550e8400-e29b-41d4-a716-446655440002', 'k6_viewer', 'K6 Viewer User', FALSE),
  ('550e8400-e29b-41d4-a716-446655440003', 'k6_operator', 'K6 Operator User', FALSE);

-- Generate 1000 regular users using H2's SYSTEM_RANGE
INSERT INTO users (user_id, username, display_name, is_super_admin)
SELECT 
    RANDOM_UUID(),
    CONCAT('loadtest_user_', LPAD(CAST(X AS VARCHAR), 4, '0')),
    CONCAT('Load Test User ', CAST(X AS VARCHAR)),
    FALSE
FROM SYSTEM_RANGE(1, 1000);

-- ============================================================================
-- 3. CREATE USER GROUPS (30 groups)
-- ============================================================================

INSERT INTO user_groups (group_id, group_name, org_uuid, description)
SELECT 
    RANDOM_UUID(),
    CONCAT('LoadTest-Team-', CAST(X AS VARCHAR)),
    1,
    CONCAT('Load test group ', CAST(X AS VARCHAR))
FROM SYSTEM_RANGE(1, 30);

-- ============================================================================
-- 4. CREATE PROJECTS (50 projects)
-- ============================================================================

INSERT INTO projects (
    project_id, 
    org_id, 
    name, 
    handler, 
    description, 
    owner_id,
    version,
    type,
    region
)
SELECT 
    RANDOM_UUID(),
    1,
    CONCAT('Project-', LPAD(CAST(X AS VARCHAR), 3, '0')),
    CONCAT('project-', LPAD(CAST(X AS VARCHAR), 3, '0')),
    CONCAT('Load test project number ', CAST(X AS VARCHAR)),
    '550e8400-e29b-41d4-a716-446655440000',
    '1.0.0',
    CASE WHEN MOD(X, 3) = 0 THEN 'API' WHEN MOD(X, 3) = 1 THEN 'INTEGRATION' ELSE 'SERVICE' END,
    CASE WHEN MOD(X, 2) = 0 THEN 'us-west-2' ELSE 'us-east-1' END
FROM SYSTEM_RANGE(1, 50);

-- ============================================================================
-- 5. CREATE COMPONENTS (250 components - 5 per project)
-- ============================================================================

INSERT INTO components (
    component_id,
    project_id,
    name,
    display_name,
    description,
    component_type,
    created_by
)
SELECT 
    RANDOM_UUID(),
    p.project_id,
    CONCAT('component-', LPAD(CAST(p.project_num AS VARCHAR), 3, '0'), '-', CAST(i.X AS VARCHAR)),
    CONCAT('Component ', CAST(i.X AS VARCHAR), ' for ', p.name),
    CONCAT('Load test component ', CAST(i.X AS VARCHAR)),
    CASE WHEN MOD(p.project_num + i.X, 2) = 0 THEN 'BI' ELSE 'MI' END,
    '550e8400-e29b-41d4-a716-446655440000'
FROM (
    SELECT project_id, name, ROW_NUMBER() OVER (ORDER BY name) as project_num
    FROM projects
) p
CROSS JOIN SYSTEM_RANGE(1, 5) i;

-- ============================================================================
-- 6. MAP USERS TO GROUPS (Distribute users across groups)
-- ============================================================================

-- Each user gets assigned to 1-3 groups
-- Primary group assignment (all 1000 users)
INSERT INTO group_user_mapping (group_id, user_uuid)
SELECT 
    g.group_id,
    u.user_id
FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY username) as user_num
    FROM users 
    WHERE username LIKE 'loadtest_user_%'
) u
INNER JOIN (
    SELECT group_id, ROW_NUMBER() OVER (ORDER BY group_name) as group_num
    FROM user_groups
) g ON MOD(u.user_num - 1, 30) + 1 = g.group_num;

-- Secondary group assignment (~70% of users get second group)
INSERT INTO group_user_mapping (group_id, user_uuid)
SELECT 
    g.group_id,
    u.user_id
FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY username) as user_num
    FROM users 
    WHERE username LIKE 'loadtest_user_%'
) u
INNER JOIN (
    SELECT group_id, ROW_NUMBER() OVER (ORDER BY group_name) as group_num
    FROM user_groups
) g ON MOD(u.user_num + 10, 30) + 1 = g.group_num
WHERE MOD(u.user_num, 10) < 7;

-- Tertiary group assignment (~30% of users get third group)
INSERT INTO group_user_mapping (group_id, user_uuid)
SELECT 
    g.group_id,
    u.user_id
FROM (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY username) as user_num
    FROM users 
    WHERE username LIKE 'loadtest_user_%'
) u
INNER JOIN (
    SELECT group_id, ROW_NUMBER() OVER (ORDER BY group_name) as group_num
    FROM user_groups
) g ON MOD(u.user_num + 20, 30) + 1 = g.group_num
WHERE MOD(u.user_num, 10) < 3;

-- Map k6 test users to specific groups
INSERT INTO group_user_mapping (group_id, user_uuid)
SELECT group_id, '550e8400-e29b-41d4-a716-446655440001'
FROM user_groups WHERE group_name = 'LoadTest-Team-1';

INSERT INTO group_user_mapping (group_id, user_uuid)
SELECT group_id, '550e8400-e29b-41d4-a716-446655440002'
FROM user_groups WHERE group_name = 'LoadTest-Team-2';

INSERT INTO group_user_mapping (group_id, user_uuid)
SELECT group_id, '550e8400-e29b-41d4-a716-446655440003'
FROM user_groups WHERE group_name = 'LoadTest-Team-3';

-- ============================================================================
-- 7. ASSIGN ROLES TO GROUPS WITH PROJECT SCOPE
-- ============================================================================

-- Groups 1-10: Developer role with access to 5 projects each
INSERT INTO group_role_mapping (group_id, role_id, org_uuid, project_uuid)
SELECT 
    g.group_id,
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Developer' LIMIT 1),
    1,
    p.project_id
FROM (
    SELECT group_id, ROW_NUMBER() OVER (ORDER BY group_name) as group_num
    FROM user_groups
    WHERE group_name LIKE 'LoadTest-Team-%'
) g
INNER JOIN (
    SELECT project_id, ROW_NUMBER() OVER (ORDER BY name) as project_num
    FROM projects
) p ON MOD((g.group_num - 1) * 5 + p.project_num - 1, 50) < 5
WHERE g.group_num <= 10;

-- Groups 11-20: Admin role with access to 3 projects each
INSERT INTO group_role_mapping (group_id, role_id, org_uuid, project_uuid)
SELECT 
    g.group_id,
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Admin' LIMIT 1),
    1,
    p.project_id
FROM (
    SELECT group_id, ROW_NUMBER() OVER (ORDER BY group_name) as group_num
    FROM user_groups
    WHERE group_name LIKE 'LoadTest-Team-%'
) g
INNER JOIN (
    SELECT project_id, ROW_NUMBER() OVER (ORDER BY name) as project_num
    FROM projects
) p ON MOD((g.group_num - 11) * 3 + p.project_num - 1, 50) < 3
WHERE g.group_num > 10 AND g.group_num <= 20;

-- Groups 21-25: Viewer role with org-wide access
INSERT INTO group_role_mapping (group_id, role_id, org_uuid)
SELECT 
    group_id,
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Viewer' LIMIT 1),
    1
FROM (
    SELECT group_id, ROW_NUMBER() OVER (ORDER BY group_name) as group_num
    FROM user_groups
    WHERE group_name LIKE 'LoadTest-Team-%'
) g
WHERE g.group_num > 20 AND g.group_num <= 25;

-- Groups 26-30: Operator role with access to 2 projects each
INSERT INTO group_role_mapping (group_id, role_id, org_uuid, project_uuid)
SELECT 
    g.group_id,
    (SELECT role_id FROM roles_v2 WHERE role_name = 'Operator' LIMIT 1),
    1,
    p.project_id
FROM (
    SELECT group_id, ROW_NUMBER() OVER (ORDER BY group_name) as group_num
    FROM user_groups
    WHERE group_name LIKE 'LoadTest-Team-%'
) g
INNER JOIN (
    SELECT project_id, ROW_NUMBER() OVER (ORDER BY name) as project_num
    FROM projects
) p ON MOD((g.group_num - 26) * 2 + p.project_num - 1, 50) < 2
WHERE g.group_num > 25;

-- ============================================================================
-- 8. CREATE RUNTIMES (500 runtimes distributed across components and environments)
-- ============================================================================

-- 250 runtimes in dev (50%)
INSERT INTO runtimes (
    runtime_id,
    name,
    project_id,
    component_id,
    environment_id,
    runtime_type,
    status,
    version,
    platform_name,
    platform_version,
    last_heartbeat
)
SELECT 
    RANDOM_UUID(),
    CONCAT(c.name, '-dev-runtime-', CAST(i.X AS VARCHAR)),
    c.project_id,
    c.component_id,
    '750e8400-e29b-41d4-a716-446655440001',
    c.component_type,
    CASE 
        WHEN MOD(c.comp_num + i.X, 10) < 8 THEN 'RUNNING'
        WHEN MOD(c.comp_num + i.X, 10) < 9 THEN 'OFFLINE'
        ELSE 'FAILED'
    END,
    '1.0.0',
    CASE WHEN c.component_type = 'BI' THEN 'ballerina' ELSE 'micro-integrator' END,
    CASE WHEN c.component_type = 'BI' THEN '2201.9.0' ELSE '4.3.0' END,
    CASE 
        WHEN MOD(c.comp_num + i.X, 10) < 8 THEN CURRENT_TIMESTAMP
        ELSE DATEADD('HOUR', -2, CURRENT_TIMESTAMP)
    END
FROM (
    SELECT 
        component_id, 
        project_id,
        name,
        component_type,
        ROW_NUMBER() OVER (ORDER BY name) as comp_num
    FROM components
) c
CROSS JOIN SYSTEM_RANGE(1, 1) i;

-- 150 runtimes in staging (30%)
INSERT INTO runtimes (
    runtime_id,
    name,
    project_id,
    component_id,
    environment_id,
    runtime_type,
    status,
    version,
    platform_name,
    platform_version,
    last_heartbeat
)
SELECT 
    RANDOM_UUID(),
    CONCAT(c.name, '-staging-runtime'),
    c.project_id,
    c.component_id,
    '750e8400-e29b-41d4-a716-446655440003',
    c.component_type,
    CASE
        WHEN MOD(c.comp_num, 10) < 9 THEN 'RUNNING'
        ELSE 'OFFLINE'
    END,
    '1.0.0',
    CASE WHEN c.component_type = 'BI' THEN 'ballerina' ELSE 'micro-integrator' END,
    CASE WHEN c.component_type = 'BI' THEN '2201.9.0' ELSE '4.3.0' END,
    CURRENT_TIMESTAMP
FROM (
    SELECT 
        component_id, 
        project_id,
        name,
        component_type,
        ROW_NUMBER() OVER (ORDER BY name) as comp_num
    FROM components
) c
WHERE MOD(c.comp_num, 5) < 3; -- 60% of components have staging runtime

-- 100 runtimes in prod (20%)
INSERT INTO runtimes (
    runtime_id,
    name,
    project_id,
    component_id,
    environment_id,
    runtime_type,
    status,
    version,
    platform_name,
    platform_version,
    last_heartbeat
)
SELECT 
    RANDOM_UUID(),
    CONCAT(c.name, '-prod-runtime'),
    c.project_id,
    c.component_id,
    '750e8400-e29b-41d4-a716-446655440002',
    c.component_type,
    'RUNNING',
    '1.0.0',
    CASE WHEN c.component_type = 'BI' THEN 'ballerina' ELSE 'micro-integrator' END,
    CASE WHEN c.component_type = 'BI' THEN '2201.9.0' ELSE '4.3.0' END,
    CURRENT_TIMESTAMP
FROM (
    SELECT 
        component_id, 
        project_id,
        name,
        component_type,
        ROW_NUMBER() OVER (ORDER BY name) as comp_num
    FROM components
) c
WHERE MOD(c.comp_num, 5) < 2; -- 40% of components have prod runtime

-- ============================================================================
-- 9. CREATE SERVICES (2-5 services per runtime)
-- ============================================================================

INSERT INTO bi_service_artifacts (
    runtime_id,
    service_name,
    service_package,
    base_path,
    state
)
SELECT 
    r.runtime_id,
    CONCAT('Service-', CAST(i.X AS VARCHAR)),
    CONCAT('com.loadtest.service', CAST(i.X AS VARCHAR)),
    CONCAT('/api/v1/service', CAST(i.X AS VARCHAR)),
    CASE WHEN MOD(r.runtime_num + i.X, 20) < 19 THEN 'enabled' ELSE 'disabled' END
FROM (
    SELECT runtime_id, ROW_NUMBER() OVER (ORDER BY name) as runtime_num
    FROM runtimes
) r
CROSS JOIN SYSTEM_RANGE(1, 3) i; -- 3 services per runtime = 1500 total

-- ============================================================================
-- 10. CREATE SERVICE RESOURCES (2-4 resources per service)
-- ============================================================================

INSERT INTO bi_service_resource_artifacts (
    runtime_id,
    service_name,
    resource_url,
    methods,
    method_first
)
SELECT 
    s.runtime_id,
    s.service_name,
    CONCAT('/', CASE WHEN i.X = 1 THEN 'list' WHEN i.X = 2 THEN 'get/[id]' ELSE 'create' END),
    CASE WHEN i.X = 1 THEN '["GET"]' WHEN i.X = 2 THEN '["GET"]' ELSE '["POST"]' END,
    CASE WHEN i.X = 1 THEN 'GET' WHEN i.X = 2 THEN 'GET' ELSE 'POST' END
FROM bi_service_artifacts s
CROSS JOIN SYSTEM_RANGE(1, 3) i; -- 3 resources per service

-- ============================================================================
-- 11. CREATE LISTENERS (1-2 listeners per runtime)
-- ============================================================================

INSERT INTO bi_runtime_listener_artifacts (
    runtime_id,
    listener_name,
    listener_package,
    protocol,
    listener_host,
    listener_port,
    state
)
SELECT 
    r.runtime_id,
    CONCAT('Listener-', CASE WHEN i.X = 1 THEN 'HTTP' ELSE 'HTTPS' END),
    'com.loadtest.listener',
    CASE WHEN i.X = 1 THEN 'HTTP' ELSE 'HTTPS' END,
    '0.0.0.0',
    CASE WHEN i.X = 1 THEN 8080 ELSE 8443 END,
    'enabled'
FROM runtimes r
CROSS JOIN SYSTEM_RANGE(1, 2) i; -- 2 listeners per runtime = 1000 total

-- ============================================================================
-- 12. CREATE DATA SERVICES (For MI runtimes - 0-2 per runtime)
-- ============================================================================

INSERT INTO mi_data_service_artifacts (
    runtime_id,
    service_name,
    artifact_id,
    description,
    state
)
SELECT
    r.runtime_id,
    CONCAT('DataService-', CAST(i.X AS VARCHAR)),
    RANDOM_UUID(),
    CONCAT('Data service ', CAST(i.X AS VARCHAR), ' for ', r.name),
    'enabled'
FROM (
    SELECT runtime_id, name, runtime_type, ROW_NUMBER() OVER (ORDER BY name) as runtime_num
    FROM runtimes
    WHERE runtime_type = 'MI'
) r
CROSS JOIN SYSTEM_RANGE(1, 2) i
WHERE MOD(r.runtime_num, 3) < 2; -- Only ~67% of MI runtimes have data services

-- ============================================================================
-- 13. CREATE REST APIs (For MI runtimes - 1-3 per runtime)
-- ============================================================================

INSERT INTO mi_api_artifacts (
    runtime_id,
    api_name,
    artifact_id,
    url,
    urls,
    context,
    version,
    state
)
SELECT 
    r.runtime_id,
    CONCAT('API-', CAST(i.X AS VARCHAR)),
    RANDOM_UUID(),
    CONCAT('http://api.loadtest.com/v1/resource', CAST(i.X AS VARCHAR)),
    CONCAT('["http://api.loadtest.com/v1/resource', CAST(i.X AS VARCHAR), '","https://api.loadtest.com/v1/resource', CAST(i.X AS VARCHAR), '"]'),
    CONCAT('/api/v1/resource', CAST(i.X AS VARCHAR)),
    '1.0.0',
    'enabled'
FROM (
    SELECT runtime_id, name, ROW_NUMBER() OVER (ORDER BY name) as runtime_num
    FROM runtimes
    WHERE runtime_type = 'MI'
) r
CROSS JOIN SYSTEM_RANGE(1, 2) i; -- 2 APIs per MI runtime

-- ============================================================================
-- 14. CREATE API RESOURCES (2-4 resources per API)
-- ============================================================================

INSERT INTO mi_api_resource_artifacts (
    runtime_id,
    api_name,
    resource_path,
    methods
)
SELECT 
    a.runtime_id,
    a.api_name,
    CASE 
        WHEN i.X = 1 THEN '/list'
        WHEN i.X = 2 THEN '/get/{id}'
        ELSE '/create'
    END,
    CASE 
        WHEN i.X = 1 THEN 'GET'
        WHEN i.X = 2 THEN 'GET'
        ELSE 'POST'
    END
FROM mi_api_artifacts a
CROSS JOIN SYSTEM_RANGE(1, 3) i; -- 3 resources per API

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================

SELECT '=== K6 LOAD TEST DATA GENERATION COMPLETE ===' AS STATUS;
SELECT '' AS BLANK;
SELECT 'Data Generation Summary:' AS SUMMARY;
SELECT 'Organizations: ' || CAST(COUNT(*) AS VARCHAR) AS count FROM organizations
UNION ALL
SELECT 'Users: ' || CAST(COUNT(*) AS VARCHAR) FROM users
UNION ALL
SELECT 'Groups: ' || CAST(COUNT(*) AS VARCHAR) FROM user_groups
UNION ALL
SELECT 'Projects: ' || CAST(COUNT(*) AS VARCHAR) FROM projects
UNION ALL
SELECT 'Components: ' || CAST(COUNT(*) AS VARCHAR) FROM components
UNION ALL
SELECT 'Environments: ' || CAST(COUNT(*) AS VARCHAR) FROM environments
UNION ALL
SELECT 'Runtimes: ' || CAST(COUNT(*) AS VARCHAR) FROM runtimes
UNION ALL
SELECT 'Services: ' || CAST(COUNT(*) AS VARCHAR) FROM bi_service_artifacts
UNION ALL
SELECT 'Service Resources: ' || CAST(COUNT(*) AS VARCHAR) FROM bi_service_resource_artifacts
UNION ALL
SELECT 'Listeners: ' || CAST(COUNT(*) AS VARCHAR) FROM bi_runtime_listener_artifacts
UNION ALL
SELECT 'Data Services: ' || CAST(COUNT(*) AS VARCHAR) FROM mi_data_service_artifacts
UNION ALL
SELECT 'REST APIs: ' || CAST(COUNT(*) AS VARCHAR) FROM mi_api_artifacts
UNION ALL
SELECT 'API Resources: ' || CAST(COUNT(*) AS VARCHAR) FROM mi_api_resource_artifacts
UNION ALL
SELECT 'Group-User Mappings: ' || CAST(COUNT(*) AS VARCHAR) FROM group_user_mapping
UNION ALL
SELECT 'Group-Role Mappings: ' || CAST(COUNT(*) AS VARCHAR) FROM group_role_mapping;

SELECT '' AS BLANK;
SELECT 'K6 Test Users (use these for load tests):' AS TEST_USERS;
SELECT '  - admin / admin (super admin)' AS user1
UNION ALL SELECT '  - k6_developer / password (developer role)' AS user2
UNION ALL SELECT '  - k6_viewer / password (viewer role)' AS user3
UNION ALL SELECT '  - k6_operator / password (operator role)' AS user4;

SELECT '' AS BLANK;
SELECT 'Runtime Distribution:' AS RUNTIME_DIST;
SELECT 
    e.name AS environment,
    COUNT(r.runtime_id) AS runtime_count,
    SUM(CASE WHEN r.status = 'RUNNING' THEN 1 ELSE 0 END) AS running,
    SUM(CASE WHEN r.status = 'OFFLINE' THEN 1 ELSE 0 END) AS offline,
    SUM(CASE WHEN r.status = 'FAILED' THEN 1 ELSE 0 END) AS failed
FROM environments e
LEFT JOIN runtimes r ON e.environment_id = r.environment_id
GROUP BY e.name
ORDER BY runtime_count DESC;

SELECT '' AS BLANK;
SELECT '=== READY FOR K6 LOAD TESTING ===' AS STATUS;
