import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gql } from './graphql';
import type { GqlArtifact } from './queries';

const UPDATE_ARTIFACT_TRACING_STATUS = `
  mutation UpdateArtifactTracingStatus($input: ArtifactTracingChangeInput!) {
    updateArtifactTracingStatus(input: $input) {
      status, message, successCount, failedCount, details
    }
  }`;

const UPDATE_ARTIFACT_STATISTICS_STATUS = `
  mutation UpdateArtifactStatisticsStatus($input: ArtifactStatisticsChangeInput!) {
    updateArtifactStatisticsStatus(input: $input) {
      status, message, successCount, failedCount, details
    }
  }`;

export interface ArtifactToggleStatusInput {
  envId: string;
  componentId: string;
  artifactType: string;
  artifactName: string;
  value: 'enable' | 'disable';
}

export interface ArtifactTracingInput {
  envId: string;
  componentId: string;
  artifactType: string;
  artifactName: string;
  trace: 'enable' | 'disable';
}

export interface ArtifactStatisticsInput {
  envId: string;
  componentId: string;
  artifactType: string;
  artifactName: string;
  statistics: 'enable' | 'disable';
}

export type ArtifactToggleKind = 'tracing' | 'statistics';

/** PascalCase → kebab-case: "ProxyService" → "proxy-service" */
function toKebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function toBackendArtifactType(artifactType: string): string {
  if (artifactType === 'RestApi') return 'api';
  return toKebab(artifactType);
}

const TOGGLE_CONFIG: Record<ArtifactToggleKind, { mutation: string; requestField: 'trace' | 'statistics'; cacheField: 'tracing' | 'statistics' }> = {
  tracing: {
    mutation: UPDATE_ARTIFACT_TRACING_STATUS,
    requestField: 'trace',
    cacheField: 'tracing',
  },
  statistics: {
    mutation: UPDATE_ARTIFACT_STATISTICS_STATUS,
    requestField: 'statistics',
    cacheField: 'statistics',
  },
};

export function useUpdateArtifactToggleStatus(kind: ArtifactToggleKind) {
  const qc = useQueryClient();
  const config = TOGGLE_CONFIG[kind];

  return useMutation({
    mutationFn: (input: ArtifactToggleStatusInput) => {
      const mutationInput: Record<string, string> = {
        componentId: input.componentId,
        artifactType: toBackendArtifactType(input.artifactType),
        artifactName: input.artifactName,
        [config.requestField]: input.value,
      };

      if (kind === 'tracing') {
        return gql<{ updateArtifactTracingStatus: { status: string; message: string } }>(config.mutation, { input: mutationInput }).then((d) => d.updateArtifactTracingStatus);
      }

      return gql<{ updateArtifactStatisticsStatus: { status: string; message: string } }>(config.mutation, { input: mutationInput }).then((d) => d.updateArtifactStatisticsStatus);
    },
    onMutate: async (input) => {
      const scope = (q: { queryKey: readonly unknown[] }) => q.queryKey[2] === input.envId && q.queryKey[3] === input.componentId;
      const filters = { queryKey: ['artifacts', input.artifactType] as const, predicate: scope };
      await qc.cancelQueries(filters);
      const previous = qc.getQueriesData<GqlArtifact[]>(filters);
      const newValue = input.value === 'enable' ? 'enabled' : 'disabled';
      qc.setQueriesData<GqlArtifact[]>(filters, (old) => old?.map((a) => (a.name === input.artifactName ? { ...a, [config.cacheField]: newValue } : a)));
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          qc.setQueryData(key, data);
        }
      }
    },
  });
}

export function useUpdateArtifactTracingStatus() {
  const mutation = useUpdateArtifactToggleStatus('tracing');

  return {
    ...mutation,
    mutate: (input: ArtifactTracingInput, options?: Parameters<typeof mutation.mutate>[1]) => mutation.mutate({ ...input, value: input.trace }, options),
    mutateAsync: (input: ArtifactTracingInput, options?: Parameters<typeof mutation.mutateAsync>[1]) => mutation.mutateAsync({ ...input, value: input.trace }, options),
  };
}

export function useUpdateArtifactStatisticsStatus() {
  const mutation = useUpdateArtifactToggleStatus('statistics');

  return {
    ...mutation,
    mutate: (input: ArtifactStatisticsInput, options?: Parameters<typeof mutation.mutate>[1]) => mutation.mutate({ ...input, value: input.statistics }, options),
    mutateAsync: (input: ArtifactStatisticsInput, options?: Parameters<typeof mutation.mutateAsync>[1]) => mutation.mutateAsync({ ...input, value: input.statistics }, options),
  };
}
