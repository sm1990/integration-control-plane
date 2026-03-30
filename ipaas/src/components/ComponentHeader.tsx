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

import { Avatar, Box, Button, ButtonGroup, Chip, CircularProgress, ClickAwayListener, Grow, IconButton, InputBase, MenuList, MenuItem, Paper, Popper, Stack, Tooltip, Typography } from '@wso2/oxygen-ui';
import { useRef, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Tag, Cloud, Github, GitCommitHorizontal, Copy, Check, ChevronDown, Code2, Pencil } from '@wso2/oxygen-ui-icons-react';
import { type GqlComponentDetail, type GqlProject, type GqlRepository, type GqlCommit } from '../api/queries';
import { useUpdateComponent } from '../api/mutations';
import { formatDistanceToNow } from '../utils/time';
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

interface ComponentHeaderProps {
  component: GqlComponentDetail;
  project?: GqlProject | null;
  repository?: GqlRepository | null;
  latestCommit?: GqlCommit | null;
  orgHandler: string;
  projectId: string;
}

export default function ComponentHeader({ component, project, repository, latestCommit, orgHandler, projectId }: ComponentHeaderProps) {
  const { userId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const splitButtonRef = useRef<HTMLDivElement>(null);

  const [nameEditing, setNameEditing] = useState(false);
  const [nameValue, setNameValue] = useState(component.displayName ?? component.handler);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const updateComponent = useUpdateComponent();

  useEffect(() => {
    setNameValue(component.displayName ?? component.handler);
  }, [component.displayName, component.handler]);

  useEffect(() => {
    if (nameEditing) nameInputRef.current?.select();
  }, [nameEditing]);

  const commitNameEdit = () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameValue(component.displayName ?? component.handler);
      setNameEditing(false);
      return;
    }
    if (trimmed === (component.displayName ?? component.handler)) {
      setNameEditing(false);
      return;
    }
    updateComponent.mutate(
      {
        id: component.id,
        displayName: trimmed,
        description: component.description ?? ' ',
        version: component.version ?? 'v1.0',
        projectId,
        handler: component.handler,
      },
      {
        onSuccess: () => setNameEditing(false),
        onError: () => {
          setNameValue(component.displayName ?? component.handler);
          setNameEditing(false);
        },
      },
    );
  };

  const cancelNameEdit = () => {
    setNameValue(component.displayName ?? component.handler);
    setNameEditing(false);
  };

  const handleCopyRepoUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

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

  const handleOpenInCloud = () => {
    if (!devantOrigin) return;
    const params = new URLSearchParams({
      userId,
      orgUuid: getOrgUuidFromToken() ?? '',
      orgHandle: orgHandler,
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
    const params = new URLSearchParams({ project: project?.handler ?? '', org: orgHandler, component: component.handler });
    if (displayType) {
      params.set('integrationType', displayType);
      params.set('integrationDisplayType', typeLabel ?? displayType);
    }
    window.open(`vscode://${extensionId}/open?${params}`, '_blank');
    setSplitOpen(false);
  };

  return (
    <Stack sx={{ mb: 3 }} gap={1}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
        <Stack direction="row" alignItems="center" gap={2}>
          <Avatar sx={{ width: 48, height: 48, fontSize: 22, bgcolor: 'text.primary', color: 'background.paper' }}>{(nameValue)?.[0]?.toUpperCase() ?? 'C'}</Avatar>
          <Box>
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 0.25, cursor: 'text', columnGap: nameEditing ? 1.5 : 0.5 }} onClick={() => !nameEditing && setNameEditing(true)}>
              {/* The Typography always stays in the DOM and determines the layout size.
                  The InputBase is absolutely overlaid on top when editing — zero layout shift. */}
              <Box sx={{ position: 'relative', display: 'inline-flex', minWidth: 200 }}>
                <Typography variant="h1" sx={{ visibility: nameEditing ? 'hidden' : 'visible', whiteSpace: 'pre' }}>
                  {nameValue || '\u200b'}
                </Typography>
                {nameEditing && (
                  <InputBase
                    inputRef={nameInputRef}
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={commitNameEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitNameEdit(); }
                      if (e.key === 'Escape') { e.preventDefault(); cancelNameEdit(); }
                    }}
                    sx={(theme) => ({
                      position: 'absolute',
                      inset: '-4px',
                      border: `2px solid ${theme.palette.primary.main}`,
                      borderRadius: `${theme.shape.borderRadius}px`,
                      '& input': {
                        ...theme.typography.h1,
                        width: '100%',
                        height: '100%',
                        padding: 0,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                      },
                    })}
                    disabled={updateComponent.isPending}
                    autoComplete="off"
                  />
                )}
              </Box>
              {updateComponent.isPending ? (
                <CircularProgress size={14} />
              ) : (
                !nameEditing && (
                  <Tooltip title="Edit name">
                    <IconButton size="small" sx={{ p: 0.25, opacity: 0, '.MuiStack-root:hover &': { opacity: 1 } }} onClick={(e) => { e.stopPropagation(); setNameEditing(true); }}>
                      <Pencil size={14} />
                    </IconButton>
                  </Tooltip>
                )
              )}
            </Stack>
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
              <Button size="small" sx={{ px: 0.5 }} aria-label="More options" aria-expanded={splitOpen} onClick={() => setSplitOpen((prev) => !prev)}>
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
              <Avatar src={latestCommit.author.avatarUrl} alt={latestCommit.author.name ?? 'Commit author'} sx={{ width: 16, height: 16, fontSize: 10 }}>
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
  );
}
