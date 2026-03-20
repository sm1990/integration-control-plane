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

import { Avatar, Box, Button, ButtonGroup, Chip, CircularProgress, ClickAwayListener, Divider, Grow, IconButton, MenuList, MenuItem, PageContent, Paper, Popper, Stack, Tooltip, Typography } from '@wso2/oxygen-ui';
import { Fragment, useRef, useState, useCallback, type JSX } from 'react';
import { CheckCircle2, XCircle, Clock, ArrowDown, Tag, Cloud, Github, GitCommitHorizontal, Copy, Check, ChevronDown, Code2 } from '@wso2/oxygen-ui-icons-react';
import { useProject, useProjectByHandler, useComponentByHandler, useEnvironments, useComponentRepository, useCommitHistory, type GqlRepository } from '../api/queries';
import { formatDistanceToNow } from '../utils/time';
import NotFound from '../components/NotFound';
import { ArtifactDetail } from '../components/ArtifactDetail';
import Environment from '../components/EntryPoints';
import type { SelectedArtifact } from '../components/artifact-config';
import { resourceUrl, broaden, type ComponentScope } from '../nav';
import { useLoadComponentPermissions } from '../hooks/usePermissionLoader';
import { useAuth } from '../auth/AuthContext';
import { getOrgUuidFromToken } from '../auth/tokenManager';

function buildRepoUrl(repo: GqlRepository): string {
  const { gitProvider, organizationApp, nameApp, branch, appSubPath, bitbucketServerUrl, serverUrl, projectApp } = repo;
  const subPath = appSubPath || '';
  const encodedBranch = encodeURIComponent(branch);
  switch (gitProvider) {
    case 'github':
      return `https://github.com/${organizationApp}/${nameApp}/tree/${encodedBranch}/${subPath}`;
    case 'bitbucket':
      return `https://bitbucket.org/${organizationApp}/${nameApp}/src/HEAD/${subPath}?at=${encodedBranch}`;
    case 'bitbucket_server': {
      const base = (bitbucketServerUrl || serverUrl || '').replace(/\/$/, '');
      return `${base}/projects/${organizationApp}/repos/${nameApp}/browse/${subPath}?at=${encodedBranch}`;
    }
    case 'gitlab_self_managed':
      return `${serverUrl || ''}/${organizationApp}/${nameApp}`;
    case 'azure_devops':
      return `https://dev.azure.com/${organizationApp}/${projectApp}/_git/${nameApp}?path=${subPath}&version=GB${branch}`;
    default:
      return `https://github.com/${organizationApp}/${nameApp}`;
  }
}

