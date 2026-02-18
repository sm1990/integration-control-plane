# RBAC v2 Implementation Plan

## Overview

This document outlines the 8-stage implementation plan for migrating from the current simple role-based access control system to a comprehensive permission-based authorization system with group management and hierarchical access control.

### Current RBAC Model (To Be Removed)
The existing system has:
- **Simple project-scoped roles**: `roles` table with `project_id`, `environment_type` (prod/non-prod), and `privilege_level` (admin/developer)
- **Direct user-role mapping**: `user_roles` table directly linking users to roles
- **Role format**: `<project_name>:<env_type>:<privilege_level>`
- **Authorization helpers**: Functions like `hasAccessToProject`, `hasAccessToEnvironment`, `hasAdminAccess` in `auth_utils.bal`
- **JWT token-based context**: Roles embedded in JWT and extracted for each request

### New RBAC Model (To Be Implemented)
The new model introduces:
- **5 Permission Domains**: Integration Management, Environment Management, Project Management, Observability Management, User Management
- **Fine-grained permissions**: Actions (view, edit, manage) on resources (project, environment, component, user)
- **Group-based access**: Users → Groups → Roles → Permissions
- **Contextual scoping**: Permissions can be scoped at org, project, environment, **and integration levels**
- **Pre-defined roles**: Super Admin, Admin, Developer with specific permission sets
- **Hierarchical access inheritance**: Org-level access cascades to projects, environments, and integrations

### Additional Requirement
An `integration_uuid` column will be added to the `group_role_mapping` table to provide integration-level granularity:
- Users can have permissions scoped to specific integrations/components
- A new view `v_user_integration_access` will handle integration-level access with full inheritance chain
- Existing views (`v_user_project_access`, `v_user_environment_access`) remain focused on their respective scopes

### Key Implementation Decisions

1. **Group-Based Only**: All permissions are assigned via groups. The path is always: permission → role → group → user
2. **Organization Support**: The `organizations` table already exists with a default org (id='1'). This provides future multi-tenant support with no performance impact
3. **No Migration Needed**: Since there's no alpha release yet, we implement the new system from scratch without migrating from the old RBAC model
4. **Parallel Data Layer**: New tables will coexist with old ones (e.g., `roles_v2`) until service layer is ready
5. **Big Bang Service Layer**: Service layer will switch to new auth system in one go (Stage 6)

---

## Stage 1: Database Schema Changes

**Objective**: Set up the new authorization tables without breaking existing functionality

### Tasks

1. Create new tables in migration scripts:
   - `groups` (with org_uuid referencing existing organizations table)
   - `roles_v2` table (keep old `roles` table for now)
   - `permissions`
   - `group_user_mapping`
   - `group_role_mapping` (with org_uuid, project_uuid, env_uuid, **and integration_uuid** columns)
   - `role_permission_mapping`

2. Define `group_role_mapping` with all context levels:
   ```sql
   CREATE TABLE group_role_mapping (
       id BIGINT AUTO_INCREMENT PRIMARY KEY,
       group_id VARCHAR(36) NOT NULL,
       role_id VARCHAR(36) NOT NULL,
       org_uuid VARCHAR(36) NULL,           -- Org-level scope (default '1')
       project_uuid VARCHAR(36) NULL,        -- Project-level scope
       env_uuid VARCHAR(36) NULL,            -- Environment filter (cross-cutting)
       integration_uuid VARCHAR(36) NULL,    -- Integration-level scope (NEW)
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (group_id) REFERENCES `groups`(group_id) ON DELETE CASCADE,
       FOREIGN KEY (role_id) REFERENCES roles_v2(role_id) ON DELETE CASCADE,
       FOREIGN KEY (org_uuid) REFERENCES organizations(org_uuid) ON DELETE CASCADE,
       FOREIGN KEY (project_uuid) REFERENCES projects(project_uuid) ON DELETE CASCADE,
       FOREIGN KEY (env_uuid) REFERENCES environments(env_uuid) ON DELETE CASCADE,
       FOREIGN KEY (integration_uuid) REFERENCES components(component_id) ON DELETE CASCADE,
       -- Ensure integration_uuid requires project_uuid (for navigation)
       CONSTRAINT chk_integration_requires_project
           CHECK (integration_uuid IS NULL OR project_uuid IS NOT NULL),
       UNIQUE KEY unique_group_role_context (group_id, role_id, org_uuid, project_uuid, env_uuid, integration_uuid),
       -- Indexes for performance
       INDEX idx_group_id (group_id),
       INDEX idx_role_id (role_id),
       INDEX idx_org_uuid (org_uuid),
       INDEX idx_project_uuid (project_uuid),
       INDEX idx_env_uuid (env_uuid),
       INDEX idx_integration_uuid (integration_uuid)
   );
   ```
   
   **Scoping Rules**:
   - `org_uuid`: Always set (default '1' for single-tenant)
   - `project_uuid`: Set for project/integration scope; NULL for org-wide
   - `env_uuid`: Acts as environment FILTER at any scope; NULL = all environments
   - `integration_uuid`: Set for integration-specific access; REQUIRES project_uuid for navigation
   
   **Access Examples**:
   ```sql
   -- Org-wide, all environments
   ('group-1', 'admin-role', '1', NULL, NULL, NULL)
   
   -- Org-wide, only prod environments
   ('group-2', 'prod-viewer', '1', NULL, 'env-prod', NULL)
   
   -- Project-wide, all environments
   ('group-3', 'project-admin', '1', 'proj-A', NULL, NULL)
   
   -- Project-wide, only dev environments
   ('group-4', 'dev-contributor', '1', 'proj-A', 'env-dev', NULL)
   
   -- Integration-specific, all environments
   ('group-5', 'integration-owner', '1', 'proj-A', NULL, 'int-X')
   
   -- Integration-specific, only prod environment
   ('group-6', 'prod-operator', '1', 'proj-A', 'env-prod', 'int-X')
   ```

3. Create views for hierarchical access:
   - `v_user_project_access` - Shows which projects user can access (via org, project, or integration assignment)
   - `v_user_environment_access` - Shows which environments user can access as a filter (returns environment restrictions per project/integration)
   - `v_user_integration_access` (NEW) - Shows which integrations user can access (via org, project, or direct integration assignment)
   
   **Note**: `env_uuid` is a filter, not a hierarchy level. Views need to:
   - Track which projects are visible (org/project/integration-level grants)
   - Track which integrations are visible (org/project/integration-level grants)
   - Track environment restrictions (if env_uuid is set, filter runtimes to that environment)

4. Seed initial data:
   - Pre-defined roles (Super Admin, Admin, Developer)
   - Permissions for each domain
   - Role-permission mappings
   - Default org_uuid='1' will be used for all initial data

### Considerations
- Keep old tables (`roles`, `user_roles`) temporarily - will be removed in Stage 6
- Organizations table already exists - use org_uuid='1' for single-tenant mode
- Use versioned SQL scripts (e.g., `V2__rbac_tables.sql`)
- All views should handle the full inheritance chain: org → project → environment → integration

---

## Stage 2: Data Model & Types

**Objective**: Define Ballerina types for the new authorization model

### Tasks

