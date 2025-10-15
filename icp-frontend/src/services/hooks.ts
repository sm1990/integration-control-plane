import { useState, useEffect, useCallback } from 'react';
import { icpApiClient } from './ICPApiClient';
import {
    GET_RUNTIMES,
    GET_ENVIRONMENTS,
    GET_COMPONENTS,
    GET_PROJECTS,
    DELETE_RUNTIME,
    CREATE_ENVIRONMENT,
    UPDATE_ENVIRONMENT,
    DELETE_ENVIRONMENT,
    CREATE_COMPONENT,
    UPDATE_COMPONENT,
    DELETE_COMPONENT,
    CREATE_PROJECT,
    UPDATE_PROJECT,
    DELETE_PROJECT,
} from '../graphql';
import {
    Runtime,
    Environment,
    Component,
    Project,
    CreateEnvironmentRequest,
    UpdateEnvironmentRequest,
    CreateComponentRequest,
    UpdateComponentRequest,
    CreateProjectRequest,
    UpdateProjectRequest,
    UserWithRoles,
    CreateUserRequest,
} from '../types';

// Generic async hook for GraphQL operations
export function useGraphQLQuery<T>(
    query: string,
    variables?: Record<string, any>,
    dependencies: any[] = []
) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [data, setData] = useState<T | undefined>(undefined);

    const execute = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await icpApiClient.query<T>(query, variables);
            setData(result);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [query, JSON.stringify(variables), ...dependencies]);

    useEffect(() => {
        execute();
    }, [execute]);

    return { loading, error, data, retry: execute };
}

// Runtime hooks
export function useRuntimes(filters?: {
    status?: string;
    runtimeType?: string;
    environmentId?: string;
    projectId?: string;
    componentId?: string;
}) {
    const { data, loading, error, retry } = useGraphQLQuery<{ runtimes: Runtime[] }>(
        GET_RUNTIMES,
        filters
    );

    return {
        value: data?.runtimes || [],
        loading,
        error,
        retry,
    };
}

