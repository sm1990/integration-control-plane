import {
    createApiRef,
    ConfigApi,
    FetchApi
} from '@backstage/core-plugin-api';

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
    project: {
        projectId: string;
        name: string;
        description: string;
        createdBy: string;
        createdAt: string;
        updatedAt: string;
        updatedBy: string;
    };
}

export interface CreateComponentRequest {
    projectId: string;
    name: string;
    description: string;
}

export interface UpdateComponentRequest {
    componentId: string;
    name: string;
    description: string;
}

export interface ComponentsApi {
    getProjects(): Promise<Project[]>;
    getComponents(projectId: string): Promise<Component[]>;
    createComponent(request: CreateComponentRequest): Promise<Component>;
    updateComponent(request: UpdateComponentRequest): Promise<Component>;
    deleteComponent(componentId: string): Promise<void>;
}

export const componentsApiRef = createApiRef<ComponentsApi>({
    id: 'plugin.icomponents.service',
});

export class ComponentsApiService implements ComponentsApi {
    constructor(
        private readonly configApi: ConfigApi,
        private readonly fetchApi: FetchApi,
    ) { }


    private async restRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const backendUrl = this.configApi.getOptionalString('backend.baseUrl') || '';
        const url = `${backendUrl}/api/icpbackend${endpoint}`;

        const response = await this.fetchApi.fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        // Handle empty responses (e.g., from DELETE operations)
        if (response.status === 204) {
            return undefined as T;
        }

        return response.json();
    }

    async getProjects(): Promise<Project[]> {
        return this.restRequest<Project[]>('/projects');
    }

    async getComponents(projectId: string): Promise<Component[]> {
        const endpoint = projectId ? `/components?projectId=${encodeURIComponent(projectId)}` : '/components';
        return this.restRequest<Component[]>(endpoint);
    }

    async createComponent(request: CreateComponentRequest): Promise<Component> {
        return this.restRequest<Component>('/components', {
            method: 'POST',
            body: JSON.stringify({
                projectId: request.projectId,
                name: request.name,
                description: request.description
            })
        });
    }

    async updateComponent(request: UpdateComponentRequest): Promise<Component> {
        return this.restRequest<Component>(`/components/${encodeURIComponent(request.componentId)}`, {
            method: 'PUT',
            body: JSON.stringify({
                componentId: request.componentId,
                name: request.name,
                description: request.description
            })
        });
    }

    async deleteComponent(componentId: string): Promise<void> {
        await this.restRequest<void>(`/components/${encodeURIComponent(componentId)}`, {
            method: 'DELETE'
        });
    }
}