1. Create new types in `modules/types/types.bal`:
   - `Permission` (permission_id, name, domain, resource_type, action)
   - `Role` (role_id, role_name, description) - redefine to match new schema
   - `Group` (group_id, group_name, org_uuid, description)
   - `GroupRoleMapping` (with org, project, env, integration scopes)
   - `UserPermissionContext` - new structure for authorization decisions

2. Update `UserContext` to include:
   - Groups the user belongs to
   - Effective permissions (computed from group→role→permission chain)
   - Access scope information

3. Create enums for:
   - `PermissionDomain`
   - `ResourceType`
   - `Action`

### Considerations
- Keep old types temporarily during transition (will be removed in Stage 6)
- Consider creating a separate `modules/authz/` module for authorization logic
- Use org_uuid='1' as the default organization ID throughout the codebase

---

## Stage 3: Repository Layer (Storage Module)

**Objective**: Implement CRUD operations for new authorization tables

### Tasks

1. Create new repository file: `modules/storage/authz_repository.bal`
   - CRUD for groups (with org_uuid='1')
   - CRUD for roles_v2 (new structure)
   - CRUD for permissions
   - Functions to manage mappings (group-user, group-role, role-permission)

2. Implement permission resolution functions:
   - `getUserGroups(userId)` - get all groups for a user
   - `getGroupRoles(groupId, context)` - get roles for a group in a specific context (org, project, env, or integration)
   - `getRolePermissions(roleId)` - get all permissions for a role
   - `getUserEffectivePermissions(userId, context)` - compute all effective permissions for a given context

3. Implement access check functions leveraging views:
   - `getUserAccessibleProjects(userId)` - Uses `v_user_project_access`
   - `getUserAccessibleEnvironments(userId, projectId?)` - Uses `v_user_environment_access`
   - `getUserAccessibleIntegrations(userId, projectId?, envId?)` - NEW - Uses `v_user_integration_access`

4. Implement context-aware access checks:
   - `hasAccessToProject(userId, projectId)` - Checks if project is visible (via org/project/integration grants)
   - `hasAccessToIntegration(userId, integrationId)` - Checks if integration is visible (via org/project/integration grants)
   - `getEnvironmentRestriction(userId, integrationId)` - Returns list of allowed env_uuids (NULL = all environments)
   - `hasAccessToRuntime(userId, runtimeId)` - Checks integration access + environment filter

### Considerations
- Optimize queries using the views (views handle complex joins and inheritance logic)
- Consider caching permission resolution results for frequently accessed resources
- Use batch queries to avoid N+1 problems when checking multiple resources
- All queries default to org_uuid='1' for single-tenant mode

---

## Stage 4: Authorization Service Layer

**Objective**: Build the permission checking logic

### Tasks

1. Create new module: `modules/authz/` with files:
   - `permission_checker.bal` - Core authorization logic
   - `context_builder.bal` - Build authorization context from JWT

2. Implement permission checking functions:
   - `hasPermission(userId, permission, resourceId?, context?)` - Generic permission check
   - `canViewIntegration(userContext, integrationId)`
   - `canEditIntegration(userContext, integrationId)`
   - `canManageIntegration(userContext, integrationId)`
   - `canManageEnvironment(userContext, environmentId)`
   - `canViewLogs(userContext, projectId, environmentId?)`
   - Similar functions for each permission in each domain

3. Build hierarchical access resolver:
   - Check org-level → project-level → integration-level (navigation hierarchy)
   - Apply environment filtering at each level (cross-cutting concern)
   - Implement inheritance logic: org access grants project access grants integration visibility
   - Environment filter applies WITHIN visible integrations (not a hierarchy level)

### Considerations
- Make functions isolated for concurrency
- Use clear naming conventions matching permission names
- Document the permission hierarchy clearly

---

## Stage 5: JWT & Context Management

**Objective**: Update token generation and extraction to support new model

### Tasks

1. Update `auth_utils.bal`:
   - Modify `generateJwtTokenForUser` to include groups and permissions in JWT
   - Update `extractUserContext` to parse new JWT structure
   - Build `UserPermissionContext` with effective permissions

2. **Decision Point**: Should JWT contain:
   - **Option A**: Full permission list (simpler, potentially large token)
   - **Option B**: Only group memberships (smaller token, requires DB lookup per request)
   - **Option C**: Hybrid - include common permissions, lazy-load others
   - **To be decided in Stage 4-5** based on performance testing

3. Update JWT custom claims structure:
   - Add `groups`, `permissions`, or `effectivePermissions` (based on decision above)
   - Include org_uuid='1' by default

### Considerations
- Balance token size vs. performance (will test in Stage 4)
- This decision doesn't affect data layer implementation (Stages 1-3)
- Consider token expiration and refresh implications
- JWT structure will be entirely new (no migration needed)

---

## Stage 6: Update API Endpoints

**Objective**: Migrate all API endpoints to use RBAC v2 authorization

**Status**: Phase 6.1 ✅ COMPLETED | Phase 6.2-6.4 🔄 IN PROGRESS

### Phase 6.1: Auth Service Endpoints (Foundation) ✅ COMPLETED

**Goal**: Update auth_service.bal to use V2 JWT generation and add new RBAC v2 management endpoints

**Status**: ✅ All 7 sub-phases complete, 25 tests passing

#### 6.1.1: Update Existing Endpoints to Generate V2 Tokens ✅ COMPLETED
- [x] Update `/login` endpoint
  - Replace `generateJWTToken` with `generateJWTTokenV2`
  - Update response to exclude old role fields if needed
  - Test with both password and new users
  
- [x] Update `/login/oidc` endpoint
  - Replace `generateJWTToken` with `generateJWTTokenV2`
  - Update response structure
  
- [x] Update `/renew-token` endpoint
  - Replace `extractUserContext` with `extractUserContextV2`
  - Replace `generateJWTToken` with `generateJWTTokenV2`
  - Update response structure
  
- [x] Update `/refresh-token` endpoint
  - Replace `generateJWTToken` with `generateJWTTokenV2`
  - Update response structure (both rotation and non-rotation paths)

**Implementation Notes:**
- All endpoints successfully migrated to V2 JWT generation
- JWT now includes permissions as scopes in standardized format
- Tested with password-based and OIDC authentication flows
- Token rotation logic preserved in refresh token endpoint

#### 6.1.2: Add New Group Management Endpoints ✅ COMPLETED
- [x] `GET /auth/orgs/{orgHandle}/groups` - List all groups with declarative scope check (`user_mgt:manage_groups`)
- [x] `POST /auth/orgs/{orgHandle}/groups` - Create new group with declarative scope check
- [x] `GET /auth/orgs/{orgHandle}/groups/{groupId}` - Get group details with description
- [x] `PUT /auth/orgs/{orgHandle}/groups/{groupId}` - Update group name/description with declarative scope check
- [x] `DELETE /auth/orgs/{orgHandle}/groups/{groupId}` - Delete group with declarative scope check

**Implementation Notes:**
- All endpoints use org-scoped paths (`/auth/orgs/{orgHandle}/...`)
- Declarative JWT scope validation using `@http:ResourceConfig` with `user_mgt:manage_groups` scope
- Comprehensive test coverage (5 tests passing)

