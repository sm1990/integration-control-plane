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

import { Alert, Box, Button, Card, CardContent, CircularProgress, Grid, IconButton, InputAdornment, MenuItem, PageContent, Select, Stack, TextField, Tooltip, Typography } from '@wso2/oxygen-ui';
import { Copy, SendHorizontal } from '@wso2/oxygen-ui-icons-react';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import AIWelcomeIcon from '../assets/icons/ai/AIWelcomeIcon';
import ApiChatMessage from '../components/AiCopilot/ApiChatMessage';
import DeploymentTrackBar from '../components/DeploymentTrackBar';
import NotFound from '../components/NotFound';
import { useComponentByHandler, useComponentDeployment, useEnvEndpoints, useEnvironments } from '../api/queries';
import { getOrgUuidFromToken } from '../auth/tokenManager';
import { CopilotContext } from '../contexts/CopilotContext';
import useCopilot from '../hooks/useCopilot';
import { useProjectId } from '../hooks/useProjectId';
import { broaden, resourceUrl, type ComponentScope } from '../nav';
import { MessageType, type ApiChatExecutionResult, type IMessage } from '../types/copilot';
import { getOrCreateCopilotSessionId } from '../utils/copilot';
import { generateUUID } from '../utils/string';

const SAMPLE_QUERIES = [
  {
    title: 'Invoke all resources of the API',
    query: 'Invoke all resources',
  },
  {
    title: 'Invoke a single resource of the API',
    query: 'Can you please provide me with a greeting message?',
  },
  {
    title: 'Invoke an action involving multiple resources',
    query: 'Could you first say hi to me and then follow it up with a hey message?',
  },
];

interface EnvDotProps {
  orgHandler: string;
  orgUuid: string;
  componentId: string;
  versionId: string;
  envId: string;
}

function EnvDot({ orgHandler, orgUuid, componentId, versionId, envId }: EnvDotProps): JSX.Element {
  const { data: dep } = useComponentDeployment(orgHandler, orgUuid, componentId, versionId, envId);
  const status = dep?.deploymentStatusV2?.toUpperCase() ?? '';
  const colorMap: Record<string, string> = {
    ACTIVE: 'success.main',
    ERROR: 'error.main',
    FAILED: 'error.main',
    IN_PROGRESS: 'warning.main',
    SUSPENDED: 'text.disabled',
    NOT_DEPLOYED: 'text.disabled',
  };
  return <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colorMap[status] ?? 'text.disabled', flexShrink: 0 }} />;
}

