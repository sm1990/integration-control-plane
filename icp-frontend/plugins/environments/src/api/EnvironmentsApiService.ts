import {
    createApiRef,
    ConfigApi,
    FetchApi
} from '@backstage/core-plugin-api';

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

export interface EnvironmentsApi {
    getEnvironments(): Promise<Environment[]>;
    createEnvironment(request: CreateEnvironmentRequest): Promise<Environment>;
    updateEnvironment(request: UpdateEnvironmentRequest): Promise<Environment>;
    deleteEnvironment(environmentId: string): Promise<void>;
}

export const environmentsApiRef = createApiRef<EnvironmentsApi>({
    id: 'plugin.environments.service',
});

export class EnvironmentsApiService implements EnvironmentsApi {
    constructor(
        private readonly configApi: ConfigApi,
        private readonly fetchApi: FetchApi,
    ) { }

    private async getBaseUrl(): Promise<string> {
        const backendUrl = this.configApi.getString('backend.baseUrl');
        return `${backendUrl}/api/icpbackend`;
    }

    async getEnvironments(): Promise<Environment[]> {
        const baseUrl = await this.getBaseUrl();

        const response = await this.fetchApi.fetch(`${baseUrl}/environments`);

        if (!response.ok) {
            throw new Error(`Failed to fetch environments: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    async createEnvironment(request: CreateEnvironmentRequest): Promise<Environment> {
        const baseUrl = await this.getBaseUrl();

        const response = await this.fetchApi.fetch(`${baseUrl}/environments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`Failed to create environment: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    async updateEnvironment(request: UpdateEnvironmentRequest): Promise<Environment> {
        const baseUrl = await this.getBaseUrl();
        const { environmentId, ...updateData } = request;

        const response = await this.fetchApi.fetch(`${baseUrl}/environments/${environmentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        });

        if (!response.ok) {
            throw new Error(`Failed to update environment: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    async deleteEnvironment(environmentId: string): Promise<void> {
        const baseUrl = await this.getBaseUrl();

        const response = await this.fetchApi.fetch(`${baseUrl}/environments/${environmentId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`Failed to delete environment: ${response.status} ${response.statusText}`);
        }
    }
}