const DISPLAY_TYPE_LABELS: Record<string, string> = {
  scheduledTask: 'Automation',
  integrationAsApi: 'Integration as API',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Component(scope: ComponentScope): JSX.Element {
  const { userId } = useAuth();
  // Support both UUID and handler in the URL — only one query will be enabled at a time
  const isUuid = UUID_RE.test(scope.project);
  const { data: projectByHandler, isLoading: loadingByHandler } = useProjectByHandler(scope.project);
  const { data: projectById, isLoading: loadingById } = useProject(isUuid ? scope.project : '');
  const project = projectByHandler ?? projectById;
  const loadingProject = isUuid ? loadingById : loadingByHandler;
  const projectId = project?.id ?? '';
  const { data: component, isLoading: loadingComponent } = useComponentByHandler(projectId, scope.component);
  const { data: environments = [] } = useEnvironments(scope.org, projectId);
  const { data: repository } = useComponentRepository(projectId, scope.component);
  const { data: commits = [] } = useCommitHistory(component?.id ?? '', repository?.branch ?? '');
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact | null>(null);
  const [copied, setCopied] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const splitButtonRef = useRef<HTMLDivElement>(null);
  const handleCopyRepoUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  // Load component permissions using the UUID - only when component is loaded
  useLoadComponentPermissions(scope.org, projectId, component?.id || '');

  const isLoading = loadingProject || loadingComponent;
  if (isLoading)
    return (
      <PageContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </PageContent>
    );
  if (!component) return <NotFound message="Component not found" backTo={resourceUrl(broaden(scope)!, 'overview')} backLabel="Back to Project" />;

  const displayType = component.displayType ?? '';
  const typeLabel = DISPLAY_TYPE_LABELS[displayType] ?? (displayType || null);
  const description = component.description?.trim() || null;
  const statusNorm = (component.status ?? '').toLowerCase();
  const buildCompleted = ['completed', 'active', 'success', 'successful'].includes(statusNorm);
  const buildFailed = ['failed', 'error'].includes(statusNorm);
  const buildStatusLabel = statusNorm === 'successful' || statusNorm === 'completed' || statusNorm === 'active' || statusNorm === 'success' ? 'Completed' : statusNorm === 'failed' || statusNorm === 'error' ? 'Failed' : (component.status ?? '');

  const envMatch = (window.API_CONFIG?.choreoOrgApiUrl ?? '').match(/\/\/apis\.([^.]+)\.choreo\.dev/);
  const devantOrigin = envMatch ? `https://${envMatch[1]}.devant.dev` : null;

  const repoUrl = repository ? buildRepoUrl(repository) : null;
  const latestCommit = commits.find((c) => c.isLatest) ?? commits[0] ?? null;

  const handleOpenInCloud = () => {
    if (!devantOrigin) return;
    const params = new URLSearchParams({
      userId,
      orgUuid: getOrgUuidFromToken() ?? '',
      orgHandle: scope.org,
      projectId,
      componentId: component.id,
      sourceCommitHash: latestCommit?.sha ?? '',
    });
    window.open(`${devantOrigin}/editor?${params}`, '_blank', 'noopener,noreferrer');
    setSplitOpen(false);
  };

  const handleOpenInVSCode = () => {
    const isMI = (component.componentType ?? '').toUpperCase() === 'MI';
    const extensionId = isMI ? 'WSO2.micro-integrator' : 'WSO2.ballerina';
    const params = new URLSearchParams({ project: project?.handler ?? '', org: scope.org, component: scope.component });
    if (displayType) {
      params.set('integrationType', displayType);
      params.set('integrationDisplayType', typeLabel ?? displayType);
    }
    window.open(`vscode://${extensionId}/open?${params}`, '_blank');
    setSplitOpen(false);
  };

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
          {/* Component header */}
          <Stack sx={{ mb: 3 }} gap={1}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
              <Stack direction="row" alignItems="flex-start" gap={2}>
                <Avatar sx={{ width: 48, height: 48, fontSize: 22, bgcolor: 'text.primary', color: 'background.paper', mt: 0.5 }}>{component.displayName?.[0]?.toUpperCase() ?? 'C'}</Avatar>
                <Box>
                  <Typography variant="h1" sx={{ mb: 0.25 }}>
                    {component.displayName ?? scope.component}
                  </Typography>
                  {typeLabel && (
                    <Typography variant="body2" color="text.secondary">
                      {typeLabel}
                    </Typography>
                  )}
                </Box>
              </Stack>
              {devantOrigin && (
                <Box sx={{ position: 'relative' }}>
                  <ButtonGroup variant="outlined" size="small" ref={splitButtonRef}>
                    <Button startIcon={<Cloud size={14} />} onClick={handleOpenInCloud} sx={{ whiteSpace: 'nowrap' }}>
                      Open in Cloud&nbsp;
                      <Chip label="Beta" size="small" color="primary" sx={{ height: 16, fontSize: 10, cursor: 'pointer' }} />
                    </Button>
                    <Button size="small" sx={{ px: 0.5 }} onClick={() => setSplitOpen((prev) => !prev)}>
                      <ChevronDown size={14} />
                    </Button>
                  </ButtonGroup>
                  <Popper open={splitOpen} anchorEl={splitButtonRef.current} placement="bottom-end" transition disablePortal style={{ zIndex: 1300 }}>
                    {({ TransitionProps }) => (
                      <Grow {...TransitionProps}>
                        <Paper elevation={3}>
                          <ClickAwayListener onClickAway={() => setSplitOpen(false)}>
                            <MenuList dense sx={{ minWidth: 200 }}>
                              <MenuItem onClick={handleOpenInCloud} selected>
                                <Stack direction="row" alignItems="center" gap={1}>
                                  <Cloud size={14} />
                                  <Typography variant="body2">Open in Cloud</Typography>
                                  <Chip label="Beta" size="small" color="primary" sx={{ height: 16, fontSize: 10 }} />
                                </Stack>
                              </MenuItem>
                              <MenuItem onClick={handleOpenInVSCode}>
                                <Stack direction="row" alignItems="center" gap={1}>
                                  <Code2 size={14} />
                                  <Typography variant="body2">Open in VS Code</Typography>
                                </Stack>
                              </MenuItem>
                            </MenuList>
                          </ClickAwayListener>
                        </Paper>
                      </Grow>
                    )}
                  </Popper>
                </Box>
              )}
            </Stack>
            <Typography variant="body2" color={description ? 'text.secondary' : 'primary'}>
              {description || '+ Add Description'}
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Tag size={12} />
              <Typography variant="body2" color="primary" sx={{ cursor: 'pointer' }}>
                + Add Labels
              </Typography>
            </Stack>
            <Stack gap={0.5}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
                  Source:
                </Typography>
                <Github size={12} />
                {repoUrl ? (
                  <>
                    <Typography
                      variant="body2"
                      component="a"
                      href={repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={repoUrl}>
                      {repoUrl}
                    </Typography>
                    <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
                      <IconButton size="small" onClick={() => handleCopyRepoUrl(repoUrl)} sx={{ p: 0.25 }}>
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                      </IconButton>
                    </Tooltip>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                )}
              </Stack>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
                  Latest Commit:
                </Typography>
                <GitCommitHorizontal size={12} />
                {latestCommit ? (
                  <>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {latestCommit.sha.substring(0, 7)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={latestCommit.message}>
                      {latestCommit.message}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDistanceToNow(latestCommit.author.date)}
                    </Typography>
                    <Avatar src={latestCommit.author.avatarUrl} sx={{ width: 16, height: 16, fontSize: 10 }}>
                      {latestCommit.author.name?.[0]?.toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" color="text.secondary">
                      {latestCommit.author.name}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                )}
              </Stack>
              {component.status && (
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>
                    Build Status:
                  </Typography>
                  {buildCompleted && <CheckCircle2 size={14} color="green" />}
                  {buildFailed && <XCircle size={14} color="red" />}
                  {!buildCompleted && !buildFailed && <Clock size={14} />}
                  <Typography variant="body2">{buildStatusLabel}</Typography>
                </Stack>
              )}
            </Stack>
          </Stack>

          <Divider sx={{ mb: 3 }} />

          {/* Environment cards with Promote between them */}
          {environments.map((env, index) => (
            <Fragment key={env.id}>
              <Environment
                env={env}
                componentId={component.id}
                projectId={projectId}
                componentType={component.componentType ?? ''}
                displayType={displayType}
                componentHandler={component.handler}
                projectHandler={project?.handler ?? ''}
                onSelectArtifact={(a, type, envId) => setSelectedArtifact({ artifact: a, artifactType: type, envId, componentId: component.id, projectId })}
                onOpenDrawerForTab={(a, type, envId, tab) => setSelectedArtifact({ artifact: a, artifactType: type, envId, componentId: component.id, projectId, initialTab: tab })}
              />
              {index < environments.length - 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                  <Button variant="outlined" size="small" startIcon={<ArrowDown size={14} />} disabled>
                    Promote
                  </Button>
                </Box>
              )}
            </Fragment>
          ))}
        </PageContent>
        <ArtifactDetail selected={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
      </Box>
    </>
  );
}
