interface GraphQLResponse<T = any> {
    data?: T;
    errors?: Array<{
        message: string;
        locations?: Array<{
            line: number;
            column: number;
        }>;
        path?: Array<string | number>;
    }>;
}

class ICPApiClient {
    private readonly endpoint: string;
    private readonly authEndpoint: string;
    private token: string | null = null;

    constructor(endpoint: string = 'http://localhost:9446/graphql', authEndpoint: string = 'https://localhost:9445/auth') {
        this.endpoint = endpoint;
        this.authEndpoint = authEndpoint;
    }

    setToken(token: string | null) {
        this.token = token;
    }

    getToken(): string | null {
        return this.token;
    }

    private async executeGraphQL<T = any>(
        query: string,
        variables?: Record<string, any>
    ): Promise<T> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            // Dynamically retrieve token from localStorage (where AuthContext stores it)
            const storedUser = localStorage.getItem('icp_auth_user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    if (parsedUser.token) {
                        headers['Authorization'] = `Bearer ${parsedUser.token}`;
                    }
                } catch (e) {
                    console.error('Failed to parse stored user for auth header', e);
                }
            }

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query,
                    variables,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result: GraphQLResponse<T> = await response.json();

            if (result.errors && result.errors.length > 0) {
                throw new Error(result.errors[0].message);
            }

            if (!result.data) {
                throw new Error('No data returned from GraphQL query');
            }

            return result.data;
        } catch (error) {
            console.error('GraphQL Error:', error);
            throw error;
        }
    }

    // Query method for executing GraphQL queries
    async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
        return this.executeGraphQL<T>(query, variables);
    }

    // Mutation method for executing GraphQL mutations
    async mutate<T = any>(mutation: string, variables?: Record<string, any>): Promise<T> {
        return this.executeGraphQL<T>(mutation, variables);
    }

    // Authentication methods
    async login(username: string, password: string): Promise<any> {
        try {
            const response = await fetch(`${this.authEndpoint}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    password,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Login failed with status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Login Error:', error);
            throw error;
        }
    }

    async refreshToken(): Promise<any> {
        try {
            // Get current token from localStorage
            const storedUser = localStorage.getItem('icp_auth_user');
            if (!storedUser) {
                throw new Error('No authentication token found');
            }

            const parsedUser = JSON.parse(storedUser);
            if (!parsedUser.token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch(`${this.authEndpoint}/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${parsedUser.token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Token refresh failed with status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Token Refresh Error:', error);
            throw error;
        }
    }

    // OIDC methods
    async getOIDCAuthorizationUrl(): Promise<{ authorizationUrl: string }> {
        try {
            const response = await fetch(`${this.authEndpoint}/oidc/authorize-url`, {
                method: 'GET',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to get authorization URL with status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('OIDC Authorization URL Error:', error);
            throw error;
        }
    }

    async loginWithOIDC(code: string): Promise<any> {
        try {
            const response = await fetch(`${this.authEndpoint}/login/oidc`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `OIDC login failed with status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('OIDC Login Error:', error);
            throw error;
        }
    }

    // User management methods
    async getUsers(): Promise<any> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            // Get token from localStorage (same as AuthContext)
            const storedUser = localStorage.getItem('icp_auth_user');
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    if (parsedUser.token) {
                        headers['Authorization'] = `Bearer ${parsedUser.token}`;
                    }
                } catch (e) {
                    console.error('Failed to parse stored user for auth header', e);
                }
            }

            const response = await fetch(`${this.authEndpoint}/users`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to fetch users with status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get Users Error:', error);
            throw error;
        }
    }

    async createUser(username: string, displayName: string, password: string): Promise<any> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const response = await fetch(`${this.authEndpoint}/users`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    username,
                    displayName,
                    password,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to create user with status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Create User Error:', error);
            throw error;
        }
    }

    async deleteUser(userId: string): Promise<void> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const response = await fetch(`${this.authEndpoint}/users/${userId}`, {
                method: 'DELETE',
                headers,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to delete user with status: ${response.status}`);
            }
        } catch (error) {
            console.error('Delete User Error:', error);
            throw error;
        }
    }

    async updateUserRoles(userId: string, roles: Array<{
        projectId: string;
        environmentId: string;
        privilegeLevel: string;
    }>): Promise<any> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const response = await fetch(`${this.authEndpoint}/users/${userId}/roles`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(roles),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to update user roles with status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Update User Roles Error:', error);
            throw error;
        }
    }
}

// Create a singleton instance
export const icpApiClient = new ICPApiClient();
export default ICPApiClient;