export default function ApiChat(scope: ComponentScope): JSX.Element {
  const orgUuid = getOrgUuidFromToken() ?? '';
  const { projectId, project } = useProjectId(scope.project);

  const { data: component, isLoading: loadingComponent } = useComponentByHandler(projectId, scope.component);
  const { data: environments = [] } = useEnvironments(scope.org, projectId);

  const tracks = useMemo(() => component?.deploymentTracks ?? [], [component?.deploymentTracks]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  useEffect(() => {
    if (!tracks.length) return;
    setSelectedTrackId((prev) => {
      if (prev && tracks.some((t) => t.id === prev)) return prev;
      return tracks.find((t) => t.latest)?.id ?? tracks[0].id;
    });
  }, [component?.id, tracks]);

  const [selectedEnvId, setSelectedEnvId] = useState('');
  useEffect(() => {
    if (!environments.length) return;
    setSelectedEnvId((prev) => (prev && environments.some((e) => e.id === prev) ? prev : environments[0].id));
  }, [environments]);
  const selectedEnv = environments.find((e) => e.id === selectedEnvId) ?? null;

  const { data: deployment } = useComponentDeployment(
    component ? scope.org : '',
    component ? orgUuid : '',
    component?.id ?? '',
    selectedTrackId,
    selectedEnv?.id ?? '',
  );
  const releaseId = deployment?.releaseId ?? '';

  const { data: endpoints = [] } = useEnvEndpoints(component?.id ?? '', selectedTrackId, releaseId);
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  useEffect(() => {
    if (endpoints.length > 0 && (!selectedEndpointId || !endpoints.find((e) => e.id === selectedEndpointId))) {
      setSelectedEndpointId(endpoints[0].id);
    }
  }, [endpoints, selectedEndpointId]);

  // Local chat state (isolated from the Copilot drawer)
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [trackingIdCopied, setTrackingIdCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { isAiCopilotLoading, isStreaming, answer, apiChatExecutionResult, sendMessage, trackingId, abortControllerRef } = useCopilot();
  const { messageSendingError, setMessageSendingError } = useContext(CopilotContext);
  const sessionId = useMemo(() => getOrCreateCopilotSessionId(), []);

  // Sync streaming answer into local messages
  useEffect(() => {
    if (!abortControllerRef.current.signal.aborted && answer.length > 0) {
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (!last.fromUser && last.type === MessageType.REGULAR) {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content: { data: answer.join('') } };
          return next;
        }
        return [...prev, { id: generateUUID(), content: { data: answer.join('') }, fromUser: false, type: MessageType.REGULAR }];
      });
    }
  }, [answer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync API execution results into local messages
  useEffect(() => {
    if (!abortControllerRef.current.signal.aborted && apiChatExecutionResult) {
      const captured = apiChatExecutionResult;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && !last.fromUser && last.type === MessageType.APICHAT) {
          const next = structuredClone(prev);
          next[next.length - 1].content.data = [...(next[next.length - 1].content.data as ApiChatExecutionResult[]), captured];
          return next;
        }
        return [...prev, { id: generateUUID(), content: { data: [captured] }, fromUser: false, type: MessageType.APICHAT }];
      });
    }
  }, [apiChatExecutionResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || isAiCopilotLoading || isStreaming) return;
      const messageId = generateUUID();
      setMessages((prev) => [...prev, { id: messageId, content: { data: trimmed }, fromUser: true, type: MessageType.REGULAR }]);
      sendMessage(trimmed, messageId);
      setInputValue('');
    },
    [isAiCopilotLoading, isStreaming, sendMessage],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  const handleCopyTrackingId = () => {
    navigator.clipboard.writeText(trackingId || sessionId).then(() => {
      setTrackingIdCopied(true);
      setTimeout(() => setTrackingIdCopied(false), 2000);
    }).catch(() => {});
  };

  if (loadingComponent) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!component) {
    return <NotFound message="Component not found" backTo={resourceUrl(broaden(scope)!, 'overview')} backLabel="Back to Project" />;
  }

  const endpointSelector = endpoints.length > 0 && (
    <Select
      size="small"
      value={selectedEndpointId}
      onChange={(e) => setSelectedEndpointId(e.target.value as string)}
      inputProps={{ 'aria-label': 'Endpoint' }}
      sx={{
        fontSize: '0.8125rem',
        '& .MuiOutlinedInput-notchedOutline': { borderRadius: 5 },
        '& .MuiSelect-select': { py: 0.5, px: 1.5 },
        minWidth: 120,
      }}>
      {endpoints.map((ep) => (
        <MenuItem key={ep.id} value={ep.id}>
          {ep.displayName}
        </MenuItem>
      ))}
    </Select>
  );

  const envSelector = environments.length > 0 && (
    <Select
      size="small"
      value={selectedEnvId}
      onChange={(e) => setSelectedEnvId(e.target.value as string)}
      renderValue={(value) => {
        const env = environments.find((e) => e.id === value);
        if (!env) return null;
        return (
          <Stack direction="row" alignItems="center" gap={0.75}>
            <EnvDot orgHandler={scope.org} orgUuid={orgUuid} componentId={component.id ?? ''} versionId={selectedTrackId} envId={env.id} />
            {env.name}
          </Stack>
        );
      }}
      inputProps={{ 'aria-label': 'Environment' }}
      sx={{
        fontSize: '0.8125rem',
        '& .MuiOutlinedInput-notchedOutline': { borderRadius: 5 },
        '& .MuiSelect-select': { py: 0.5, px: 1.5 },
        minWidth: 140,
      }}>
      {environments.map((env) => (
        <MenuItem key={env.id} value={env.id}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <EnvDot orgHandler={scope.org} orgUuid={orgUuid} componentId={component.id ?? ''} versionId={selectedTrackId} envId={env.id} />
            {env.name}
          </Stack>
        </MenuItem>
      ))}
    </Select>
  );

  const extra = (
    <Stack direction="row" gap={1}>
      {envSelector}
      {endpointSelector}
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {tracks.length > 0 && (
        <DeploymentTrackBar
          tracks={tracks}
          selectedId={selectedTrackId}
          onChange={setSelectedTrackId}
          orgHandler={scope.org}
          projectHandler={project?.handler ?? scope.project}
          componentHandler={component.handler}
          extra={extra}
        />
      )}

      {/* Scrollable content area */}
      <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <PageContent sx={{ overflow: 'visible', height: 'auto' }}>
        {/* Page title */}
        <Typography variant="h1" sx={{ mb: 0.5 }}>
          API Chat
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Powered by Azure OpenAI
        </Typography>

        {/* Welcome card */}
        <Box sx={{ mb: 3, maxWidth: 640, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flexShrink: 0 }}>
            <AIWelcomeIcon width={72} height={72} />
          </Box>
          <Box
            sx={{
              position: 'relative',
              flex: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 2,
              bgcolor: 'background.paper',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: '-11px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: 0,
                height: 0,
                borderTop: '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderRight: (theme) => `11px solid ${theme.palette.divider}`,
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                left: '-9px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: 0,
                height: 0,
                borderTop: '9px solid transparent',
                borderBottom: '9px solid transparent',
                borderRight: (theme) => `9px solid ${theme.palette.background.paper}`,
              },
            }}>
            <Typography variant="body1" fontWeight={600} sx={{ mb: 0.5 }}>
              Your API is now equipped with an Intelligent Agent!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Effortlessly engage with your APIs in natural language with our API Chat Agent powered by Azure OpenAI&apos;s cutting-edge language models.
            </Typography>
          </Box>
        </Box>

        {/* Sample query cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {SAMPLE_QUERIES.map(({ title, query }) => (
            <Grid key={title} size={{ xs: 12, md: 4 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%', pb: '16px !important' }}>
                  <Typography variant="body2" fontWeight={600}>
                    {title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                    {query}
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={isAiCopilotLoading || isStreaming}
                      onClick={() => handleSend(query)}
                      sx={{ minWidth: 80 }}>
                      Execute
                    </Button>
                    <Tooltip title="Copy query">
                      <IconButton
                        size="small"
                        onClick={() => navigator.clipboard.writeText(query).catch(() => {})}
                        aria-label="Copy query">
                        <Copy size={16} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Conversation messages */}
        {messages.map((msg) => {
          if (msg.fromUser) {
            return (
              <Box key={msg.id} sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Box
                  sx={(theme) => ({
                    maxWidth: '80%',
                    bgcolor: theme.palette.warning.light + '33',
                    borderRadius: '16px 16px 4px 16px',
                    px: 2,
                    py: 1,
                  })}>
                  <Typography variant="body2">{String(msg.content.data)}</Typography>
                </Box>
              </Box>
            );
          }
          if (msg.type === MessageType.APICHAT) {
            return <Box key={msg.id} sx={{ mb: 2 }}><ApiChatMessage executionResults={msg.content.data as ApiChatExecutionResult[]} /></Box>;
          }
          return (
            <Box key={msg.id} sx={{ mb: 2, bgcolor: 'action.hover', borderRadius: 2, px: 2, py: 1.5 }}>
              <Typography variant="body2">{msg.content.data as string}</Typography>
            </Box>
          );
        })}

        {isAiCopilotLoading && (
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">Working on it...</Typography>
          </Stack>
        )}

      </PageContent>
      </Box>

      {/* Input bar */}
      <Box sx={{ flexShrink: 0 }}>
      <Box sx={{ maxWidth: '1400px', mx: 'auto', width: '100%', px: 8, pb: 4, pt: 1 }}>
        <Alert severity="warning" onClose={messageSendingError ? () => setMessageSendingError('') : undefined} sx={{ mb: 1 }}>
          {messageSendingError && <Typography variant="body2" sx={{ mb: 0.5 }}>{messageSendingError}</Typography>}
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Typography variant="caption" sx={{ flex: 1, wordBreak: 'break-all' }}>
              Tracking ID: {trackingId || sessionId}
            </Typography>
            <Tooltip title={trackingIdCopied ? 'Copied!' : 'Copy'}>
              <IconButton size="small" onClick={handleCopyTrackingId} sx={{ p: 0.25, flexShrink: 0 }} aria-label="Copy tracking ID">
                <Copy size={12} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Alert>
        <TextField
          fullWidth
          size="small"
          placeholder="Send Query"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isAiCopilotLoading || isStreaming}
          inputProps={{ maxLength: 500 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  variant="contained"
                  size="small"
                  disabled={!inputValue.trim() || isAiCopilotLoading || isStreaming}
                  onClick={() => handleSend(inputValue)}
                  startIcon={<SendHorizontal size={14} />}
                  sx={{ borderRadius: 1 }}>
                  Execute
                </Button>
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 0.75 }}>
          It is prudent to exercise a degree of caution and thoughtfulness, as language models may exhibit some degree of unpredictability at times.
        </Typography>
      </Box>
      </Box>
    </Box>
  );
}