#### 6.1.3: Add New Role Management Endpoints (V2) ✅ COMPLETED
- [x] `GET /auth/orgs/{orgHandle}/roles` - List all RBAC v2 roles with declarative scope check (`user_mgt:manage_roles`)
- [x] `POST /auth/orgs/{orgHandle}/roles` - Create new role with scope check
- [x] `GET /auth/orgs/{orgHandle}/roles/{roleId}` - Get role details with permissions
- [x] `PUT /auth/orgs/{orgHandle}/roles/{roleId}` - Update role name/description with scope check
- [x] `DELETE /auth/orgs/{orgHandle}/roles/{roleId}` - Delete role with scope check

**Implementation Notes:**
- All endpoints use org-scoped paths
- Declarative JWT scope validation using `user_mgt:manage_roles` scope
- Comprehensive test coverage (5 tests passing)

#### 6.1.4: Add New Permission Management Endpoints ✅ COMPLETED
- [x] `GET /auth/orgs/{orgHandle}/permissions` - List all available permissions grouped by domain (declarative scope check)
- [x] `GET /auth/orgs/{orgHandle}/users/{userId}/permissions/effective` - Get user's effective permissions with scope
  - Query params: `projectId?`, `integrationId?`, `environmentId?`
  - Returns computed permissions for the given scope
  - Includes granular permission checking for access control

**Implementation Notes:**
- Permissions endpoint returns hierarchical structure grouped by domain
- Effective permissions endpoint supports full context filtering (org/project/integration/environment)
- Comprehensive test coverage (2 tests passing)

#### 6.1.5: Add Group-User Mapping Endpoints ✅ COMPLETED
- [x] `POST /auth/orgs/{orgHandle}/groups/{groupId}/users` - Add users to group
  - Body: `{ userIds: string[] }`
  - Declarative scope check: `user_mgt:manage_groups`
  - Returns success/failure counts with detailed results
  
- [x] `DELETE /auth/orgs/{orgHandle}/groups/{groupId}/users/{userId}` - Remove user from group
  - Declarative scope check: `user_mgt:manage_groups`
  - Returns 204 No Content on success

**Implementation Notes:**
- Batch user addition with individual error handling
- Returns detailed results showing which users were successfully added and which failed
- Comprehensive test coverage (2 tests passing)

#### 6.1.6: Add Group-Role Mapping Endpoints ✅ COMPLETED
- [x] `POST /auth/orgs/{orgHandle}/groups/{groupId}/roles` - Assign roles to group with scope
  - Body: `{ roleIds: string[], projectId?: string, integrationId?: string, envId?: string }`
  - Batch assignment with individual error handling
  - Granular permission check: Verify caller has `user_mgt:update_group_roles` permission at specified scope
  - Returns success/failure counts with mapping IDs
  
- [x] `DELETE /auth/orgs/{orgHandle}/groups/{groupId}/roles/{mappingId}` - Remove role from group
  - Granular permission check: Verify caller has access to the scope of the mapping being removed
  - Returns 204 No Content on success
  
- [x] `GET /auth/orgs/{orgHandle}/groups/{groupId}/roles` - List group's role assignments with scope
  - Declarative scope check: `user_mgt:manage_groups`
  - Returns detailed role assignments including scope information (projectId, integrationId, envId)

**Implementation Notes:**
- Full support for org/project/integration/environment scoped role assignments
- Granular permission checks ensure users can only assign roles within their access scope
- Comprehensive test coverage (3 tests passing)

#### 6.1.7: Update User Management Endpoints ✅ COMPLETED
- [x] Implement `GET /auth/orgs/{orgHandle}/users` 
  - Declarative scope check: `user_mgt:view` (org-level only, no project/integration filtering needed)
  - Returns users with group membership information enriched
  - Replaced old role-based endpoint with group-based approach
  
- [x] Implement `POST /auth/orgs/{orgHandle}/users`
  - Declarative scope check: `user_mgt:manage_users`
  - Creates credentials in auth backend first, then user record in main DB
  - Supports optional group assignments via `groupIds` array in request body
  - Returns enriched user object with assigned groups
  
- [x] Implement `DELETE /auth/orgs/{orgHandle}/users/{userId}`
  - Declarative scope check: `user_mgt:manage_users`
  - Safety checks: Cannot delete self, cannot delete system administrator
  - Cascades to group_user_mapping and refresh_tokens
  - Does NOT call auth backend (credentials managed separately)
  
- [x] Remove `PUT /auth/users/{userId}/roles` 
  - **REMOVED ENTIRELY** (not deprecated) since this is alpha and frontend will be updated
  - Group-based permissions replace direct user-role assignments
  - Use group-user and group-role mapping endpoints instead

**Implementation Notes:**
- All user management now org-scoped with path `/auth/orgs/{orgHandle}/users`
- User creation uses two-phase approach: auth backend credentials → main DB record with groups
- User deletion includes critical safety checks (self-delete prevention, system admin protection)
- Comprehensive test coverage (5 tests passing: list, create, create duplicate, delete, delete not found, delete system admin, delete self)

---

#### Phase 6.1 Summary - ✅ COMPLETED

**Total Implementation Stats:**
- **25 tests passing** in auth-v2 test suite
- **7 phases completed** (6.1.1 through 6.1.7)
- **All endpoints migrated** to RBAC v2 group-based permissions

**Key Milestones:**
1. ✅ JWT V2 generation fully migrated across all auth endpoints (login, OIDC, renew-token, refresh-token)
2. ✅ Complete group management API (5 endpoints, 5 tests)
3. ✅ Complete role management API v2 (5 endpoints, 5 tests)
4. ✅ Permission listing and effective permissions API (2 endpoints, 2 tests)
5. ✅ Group-user mapping API (2 endpoints, 2 tests)
6. ✅ Group-role mapping API with scoping (3 endpoints, 3 tests)
7. ✅ User management API migrated to groups (3 endpoints, 5 tests)
8. ✅ Old user-role endpoint removed entirely

**Architecture Highlights:**
- **Declarative scope validation**: Using `@http:ResourceConfig` with JWT scopes for simple org-level checks
- **Granular permission checks**: Using `auth:hasPermission()` for context-aware checks (group-role assignments at specific scopes)
- **Two-phase user creation**: Auth backend for credentials, main DB for user record with group assignments
- **Dual database architecture**: H2 for credentials (auth backend), MySQL for main application data

**Test Coverage:**
- All 25 auth-v2 tests passing
- Comprehensive coverage including edge cases (duplicates, not found, forbidden operations)
- Test isolation via unique timestamp-based identifiers

**Next Phase:** GraphQL API Access Filtering (Phase 6.2) - to be implemented next

---

## RBAC v2 Access Control Flow Analysis

### Current Architecture (Old RBAC - To Be Replaced)

**Flow Pattern:**
```
GraphQL Endpoint
    ↓ Extract JWT
    ├─→ utils:extractUserContext() → UserContext (with roles[])
    ↓ Check Access
    ├─→ utils:hasAccessToProject(userContext, projectId)
    ├─→ utils:hasAccessToEnvironment(userContext, projectId, envId)  
    ├─→ utils:hasAdminAccess(userContext, projectId, envId)
    ├─→ utils:getAccessibleEnvironmentIds(userContext, projectId)
    ↓ Fetch Data
    └─→ storage:getRuntimes() / storage:getComponents() / etc.
```

