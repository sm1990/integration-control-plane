import {
  BackstageCredentials,
  BackstageUserPrincipal,
} from '@backstage/backend-plugin-api';

// Environment interfaces
export interface Environment {
  environmentId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  createdBy: string;
}

export interface CreateEnvironmentRequest {
  name: string;
  description: string;
}

export interface UpdateEnvironmentRequest {
  environmentId: string;
  name: string;
  description: string;
}

// Project interfaces
export interface Project {
  projectId: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
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

// Component interfaces
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

export interface CreateComponentRequest {
  name: string;
  description: string;
  projectId: string;
}

export interface UpdateComponentRequest {
  componentId: string;
  name: string;
  description: string;
}

// Runtime interfaces
export interface Listener {
  name: string;
  package: string;
  protocol: string;
  state: string;
}

export interface Resource {
  methods: string;
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
  version: string;
  platformName: string;
  platformVersion: string;
  platformHome: string;
  osName: string;
  osVersion: string;
  registrationTime: string;
  lastHeartbeat: string;
  environment: Environment;
  component: Component;
  artifacts: Artifacts;
}

export interface RuntimeFilters {
  status?: string;
  runtimeType?: string;
  environment?: string;
  projectId?: string;
  componentId?: string;
}

// Main service interface
export interface ICPApiService {
  // Environment operations
  getEnvironments(): Promise<Environment[]>;
  createEnvironment(
    request: CreateEnvironmentRequest,
    options: {
      credentials: BackstageCredentials<BackstageUserPrincipal>;
    },
  ): Promise<Environment>;
  updateEnvironment(
    request: UpdateEnvironmentRequest,
    options: {
      credentials: BackstageCredentials<BackstageUserPrincipal>;
    },
  ): Promise<Environment>;
  deleteEnvironment(
    environmentId: string,
    options: {
      credentials: BackstageCredentials<BackstageUserPrincipal>;
    },
  ): Promise<void>;

  // Project operations
  getProjects(): Promise<Project[]>;
  createProject(
    request: CreateProjectRequest,
    options: {
      credentials: BackstageCredentials<BackstageUserPrincipal>;
    },
  ): Promise<Project>;
  updateProject(
    request: UpdateProjectRequest,
    options: {
      credentials: BackstageCredentials<BackstageUserPrincipal>;
    },
  ): Promise<Project>;
  deleteProject(
    projectId: string,
    options: {
      credentials: BackstageCredentials<BackstageUserPrincipal>;
    },
  ): Promise<void>;

  // Component operations
  getComponents(projectId?: string): Promise<Component[]>;
  createComponent(
    request: CreateComponentRequest,
    options: {
      credentials: BackstageCredentials<BackstageUserPrincipal>;
    },
  ): Promise<Component>;
  updateComponent(
    request: UpdateComponentRequest,
    options: {
      credentials: BackstageCredentials<BackstageUserPrincipal>;
    },
  ): Promise<Component>;
  deleteComponent(
    componentId: string,
    options: {
      credentials: BackstageCredentials<BackstageUserPrincipal>;
    },
  ): Promise<void>;

  // Runtime operations
  getRuntimes(filters?: RuntimeFilters): Promise<Runtime[]>;
  getRuntime(runtimeId: string): Promise<Runtime>;
}
