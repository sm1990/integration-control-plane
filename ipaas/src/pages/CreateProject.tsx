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

import { Alert, Box, Button, CircularProgress, Grid, IconButton, InputAdornment, MenuItem, PageContent, Stack, TextField, Tooltip, Typography } from '@wso2/oxygen-ui';
import { ArrowLeft, Building2, Check, ChevronDown, ChevronUp, Edit, GitHub, GitBranch } from '@wso2/oxygen-ui-icons-react';
import GitLogoIcon from '../assets/icons/GitLogoIcon';
import GitProviderCards from '../components/ProjectCreate/GitProviderCards';
import GitHubAuthArea from '../components/Import/GitHubAuthArea';
import { useGitRepoSource } from '../hooks/useGitRepoSource';
import { useState, useEffect, useLayoutEffect, type JSX } from 'react';
import { useAppNavigate } from '../hooks/useAppNavigate';
import BusyFields from '../components/common/BusyFields';
import { useCreateProject, useCreateMonoRepoProject } from '../hooks/useProjects';
import { useCreateComponent } from '../hooks/useComponents';
import { useOrgs, useOrgComponentLimits, useOrgSubscriptions } from '../hooks/useOrg';
import type { Project } from '../types/project';
import { useOrgUuid } from '../hooks/useOrgUuid';
import DirectoryPickerField from '../components/DirectoryPicker';
import WorkspaceModuleTable from '../components/ProjectCreate/WorkspaceModuleTable';
import { FREE_COMPONENT_LIMIT } from '../constants/project';
import { useProjectHandler } from '../hooks/useProjectHandler';
import { resourceUrl, narrow, type OrgScope } from '../nav';
import { toHandler } from '../utils/string';
import { validateProjectName, validateProjectHandler, normalizeProjectError } from '../utils/projectValidation';
import { GitProvider as CredGitProvider } from '../types/credentials';
import AddCredentialDialog from '../components/Settings/Credentials/AddCredentialDialog';
import { gitProviderIcon } from '../constants/gitProviders';
import { buildRepoUrl } from '../utils/gitProviderUrl';