**Problems:**
- Role-based filtering happens in utils layer (inspects `UserContext.roles[]`)
- Each request loops through roles to check access
- Storage layer sometimes receives filtered data, sometimes receives UserContext
- No clear separation between authorization (can user access?) and data filtering (what can user see?)

---

### New Architecture (RBAC v2 - To Be Implemented)

**Flow Pattern:**
```
GraphQL Endpoint
    ↓ Extract JWT
    ├─→ utils:extractUserContextV2() → UserContextV2 (with permissions[])
    ↓ Build Scope
    ├─→ types:AccessScope {orgId, projectId?, integrationId?, envId?}
    ↓ Check Permission
    ├─→ auth:hasPermission(userId, "integration_mgt:view", scope)
    │   ├─→ storage:getUserEffectivePermissions(userId, scope)
    │   └─→ Query: v_user_permissions view with scope filters
    ↓ Filter Accessible Resources (if needed)
    ├─→ auth:filterAccessibleProjects(userId, projectIds[])
    │   ├─→ storage:getUserAccessibleProjects(userId)
    │   └─→ Query: v_user_project_access view
    ├─→ auth:filterAccessibleIntegrations(userId, integrationIds[], projectId?, envId?)
    │   ├─→ storage:getUserAccessibleIntegrations(userId, projectId, envId)
    │   └─→ Query: v_user_integration_access view
    ↓ Fetch Data
    └─→ storage:getRuntimes() / storage:getComponents() / etc.
        (receives filtered IDs, NOT UserContext)
```

**Key Improvements:**
1. **Clear separation of concerns**:
   - **Authorization layer** (`auth:hasPermission`) - answers "can user perform this action?"
   - **Access resolver layer** (`auth:filterAccessible*`) - answers "what resources can user see?"
   - **Data layer** (`storage:get*`) - fetches data by IDs (no RBAC logic)

2. **Database views do the heavy lifting**:
   - `v_user_project_access` - pre-computes project visibility with org→project→integration hierarchy
   - `v_user_integration_access` - pre-computes integration visibility with full inheritance
   - `v_user_environment_access` - handles environment filtering (cross-cutting concern)
   - Views handle complex JOINs once; app code does simple lookups

3. **Two distinct patterns**:

   **Pattern A: Single Resource Access** (e.g., `get runtime`)
   ```ballerina
   // 1. Extract user
   types:UserContextV2 userContext = check utils:extractUserContextV2(authHeader);
   
   // 2. Fetch resource to get context
   types:Runtime? runtime = check storage:getRuntimeById(runtimeId);
   
   // 3. Build scope from resource
   types:AccessScope scope = {
       orgId: "1",
       projectId: runtime.component.projectId,
       integrationId: runtime.component.id,
       envId: runtime.environment.id
   };
   
   // 4. Check permission
   if !check auth:hasPermission(userContext.userId, "integration_mgt:view", scope) {
       return error("Access denied");
   }
   
   // 5. Return resource
   return runtime;
   ```

   **Pattern B: List/Filter Resources** (e.g., `get runtimes`)
   ```ballerina
   // 1. Extract user
   types:UserContextV2 userContext = check utils:extractUserContextV2(authHeader);
   
   // 2. Check base permission at org level
   types:AccessScope orgScope = {orgId: "1"};
   if !check auth:hasPermission(userContext.userId, "integration_mgt:view", orgScope) {
       return error("Access denied");
   }
   
   // 3a. If no filters - get all accessible integrations
   if projectId is () {
       types:UserIntegrationAccess[] accessibleIntegrations = 
           check auth:getAccessibleIntegrations(userContext.userId);
       string[] integrationIds = accessibleIntegrations.map(i => i.integrationUuid);
       return check storage:getRuntimesByIntegrationIds(integrationIds, envId);
   }
   
   // 3b. If projectId filter - check project access first
   types:AccessScope projectScope = {orgId: "1", projectId: projectId};
   if !check auth:hasPermission(userContext.userId, "integration_mgt:view", projectScope) {
       return error("Access denied to project");
   }
   
   // 3c. Get integrations in that project
   types:UserIntegrationAccess[] projectIntegrations = 
       check auth:getAccessibleIntegrations(userContext.userId, projectId);
   string[] integrationIds = projectIntegrations.map(i => i.integrationUuid);
   
   // 4. Fetch runtimes
   return check storage:getRuntimesByIntegrationIds(integrationIds, projectId, envId);
   ```

---

### Unified RBAC Flow Recommendations

**For Phase 6.2 Implementation:**

1. **Standard Endpoint Template** - Every endpoint follows this structure:
   ```ballerina
   isolated resource function get myResource(...) returns MyType|error {
       // STEP 1: Extract user context (V2)
       types:UserContextV2 userContext = check extractUserContextV2(authHeader);
       
       // STEP 2: Build access scope from parameters
       types:AccessScope scope = buildScope(orgId, projectId?, integrationId?, envId?);
       
       // STEP 3: Check permission for the action
       if !check auth:hasPermission(userContext.userId, "domain:action", scope) {
           return error("Access denied");
       }
       
       // STEP 4: Filter accessible resources (if listing)
       string[] accessibleIds = check auth:filterAccessible*(userContext.userId, ...);
       
       // STEP 5: Fetch and return data
       return check storage:getData(accessibleIds);
   }
   ```

2. **Helper Function to Build Scope** - Create in `auth` module:
   ```ballerina
   // Helper to build AccessScope from GraphQL parameters
   public isolated function buildScopeFromContext(
       string? projectId = (),
       string? integrationId = (),
       string? envId = ()
   ) returns types:AccessScope {
       types:AccessScope scope = {orgId: storage:DEFAULT_ORG_ID};
       if projectId is string { scope.projectUuid = projectId; }
       if integrationId is string { scope.integrationUuid = integrationId; }
       if envId is string { scope.envUuid = envId; }
       return scope;
   }
   ```

3. **Storage Layer Changes** - Update storage functions to NOT use UserContext:
   ```ballerina
   // OLD (receives UserContext):
   public isolated function getRuntimesByAccessibleEnvironments(types:UserContext userContext) 
       returns types:Runtime[]|error
   
   // NEW (receives filtered IDs):
   public isolated function getRuntimesByIntegrationIds(
       string[] integrationIds, 
       string? projectId = (), 
       string? envId = ()
   ) returns types:Runtime[]|error
   ```

4. **Two-Phase Filtering** for performance:
   ```ballerina
   // Phase 1: Get accessible integrations (1 DB call via view)
   types:UserIntegrationAccess[] accessible = 
       check storage:getUserAccessibleIntegrations(userId, projectId, envId);
   
   // Phase 2: Use WHERE integration_id IN (...) clause (1 DB call)
   string[] integrationIds = accessible.map(i => i.integrationUuid);
   types:Runtime[] runtimes = check storage:getRuntimesByIntegrationIds(integrationIds);
   ```

---

### Database View Strategy

**Views are the secret sauce** - they pre-compute access with inheritance:

```sql
-- v_user_integration_access handles complex hierarchy:
-- 1. Org-level grants → see ALL integrations
-- 2. Project-level grants → see integrations in THAT project  
-- 3. Integration-level grants → see THAT specific integration
-- 4. Environment filter → cross-cutting restriction on runtimes

SELECT DISTINCT
    gum.user_uuid,
    c.component_id as integration_uuid,
    c.component_name as integration_name,
    p.project_uuid,
    p.project_name,
    grm.env_uuid,
    e.env_name,
    ...
FROM group_user_mapping gum
JOIN group_role_mapping grm ON gum.group_id = grm.group_id
LEFT JOIN projects p ON grm.project_uuid = p.project_uuid
LEFT JOIN components c ON grm.integration_uuid = c.component_id OR p.project_uuid = c.project_uuid
LEFT JOIN environments e ON grm.env_uuid = e.env_uuid
WHERE grm.integration_uuid IS NOT NULL 
   OR (grm.project_uuid IS NOT NULL AND c.project_uuid = grm.project_uuid)
   OR (grm.org_uuid IS NOT NULL AND grm.project_uuid IS NULL)
```

**Application code just queries the view** - no complex JOINs needed!

---

### Phase 6.2: GraphQL API Access Filtering

**Goal**: Migrate GraphQL endpoints to RBAC v2 permission-based authorization, group by group

**Status**: Phase 6.2.1-6.2.6 ✅ COMPLETED

**Strategy**: For each endpoint group:
1. Replace `extractUserContext()` → `extractUserContextV2()` (returns `UserContextV2` with `permissions[]`)
2. Replace old RBAC helper functions (`hasAccessToProject`, `hasAdminAccess`, etc.) with new permission checks
3. Use `auth:hasPermission()` for authorization decisions
4. Use `auth:filterAccessible*()` batch functions for data filtering
5. Test each group before moving to the next

---

#### 6.2.1: Runtime Management Endpoints (Integration Management Domain) ✅ COMPLETED

**Status**: ✅ All 4 endpoints migrated, 6 integration tests passing

**Endpoints Migrated**: 3 queries + 1 mutation

**Implementation Summary:**
- [x] **`get runtimes`** - List all runtimes with optional filters
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Removed restrictive base permission check that was blocking project-level users
  - ✅ Uses `storage:getUserAccessibleIntegrations()` to filter by user's accessible integrations
  - ✅ Filters runtimes by integration IDs with proper hierarchical access (org → project → integration)
  - ✅ Handles optional `projectId`, `componentId`, `environmentId` filters correctly
  
- [x] **`get runtime`** - Get single runtime by ID
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Fetches runtime first, builds scope from runtime's project/component/environment
  - ✅ Uses `auth:hasPermission(userId, "integration_mgt:view", scope)` with runtime's context
  - ✅ Returns `null` for both not-found and no-access (404 pattern for queries)
  
- [x] **`get componentDeployment`** - Get deployment info for component in environment
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Builds scope with `projectId`, `componentId`, and `environmentId`
  - ✅ Uses `auth:hasPermission(userId, "integration_mgt:view", scope)`
  - ✅ Returns `null` on access denied (404 pattern)
  
- [x] **`deleteRuntime` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Builds scope from runtime's project/component/environment
  - ✅ Uses `auth:hasPermission(userId, "integration_mgt:delete", scope)`
  - ✅ Returns explicit error on access denial (mutation pattern)

**Key Implementation Changes:**
1. **Created `buildScopeFromContext()` helper** in `modules/auth/permission_checker.bal`:
   - Standardizes AccessScope building from GraphQL parameters (projectId, integrationId, envId)
   - Used consistently across all runtime endpoints

2. **Fixed SQL query issues** in `modules/storage/auth_repository.bal`:
   - `getUserAccessibleIntegrations()` - Removed non-existent columns from view query (project_name, env_name, group_name, etc.)
   - `getUserEnvironmentRestrictions()` - Fixed column selection to match `v_user_environment_access` view
   - Both functions now query only columns that exist in the database views

3. **Removed restrictive permission check** in `graphql_api.bal`:
   - Original base permission check at line 82 was filtering out project-level users
   - Issue: When no projectId filter provided, scope had only orgUuid, causing `getUserEffectivePermissions()` to exclude project-level role mappings
   - Solution: Removed base check and rely on `getUserAccessibleIntegrations()` filtering instead
   - This allows users with project-level permissions to see their accessible runtimes

**Test Coverage** (6 tests passing):
- ✅ `testGetRuntimesOrgLevel` - Org-level user sees all runtimes (12 runtimes from test data)
- ✅ `testGetRuntimesProjectLevel` - Project-level admin sees only their project's runtimes (4 runtimes)
- ✅ `testGetRuntimeById` - Returns runtime with valid access
- ✅ `testGetRuntimeByIdNoAccess` - Returns null when user lacks access (404 pattern)
- ✅ `testGetComponentDeployment` - Returns deployment info with permission check
- ✅ `testDeleteRuntimeNoAccess` - Returns explicit error for delete without permission

**Test Setup:**
- Test data loaded via `mysql_test_data_init.sql`
- 4 test users with different access levels:
  - `orgdev` - Org-level Developer (sees all 5 runtimes)
  - `projectadmin` - Project 1 Admin (sees only Project 1 runtimes)
  - `integrationviewer` - Integration-level viewer (Component 1 only)
  - `devonly` - Dev environment only
- RBAC v2 mappings: group-user and group-role assignments at different scopes

---

#### 6.2.2: Environment Management Endpoints ✅ COMPLETED

**Status**: ✅ All 6 endpoints migrated, 8 integration tests passing

**Endpoints Migrated**: 1 query + 5 mutations

**Implementation Summary:**
- [x] **`get environments`** - List accessible environments
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Removed specific permission checks for `environment_mgt:manage` and `environment_mgt:manage_nonprod`
  - ✅ Uses `storage:getUserEnvironmentRestrictions()` to determine accessible environments
  - ✅ If ANY mapping has `env_uuid = NULL`, user gets all environments (unrestricted access)
  - ✅ Otherwise, user gets specific environments from their mappings
  - ✅ Applies type filter (prod/non-prod) if provided
  - ✅ **Key insight**: GET operations check role mappings, not specific permissions (read vs write separation)
  
- [x] **~~`get adminEnvironments`~~** - ENDPOINT REMOVED
  - ❌ Endpoint removed as it's obsolete in RBAC v2 model
  - Regular environments query with proper role mappings is sufficient
  
- [x] **`createEnvironment` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Checks `input.critical` flag to determine production status
  - ✅ Production (`critical=true`): requires `environment_mgt:manage` permission
  - ✅ Non-production (`critical=false`): requires `environment_mgt:manage_nonprod` OR `environment_mgt:manage`
  
- [x] **`deleteEnvironment` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Fetches environment to check production status first
  - ✅ Applies appropriate permission check based on `critical` flag
  
- [x] **`updateEnvironment` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Checks both current and target production status when changing `critical` flag
  - ✅ Validates permissions for target environment type
  
- [x] **`updateEnvironmentProductionStatus` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Always requires `environment_mgt:manage` (highest permission)
  - ✅ Critical operation affecting production classification

