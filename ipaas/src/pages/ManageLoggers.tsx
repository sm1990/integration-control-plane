/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Alert, Avatar, Box, Card, CardContent, Chip, CircularProgress, Divider, IconButton, MenuItem, PageContent, Select, Snackbar, Stack, Typography } from '@wso2/oxygen-ui';
import { RefreshCw } from '@wso2/oxygen-ui-icons-react';
import { useState, type JSX } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectByHandler, useComponentByHandler, useEnvironments, useLoggers } from '../api/queries';
import { useUpdateLogLevel } from '../api/mutations';
import NotFound from '../components/NotFound';
import { resourceUrl, broaden, type ComponentScope } from '../nav';

type LogLevel = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';

const LOG_LEVELS: LogLevel[] = ['INFO', 'DEBUG', 'WARN', 'ERROR'];

const getLogLevelColor = (level: string): 'default' | 'info' | 'warning' | 'error' => {
  switch (level) {
    case 'DEBUG':
      return 'info';
    case 'WARN':
      return 'warning';
    case 'ERROR':
      return 'error';
    default:
      return 'default';
  }
};

function LoggersList({ environmentId, componentId }: { environmentId: string; componentId: string }) {
  const { data: loggers = [], isLoading, isError, error, refetch } = useLoggers(environmentId, componentId);
  const updateLogLevel = useUpdateLogLevel();
  const [updatingLogger, setUpdatingLogger] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const handleLogLevelChange = async (componentName: string, runtimeIds: string[], newLevel: LogLevel) => {
    setUpdatingLogger(componentName);
    try {
      await updateLogLevel.mutateAsync({
        runtimeIds,
        componentName,
        logLevel: newLevel,
      });
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Failed to update log level:', error);
    } finally {
      setUpdatingLogger(null);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert
        severity="error"
        action={
          <IconButton color="inherit" size="small" onClick={() => refetch()} aria-label="Retry">
            <RefreshCw size={16} />
          </IconButton>
        }>
        {error instanceof Error ? error.message : 'Failed to load loggers'}
      </Alert>
    );
  }

  if (loggers.length === 0) {
    return (
      <Box sx={{ p: 3, bgcolor: 'action.hover', borderRadius: 1, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No loggers found for this environment
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Stack spacing={2}>
        {loggers.map((logger) => (
          <Box key={logger.componentName} sx={{ p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                  {logger.componentName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {logger.runtimeIds.length} runtime{logger.runtimeIds.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <Select value={logger.logLevel} onChange={(e) => handleLogLevelChange(logger.componentName, logger.runtimeIds, e.target.value as LogLevel)} size="small" disabled={updatingLogger === logger.componentName} sx={{ minWidth: 120 }}>
                {LOG_LEVELS.map((level) => (
                  <MenuItem key={level} value={level}>
                    <Chip label={level} size="small" color={getLogLevelColor(level)} sx={{ minWidth: 70 }} />
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          </Box>
        ))}
      </Stack>
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" variant="filled" sx={{ width: '100%' }}>
          Logger level update in progress, please refresh after sometime to view the change
        </Alert>
      </Snackbar>
    </>
  );
}

export default function ManageLoggers(scope: ComponentScope): JSX.Element {
  const queryClient = useQueryClient();
  const [refreshingEnv, setRefreshingEnv] = useState<string | null>(null);
  const { data: project, isLoading: loadingProject } = useProjectByHandler(scope.project);
  const projectId = project?.id ?? '';
  const { data: component, isLoading: loadingComponent } = useComponentByHandler(projectId, scope.component);
  const { data: environments = [], isLoading: loadingEnvironments } = useEnvironments(projectId);

  const handleRefresh = async (envId: string, componentId: string) => {
    setRefreshingEnv(envId);
    await queryClient.invalidateQueries({ queryKey: ['loggers', envId, componentId] });
    setRefreshingEnv(null);
  };

  const isLoading = loadingProject || loadingComponent;
  if (isLoading)
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );

  if (!component) return <NotFound message="Component not found" backTo={resourceUrl(broaden(scope)!, 'overview')} backLabel="Back to Project" />;

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <Box sx={{ position: 'relative', overflow: 'hidden', flex: 1 }}>
        <PageContent>
          <Stack component="header" direction="row" alignItems="center" gap={2} sx={{ mb: 1 }}>
            <Avatar sx={{ width: 56, height: 56, fontSize: 24, bgcolor: 'text.primary', color: 'background.paper' }}>{component.displayName?.[0]?.toUpperCase() ?? 'C'}</Avatar>
            <Typography variant="h1">{component.displayName ?? scope.component}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, ml: 9 }}>
            {component.description || '+ Add Description'}
          </Typography>

          {loadingEnvironments ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : environments.length === 0 ? (
            <Card variant="outlined">
              <CardContent sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Environments Found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create an environment to start managing loggers
                </Typography>
              </CardContent>
            </Card>
          ) : (
            environments.map((env) => (
              <Card key={env.id} variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {env.name}
                    </Typography>
                    <IconButton size="small" onClick={() => handleRefresh(env.id, component.id)} disabled={refreshingEnv === env.id} aria-label="Refresh loggers">
                      <RefreshCw size={16} style={{ animation: refreshingEnv === env.id ? 'spin 1s linear infinite' : 'none', transformOrigin: 'center' }} />
                    </IconButton>
                  </Stack>
                  <Divider sx={{ my: 2 }} />
                  <LoggersList environmentId={env.id} componentId={component.id} />
                </CardContent>
              </Card>
            ))
          )}
        </PageContent>
      </Box>
    </>
  );
}