export function useDeleteRuntime() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const deleteRuntime = useCallback(async (runtimeId: string) => {
        setLoading(true);
        setError(null);
        try {
            await icpApiClient.mutate(DELETE_RUNTIME, { runtimeId });
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteRuntime, loading, error };
}

// Environment hooks
export function useEnvironments() {
    const { data, loading, error, retry } = useGraphQLQuery<{ environments: Environment[] }>(
        GET_ENVIRONMENTS
    );

    return {
        value: data?.environments || [],
        loading,
        error,
        retry,
    };
}

export function useCreateEnvironment() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const createEnvironment = useCallback(async (environment: CreateEnvironmentRequest) => {
        setLoading(true);
        setError(null);
        try {
            const result = await icpApiClient.mutate<{ createEnvironment: Environment }>(
                CREATE_ENVIRONMENT,
                {
                    environment: {
                        name: environment.name,
                        description: environment.description,
                        isProduction: environment.isProduction,
                    },
                }
            );
            return result.createEnvironment;
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { createEnvironment, loading, error };
}

export function useUpdateEnvironment() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const updateEnvironment = useCallback(async (environment: UpdateEnvironmentRequest) => {
        setLoading(true);
        setError(null);
        try {
            const result = await icpApiClient.mutate<{ updateEnvironment: Environment }>(
                UPDATE_ENVIRONMENT,
                {
                    environmentId: environment.environmentId,
                    name: environment.name,
                    description: environment.description,
                    isProduction: environment.isProduction,
                }
            );
            return result.updateEnvironment;
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { updateEnvironment, loading, error };
}

export function useDeleteEnvironment() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const deleteEnvironment = useCallback(async (environmentId: string) => {
        setLoading(true);
        setError(null);
        try {
            await icpApiClient.mutate(DELETE_ENVIRONMENT, { environmentId });
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteEnvironment, loading, error };
}

// Component hooks
export function useComponents(projectId?: string) {
    const { data, loading, error, retry } = useGraphQLQuery<{ components: Component[] }>(
        GET_COMPONENTS,
        projectId ? { projectId } : undefined
    );

    return {
        value: data?.components || [],
        loading,
        error,
        retry,
    };
}

export function useCreateComponent() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const createComponent = useCallback(async (component: CreateComponentRequest) => {
        setLoading(true);
        setError(null);
        try {
            const result = await icpApiClient.mutate<{ createComponent: Component }>(
                CREATE_COMPONENT,
                {
                    component: {
                        projectId: component.projectId,
                        name: component.name,
                        description: component.description,
                    },
                }
            );
            return result.createComponent;
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { createComponent, loading, error };
}

export function useUpdateComponent() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const updateComponent = useCallback(async (component: UpdateComponentRequest) => {
        setLoading(true);
        setError(null);
        try {
            const result = await icpApiClient.mutate<{ updateComponent: Component }>(
                UPDATE_COMPONENT,
                {
                    componentId: component.componentId,
                    name: component.name,
                    description: component.description,
                }
            );
            return result.updateComponent;
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { updateComponent, loading, error };
}

export function useDeleteComponent() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const deleteComponent = useCallback(async (componentId: string) => {
        setLoading(true);
        setError(null);
        try {
            await icpApiClient.mutate(DELETE_COMPONENT, { componentId });
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteComponent, loading, error };
}

// Project hooks
export function useProjects() {
    const { data, loading, error, retry } = useGraphQLQuery<{ projects: Project[] }>(
        GET_PROJECTS
    );

    return {
        value: data?.projects || [],
        loading,
        error,
        retry,
    };
}

export function useCreateProject() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const createProject = useCallback(async (project: CreateProjectRequest) => {
        setLoading(true);
        setError(null);
        try {
            const result = await icpApiClient.mutate<{ createProject: Project }>(
                CREATE_PROJECT,
                {
                    project: {
                        name: project.name,
                        description: project.description,
                    },
                }
            );
            return result.createProject;
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { createProject, loading, error };
}

export function useUpdateProject() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const updateProject = useCallback(async (project: UpdateProjectRequest) => {
        setLoading(true);
        setError(null);
        try {
            const result = await icpApiClient.mutate<{ updateProject: Project }>(
                UPDATE_PROJECT,
                {
                    projectId: project.projectId,
                    name: project.name,
                    description: project.description,
                }
            );
            return result.updateProject;
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { updateProject, loading, error };
}

export function useDeleteProject() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const deleteProject = useCallback(async (projectId: string) => {
        setLoading(true);
        setError(null);
        try {
            await icpApiClient.mutate(DELETE_PROJECT, { projectId });
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteProject, loading, error };
}

// User management hooks
export function useUsers() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [data, setData] = useState<UserWithRoles[]>([]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await icpApiClient.getUsers();
            setData(result);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    return {
        value: data,
        loading,
        error,
        retry: fetchUsers,
    };
}

export function useCreateUser() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const createUser = useCallback(async (user: CreateUserRequest) => {
        setLoading(true);
        setError(null);
        try {
            const result = await icpApiClient.createUser(
                user.username,
                user.displayName,
                user.password
            );
            return result;
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { createUser, loading, error };
}

export function useDeleteUser() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const deleteUser = useCallback(async (userId: string) => {
        setLoading(true);
        setError(null);
        try {
            await icpApiClient.deleteUser(userId);
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteUser, loading, error };
}

export function useUpdateUserRoles() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const updateUserRoles = useCallback(async (
        userId: string,
        roles: Array<{
            projectId: string;
            environmentId: string;
            privilegeLevel: string;
        }>
    ) => {
        setLoading(true);
        setError(null);
        try {
            const result = await icpApiClient.updateUserRoles(userId, roles);
            return result;
        } catch (err) {
            setError(err as Error);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { updateUserRoles, loading, error };
}