**Key Implementation Changes:**
1. **Created `getAllEnvironments()` storage helper** in `modules/storage/environment_repository.bal`:
   - Returns all environments ordered by name
   - Used when user has unrestricted access (env_uuid = NULL in role mapping)

2. **Fixed NULL env_uuid interpretation logic** in `graphql_api.bal`:
   - Original issue: Code was filtering out NULL values, treating them as "no access"
   - **Critical fix**: `env_uuid = NULL` means "unrestricted access to all environments"
   - If ANY mapping has `env_uuid = NULL`, user can see all environments

3. **Separated read vs write permissions**:
   - GET operations: Check role mappings only (any user with access can query)
   - Write operations: Check specific permissions (`environment_mgt:manage`, `environment_mgt:manage_nonprod`)
   - Rationale: environment_mgt permissions are for create/update/delete, not for viewing

**Test Coverage** (8 tests passing):
- ✅ `testGetEnvironmentsOrgLevel` - Returns all environments (dev, prod)
- ✅ `testGetEnvironmentsProjectLevel` - Returns project-scoped environments
- ✅ `testGetEnvironmentsFilterByType` - Correctly filters prod and non-prod environments
- ✅ `testCreateEnvironmentNonProd` - Creates non-production environment successfully
- ✅ `testCreateEnvironmentProdDenied` - Correctly denies prod creation for non-prod user
- ✅ `testDeleteEnvironmentNonProd` - Deletes environment successfully
- ✅ `testUpdateEnvironmentProductionStatus` - Updates environment to production
- ✅ `testUpdateEnvironmentProductionStatusDenied` - Correctly denies status change for non-prod user

**Test Setup:**
- Test data loaded via `mysql_test_data_init.sql`
- 2 test tokens generated in `setupEnvironmentTests()`:
  - `envAdminToken` for user `projectadmin` (770e8400-e29b-41d4-a716-446655440002)
    - Permissions: `environment_mgt:manage`, `environment_mgt:manage_nonprod`, project and integration permissions
  - `envNonProdToken` for user `orgdev` (770e8400-e29b-41d4-a716-446655440001)
    - Permissions: `environment_mgt:manage_nonprod`, view-level project and integration permissions

**Architecture Highlights:**
- Environments are org-level resources (not project-specific)
- Access control via role mappings at various scopes
- NULL semantics: env_uuid = NULL in mapping means unrestricted access to all environments
- Permission model: GET checks role mappings, write operations check specific permissions

---

#### 6.2.3: Project Management Endpoints ✅ COMPLETED

**Status**: ✅ All 5 endpoints migrated, 7 integration tests passing

**Endpoints Migrated**: 1 query + 4 mutations

**Implementation Summary:**
- [x] **`get projects`** - List all accessible projects
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Uses `auth:getAccessibleProjects(userId)` to get user's accessible projects (permission-agnostic)
  - ✅ Filters projects using `storage:getProjectsByIds()` with SQL IN clause
  - ✅ Returns projects where user has ANY role assignment (not just project_mgt:view)
  - ✅ Key insight: Project visibility is based on role mappings, not specific permissions
  
- [x] **`get project`** - Get single project by ID
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Uses `auth:resolveProjectAccess(userId, projectId)` for detailed access check
  - ✅ Returns `null` for no access (404 pattern for queries)
  
- [x] **`createProject` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Uses `auth:canManageProject(userId)` (checks project_mgt:manage at org level)
  - ✅ **NEW**: Creates "Project Admin" role and auto-assigns creator
  - ✅ **NEW**: Creates "<project_name> Admins" group automatically
  - ✅ **NEW**: Adds creator to admin group with project-scoped Project Admin role
  - ✅ **NEW**: Project Admin role grants access to ALL environments by default (env_uuid=NULL)
  
- [x] **`updateProject` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Uses `auth:canEditProject(userId, projectId)` (checks project_mgt:edit or project_mgt:manage)
  
- [x] **`deleteProject` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Uses `auth:canManageProject(userId, projectId)` (requires project_mgt:manage - higher bar than edit)

**Key Implementation Changes:**
1. **Created "Project Admin" pre-defined role** in `mysql_init.sql`:
   - Permissions: `project_mgt:manage`, `integration_mgt:manage`, `user_mgt:update_group_roles`
   - Allows project creators to manage their projects and add/remove team members
   
2. **Added `getProjectAdminRoleId()` helper** in `modules/storage/project_repository.bal`:
   - Queries `roles_v2` table for Project Admin role
   - Used during project creation to assign creator as admin
   
3. **Enhanced `createProject()` function** in `modules/storage/project_repository.bal`:
   - Creates project record in database
   - Creates "<project_name> Admins" group automatically
   - Maps group to Project Admin role (project-scoped, all environments)
   - Adds creator to the admin group
   - **Note**: env_uuid=NULL means creator has access to ALL environments
   
4. **Fixed `getUserAccessibleProjects()` SQL query** in `modules/storage/auth_repository.bal`:
   - Removed non-existent columns (group_id, group_name, role_name) from SELECT
   - Now queries only columns that exist in `v_user_project_access` view
   
5. **Fixed `Project` type nullability** in `modules/types/types.bal`:
   - Changed `version` field from `string` to `string?` to match database schema

**Test Coverage** (7 tests passing):
- ✅ `testGetProjectsFilteredByAccess` - Project-level user sees only their projects
- ✅ `testGetProjectById` - Returns project with valid access
- ✅ `testGetProjectByIdNoAccess` - Returns null when user lacks access (404 pattern)
- ✅ `testCreateProjectSuccess` - Creates project with super admin token
- ✅ `testCreateProjectGroupAssignment` - Verifies creator gets immediate access via auto-created group
- ✅ `testUpdateProjectSuccess` - Updates project successfully
- ✅ `testDeleteProjectNoAccess` - Returns error when user lacks permission

**Architecture Highlights:**
- Projects are org-level resources
- Project creators automatically become project admins via group assignment
- Permission model: GET operations check role mappings (any permission grants visibility)
- Write operations check specific permissions (edit vs manage hierarchy)
- SQL IN clause used for efficient project filtering (handles up to 5000+ projects)

---

#### 6.2.4: Component Management Endpoints (Integration Management Domain) ✅ COMPLETED

**Status**: ✅ All 7 endpoints migrated, 12 integration tests passing

**Endpoints Migrated**: 3 queries + 4 mutations

**Implementation Summary:**
- [x] **`get components`** - List components with optional project filter
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Uses `storage:getUserAccessibleIntegrations()` to get user's accessible components
  - ✅ Filters by integration IDs (no base permission check needed - view-based filtering)
  - ✅ Handles optional `projectId` filter correctly
  - ✅ Returns empty array when user has no access (not error)
  
- [x] **`get component`** - Get single component by ID
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Fetches component first, builds scope from component's project/component
  - ✅ Uses `auth:hasAnyPermission()` with `["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"]`
  - ✅ Returns `null` for both not-found and no-access (404 pattern for queries)
  - ✅ **Optimization**: Single DB call for 3 permissions using `hasAnyPermission()`
  
- [x] **`createComponent` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Builds scope with `projectId` only (integration creation is project-level)
  - ✅ Uses `auth:hasPermission(userId, "integration_mgt:manage", scope)`
  - ✅ Returns explicit error on access denial (mutation pattern)
  
