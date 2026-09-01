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

import { Box, CircularProgress, PageContent, Typography } from '@wso2/oxygen-ui';
import { useEffect, type JSX } from 'react';
import AgentChatConsole from './AgentChatConsole';
import AutomationTest from './AutomationTest';
import ComingSoon from './ComingSoon';
import McpTest from './McpTest';
import TestConsole from './TestConsole';
import { useComponentByHandler } from '../hooks/useComponents';
import { useIntegrationIdentity } from '../hooks/useIntegrationIdentity';
import { useProjectId } from '../hooks/useProjects';
import type { ComponentScope } from '../nav';
import { trackEvent } from '../utils/tracking';

/**
 * The component "Test" page dispatches by integration type (identified once via
 * `useIntegrationIdentity`), so `/test` is correct however it was reached — sidebar
 * tile, bookmark, or a scope switch that preserved the `test` resource key.
 */
export default function ComponentTest(scope: ComponentScope): JSX.Element {
  const { projectId } = useProjectId(scope.project);
  const { data: comp, isLoading } = useComponentByHandler(projectId, scope.component);
  const identity = useIntegrationIdentity(comp ?? undefined);

  useEffect(() => {
    if (comp) trackEvent('component-test');
    // Only re-fire when navigating to a different component, not on every re-render where
    // `comp` gets a new object reference for the same id (e.g. a background refetch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp?.id]);

  if (isLoading) {
    return (
      <PageContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 120px)' }}>
          <CircularProgress />
        </Box>
      </PageContent>
    );
  }

  // Not-found is distinct from an unsupported type — surface it rather than "Coming Soon".
  if (!comp) {
    return (
      <PageContent>
        <Typography>Integration not found</Typography>
      </PageContent>
    );
  }

  // RAG ingestion is a scheduled task — it uses the same Automation test view.
  if (identity?.type === 'automation' || identity?.type === 'rag-ingestion') return <AutomationTest {...scope} />;
  if (identity?.type === 'mcp-server' || identity?.type === 'mcp-proxy') return <McpTest {...scope} />;
  if (identity?.type === 'integration-as-api') return <TestConsole {...scope} />;
  if (identity?.type === 'ai-agent') return <AgentChatConsole {...scope} />;
  return <ComingSoon title="Coming Soon" description="Testing tools are currently under development." />;
}
