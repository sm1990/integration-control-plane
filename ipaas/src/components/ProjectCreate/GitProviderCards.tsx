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

import { Box, Link, Paper, Stack, Tooltip, Typography } from '@wso2/oxygen-ui';
import { GitHub } from '@wso2/oxygen-ui-icons-react';
import { type JSX, type ReactNode } from 'react';
import GitLogoIcon from '../../assets/icons/GitLogoIcon';
import GitLabIcon from '../../assets/icons/GitLabIcon';
import BitbucketIcon from '../../assets/icons/BitbucketIcon';
import AzureDevOpsIcon from '../../assets/icons/AzureDevOpsIcon';
import { GitProvider, type GitCredential } from '../../types/credentials';
import { credentialsForProvider } from '../../utils/gitCredentials';
import CredentialSelectCard from '../Import/CredentialSelectCard';
import { IS_CLOUD } from '../../features';
import { providerComingSoonLabel } from '../../constants/gitProviders';

interface GitProviderCardsProps {
  onGitHubSelect: () => void;
  onPublicSelect: () => void;
  /** All stored git credentials. When paired with `onCredentialSelect`, Bitbucket + GitLab render their credential dropdown inline. */
  credentials?: GitCredential[];
  /** A credential was picked from the Bitbucket/GitLab card dropdown. When provided (with `credentials`), those cards are enabled; omit to render them as "coming soon" (e.g. the import-project flow, not yet wired). */
  onCredentialSelect?: (provider: GitProvider, credential: GitCredential) => void;
  /** Empty-state "Create a credential" action for a provider (opens the add-credential dialog). */
  onCreateCredential?: (provider: GitProvider) => void;
}

const CARD_SX = { px: 3, py: 2, borderColor: 'primary', width: '100%' } as const;

/** A provider card with a static subtitle (GitHub / Public), styled like the credential card. */
function InfoCard({ icon, title, subtitle, onClick, disabled = false }: { icon: ReactNode; title: string; subtitle?: ReactNode; onClick?: () => void; disabled?: boolean }): JSX.Element {
  return (
    <Paper
      variant="outlined"
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={disabled ? undefined : (e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      sx={{ ...CARD_SX, height: '100%', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'border-color 0.15s', '&:hover': disabled ? {} : { borderColor: 'primary.main' } }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ height: '100%' }}>
        <Box sx={{ display: 'flex', flexShrink: 0, color: 'text.primary' }}>{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={500} sx={{ lineHeight: 1.3 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body1" color="grey.600" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

export default function GitProviderCards({ onGitHubSelect, onPublicSelect, credentials, onCredentialSelect, onCreateCredential }: GitProviderCardsProps): JSX.Element {
  // Cloud has no credential-based import yet, so those cards stay "coming soon" even when a caller wires a handler.
  const credentialsEnabled = !!onCredentialSelect && !IS_CLOUD;
  // Cloud only: private GitHub needs the platform GitHub App, so environments
  // without a configured client id can only import public repos.
  const gitHubEnabled = !IS_CLOUD || !!window.API_CONFIG.githubAppClientId;

  const credentialCard = (provider: GitProvider) => (
    <CredentialSelectCard
      provider={provider}
      credentials={credentialsForProvider(credentials ?? [], provider)}
      selected={null}
      onSelect={(c) => onCredentialSelect?.((c.type as GitProvider) || provider, c)}
      emptyContent={
        <Typography variant="body2" color="text.secondary">
          No credentials found.{' '}
          <Link component="button" type="button" onClick={() => onCreateCredential?.(provider)} sx={{ verticalAlign: 'baseline' }}>
            Create a credential
          </Link>{' '}
          to continue.
        </Typography>
      }
    />
  );

  const comingSoonCard = (icon: ReactNode, title: string, subtitle: string, message: string) => (
    <Tooltip title={message} placement="top">
      <Box sx={{ flex: 1 }}>
        <InfoCard icon={icon} title={title} subtitle={subtitle} disabled />
      </Box>
    </Tooltip>
  );

  return (
    <Stack direction="row" gap={2} alignItems="stretch">
      {/* GitHub */}
      {gitHubEnabled ? (
        <Box sx={{ flex: 1 }}>
          <InfoCard icon={<GitHub size={30} />} title="Authorize With GitHub" subtitle="Private GitHub repository" onClick={onGitHubSelect} />
        </Box>
      ) : (
        comingSoonCard(<GitHub size={30} />, 'Authorize With GitHub', 'Connect a private GitHub repository', 'Private GitHub repositories are not enabled in this environment')
      )}

      {/* Bitbucket */}
      {credentialsEnabled ? (
        <Box sx={{ flex: 1 }}>{credentialCard(GitProvider.BITBUCKET_CLOUD)}</Box>
      ) : (
        comingSoonCard(<BitbucketIcon size={30} />, 'Authorize With Bitbucket', 'Connect a Bitbucket repository', providerComingSoonLabel(GitProvider.BITBUCKET_CLOUD))
      )}

      {/* GitLab */}
      {credentialsEnabled ? (
        <Box sx={{ flex: 1 }}>{credentialCard(GitProvider.GITLAB_SELF_MANAGED)}</Box>
      ) : (
        comingSoonCard(<GitLabIcon size={30} />, 'Authorize With GitLab', 'Connect a GitLab repository', providerComingSoonLabel(GitProvider.GITLAB_SELF_MANAGED))
      )}

      {/* Azure DevOps — no import path yet on any product */}
      {comingSoonCard(<AzureDevOpsIcon size={30} />, 'Authorize With Azure DevOps', 'Connect an Azure DevOps repository', providerComingSoonLabel(GitProvider.AZURE_DEVOPS))}

      {/* Public Git Repository */}
      <Box sx={{ flex: 1 }}>
        <InfoCard icon={<GitLogoIcon size={30} />} title="Use Public GitHub Repository" onClick={onPublicSelect} />
      </Box>
    </Stack>
  );
}