- [x] **`deleteComponent` mutation** (non-V2 version)
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Fetches component first, builds scope from component's project/component
  - ✅ Uses `auth:hasPermission(userId, "integration_mgt:manage", scope)`
  - ✅ Returns explicit error on access denial
  
- [x] **`deleteComponentV2` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Builds scope with `projectId` and `componentId`
  - ✅ Uses `auth:hasPermission(userId, "integration_mgt:manage", scope)`
  - ✅ Returns explicit error on access denial
  
- [x] **`updateComponent` mutation**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Fetches component first, builds scope from component's project/component
  - ✅ Uses `auth:hasAnyPermission()` with `["integration_mgt:edit", "integration_mgt:manage"]`
  - ✅ Returns explicit error on access denial
  - ✅ **Optimization**: Single DB call for 2 permissions using `hasAnyPermission()`
  
- [x] **`componentArtifactTypes` query**
  - ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
  - ✅ Fetches component first, builds scope from component's project/component
  - ✅ Uses `auth:hasAnyPermission()` with `["integration_mgt:view", "integration_mgt:edit", "integration_mgt:manage"]`
  - ✅ Returns explicit error on access denial
  - ✅ **Optimization**: Single DB call for 3 permissions using `hasAnyPermission()`

**Key Implementation Changes:**
1. **Permission Check Optimization**:
   - Created `hasAnyPermission()` function in `modules/auth/permission_checker.bal`
   - Reduces DB calls from N (one per permission) to 1 (checks all permissions at once)
   - Used in 3 endpoints: `get component`, `updateComponent`, `componentArtifactTypes`

2. **Test Data Enhancements**:
   - Added "Viewer" role to `mysql_init.sql` with view-only permissions
   - Created `readonlyviewer` test user with Viewer role (integration-level scope)
   - Enables proper testing of view vs edit permission hierarchy

**Test Coverage** (12 tests passing):
- ✅ `testGetComponentsOrgLevel` - Org-level user sees all components (3 components)
- ✅ `testGetComponentsProjectLevel` - Project-level admin sees only their project's components (2 components)
- ✅ `testGetComponentById` - Returns component with valid access
- ✅ `testGetComponentByIdNoAccess` - Returns null when user lacks access (404 pattern)
- ✅ `testCreateComponentSuccess` - Creates component with project admin token
- ✅ `testCreateComponentNoPermission` - Returns error when user lacks manage permission
- ✅ `testUpdateComponentSuccess` - Updates component with edit permission
- ✅ `testUpdateComponentNoPermission` - Returns error when user has only view permission
- ✅ `testDeleteComponentV2Success` - Deletes component with manage permission
- ✅ `testDeleteComponentV2NoPermission` - Returns error when user lacks permission
- ✅ `testGetComponentArtifactTypes` - Returns artifact types with view permission
- ✅ `testGetComponentArtifactTypesNoAccess` - Returns error when user lacks access

**Test Setup:**
- Test data: `mysql_test_data_init.sql` with 3 test components
- 4 test users with different access levels:
  - `orgdev` (770e8400...440001) - Org-level Developer (sees all 3 components)
  - `projectadmin` (770e8400...440002) - Project 1 Admin (sees 2 components)
  - `integrationviewer` (770e8400...440003) - Component 1 Developer (has edit permission)
  - `readonlyviewer` (770e8400...440005) - Component 1 Viewer (view-only permission)

**Architecture Highlights:**
- Components are project-level resources but can be scoped to integration level
- Permission hierarchy: view < edit < manage
- `hasAnyPermission()` optimization reduces database overhead
- Follows consistent 404 pattern for queries, explicit error for mutations

---

#### 6.2.5: Artifact Query Endpoints (Services, Listeners, APIs, etc.) ✅ COMPLETED

**Status**: ✅ All 16 artifact query endpoints migrated

**Endpoints Migrated**: 16 queries (all by environment and component)

**Migration Summary:**
- [x] **All artifact query endpoints** migrated to RBAC v2:
  - `get services`
  - `get servicesByEnvironmentAndComponent`
  - `get listeners`
  - `get listenersByEnvironmentAndComponent`
  - `get restApisByEnvironmentAndComponent`
  - `get carbonAppsByEnvironmentAndComponent`
  - `get inboundEndpointsByEnvironmentAndComponent`
  - `get endpointsByEnvironmentAndComponent`
  - `get sequencesByEnvironmentAndComponent`
  - `get proxyServicesByEnvironmentAndComponent`
  - `get tasksByEnvironmentAndComponent`
  - `get templatesByEnvironmentAndComponent`
  - `get messageStoresByEnvironmentAndComponent`
  - `get messageProcessorsByEnvironmentAndComponent`
  - `get localEntriesByEnvironmentAndComponent`
  - `get dataServicesByEnvironmentAndComponent`

**Implementation Pattern:**
- ✅ Replaced `extractUserContext()` → `extractUserContextV2()`
- ✅ Removed old `utils:hasAccessToEnvironment()` checks
- ✅ Consistent pattern: fetch component → build scope → check permission → return data
- ✅ Uses `auth:hasPermission(userId, "integration_mgt:view", scope)` for all endpoints
- ✅ Returns `null` for no-access (404 pattern for queries)

---

#### 6.2.6: Helper Function Removal (Final Cleanup for Phase 6.2) ✅ COMPLETED

**Status**: ✅ All old RBAC helper functions removed from `modules/utils/auth_utils.bal`

**Functions Removed:**
- [x] Removed `hasAccessToProject()`
- [x] Removed `hasAccessToEnvironment()`
- [x] Removed `hasAdminAccess()`
- [x] Removed `isAdminInAnyEnvironment()`
- [x] Removed `getAccessibleProjectIds()`
- [x] Removed `getAccessibleEnvironmentIds()`
- [x] Removed `getAccessibleEnvironmentIdsByType()`
- [x] Removed `getAdminEnvironmentIdsByType()`

**Impact:**
- All GraphQL endpoints now use RBAC v2 permission checks exclusively
- No remaining references to old RBAC helper functions in service layer
- Old UserContext-based access checks completely replaced with UserContextV2 + permission-based checks

---

### Phase 6.3: Batch Access Filtering

**Goal**: Use auth module's batch filtering functions for efficient access control

#### 6.3.1: Replace Manual Filtering with Batch Functions ✅ N/A
**Status**: Not Applicable - No manual filtering loops found

**Analysis**:
- All GraphQL endpoints already use batch functions from storage layer (`getUserAccessibleIntegrations()`, `getUserAccessibleProjects()`, etc.)
- These functions leverage database views (`v_user_integration_access`, `v_user_project_access`) for efficient filtering
- No manual permission checking loops exist that need replacement

#### 6.3.2: Optimize Query Performance 🔄 IN PROGRESS
- [x] **Runtime Query Optimization**: Add `getRuntimesByIntegrationIds()` to eliminate N+1 query pattern
  - Current: 1 query for integrations + N queries for runtimes (one per integration)
  - Optimized: 1 query for integrations + 1 batch query for all runtimes using `IN` clause
  - Implementation: Created `getRuntimesByIntegrationIds()` in `modules/storage/runtime_repository.bal`
  - Modified: `graphql_api.bal` lines 92-135 to use batch query
  - Performance: ~82% reduction in database calls (11→2 queries for 10 integrations)
