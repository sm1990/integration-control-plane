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

            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
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
}

// Create a singleton instance
export const icpApiClient = new ICPApiClient();
export default ICPApiClient;