export default function CreateProject(scope: OrgScope): JSX.Element {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [gitSectionOpen, setGitSectionOpen] = useState(false);
  const [showWorkspaceConfig, setShowWorkspaceConfig] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    gitProvider,
    credProvider,
    selectedCredential,
    isCredentialMode,
    isPublicRepo,
    providerSelected,
    secretRef,
    providerLabel,
    allCredentials,
    showCredModal,
    setShowCredModal,
    modalProvider,
    selectedOrg,
    setSelectedOrg,
    selectedRepo,
    setSelectedRepo,
    repoUrl,
    setRepoUrl,
    urlError,
    parsedOrg,
    selectedBranch,
    setSelectedBranch,
    subPath,
    setSubPath,
    activeOrg,
    activeRepo,
    showBranchAndSubPath,
    isWorkspace,
    workspaceModules,
    setWorkspaceModules,
    userRepos,
    isReposLoading,
    refetchRepos,
    isAuthenticated,
    branches,
    isBranchesLoading,
    repoContents,
    isContentsLoading,
    isContentsError,
    refetchContents,
    authStatus,
    startGitHubAuth,
    startGitHubAppInstall,
    isCheckingAuth,
    credentialAuthFailed,
    handleProviderSelect,
    handleCredentialPicked,
    handleCreateCredential,
    handleCredentialAdded,
    resetSource,
  } = useGitRepoSource(gitSectionOpen);
  const attachGit = providerSelected;

  const colSize = !isPublicRepo && showBranchAndSubPath ? 3 : 4;

  const { handler: effectiveHandler, handlerEdited, isCheckingAvailability, availability, availabilityError, startEditing, stopEditing, onHandlerChange } = useProjectHandler(displayName);
  const createProject = useCreateProject();
  const createMonoRepoProject = useCreateMonoRepoProject();
  const createComponent = useCreateComponent();
  const navigate = useAppNavigate();
  const orgHomeUrl = resourceUrl(scope, 'overview');

  const { data: orgs = [] } = useOrgs();
  const orgUuid = useOrgUuid() ?? orgs.find((o) => o.handle === scope.org)?.uuid ?? '';
  const { data: orgLimits } = useOrgComponentLimits(orgUuid);
  const { data: subscriptions } = useOrgSubscriptions(orgUuid);
  const isUpgraded = (subscriptions ?? []).some((s) => s.subscriptionType === 'devant-subscription' && s.subscriptionStatus === 'active');
  const orgBillableCount = isUpgraded ? 0 : (orgLimits?.billableComponentCount ?? 0);
  const quotaRemaining = isUpgraded ? undefined : Math.max(0, FREE_COMPONENT_LIMIT - orgBillableCount);

  // Collapse the workspace-config panel whenever the source repo/branch or detection result changes.
  useEffect(() => {
    setShowWorkspaceConfig(false);
  }, [selectedRepo, selectedBranch, isWorkspace]);

  // Stabilize scrollbar gutter to prevent layout shift when content height changes
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('scrollbar-gutter', 'stable');
    return () => {
      document.documentElement.style.removeProperty('scrollbar-gutter');
    };
  }, []);

  const handleGitSectionToggle = () => {
    // Dismissing the optional section clears any chosen provider and repo state.
    if (gitSectionOpen) resetSource();
    setGitSectionOpen((prev) => !prev);
  };

  const nameError = displayName ? validateProjectName(displayName) : null;
  const handlerError = effectiveHandler ? validateProjectHandler(effectiveHandler) : null;
  const handlerTaken = availability && !availability.handlerUnique ? 'This name is already taken.' : null;

  const gitReady = !attachGit || (showBranchAndSubPath && !!selectedBranch);
  // A failed availability check must not hard-block submit — the create call still validates uniqueness.
  const availabilityReady = !effectiveHandler || effectiveHandler.length < 2 || availability !== undefined || availabilityError;
  const canSubmit = !!displayName.trim() && !nameError && !!effectiveHandler && !handlerError && !handlerTaken && !isCheckingAvailability && availabilityReady && gitReady;

  const handleSubmit = async () => {
    setIsCreating(true);
    setSubmitError(null);

    // Step 1: create the project. Any failure here is surfaced immediately.
    let project: Project;
    try {
      if (attachGit && activeOrg && activeRepo && selectedBranch) {
        project = await createMonoRepoProject.mutateAsync({
          name: displayName.trim(),
          handler: effectiveHandler,
          description: description.trim(),
          orgHandler: scope.org,
          repository: activeRepo,
          gitOrganization: activeOrg,
          branch: selectedBranch,
          directoryPath: subPath === '/' ? '' : subPath.replace(/^\//, ''),
          gitProvider: isPublicRepo ? 'public' : isCredentialMode ? (credProvider as string) : 'github',
          isPublicRepo,
          secretRef,
        });
      } else {
        project = await createProject.mutateAsync({
          name: displayName.trim(),
          handler: effectiveHandler,
          description: description.trim(),
          orgHandler: scope.org,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setSubmitError(normalizeProjectError(message));
      setIsCreating(false);
      return;
    }

    // Step 2: create workspace module components. The project already exists, so individual
    // component failures don't block navigation — the user can manage them from the project page.
    if (isWorkspace && workspaceModules.length > 0) {
      const srcGitRepoUrl = buildRepoUrl(credProvider ?? CredGitProvider.GITHUB, activeOrg, activeRepo, selectedCredential?.serverUrl);
      await Promise.allSettled(
        workspaceModules.map((module) =>
          createComponent.mutateAsync({
            displayName: module.displayName || module.name,
            name: toHandler(module.displayName || module.name),
            description: '',
            orgHandler: scope.org,
            projectId: project.id,
            displayType: module.integrationType === 'automation' ? 'scheduledTask' : 'ballerinaService',
            srcGitRepoUrl,
            repositoryBranch: selectedBranch,
            repositorySubPath: module.path,
            isPublicRepo,
            ...(isCredentialMode ? { secretRef } : {}),
          }),
        ),
      );
    }

    window.location.href = resourceUrl(narrow(scope, project.handler), 'overview');
  };

  const renderHandlerHelperText = () => {
    // handlerError first: it is a fault in the value itself (reserved, malformed), which
    // stands regardless of what the availability call says about uniqueness.
    if (handlerError) return handlerError;
    if (isCheckingAvailability) return 'Checking availability…';
    if (handlerTaken) {
      const alt = availability?.alternateHandlerCandidate;
      return alt ? `This name is already taken. Try "${alt}" instead.` : handlerTaken;
    }
    return 'Auto-generated identifier';
  };

  const renderCredentialAuthArea = () => {
    if (!secretRef) return null;
    if (credentialAuthFailed) {
      return (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={resetSource}>
              Retry
            </Button>
          }>
          Could not access your {providerLabel} repositories. Re-authorize and try again.
        </Alert>
      );
    }
    if (isReposLoading) {
      return (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3, minHeight: 40 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Loading your {providerLabel} repositories…
          </Typography>
        </Stack>
      );
    }
    return null;
  };

  const orgOptions = userRepos?.map((o) => o.orgName) ?? [];
  const reposForOrg = userRepos?.find((o) => o.orgName === selectedOrg)?.repositories.map((r) => r.name) ?? [];

  const renderRepoPickers = () => (
    <Grid container spacing={3} sx={{ mb: 5 }}>
      {isPublicRepo ? (
        <Grid size={{ xs: 12, md: colSize }}>
          <TextField
            label="Repository URL"
            required
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            fullWidth
            error={!!urlError}
            helperText={
              urlError || (
                <>
                  Only public GitHub repositories are supported.
                  <br />
                  e.g. https://github.com/org/repo
                </>
              )
            }
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <GitLogoIcon size={16} />
                  </InputAdornment>
                ),
                endAdornment:
                  isBranchesLoading && parsedOrg ? (
                    <InputAdornment position="end">
                      <CircularProgress size={16} />
                    </InputAdornment>
                  ) : undefined,
              },
            }}
          />
        </Grid>
      ) : (
        <>
          <Grid size={{ xs: 12, md: colSize }}>
            <TextField
              label="Organization"
              select
              required
              value={selectedOrg}
              onChange={(e) => {
                setSelectedOrg(e.target.value);
                setSelectedRepo('');
                setSelectedBranch('');
              }}
              fullWidth
              disabled={!isAuthenticated || isReposLoading}
              error={credentialAuthFailed}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">{isCredentialMode ? gitProviderIcon(credProvider!, 18) : <Building2 size={18} />}</InputAdornment>,
                },
              }}
              helperText={isCredentialMode ? `${providerLabel} organization` : 'GitHub organization'}>
              {orgOptions.map((org) => (
                <MenuItem key={org} value={org}>
                  {org}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: colSize }}>
            <TextField
              label="Repository"
              select
              required
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              fullWidth
              disabled={!selectedOrg || isReposLoading}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      {isCredentialMode ? (
                        gitProviderIcon(credProvider!, 16)
                      ) : (
                        <Box sx={{ color: 'common.black', display: 'flex' }}>
                          <GitHub size={16} />
                        </Box>
                      )}
                    </InputAdornment>
                  ),
                },
              }}
              helperText="Select repository">
              {reposForOrg.map((repo) => (
                <MenuItem key={repo} value={repo}>
                  {repo}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </>
      )}

      {showBranchAndSubPath && (
        <Grid size={{ xs: 12, md: colSize }}>
          <TextField
            label="Branch"
            select
            required
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            fullWidth
            disabled={!activeRepo || isBranchesLoading}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <GitBranch size={18} />
                  </InputAdornment>
                ),
              },
            }}
            helperText="Select branch">
            {(branches ?? []).map((b) => (
              <MenuItem key={b.name} value={b.name}>
                {b.name}
                {b.isDefault ? ' (default)' : ''}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      )}

      {showBranchAndSubPath && (
        <Grid size={{ xs: 12, md: colSize }}>
          <DirectoryPickerField repo={activeRepo} value={subPath} onChange={(path) => setSubPath(path)} isError={isContentsError} contents={repoContents} isFetching={isContentsLoading} onRefetch={refetchContents} disabled={!selectedBranch} />
        </Grid>
      )}
    </Grid>
  );

  return (
    <PageContent sx={{ pt: 5, '& .MuiFormLabel-asterisk': { color: 'error.main' } }}>
      <Button startIcon={<ArrowLeft size={16} />} onClick={() => navigate(orgHomeUrl)} sx={{ mb: 2 }}>
        Back to Home
      </Button>

      <Typography variant="h1" sx={{ mb: 4 }}>
        Create a Project
      </Typography>

      {submitError && (
        <Alert severity="error" role="alert" sx={{ mb: 3 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      <BusyFields busy={isCreating}>
        {/* Project details */}
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Project Details
        </Typography>

        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Display Name"
              required
              placeholder="Enter Project Name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setSubmitError(null);
              }}
              fullWidth
              error={!!nameError}
              helperText={nameError ?? 'Name of the project'}
              slotProps={{ htmlInput: { 'aria-label': 'Display Name' } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Name"
              value={effectiveHandler}
              onChange={(e) => onHandlerChange(e.target.value)}
              fullWidth
              disabled={!handlerEdited}
              error={!!handlerError || !!handlerTaken}
              helperText={renderHandlerHelperText()}
              slotProps={{
                htmlInput: { 'aria-label': 'Name' },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      {isCheckingAvailability ? (
                        <CircularProgress size={16} />
                      ) : (
                        <Tooltip title={handlerEdited ? 'Done' : 'Edit name'} placement="top">
                          <IconButton size="small" aria-label={handlerEdited ? 'Confirm name' : 'Edit name'} onClick={() => (handlerEdited ? stopEditing() : startEditing())} sx={handlerEdited ? { color: 'success.main' } : { color: 'primary.main' }}>
                            {handlerEdited ? <Check size={16} /> : <Edit size={16} />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField label="Description (Optional)" placeholder="Enter description here" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={1} slotProps={{ htmlInput: { 'aria-label': 'Description' } }} />
          </Grid>
        </Grid>

        {/* Connect Repository — collapsible optional section */}
        <Stack
          direction="row"
          alignItems="center"
          gap={1.5}
          role="button"
          tabIndex={0}
          aria-expanded={gitSectionOpen}
          onClick={handleGitSectionToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleGitSectionToggle();
            }
          }}
          sx={{ cursor: 'pointer', mb: gitSectionOpen ? 3 : 6, userSelect: 'none' }}>
          <Typography variant="h5" component="h2">
            Connect Your Repository (Optional)
          </Typography>
          <Box sx={{ color: 'primary.main', display: 'flex' }}>{gitSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</Box>
        </Stack>

        {gitSectionOpen && (
          <>
            {!attachGit ? (
              <Box sx={{ mb: 5 }}>
                <GitProviderCards
                  onGitHubSelect={() => {
                    handleProviderSelect('github');
                    startGitHubAuth(refetchRepos);
                  }}
                  onPublicSelect={() => handleProviderSelect('public')}
                  credentials={allCredentials}
                  onCredentialSelect={handleCredentialPicked}
                  onCreateCredential={handleCreateCredential}
                />
              </Box>
            ) : (
              <Box sx={{ mt: 4 }}>
                {gitProvider === 'github' && <GitHubAuthArea authStatus={authStatus} isCheckingAuth={isCheckingAuth} isAuthenticated={isAuthenticated} onAuthorize={() => startGitHubAuth(refetchRepos)} onInstall={() => startGitHubAppInstall(refetchRepos)} />}
                {isCredentialMode && renderCredentialAuthArea()}
                {renderRepoPickers()}
              </Box>
            )}
          </>
        )}

        {/* Workspace detected — prompt user to configure integrations */}
        {isWorkspace && !showWorkspaceConfig && (
          <Box sx={{ mb: 5, mt: -1 }}>
            <Typography variant="body2" color="text.secondary">
              WSO2 Integrator project detected. Do you want to import its integrations?
            </Typography>
            <Button
              variant="text"
              size="small"
              sx={{
                p: 0,
                minWidth: 0,
                mt: 0.5,
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
                },
              }}
              onClick={() => setShowWorkspaceConfig(true)}>
              Import Project Integrations
            </Button>
          </Box>
        )}
        {isWorkspace && showWorkspaceConfig && (
          <>
            <WorkspaceModuleTable repoName={activeRepo} repoContents={repoContents} modules={workspaceModules} onChange={setWorkspaceModules} quotaRemaining={quotaRemaining} />
            <Box sx={{ mb: 2 }} />
          </>
        )}
      </BusyFields>

      <Stack direction="row" gap={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => navigate(orgHomeUrl)} disabled={isCreating}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || isCreating} startIcon={isCreating ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {isCreating ? 'Creating…' : 'Create Project'}
        </Button>
      </Stack>

      {showCredModal && modalProvider && (
        <AddCredentialDialog initialProvider={modalProvider} lockProvider onClose={() => setShowCredModal(false)} onCancel={() => setShowCredModal(false)} onAdded={() => {}} onAddedCredential={handleCredentialAdded} onError={() => {}} />
      )}
    </PageContent>
  );
}