- [x] **Environment Name Lookup Optimization**: Fix N+1 pattern in observability service
  - Current: N queries for environment names (one per accessible environment ID)
  - Optimized: 1 batch query using existing `getEnvironmentsByIds()` + map operation
  - Modified: `observability_service.bal` lines 170-185
  - Performance: N queries → 1 query for environment name resolution
- [ ] Add caching strategy for permission lookups if needed
- [ ] Profile query performance with large datasets
- [ ] Consider adding database indexes on new RBAC tables if missing

---

### Phase 6.4: Cleanup Old RBAC Code

**Goal**: Remove old RBAC implementation and rename V2 functions

#### 6.4.1: Remove Old RBAC Database Objects ✅
- [x] Removed `roles` table from mysql_init.sql and h2_init.sql
- [x] Removed `user_roles` table from mysql_init.sql and h2_init.sql
- [x] Removed old RBAC references from project_repository.bal (2 UPDATE statements)
- [x] Tests verified: 102/102 passing

#### 6.4.2: Remove Old RBAC Functions
- [x] Remove old `generateJWTToken` function
- [x] Remove old `extractUserContext` function
- [x] Remove old role-related functions from storage module
- [x] Remove old `UserContext` type

#### 6.4.3: Rename V2 Functions (Remove Suffix)
- [ ] Rename `generateJWTTokenV2` → `generateJWTToken`
- [ ] Rename `extractUserContextV2` → `extractUserContext`
- [ ] Rename `UserContextV2` → `UserContext`
- [ ] Rename `buildUserAuthzContextV2` → `buildUserAuthzContext` (if V2 exists)
- [ ] Rename `hasPermissionV2` → `hasPermission`
- [ ] Update all references across codebase

#### 6.4.4: Update Response Types
- [x] Remove `isSuperAdmin` and `isProjectAuthor` from login responses if not needed
- [x] Remove `roles` array from login responses
- [ ] Update frontend/client expectations (coordinate with frontend team)
- [ ] Update API documentation

#### 6.4.5: Final Cleanup
- [x] Remove any remaining old RBAC code
- [x] Clean up unused imports
- [ ] Update all comments referencing old RBAC
- [x] Run full test suite

---

### Testing Strategy for Stage 6

1. **Phase 6.1 Testing**:
   - Test login with V2 JWT generation
   - Verify JWT contains correct permissions as scopes
   - Test all new management endpoints with different permission levels
   - Test super admin vs. regular user access

2. **Phase 6.2 Testing**:
   - Test each GraphQL endpoint with users having different permissions
   - Verify access filtering returns only authorized data
   - Test permission checks reject unauthorized operations

3. **Phase 6.3 Testing**:
   - Performance test batch filtering with large datasets
   - Verify filtering produces same results as manual filtering

4. **Phase 6.4 Testing**:
   - Full regression test after cleanup
   - Verify no references to old RBAC code remain
   - Test all endpoints still work after renaming

### Considerations
- This is the "big bang" stage - completely replace old auth system
- Old RBAC tables (`roles`, `user_roles`) will be dropped in Phase 6.4
- Old authorization helper functions removed in Phase 6.4
- May have a brief period with minimal auth during transition (acceptable in dev)
- Comprehensive testing for each phase before moving to next
- Coordinate with frontend team for response structure changes

---

## Stage 7: Testing & Documentation

**Objective**: Ensure robustness and maintainability

### Tasks

1. Create comprehensive test suite:
   - Rewrite `tests/rbac_tests.bal` for new model
   - Add tests for each permission domain
   - Test hierarchical access inheritance (org → project → environment → integration)
   - Test integration-level permissions specifically
   - Test group memberships and role assignments
   - Add performance tests for permission resolution

2. Update documentation:
   - Update `rbac.md` with implementation details
   - Document API endpoints for group/role management
   - Create user guide for administrators
   - Add code examples for common authorization patterns
   - Document the default org_uuid='1' convention

3. Integration testing:
   - End-to-end scenarios covering all permission types
   - Test with multiple users, groups, and contexts
   - Test access inheritance at all levels
   - Stress test permission resolution performance
   - Verify views are performing efficiently

---

## Access Scoping Model

### Navigation Hierarchy
```
Organization (org_uuid='1')
  └─ Projects (project_uuid)
      └─ Integrations (integration_uuid)
          └─ Runtimes (grouped by environment)
```

### Environment as Cross-Cutting Filter
- **Environment is NOT a navigation level**
- `env_uuid` in `group_role_mapping` acts as a **filter** on runtime visibility
- Can be applied at any scope: org-wide, project-wide, or integration-specific
- `env_uuid = NULL` means "all environments accessible"

### Access Scoping Examples

| Scope | Description | Visible In UI |
|-------|-------------|---------------|
| Org + All Envs | Full org access | All projects, all integrations, all runtimes |
| Org + Prod Only | Org-wide prod access | All projects, all integrations, only prod runtimes |
| Project + All Envs | Full project access | Project A, all integrations in A, all runtimes |
| Project + Dev Only | Project dev access | Project A, all integrations in A, only dev runtimes |
| Integration + All Envs | Full integration access | Project A (parent), Integration X only, all runtimes |
| Integration + Staging Only | Integration staging access | Project A (parent), Integration X only, only staging runtimes |

### Key Constraint
**Integration-level access REQUIRES project_uuid** to ensure parent project is visible for navigation.

## Design Decisions - RESOLVED

The following design decisions have been made:

1. **✅ Integration UUID Scope**: 
   - **Decision**: All permissions go through groups. Path is always: permission → role → group → user
   - Even integration-specific access requires a group assignment

2. **✅ Organization Table**: 
   - **Decision**: Organizations table already exists with default org_uuid='1'
   - This provides future multi-tenant support with negligible performance impact
   - All queries will use org_uuid='1' in single-tenant mode

3. **✅ JWT Strategy**: 
   - **Decision**: To be decided in Stage 4-5 after data layer is complete
   - Three options remain open (full permissions, groups only, or hybrid)
   - This decision doesn't affect database schema or repository layer

4. **✅ Migration Path**: 
   - **Decision**: Parallel data layer, big bang service layer
   - New tables coexist with old (e.g., `roles_v2`)
   - Service layer switches completely in Stage 6
   - No migration needed since no alpha release exists yet

5. **✅ Super Admin Evolution**: 
   - **Decision**: No migration needed - implement Super Admin from scratch in new system
   - Super Admin will be a pre-defined role with org-level scope and all permissions
   - Old `isSuperAdmin` flag will be removed in Stage 6

6. **✅ View Updates**: 
   - **Decision**: Create separate `v_user_integration_access` view
   - Navigation hierarchy: org → project → integration (environment is NOT a navigation level)
   - Environment filtering: `env_uuid` acts as a cross-cutting filter at any scope
   - Integration-level access MUST include `project_uuid` for navigation (enforced by CHECK constraint)
   - Provides better performance and maintainability with clear separation of concerns

## Remaining Open Questions

None at this stage. All major design decisions have been resolved. Implementation can proceed.
