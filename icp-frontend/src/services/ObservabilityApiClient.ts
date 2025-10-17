interface ObservabilityResponse<T = any> {
  data?: T;
  error?: string;
}

class ObservabilityApiClient {
  private readonly endpoint: string;

  constructor(endpoint?: string) {
    // In development, use relative path to leverage proxy
    const defaultEndpoint = 'https://localhost:9448/icp/observability';

    this.endpoint = endpoint || process.env.REACT_APP_OBSERVABILITY_URL || defaultEndpoint;
  }

  private async executeRequest<T = any>(
    path: string,
    method: string = 'POST',
    body?: any
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

      const response = await fetch(`${this.endpoint}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Observability API Error:', error);
      throw error;
    }
  }

  // Fetch logs based on filters
  async getLogs(request: {
    duration: number;
    logLimit: number;
    runtimeId?: string;
    component?: string;
    environment?: string;
    project?: string;
    logLevel?: string;
  }): Promise<any[]> {
    return this.executeRequest('/logs', 'POST', request);
  }
}

// Create a singleton instance
export const observabilityApiClient = new ObservabilityApiClient();
export default ObservabilityApiClient;
