// Common types for ICP
export interface Environment {
    environmentId: string;
    name: string;
    description: string;
    isProduction: boolean;
    createdAt: string;
    updatedAt: string;
    updatedBy: string;
    createdBy: string;
}

export interface Project {
    projectId: string;
    name: string;
    description: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    updatedBy: string;
}

export interface Component {
    componentId: string;
    name: string;
    description: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    updatedBy: string;
    project: Project;
}

export interface Listener {
    name: string;
    package: string;
    protocol: string;
    state: string;
}

export interface Resource {
    methods: string[];
    url: string;
}

export interface Service {
    name: string;
    package: string;
    basePath: string;
    state: string;
    resources: Resource[];
}

export interface Artifacts {
    listeners: Listener[];
    services: Service[];
}

export interface Runtime {
    runtimeId: string;
    runtimeType: string;
    status: string;
    version?: string;
    platformName?: string;
    platformVersion?: string;
    platformHome?: string;
    osName?: string;
    osVersion?: string;
    registrationTime?: string;
    lastHeartbeat?: string;
    environment: Environment;
    component: Component;
    artifacts?: Artifacts;
}

// Request types
export interface CreateRuntimeRequest {
    runtimeType: string;
    description: string;
    environmentId: string;
    componentId: string;
}

export interface CreateEnvironmentRequest {
    name: string;
    description: string;
    isProduction: boolean;
}

export interface UpdateEnvironmentRequest {
    environmentId: string;
    name: string;
    description: string;
    isProduction: boolean;
}

export interface CreateComponentRequest {
    name: string;
    description: string;
    projectId: string;
}

export interface UpdateComponentRequest {
    componentId: string;
    name: string;
    description: string;
    projectId: string;
}

export interface CreateProjectRequest {
    name: string;
    description: string;
}

export interface UpdateProjectRequest {
    projectId: string;
    name: string;
    description: string;
}

// Authentication types
export interface LoginRequest {
    username: string;
    password: string;
}

export interface Role {
    roleId: string;
    projectId: string;
    environmentId: string;
    privilegeLevel: string;
    roleName: string;
    createdAt: string;
    updatedAt: string;
}

export interface LoginResponse {
    isNewUser: boolean;
    token: string;
    expiresIn: number;
    username: string;
    roles: Role[];
    isSuperAdmin: boolean; // Super admin flag from backend
    isProjectAuthor: boolean; // Project author flag from backend
}

export interface AuthUser {
    username: string;
    token: string;
    roles: Role[];
    expiresAt: number;
    isSuperAdmin?: boolean; // Super admin flag from JWT
    isProjectAuthor?: boolean; // Project author flag from JWT
}

// User management types
export interface User {
    userId: string;
    username: string;
    displayName: string;
    isSuperAdmin?: boolean;
    isProjectAuthor?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface UserWithRoles extends User {
    roles: Role[];
}

export interface CreateUserRequest {
    username: string;
    displayName: string;
    password: string;
}

// OIDC types
export interface OIDCAuthorizationUrlResponse {
  authorizationUrl: string;
}

export interface OIDCCallbackRequest {
  code: string;
}
